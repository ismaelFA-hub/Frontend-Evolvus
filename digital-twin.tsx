/**
 * Evolvus Core Quantum — Módulo 12: Gêmeo Digital Quântico
 *
 * Simula milhares de cenários de preço futuros com GBM + Jump-Diffusion.
 * Mostra: VaR95/99, CVaR95, drawdown esperado, percentis P5/P50/P95,
 * distribuição final de preços.
 *
 * Rota: POST /api/risk-metrics
 */

import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ─── Validation constants ─────────────────────────────────────────────
const MIN_HORIZON = 1;
const MAX_HORIZON = 168;   // 7 days in hours
const MIN_PATHS   = 100;
const MAX_PATHS   = 10_000;
const MAX_JUMP_INTENSITY = 50;

// ─── Types ────────────────────────────────────────────────────────────

interface PercentilesAtStep { p5: number; p25: number; p50: number; p75: number; p95: number }

interface RiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  expectedDrawdown: number;
  maxSimDrawdown: number;
  probabilityOfLoss: number;
}

interface DigitalTwinResult {
  symbol: string;
  currentPrice: number;
  horizon: number;
  paths: number;
  jumpIntensity: number;
  risk: RiskMetrics;
  percentileCurves: PercentilesAtStep[];
  finalDistribution: { p5: number; p25: number; p50: number; p75: number; p95: number };
  volatilityAnnual: number;
  driftAnnual: number;
  computedInMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "DOGE"];
const INTERVALS = ["1h", "4h", "1d"] as const;

// ─── Sparkline ────────────────────────────────────────────────────────

function SparkLine({ curves }: { curves: PercentilesAtStep[] }) {
  if (!curves || curves.length === 0) return null;
  const HEIGHT = 100;
  const BAR_W = 4;
  const GAP = 1;
  const maxPts = 50;
  const step = Math.max(1, Math.floor(curves.length / maxPts));
  const sampled = curves.filter((_, i) => i % step === 0);
  const allVals = sampled.flatMap((c) => [c.p5, c.p50, c.p95]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const bh = (v: number) => Math.max(2, ((v - minV) / range) * HEIGHT);
  return (
    <View style={{ height: HEIGHT + 8, flexDirection: "row", alignItems: "flex-end", gap: GAP, overflow: "hidden" }}>
      {sampled.map((c, i) => (
        <View key={i} style={{ flexDirection: "column", alignItems: "center", gap: 1 }}>
          <View style={{ width: BAR_W, height: bh(c.p95), borderRadius: 2, backgroundColor: C.success, opacity: 0.5 }} />
          <View style={{ width: BAR_W, height: bh(c.p50), borderRadius: 2, backgroundColor: "#8BC34A" }} />
          <View style={{ width: BAR_W, height: bh(c.p5), borderRadius: 2, backgroundColor: C.danger, opacity: 0.5 }} />
        </View>
      ))}
    </View>
  );
}

// ─── Risk gauge ───────────────────────────────────────────────────────

function RiskGauge({ value, label, color, tooltip }: { value: number; label: string; color: string; tooltip?: string }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <Pressable style={rg.item} onPress={() => setShowTip((v) => !v)}>
      <Text style={[rg.value, { color }]}>{value.toFixed(1)}%</Text>
      <Text style={rg.label}>{label} {tooltip ? "ℹ️" : ""}</Text>
      {showTip && tooltip && (
        <View style={rg.tooltip}>
          <Text style={rg.tooltipText}>{tooltip}</Text>
        </View>
      )}
    </Pressable>
  );
}
const rg = StyleSheet.create({
  item:        { alignItems: "center", flex: 1 },
  value:       { fontSize: 20, fontWeight: "800" },
  label:       { fontSize: 10, color: Colors.dark.textSecondary, textAlign: "center", marginTop: 2 },
  tooltip:     { position: "absolute", bottom: -50, left: -40, right: -40, backgroundColor: "#222", borderRadius: 8, padding: 6, zIndex: 10 },
  tooltipText: { fontSize: 10, color: "#ddd", textAlign: "center" },
});

// ─── Main screen ──────────────────────────────────────────────────────

export default function DigitalTwinScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState<"1h" | "4h" | "1d">("1h");
  const [horizon, setHorizon] = useState("24");
  const [paths, setPaths] = useState("500");
  const [jumpIntensity, setJumpIntensity] = useState("0");

  const [result, setResult] = useState<DigitalTwinResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);

    // ── Input validation ──────────────────────────────────────────────
    const h = parseInt(horizon, 10);
    const p = parseInt(paths, 10);
    const ji = parseFloat(jumpIntensity);
    if (!Number.isInteger(h) || h < MIN_HORIZON || h > MAX_HORIZON) {
      setError(`Horizonte deve ser um número inteiro entre ${MIN_HORIZON} e ${MAX_HORIZON} (7 dias).`);
      return;
    }
    if (!Number.isInteger(p) || p < MIN_PATHS || p > MAX_PATHS) {
      setError(`Caminhos deve ser um número inteiro entre ${MIN_PATHS} e ${MAX_PATHS.toLocaleString()}.`);
      return;
    }
    if (isNaN(ji) || ji < 0 || ji > MAX_JUMP_INTENSITY) {
      setError(`Jumps/ano deve ser um número entre 0 e ${MAX_JUMP_INTENSITY}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/risk-metrics", {
        symbol, interval, horizon: h, paths: p, jumpIntensity: ji,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as DigitalTwinResult;
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, horizon, paths, jumpIntensity]);

  const risk = result?.risk;

  return (
    <View style={[s.root, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>{t('digitalTwin')}</Text>
          <Text style={s.subtitle}>Simulação GBM + Jump-Diffusion</Text>
        </View>
        <Ionicons name="pulse-outline" size={24} color={planTheme.primary} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Symbol selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
          {SYMBOLS.map((sym) => (
            <Pressable
              key={sym}
              style={[s.chip, symbol === sym && { backgroundColor: planTheme.primary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSymbol(sym); }}
            >
              <Text style={[s.chipText, symbol === sym && { color: "#fff" }]}>{sym}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Interval */}
        <View style={s.tabRow}>
          {INTERVALS.map((ivl) => (
            <Pressable
              key={ivl}
              style={[s.tabBtn, interval === ivl && { backgroundColor: planTheme.primary + "33", borderColor: planTheme.primary }]}
              onPress={() => setInterval(ivl)}
            >
              <Text style={[s.tabText, interval === ivl && { color: planTheme.primary }]}>{ivl}</Text>
            </Pressable>
          ))}
        </View>

        {/* Params */}
        <View style={s.card}>
          <Text style={s.cardTitle}>⚙️ Parâmetros</Text>
          <View style={s.paramRow}>
            <View style={s.paramField}>
              <Text style={s.paramLabel}>Horizonte (steps)</Text>
              <TextInput
                style={s.paramInput}
                value={horizon}
                onChangeText={setHorizon}
                keyboardType="number-pad"
                placeholderTextColor={C.textTertiary}
                selectionColor={planTheme.primary}
              />
            </View>
            <View style={s.paramField}>
              <Text style={s.paramLabel}>Caminhos</Text>
              <TextInput
                style={s.paramInput}
                value={paths}
                onChangeText={setPaths}
                keyboardType="number-pad"
                placeholderTextColor={C.textTertiary}
                selectionColor={planTheme.primary}
              />
            </View>
            <View style={s.paramField}>
              <Text style={s.paramLabel}>Jumps/ano</Text>
              <TextInput
                style={s.paramInput}
                value={jumpIntensity}
                onChangeText={setJumpIntensity}
                keyboardType="decimal-pad"
                placeholderTextColor={C.textTertiary}
                selectionColor={planTheme.primary}
              />
            </View>
          </View>
        </View>

        {/* Run button */}
        <Pressable
          style={[s.runBtn, { backgroundColor: planTheme.primary }]}
          onPress={runSimulation}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="flash-outline" size={18} color="#fff" /><Text style={s.runBtnText}>Simular {paths} Cenários</Text></>
          }
        </Pressable>

        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <>
            {/* Price projection chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📈 Projeção de Preço — {result.symbol}/USDT</Text>
              <SparkLine curves={result.percentileCurves} />
              <View style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: C.success, opacity: 0.7 }]} /><Text style={s.legendLabel}>P95</Text>
                <View style={[s.legendDot, { backgroundColor: "#8BC34A" }]} /><Text style={s.legendLabel}>P50</Text>
                <View style={[s.legendDot, { backgroundColor: C.danger, opacity: 0.7 }]} /><Text style={s.legendLabel}>P5</Text>
              </View>
            </View>

            {/* VaR / CVaR */}
            {risk && (
              <View style={s.card}>
                <Text style={s.cardTitle}>🛡️ Métricas de Risco (toque para explicação)</Text>
                <View style={s.riskRow}>
                  <RiskGauge value={risk.var95} label="VaR 95%" color={C.warning} tooltip="Com 95% de confiança, a perda máxima em 1 candle não excede este valor." />
                  <View style={s.riskDivider} />
                  <RiskGauge value={risk.var99} label="VaR 99%" color={C.danger} tooltip="Com 99% de confiança, a perda máxima em 1 candle não excede este valor." />
                  <View style={s.riskDivider} />
                  <RiskGauge value={risk.cvar95} label="CVaR 95%" color={C.danger} tooltip="Média das perdas nos 5% piores cenários. Mais conservador que VaR." />
                </View>
                <View style={[s.riskRow, { marginTop: 14 }]}>
                  <RiskGauge value={risk.expectedDrawdown} label="Drawdown Esp." color={C.warning} tooltip="Queda média esperada do pico ao vale ao longo de todos os caminhos simulados." />
                  <View style={s.riskDivider} />
                  <RiskGauge value={risk.maxSimDrawdown} label="Drawdown Máx." color={C.danger} tooltip="O pior drawdown observado em qualquer caminho simulado." />
                  <View style={s.riskDivider} />
                  <RiskGauge value={risk.probabilityOfLoss * 100} label="Prob. de Perda" color={C.textSecondary} tooltip="Percentual de caminhos que terminaram com preço abaixo do preço de entrada." />
                </View>
              </View>
            )}

            {/* Final distribution */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📊 Distribuição Final de Preço</Text>
              {[
                { label: "P5 (pessimista)", value: result.finalDistribution.p5, color: C.danger },
                { label: "P25", value: result.finalDistribution.p25, color: C.warning },
                { label: "P50 (mediana)", value: result.finalDistribution.p50, color: "#8BC34A" },
                { label: "P75", value: result.finalDistribution.p75, color: C.success },
                { label: "P95 (otimista)", value: result.finalDistribution.p95, color: C.success },
              ].map((row) => (
                <View key={row.label} style={s.distRow}>
                  <Text style={s.distLabel}>{row.label}</Text>
                  <Text style={[s.distValue, { color: row.color }]}>
                    ${row.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              ))}
            </View>

            {/* Model info */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🔬 Parâmetros do Modelo</Text>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Volatilidade Anual</Text>
                <Text style={s.infoValue}>{(result.volatilityAnnual * 100).toFixed(1)}%</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Regime de Volatilidade</Text>
                <Text style={[s.infoValue, {
                  color: result.volatilityAnnual > 1.5 ? C.danger
                       : result.volatilityAnnual > 0.8 ? C.warning
                       : result.volatilityAnnual > 0.4 ? "#8BC34A"
                       : C.success,
                }]}>
                  {result.volatilityAnnual > 1.5 ? "🔴 Extremo"
                   : result.volatilityAnnual > 0.8 ? "🟠 Alto"
                   : result.volatilityAnnual > 0.4 ? "🟡 Normal"
                   : "🟢 Baixo"}
                </Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Drift Anual</Text>
                <Text style={[s.infoValue, { color: result.driftAnnual >= 0 ? C.success : C.danger }]}>
                  {(result.driftAnnual * 100).toFixed(2)}%
                </Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Preço Atual</Text>
                <Text style={s.infoValue}>${result.currentPrice.toLocaleString()}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Processado em</Text>
                <Text style={s.infoValue}>{result.computedInMs}ms</Text>
              </View>
            </View>
          </>
        )}

        {!result && !loading && !error && (
          <View style={s.emptyState}>
            <Ionicons name="pulse-outline" size={48} color={C.textTertiary} />
            <Text style={s.emptyText}>Configure os parâmetros e clique em Simular</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.background },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  backBtn:      { padding: 4 },
  title:        { fontSize: 18, fontWeight: "700", color: C.text },
  subtitle:     { fontSize: 12, color: C.textSecondary },
  scroll:       { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  chipScroll:   { marginBottom: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, marginRight: 8, borderWidth: 1, borderColor: C.border },
  chipText:     { fontSize: 13, fontWeight: "600", color: C.text },
  tabRow:       { flexDirection: "row", gap: 8, marginBottom: 4 },
  tabBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  tabText:      { fontSize: 13, fontWeight: "600", color: C.textSecondary },
  card:         { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 10 },
  paramRow:     { flexDirection: "row", gap: 8 },
  paramField:   { flex: 1 },
  paramLabel:   { fontSize: 11, color: C.textSecondary, marginBottom: 4 },
  paramInput:   { backgroundColor: C.background, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8, color: C.text, fontSize: 13 },
  runBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  runBtnText:   { fontSize: 15, fontWeight: "700", color: "#fff" },
  errorBox:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.danger + "22", borderRadius: 10, padding: 12 },
  errorText:    { color: C.danger, fontSize: 13, flex: 1 },
  legendRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendLabel:  { fontSize: 11, color: C.textSecondary, marginRight: 8 },
  riskRow:      { flexDirection: "row", alignItems: "center" },
  riskDivider:  { width: 1, height: 40, backgroundColor: C.border },
  distRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  distLabel:    { fontSize: 12, color: C.textSecondary },
  distValue:    { fontSize: 14, fontWeight: "700" },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoLabel:    { fontSize: 12, color: C.textSecondary },
  infoValue:    { fontSize: 13, fontWeight: "600", color: C.text },
  emptyState:   { alignItems: "center", gap: 12, paddingVertical: 48 },
  emptyText:    { fontSize: 14, color: C.textSecondary, textAlign: "center" },
});
