/**
 * Evolvus Core Quantum — Monte Carlo Simulation Screen
 *
 * Flow:
 *   1. Pick a symbol / interval → POST /api/backtest → get backtestId
 *   2. POST /api/backtest/:id/montecarlo → get MonteCarloResult
 *   3. Display P5 / P50 / P95 equity curves as sparkline bars
 */

import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator,
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

// ─── Types ────────────────────────────────────────────────────────────

interface PercentilesAtTime { p5: number; p25: number; p50: number; p75: number; p95: number }

interface MonteCarloResult {
  backtestId: string;
  symbol: string;
  interval: string;
  initialCapital: number;
  monteCarlo: {
    completedPaths: number;
    percentileCurves: PercentilesAtTime[];
    returnStats: { mean: number; stdDev: number; min: number; max: number };
    risk: {
      var5Percent: number;
      probabilityOfLoss: number;
      maxDrawdown: { p5: number; p50: number; p95: number };
    };
    bestFinalEquity: number;
    worstFinalEquity: number;
    medianFinalEquity: number;
  };
}

// ─── Config options ───────────────────────────────────────────────────

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "DOGE"];
const INTERVALS = ["1h", "4h", "1d"] as const;

// ─── Sparkline visualisation ──────────────────────────────────────────

function MiniChart({ curves, initialCapital }: { curves: PercentilesAtTime[]; initialCapital: number }) {
  if (!curves || curves.length === 0) return null;

  const HEIGHT = 120;
  const BAR_W = 3;
  const GAP = 1;
  const maxPoints = 40;
  const step = Math.max(1, Math.floor(curves.length / maxPoints));
  const sampled = curves.filter((_, i) => i % step === 0);

  const allVals = sampled.flatMap((c) => [c.p5, c.p50, c.p95]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  function barHeight(v: number): number {
    return Math.max(2, ((v - minV) / range) * HEIGHT);
  }
  function barColor(v: number): string {
    const pct = ((v - initialCapital) / initialCapital) * 100;
    if (pct > 20) return C.success;
    if (pct > 0) return "#8BC34A";
    if (pct > -10) return C.warning;
    return C.danger;
  }

  return (
    <View style={{ height: HEIGHT + 8, flexDirection: "row", alignItems: "flex-end", gap: GAP, overflow: "hidden" }}>
      {sampled.map((c, i) => (
        <View key={i} style={{ flexDirection: "column", alignItems: "center", gap: 1 }}>
          {/* P95 bar (tallest) */}
          <View style={{ width: BAR_W, height: barHeight(c.p95), borderRadius: 1, backgroundColor: C.success, opacity: 0.5 }} />
          {/* P50 bar */}
          <View style={{ width: BAR_W, height: barHeight(c.p50), borderRadius: 1, backgroundColor: barColor(c.p50) }} />
          {/* P5 bar (bottom) */}
          <View style={{ width: BAR_W, height: barHeight(c.p5), borderRadius: 1, backgroundColor: C.danger, opacity: 0.5 }} />
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────

export default function MonteCarloScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState<typeof INTERVALS[number]>("1h");
  const [paths, setPaths] = useState(500);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"idle" | "backtest" | "montecarlo">("idle");
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Step 1: Run backtest
      setStep("backtest");
      const btRes = await apiRequest("POST", "/api/backtest", {
        symbol,
        interval,
        leverage: 1,
        initialCapital: 10000,
      });
      if (!btRes.ok) {
        const msg = await btRes.json().then((d: { message?: string }) => d.message).catch(() => btRes.statusText);
        throw new Error(`Backtest falhou (${btRes.status}): ${msg}`);
      }
      const btData = await btRes.json() as { backtestId: string };
      const backtestId = btData.backtestId;

      // Step 2: Run Monte Carlo
      setStep("montecarlo");
      const mcRes = await apiRequest("POST", `/api/backtest/${backtestId}/montecarlo`, {
        paths,
        blockSize: 5,
        equityPoints: 40,
      });
      if (!mcRes.ok) {
        const msg = await mcRes.json().then((d: { message?: string }) => d.message).catch(() => mcRes.statusText);
        throw new Error(`Monte Carlo falhou (${mcRes.status}): ${msg}`);
      }
      const mcData = await mcRes.json() as MonteCarloResult;
      setResult(mcData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setStep("idle");
    }
  }, [symbol, interval, paths]);

  function fmt(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }
  function pct(v: number, init: number): string {
    const p = ((v - init) / init) * 100;
    return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
  }

  const mc = result?.monteCarlo;
  const init = result?.initialCapital ?? 10000;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('monteCarlo')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Config card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configuração</Text>

          <Text style={styles.label}>Símbolo</Text>
          <View style={styles.pillRow}>
            {SYMBOLS.map((s) => (
              <Pressable
                key={s}
                style={[styles.pill, symbol === s && { backgroundColor: planTheme.primary }]}
                onPress={() => { Haptics.selectionAsync(); setSymbol(s); }}
              >
                <Text style={[styles.pillText, symbol === s && { color: "#000" }]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Intervalo</Text>
          <View style={styles.pillRow}>
            {INTERVALS.map((iv) => (
              <Pressable
                key={iv}
                style={[styles.pill, interval === iv && { backgroundColor: planTheme.primary }]}
                onPress={() => { Haptics.selectionAsync(); setInterval(iv); }}
              >
                <Text style={[styles.pillText, interval === iv && { color: "#000" }]}>{iv}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 12 }]}>Simulações</Text>
          <View style={styles.pillRow}>
            {[200, 500, 1000].map((p) => (
              <Pressable
                key={p}
                style={[styles.pill, paths === p && { backgroundColor: planTheme.primary }]}
                onPress={() => { Haptics.selectionAsync(); setPaths(p); }}
              >
                <Text style={[styles.pillText, paths === p && { color: "#000" }]}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.runBtn, { backgroundColor: planTheme.primary }, loading && { opacity: 0.6 }]}
            onPress={run}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="play" size={18} color="#000" />
            )}
            <Text style={styles.runBtnText}>
              {loading
                ? step === "backtest" ? "Rodando backtest…" : "Simulando caminhos…"
                : "Executar Simulação"}
            </Text>
          </Pressable>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>

        {/* Results */}
        {mc && result && (
          <>
            {/* Chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Curvas de Equity — {result.symbol} {result.interval}</Text>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
                {[
                  { label: "P95 (Optimista)", color: C.success },
                  { label: "P50 (Mediana)", color: planTheme.primary },
                  { label: "P5 (Pessimista)", color: C.danger },
                ].map((l) => (
                  <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: l.color }} />
                    <Text style={styles.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>
              <MiniChart curves={mc.percentileCurves} initialCapital={init} />
              <View style={styles.divider} />
              <Text style={styles.paths}>{mc.completedPaths.toLocaleString()} caminhos simulados</Text>
            </View>

            {/* Percentile outcomes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Equity Final</Text>
              <View style={styles.row3}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: C.success }]}>{fmt(mc.bestFinalEquity)}</Text>
                  <Text style={styles.statLabel}>Melhor</Text>
                  <Text style={[styles.statSub, { color: C.success }]}>{pct(mc.bestFinalEquity, init)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: planTheme.primary }]}>{fmt(mc.medianFinalEquity)}</Text>
                  <Text style={styles.statLabel}>Mediana P50</Text>
                  <Text style={[styles.statSub, { color: planTheme.primary }]}>{pct(mc.medianFinalEquity, init)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: C.danger }]}>{fmt(mc.worstFinalEquity)}</Text>
                  <Text style={styles.statLabel}>Pior</Text>
                  <Text style={[styles.statSub, { color: C.danger }]}>{pct(mc.worstFinalEquity, init)}</Text>
                </View>
              </View>
            </View>

            {/* Risk metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Métricas de Risco</Text>
              <View style={styles.riskGrid}>
                <View style={styles.riskItem}>
                  <Text style={styles.riskValue}>{(mc.risk.probabilityOfLoss * 100).toFixed(1)}%</Text>
                  <Text style={styles.riskLabel}>Prob. de Perda</Text>
                </View>
                <View style={styles.riskItem}>
                  <Text style={[styles.riskValue, { color: C.danger }]}>{fmt(mc.risk.var5Percent)}</Text>
                  <Text style={styles.riskLabel}>VaR 5%</Text>
                </View>
                <View style={styles.riskItem}>
                  <Text style={[styles.riskValue, { color: C.danger }]}>-{mc.risk.maxDrawdown.p50.toFixed(1)}%</Text>
                  <Text style={styles.riskLabel}>Max DD P50</Text>
                </View>
                <View style={styles.riskItem}>
                  <Text style={styles.riskValue}>{mc.returnStats.mean.toFixed(1)}%</Text>
                  <Text style={styles.riskLabel}>Retorno Médio</Text>
                </View>
                <View style={styles.riskItem}>
                  <Text style={styles.riskValue}>±{mc.returnStats.stdDev.toFixed(1)}%</Text>
                  <Text style={styles.riskLabel}>Desvio Padrão</Text>
                </View>
                <View style={styles.riskItem}>
                  <Text style={[styles.riskValue, { color: C.danger }]}>-{mc.risk.maxDrawdown.p5.toFixed(1)}%</Text>
                  <Text style={styles.riskLabel}>Max DD P5</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  scroll: { paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, marginBottom: 12 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, marginBottom: 8 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, marginTop: 16 },
  runBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#000" },
  errorText: { color: C.danger, fontSize: 13, marginTop: 10, textAlign: "center" },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },
  paths: { fontSize: 12, color: C.textTertiary, textAlign: "center" },
  legendText: { fontSize: 11, color: C.textSecondary },
  row3: { flexDirection: "row", justifyContent: "space-between" },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  statSub: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  riskGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  riskItem: { width: "30%", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, padding: 10, gap: 4 },
  riskValue: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  riskLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, textAlign: "center" },
});
