/**
 * Evolvus Core Quantum — Market Regime Detector
 *
 * Detecta o regime atual de mercado de qualquer par via análise de 100 velas.
 * - Regime: BULLISH / BEARISH / RANGING / VOLATILE
 * - Tendência: UPTREND / DOWNTREND / SIDEWAYS
 * - Volatilidade: HIGH / NORMAL / LOW
 * - Força do sinal (0-100)
 * - Estratégias recomendadas para o regime
 *
 * Rota: GET /api/ai/regime/:symbol?interval=1h&limit=100
 */

import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput,
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

interface RegimeResult {
  symbol: string;
  interval: string;
  candlesAnalyzed: number;
  regime: "BULLISH" | "BEARISH" | "RANGING" | "VOLATILE";
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
  volatility: "HIGH" | "NORMAL" | "LOW";
  strength: number;
  confidence: number;
  description: string;
  recommendedStrategies: string[];
  indicators: {
    adx?: number;
    atr?: number;
    rsiAvg?: number;
    emaSlope?: number;
    bollingerWidth?: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function regimeColor(r: RegimeResult["regime"]): string {
  if (r === "BULLISH") return C.success;
  if (r === "BEARISH") return C.danger;
  if (r === "VOLATILE") return C.warning;
  return C.textSecondary;
}

function regimeIcon(r: RegimeResult["regime"]): "trending-up" | "trending-down" | "remove" | "flash" {
  if (r === "BULLISH") return "trending-up";
  if (r === "BEARISH") return "trending-down";
  if (r === "VOLATILE") return "flash";
  return "remove";
}

function trendColor(t: RegimeResult["trend"]): string {
  if (t === "UPTREND") return C.success;
  if (t === "DOWNTREND") return C.danger;
  return C.textSecondary;
}

function volColor(v: RegimeResult["volatility"]): string {
  if (v === "HIGH") return C.danger;
  if (v === "LOW") return C.success;
  return C.textSecondary;
}

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

// ─── Strength Gauge ───────────────────────────────────────────────────

function StrengthGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <View style={gauge.container}>
      <View style={gauge.track}>
        <View style={[gauge.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[gauge.label, { color }]}>{fmt(value, 0)}%</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function AIRegimeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary } = usePlanTheme();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeInterval, setTimeInterval] = useState("1h");
  const [result, setResult] = useState<RegimeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiRequest<RegimeResult>(
        "GET",
        `/api/ai/regime/${symbol.toUpperCase()}?interval=${timeInterval}&limit=100`,
      );
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message ?? "Falha ao detectar regime.");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeInterval]);

  const color = result ? regimeColor(result.regime) : primary;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('aiRegime')}</Text>
          <Text style={s.sub}>Identifica o estado atual do mercado via ML</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Config */}
        <View style={[s.form, { borderColor: `${primary}30` }]}>
          <Text style={s.formTitle}>Configuração</Text>
          <Text style={s.label}>Par</Text>
          <TextInput
            style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
            value={symbol}
            onChangeText={t => setSymbol(t.toUpperCase())}
            autoCapitalize="characters"
            placeholderTextColor={C.textSecondary}
          />
          <Text style={s.label}>Intervalo</Text>
          <View style={s.intervalRow}>
            {INTERVALS.map(iv => (
              <Pressable
                key={iv}
                style={[s.intervalBtn, timeInterval === iv && { backgroundColor: primary }]}
                onPress={() => setTimeInterval(iv)}
              >
                <Text style={[s.intervalText, timeInterval === iv && { color: "#000" }]}>{iv}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[s.detectBtn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
            onPress={detect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Ionicons name="scan-outline" size={16} color="#000" />
                <Text style={s.detectBtnText}>Detectar Regime</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Error */}
        {error && (
          <View style={[s.errorBox, { borderColor: `${C.danger}40` }]}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
            <Text style={[s.errorText, { color: C.danger }]}>{error}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <>
            {/* Main regime card */}
            <View style={[s.regimeCard, { borderColor: `${color}40` }]}>
              <View style={s.regimeHeader}>
                <Ionicons name={regimeIcon(result.regime)} size={32} color={color} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.regimeName, { color }]}>{result.regime}</Text>
                  <Text style={s.regimeSub}>{result.symbol} · {result.interval} · {result.candlesAnalyzed} velas</Text>
                </View>
              </View>
              <Text style={s.description}>{result.description}</Text>
              <Text style={s.strengthLabel}>Força do sinal</Text>
              <StrengthGauge value={result.strength} color={color} />
              <Text style={[s.strengthLabel, { marginTop: 6 }]}>Confiança</Text>
              <StrengthGauge value={result.confidence} color={primary} />
            </View>

            {/* State cards */}
            <View style={s.stateRow}>
              <View style={[s.stateCard, { borderColor: `${trendColor(result.trend)}30` }]}>
                <Text style={[s.stateVal, { color: trendColor(result.trend) }]}>{result.trend}</Text>
                <Text style={s.stateLbl}>Tendência</Text>
              </View>
              <View style={[s.stateCard, { borderColor: `${volColor(result.volatility)}30` }]}>
                <Text style={[s.stateVal, { color: volColor(result.volatility) }]}>{result.volatility}</Text>
                <Text style={s.stateLbl}>Volatilidade</Text>
              </View>
            </View>

            {/* Indicators */}
            {result.indicators && Object.keys(result.indicators).length > 0 && (
              <View style={[s.indicBox, { borderColor: `${primary}20` }]}>
                <Text style={s.indicTitle}>Indicadores técnicos</Text>
                <View style={s.indicGrid}>
                  {result.indicators.adx != null && (
                    <View style={s.indicItem}>
                      <Text style={[s.indicVal, { color: result.indicators.adx > 25 ? C.success : C.textSecondary }]}>
                        {fmt(result.indicators.adx, 1)}
                      </Text>
                      <Text style={s.indicLbl}>ADX</Text>
                    </View>
                  )}
                  {result.indicators.rsiAvg != null && (
                    <View style={s.indicItem}>
                      <Text style={[s.indicVal, {
                        color: result.indicators.rsiAvg > 70 ? C.danger
                          : result.indicators.rsiAvg < 30 ? C.success : C.textSecondary,
                      }]}>
                        {fmt(result.indicators.rsiAvg, 1)}
                      </Text>
                      <Text style={s.indicLbl}>RSI médio</Text>
                    </View>
                  )}
                  {result.indicators.atr != null && (
                    <View style={s.indicItem}>
                      <Text style={s.indicVal}>{fmt(result.indicators.atr, 2)}</Text>
                      <Text style={s.indicLbl}>ATR</Text>
                    </View>
                  )}
                  {result.indicators.bollingerWidth != null && (
                    <View style={s.indicItem}>
                      <Text style={s.indicVal}>{fmt(result.indicators.bollingerWidth, 3)}</Text>
                      <Text style={s.indicLbl}>BB Width</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Recommended strategies */}
            {result.recommendedStrategies?.length > 0 && (
              <View style={[s.stratBox, { borderColor: `${color}30` }]}>
                <Text style={[s.stratTitle, { color }]}>Estratégias recomendadas</Text>
                {result.recommendedStrategies.map((strat, i) => (
                  <View key={i} style={s.stratItem}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={color} />
                    <Text style={s.stratText}>{strat}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {!loading && !result && !error && (
          <View style={s.hint}>
            <Ionicons name="analytics-outline" size={40} color={C.textSecondary} />
            <Text style={s.hintTitle}>Pronto para detectar</Text>
            <Text style={[s.hintSub, { color: C.textSecondary }]}>
              Selecione um par e intervalo, depois clique em Detectar Regime para ver a análise de ML em tempo real.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  content: { padding: 16, gap: 14 },
  form: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  intervalRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  intervalBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1a1a1a" },
  intervalText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  detectBtn: { borderRadius: 10, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 4 },
  detectBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  errorText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13 },
  regimeCard: { backgroundColor: "#111", borderWidth: 2, borderRadius: 16, padding: 16, gap: 10 },
  regimeHeader: { flexDirection: "row", alignItems: "center" },
  regimeName: { fontFamily: "Inter_700Bold", fontSize: 28 },
  regimeSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  description: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  strengthLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  stateRow: { flexDirection: "row", gap: 10 },
  stateCard: { flex: 1, backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  stateVal: { fontFamily: "Inter_700Bold", fontSize: 16 },
  stateLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  indicBox: { backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 14 },
  indicTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text, marginBottom: 10 },
  indicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  indicItem: { width: "47%", backgroundColor: "#1a1a1a", borderRadius: 8, padding: 10, alignItems: "center" },
  indicVal: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  indicLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2 },
  stratBox: { backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  stratTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  stratItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  stratText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1 },
  hint: { alignItems: "center", paddingVertical: 48, gap: 8 },
  hintTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  hintSub: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
});

const gauge = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: { flex: 1, height: 8, backgroundColor: "#222", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  label: { fontFamily: "Inter_700Bold", fontSize: 13, width: 40, textAlign: "right" },
});
