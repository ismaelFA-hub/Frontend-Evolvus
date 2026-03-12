/**
 * Evolvus Core Quantum — Análise de Mercado
 *
 * Análise técnica multi-timeframe por símbolo com IA.
 * - Análise técnica: tendência, suporte, resistência, RSI, MACD
 * - Grid multi-timeframe com sinal e força por período
 * - Sentimento de mercado com score visual
 * - Auto-refresh a cada 30s para o último símbolo analisado
 *
 * Rotas: GET /api/market/analysis/:symbol    — análise técnica
 *        GET /api/market/multi-tf/:symbol    — sinais multi-timeframe
 *        GET /api/market/sentiment/:symbol   — sentimento
 */

import { useState, useCallback, useEffect, useRef } from "react";
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

// ─── Types ────────────────────────────────────────────────────

interface TechnicalAnalysis {
  trend: string;
  support: number;
  resistance: number;
  volume: number;
  rsi: number;
  macd: number;
  recommendation: string;
  confidence: number;
}

type Signal = "BULLISH" | "BEARISH" | "NEUTRAL";
interface TFSignal { signal: Signal; strength: number }
interface MultiTF {
  timeframes: Record<string, TFSignal>;
}

interface Sentiment {
  sentiment: string;
  score: number;
  sources: string[];
}

// ─── Helpers ──────────────────────────────────────────────────

function signalColor(s: Signal) {
  if (s === "BULLISH") return C.success;
  if (s === "BEARISH") return C.danger;
  return C.textSecondary;
}

function signalBg(s: Signal) {
  if (s === "BULLISH") return `${C.success}18`;
  if (s === "BEARISH") return `${C.danger}18`;
  return "#1a1a1a";
}

function fmt(n: number, d = 2) {
  return n?.toLocaleString("en-US", { maximumFractionDigits: d }) ?? "–";
}

// ─── Strength Bar ─────────────────────────────────────────────

function StrengthBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <View style={sb.track}>
      <View style={[sb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function MarketAnalysisScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary } = usePlanTheme();

  const [inputSymbol, setInputSymbol] = useState("BTCUSDT");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
  const [multiTf, setMultiTf] = useState<MultiTF | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyze = useCallback(async (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingAnalysis(true);
    setActiveSymbol(s);

    try {
      const [analysisRes, multiTfRes, sentimentRes] = await Promise.all([
        apiRequest("GET", `/api/market/analysis/${s}`).catch(() => null),
        apiRequest("GET", `/api/market/multi-tf/${s}?interval=1h&limit=100`).catch(() => null),
        apiRequest("GET", `/api/market/sentiment/${s}`).catch(() => null),
      ]);

      if (analysisRes) {
        const d = await analysisRes.json() as TechnicalAnalysis;
        setAnalysis(d);
      }
      if (multiTfRes) {
        const d = await multiTfRes.json() as MultiTF;
        setMultiTf(d);
      }
      if (sentimentRes) {
        const d = await sentimentRes.json() as Sentiment;
        setSentiment(d);
      }
    } catch {
      // keep previous data
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  // Auto-refresh every 30s for active symbol
  useEffect(() => {
    if (!activeSymbol) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      analyze(activeSymbol);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSymbol]);

  const TF_ORDER = ["1m", "5m", "15m", "1h", "4h", "1d"];
  const tfEntries = multiTf?.timeframes
    ? TF_ORDER.map(tf => ({ tf, data: multiTf.timeframes[tf] })).filter(e => e.data)
    : [];

  const sentimentPct = sentiment ? Math.min(100, Math.max(0, (sentiment.score + 1) * 50)) : 50;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('marketAnalysis')}</Text>
          <Text style={s.sub}>Multi-Timeframe IA</Text>
        </View>
        {activeSymbol && !loadingAnalysis && (
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>30s</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Symbol selector */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <Text style={s.cardTitle}>Símbolo</Text>
          <View style={s.searchRow}>
            <TextInput
              style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
              value={inputSymbol}
              onChangeText={t => setInputSymbol(t.toUpperCase())}
              placeholder="BTCUSDT"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="characters"
            />
            <Pressable
              style={[s.analyzeBtn, { backgroundColor: primary, opacity: loadingAnalysis ? 0.6 : 1 }]}
              onPress={() => analyze(inputSymbol)}
              disabled={loadingAnalysis}
            >
              {loadingAnalysis
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={s.analyzeBtnText}>Analisar</Text>}
            </Pressable>
          </View>
        </View>

        {/* Technical analysis */}
        {analysis && (
          <View style={[s.card, { borderColor: `${primary}20` }]}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Análise Técnica</Text>
              {activeSymbol && <Text style={s.symbolTag}>{activeSymbol}</Text>}
            </View>
            <View style={s.trendRow}>
              <Ionicons
                name={analysis.trend?.toLowerCase().includes("up") || analysis.trend?.toLowerCase().includes("bull") ? "trending-up" : "trending-down"}
                size={22}
                color={analysis.trend?.toLowerCase().includes("up") || analysis.trend?.toLowerCase().includes("bull") ? C.success : C.danger}
              />
              <Text style={[s.trendText, {
                color: analysis.trend?.toLowerCase().includes("up") || analysis.trend?.toLowerCase().includes("bull") ? C.success : C.danger
              }]}>
                {analysis.trend ?? "–"}
              </Text>
            </View>
            <View style={s.statsGrid}>
              <View style={s.gridStat}>
                <Text style={s.gridVal}>${fmt(analysis.support)}</Text>
                <Text style={s.gridLbl}>Suporte</Text>
              </View>
              <View style={s.gridStat}>
                <Text style={s.gridVal}>${fmt(analysis.resistance)}</Text>
                <Text style={s.gridLbl}>Resistência</Text>
              </View>
              <View style={s.gridStat}>
                <Text style={[s.gridVal, {
                  color: analysis.rsi > 70 ? C.danger : analysis.rsi < 30 ? C.success : C.text
                }]}>{fmt(analysis.rsi, 1)}</Text>
                <Text style={s.gridLbl}>RSI</Text>
              </View>
              <View style={s.gridStat}>
                <Text style={[s.gridVal, { color: analysis.macd >= 0 ? C.success : C.danger }]}>
                  {analysis.macd >= 0 ? "+" : ""}{fmt(analysis.macd)}
                </Text>
                <Text style={s.gridLbl}>MACD</Text>
              </View>
            </View>
            <View style={s.recRow}>
              <Text style={s.recLabel}>Recomendação:</Text>
              <Text style={[s.recValue, {
                color: analysis.recommendation?.toUpperCase().includes("BUY") || analysis.recommendation?.toUpperCase().includes("COMPRA")
                  ? C.success : analysis.recommendation?.toUpperCase().includes("SELL") || analysis.recommendation?.toUpperCase().includes("VEND")
                  ? C.danger : C.textSecondary
              }]}>{analysis.recommendation ?? "–"}</Text>
              {analysis.confidence != null && (
                <View style={[s.confBadge, { backgroundColor: `${primary}22` }]}>
                  <Text style={[s.confText, { color: primary }]}>{Math.round(analysis.confidence * 100)}%</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Multi-timeframe grid */}
        {tfEntries.length > 0 && (
          <View style={[s.card, { borderColor: `${primary}20` }]}>
            <Text style={s.cardTitle}>Multi-Timeframe</Text>
            <View style={s.tfGrid}>
              {tfEntries.map(({ tf, data }) => (
                <View key={tf} style={[s.tfCell, { backgroundColor: signalBg(data.signal) }]}>
                  <Text style={s.tfLabel}>{tf}</Text>
                  <Text style={[s.tfSignal, { color: signalColor(data.signal) }]}>{data.signal}</Text>
                  <StrengthBar value={data.strength ?? 0} color={signalColor(data.signal)} />
                  <Text style={[s.tfStrength, { color: signalColor(data.signal) }]}>
                    {Math.round((data.strength ?? 0) * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sentiment */}
        {sentiment && (
          <View style={[s.card, { borderColor: `${primary}20` }]}>
            <Text style={s.cardTitle}>Sentimento</Text>
            <View style={s.sentRow}>
              <Text style={s.sentLabel}>{sentiment.sentiment}</Text>
              <Text style={[s.sentScore, {
                color: sentiment.score >= 0 ? C.success : C.danger
              }]}>
                {sentiment.score >= 0 ? "+" : ""}{fmt(sentiment.score, 2)}
              </Text>
            </View>
            <View style={s.sentBar}>
              <View style={[s.sentFill, { width: `${sentimentPct}%` as any, backgroundColor: sentiment.score >= 0 ? C.success : C.danger }]} />
            </View>
            {sentiment.sources?.length > 0 && (
              <Text style={s.sentSources}>Fontes: {sentiment.sources.slice(0, 3).join(", ")}</Text>
            )}
          </View>
        )}

        {/* Empty state */}
        {!analysis && !loadingAnalysis && (
          <View style={s.empty}>
            <Ionicons name="analytics-outline" size={56} color={C.textSecondary} />
            <Text style={s.emptyText}>Digite um símbolo e toque em Analisar</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: `${C.success}15`, borderRadius: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.success },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  symbolTag: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, backgroundColor: "#ffffff10", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  analyzeBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, justifyContent: "center" },
  analyzeBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trendText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridStat: { flex: 1, minWidth: "40%", backgroundColor: "#1a1a1a", borderRadius: 10, padding: 10, alignItems: "center" },
  gridVal: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  gridLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 3 },
  recRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  recValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  tfGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tfCell: { width: "30%", borderRadius: 10, padding: 10, alignItems: "center", gap: 4, flexGrow: 1 },
  tfLabel: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  tfSignal: { fontFamily: "Inter_500Medium", fontSize: 10 },
  tfStrength: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  sentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sentLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  sentScore: { fontFamily: "Inter_700Bold", fontSize: 18 },
  sentBar: { height: 8, backgroundColor: "#1a1a1a", borderRadius: 4, overflow: "hidden" },
  sentFill: { height: "100%", borderRadius: 4 },
  sentSources: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center" },
});

const sb = StyleSheet.create({
  track: { height: 4, backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden", width: "100%", marginTop: 2 },
  fill: { height: "100%", borderRadius: 2 },
});
