import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

const PLAN_ORDER = ["free", "pro", "premium", "enterprise"];
function planGte(user: string, required: string) {
  return PLAN_ORDER.indexOf(user) >= PLAN_ORDER.indexOf(required);
}

// ─── Types (mirrors server/market/sentimentService.ts SentimentAnalysis) ──

interface ApiSentimentAnalysis {
  fundingProxy: { fundingProxy: number; bullConcentration: number; level: string; summary: string };
  oiDivergence: { oiDivergence: number; priceChange: number; regime: string; summary: string };
  reflexivity: { reflexivity: number; phase: string; acceleration: number; summary: string };
  sentimentScore: number;   // -100 to +100
  sentimentSignal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  timestamp: string;
}

/** Map server sentimentScore (-100..+100) to a 0..100 fear/greed index */
function toFearGreed(score: number): number {
  return Math.round(Math.max(0, Math.min(100, (score + 100) / 2)));
}

function signalToLabel(signal: ApiSentimentAnalysis["sentimentSignal"]): string {
  const map: Record<ApiSentimentAnalysis["sentimentSignal"], string> = {
    STRONG_BUY: "Extreme Greed",
    BUY: "Greed",
    NEUTRAL: "Neutral",
    SELL: "Fear",
    STRONG_SELL: "Extreme Fear",
  };
  return map[signal] ?? "Neutral";
}

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB"];

function PlanGate({ required }: { required: string }) {
  const { planTheme } = usePlanTheme();
  return (
    <View style={s.gateOverlay}>
      <Ionicons name="lock-closed" size={28} color={C.textTertiary} />
      <Text style={s.gateTitle}>Requer plano {required.charAt(0).toUpperCase() + required.slice(1)}+</Text>
      <Pressable
        style={[s.gateBtn, { backgroundColor: planTheme.primary }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Text style={s.gateBtnText}>Fazer Upgrade</Text>
      </Pressable>
    </View>
  );
}

function FearGreedGauge({ index, label }: { index: number; label: string }) {
  const bars = [
    { color: C.danger },
    { color: "#FF7043" },
    { color: C.warning },
    { color: "#8BC34A" },
    { color: C.success },
  ];
  const activeBars = Math.ceil((index / 100) * bars.length);
  return (
    <View style={s.gaugeContainer}>
      <Text style={s.gaugeNumber}>{index}</Text>
      <View style={s.gaugeBars}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={[
              s.gaugeBar,
              {
                backgroundColor: i < activeBars ? b.color : C.surface,
                opacity: i < activeBars ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[s.gaugeLabel, { color: index >= 60 ? C.success : index >= 40 ? C.warning : C.danger }]}>
        {label}
      </Text>
    </View>
  );
}

export default function SentimentScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const { t } = useI18n();

  const [symbol, setSymbol] = useState("BTC");
  const [analysis, setAnalysis] = useState<ApiSentimentAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSentiment = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("GET", `/api/market/sentiment/${sym}`);
      const data = await res.json() as ApiSentimentAnalysis;
      setAnalysis(data);
    } catch (err) {
      setError(`Falha ao carregar dados: ${(err as Error).message ?? "Erro de rede"}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSentiment(symbol);
    const id = setInterval(() => fetchSentiment(symbol), 60_000);
    return () => clearInterval(id);
  }, [symbol, fetchSentiment]);

  const fearGreedIndex = analysis ? toFearGreed(analysis.sentimentScore) : 50;
  const fearGreedLabel = analysis ? signalToLabel(analysis.sentimentSignal) : "Neutral";

  const sources = analysis
    ? [
        { label: "Funding Proxy", key: "funding", value: Math.round(((analysis.fundingProxy.fundingProxy + 1) / 2) * 100) },
        { label: "OI Divergence", key: "oi", value: Math.round(((analysis.oiDivergence.oiDivergence + 1) / 2) * 100) },
        { label: "Reflexivity", key: "reflex", value: Math.round(((analysis.reflexivity.reflexivity + 1) / 2) * 100) },
        { label: "Bull Concentration", key: "bull", value: Math.round(analysis.fundingProxy.bullConcentration * 100) },
      ]
    : [];

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('socialSentiment')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Symbol selector */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        {SYMBOLS.map((sym) => (
          <Pressable
            key={sym}
            style={[s.symBtn, symbol === sym && { backgroundColor: planTheme.primary }]}
            onPress={() => { Haptics.selectionAsync(); setSymbol(sym); }}
          >
            <Text style={[s.symBtnText, symbol === sym && { color: "#000" }]}>{sym}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={planTheme.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="alert-circle" size={40} color={C.danger} />
          <Text style={{ color: C.danger, marginTop: 8, textAlign: "center" }}>{error}</Text>
          <Pressable style={[s.retryBtn, { borderColor: planTheme.primary }]} onPress={() => fetchSentiment(symbol)}>
            <Text style={{ color: planTheme.primary, fontWeight: "600" }}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Fear & Greed Gauge */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('fearGreedIndex')}</Text>
          <View style={s.card}>
            <FearGreedGauge index={fearGreedIndex} label={fearGreedLabel} />
          </View>
        </View>

        {/* Signal badge */}
        {analysis && (
          <View style={s.section}>
            <View style={[s.signalBadge, {
              backgroundColor: analysis.sentimentSignal.includes("BUY") ? `${C.success}20` : analysis.sentimentSignal === "NEUTRAL" ? `${C.warning}20` : `${C.danger}20`,
              borderColor: analysis.sentimentSignal.includes("BUY") ? C.success : analysis.sentimentSignal === "NEUTRAL" ? C.warning : C.danger,
            }]}>
              <Text style={[s.signalText, {
                color: analysis.sentimentSignal.includes("BUY") ? C.success : analysis.sentimentSignal === "NEUTRAL" ? C.warning : C.danger,
              }]}>
                {analysis.sentimentSignal.replace("_", " ")} · Score: {analysis.sentimentScore.toFixed(1)}
              </Text>
            </View>
          </View>
        )}

        {/* Source Breakdown */}
        {planGte(planType, "pro") ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('sentimentBySource')}</Text>
            <View style={s.card}>
              {sources.map((src) => (
                <View key={src.key} style={s.sourceRow}>
                  <Text style={s.sourceLabel}>{src.label}</Text>
                  <View style={s.progressBg}>
                    <View
                      style={[
                        s.progressFill,
                        {
                          width: `${src.value}%` as any,
                          backgroundColor: src.value >= 60 ? C.success : src.value >= 40 ? C.warning : C.danger,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.sourceValue}>{src.value}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('sentimentBySource')}</Text>
            <View style={[s.card, s.gateCard]}>
              <PlanGate required="pro" />
            </View>
          </View>
        )}

        {/* Signals detail */}
        {planGte(planType, "pro") && analysis && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Análise Detalhada</Text>
            <View style={s.card}>
              {[
                { label: "Funding Proxy", summary: analysis.fundingProxy.summary, level: analysis.fundingProxy.level },
                { label: "OI Divergence", summary: analysis.oiDivergence.summary, regime: analysis.oiDivergence.regime },
                { label: "Reflexivity", summary: analysis.reflexivity.summary, phase: analysis.reflexivity.phase },
              ].map((item, idx) => (
                <View key={idx} style={[s.sourceRow, { flexDirection: "column", alignItems: "flex-start", marginBottom: 10 }]}>
                  <Text style={[s.sourceLabel, { marginBottom: 2 }]}>{item.label}</Text>
                  <Text style={[s.sourceValue, { flex: 1, color: C.textSecondary, fontSize: 12 }]}>{item.summary}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Trending Topics — gated */}
        {planGte(planType, "premium") ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Trending Topics</Text>
            <View style={s.card}>
              <View style={s.topicsWrap}>
                {(["#BTC", "#Reflexivity", "#FundingRates", "#OIContra", "#LongSqueeze"]).map((topic, i) => (
                  <View key={i} style={s.topicChip}>
                    <Text style={s.topicText}>{topic}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Trending Topics</Text>
            <View style={[s.card, s.gateCard]}>
              <PlanGate required="premium" />
            </View>
          </View>
        )}
      </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, flex: 1, textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  gateCard: { minHeight: 120, justifyContent: "center", alignItems: "center" },
  // Gauge
  gaugeContainer: { alignItems: "center", paddingVertical: 8 },
  gaugeNumber: { fontFamily: "Inter_700Bold", fontSize: 56, color: C.text },
  gaugeBars: { flexDirection: "row", gap: 6, marginVertical: 12 },
  gaugeBar: { flex: 1, height: 12, borderRadius: 6, minWidth: 40 },
  gaugeLabel: { fontFamily: "Inter_700Bold", fontSize: 18 },
  // Sources
  sourceRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sourceLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, width: 70 },
  progressBg: { flex: 1, height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: "hidden", marginHorizontal: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  sourceValue: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text, width: 38, textAlign: "right" },
  // Asset cards
  hScroll: { paddingBottom: 4, gap: 10 },
  assetCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    width: 90,
    borderWidth: 1,
    borderColor: C.border,
  },
  assetSymbol: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text, marginBottom: 8 },
  scoreCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  scoreNum: { fontFamily: "Inter_700Bold", fontSize: 16 },
  assetMentions: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  assetChange: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  // Topics
  topicsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topicChip: {
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  topicText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.secondary },
  // Whale
  whaleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  whaleIconWrap: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 10 },
  whaleInfo: { flex: 1 },
  whaleTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  tokenBadge: { backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tokenBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11, color: C.accent },
  whaleAmount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  whaleRoute: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  whaleTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  // PlanGate
  gateOverlay: { alignItems: "center", paddingVertical: 16, gap: 10 },
  gateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gateBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  gateBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  // Symbol selector
  symBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  symBtnText: { fontSize: 13, fontWeight: "600", color: C.text },
  // Signal badge
  signalBadge: { borderRadius: 8, borderWidth: 1, padding: 10, alignItems: "center" },
  signalText: { fontSize: 14, fontWeight: "700" },
  // Retry
  retryBtn: { marginTop: 12, borderWidth: 1, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
});
