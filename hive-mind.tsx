/**
 * Evolvus Core Quantum — Módulo 11: Mente Colmeia (Hive Mind)
 *
 * Visualiza o consenso agregado dos 35 cérebros de IA para um símbolo.
 * Mostra: hiveScore, sinal, divergência, breakdown por categoria,
 * cérebros mais bullish/bearish, narrativa e histórico.
 *
 * Rotas: GET /api/insights/:symbol?interval=
 *        GET /api/insights/:symbol/history
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator, Switch,
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

interface CategoryConsensus {
  category: string;
  totalBrains: number;
  bullish: number;
  bearish: number;
  neutral: number;
  categoryScore: number;
}

interface BrainSignal {
  brainId: string;
  signal: string;
  score: number;
  weight: number;
  evidence: string;
}

interface HiveInsight {
  symbol: string;
  interval: string;
  hiveScore: number;
  hiveSignal: string;
  divergenceIndex: number;
  participationRate: number;
  activeBrainCount: number;
  categoryBreakdown: CategoryConsensus[];
  topBullishBrains: BrainSignal[];
  topBearishBrains: BrainSignal[];
  narrative: string;
  confluence: string;
  generatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "DOGE", "ADA", "XRP"];
const INTERVALS = ["15m", "1h", "4h", "1d"] as const;

function formatBrainId(id: string): string {
  return id.replace(/_/g, " ");
}

function signalColor(signal: string): string {
  if (signal === "STRONG_BUY" || signal === "BUY") return C.success;
  if (signal === "STRONG_SELL" || signal === "SELL") return C.danger;
  return C.textSecondary;
}

function scoreColor(score: number): string {
  if (score >= 65) return C.success;
  if (score >= 50) return "#8BC34A";
  if (score >= 40) return C.warning;
  return C.danger;
}

function HiveScoreRing({ score, signal }: { score: number; signal: string }) {
  const color = scoreColor(score);
  const bars = 24;
  const filled = Math.round((score / 100) * bars);
  return (
    <View style={ring.container}>
      <View style={ring.orbit}>
        {Array.from({ length: bars }).map((_, i) => {
          const angle = (i / bars) * 360;
          const rad = (angle * Math.PI) / 180;
          const r = 62;
          const x = 78 + r * Math.sin(rad);
          const y = 78 - r * Math.cos(rad);
          return (
            <View
              key={i}
              style={[ring.dot, {
                left: x - 4, top: y - 4,
                backgroundColor: i < filled ? color : C.border,
              }]}
            />
          );
        })}
        <View style={ring.center}>
          <Text style={[ring.scoreText, { color }]}>{score}</Text>
          <Text style={[ring.signalText, { color }]}>{signal.replace("_", " ")}</Text>
        </View>
      </View>
    </View>
  );
}

const ring = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 12 },
  orbit: { width: 156, height: 156, position: "relative" },
  dot: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  center: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  scoreText: { fontSize: 32, fontWeight: "800" },
  signalText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});

// ─── Category bar ─────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CategoryConsensus }) {
  const bullPct = cat.totalBrains > 0 ? (cat.bullish / cat.totalBrains) * 100 : 0;
  const bearPct = cat.totalBrains > 0 ? (cat.bearish / cat.totalBrains) * 100 : 0;
  return (
    <View style={s.catRow}>
      <Text style={s.catLabel}>{cat.category.replace(/_/g, " ")}</Text>
      <View style={s.catBar}>
        <View style={[s.catBull, { flex: bullPct }]} />
        <View style={[s.catBear, { flex: bearPct }]} />
        <View style={[s.catNeutral, { flex: 100 - bullPct - bearPct }]} />
      </View>
      <Text style={[s.catScore, { color: scoreColor(cat.categoryScore) }]}>{cat.categoryScore}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────

export default function HiveMindScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState<"15m" | "1h" | "4h" | "1d">("1h");
  const [insight, setInsight] = useState<HiveInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Community consensus (Sprint 11)
  const [optIn, setOptIn] = useState(false);
  const [optInLoading, setOptInLoading] = useState(false);
  const [community, setCommunity] = useState<{
    bullishPct: number; bearishPct: number; neutralPct: number; participantCount: number; signal: string;
  } | null>(null);

  useEffect(() => {
    apiRequest("GET", "/api/insights/community/opt-in/status")
      .then((r) => r.json())
      .then((d) => setOptIn(!!(d as { optIn: boolean }).optIn))
      .catch(() => {});
  }, []);

  const fetchCommunity = useCallback(async (sym = symbol) => {
    try {
      const res = await apiRequest("GET", `/api/insights/community/${sym}`);
      if (res.ok) setCommunity(await res.json() as typeof community);
    } catch { /* ignore */ }
  }, [symbol]);

  const toggleOptIn = async () => {
    setOptInLoading(true);
    const next = !optIn;
    try {
      await apiRequest("POST", "/api/insights/community/opt-in", { optIn: next });
      setOptIn(next);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { /* ignore */ } finally { setOptInLoading(false); }
  };

  const fetchInsight = useCallback(async (sym = symbol, ivl = interval) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("GET", `/api/insights/${sym}?interval=${ivl}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as HiveInsight;
      setInsight(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  const handleSymbol = (sym: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSymbol(sym);
    fetchInsight(sym, interval);
    fetchCommunity(sym);
  };

  const handleInterval = (ivl: typeof interval) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInterval(ivl);
    fetchInsight(symbol, ivl);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>{t('hiveMind')}</Text>
          <Text style={s.subtitle}>Consenso dos 35 cérebros de IA</Text>
        </View>
        <Ionicons name="git-network-outline" size={24} color={planTheme.primary} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Symbol selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
          {SYMBOLS.map((sym) => (
            <Pressable
              key={sym}
              style={[s.chip, symbol === sym && { backgroundColor: planTheme.primary }]}
              onPress={() => handleSymbol(sym)}
            >
              <Text style={[s.chipText, symbol === sym && { color: "#fff" }]}>{sym}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Interval selector */}
        <View style={s.tabRow}>
          {INTERVALS.map((ivl) => (
            <Pressable
              key={ivl}
              style={[s.tabBtn, interval === ivl && { backgroundColor: planTheme.primary + "33", borderColor: planTheme.primary }]}
              onPress={() => handleInterval(ivl)}
            >
              <Text style={[s.tabText, interval === ivl && { color: planTheme.primary }]}>{ivl}</Text>
            </Pressable>
          ))}
        </View>

        {/* Analyse button + timestamp */}
        <Pressable
          style={[s.analyseBtn, { backgroundColor: planTheme.primary }]}
          onPress={() => fetchInsight()}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="analytics-outline" size={18} color="#fff" /><Text style={s.analyseBtnText}>Analisar Colmeia</Text></>
          }
        </Pressable>

        {lastUpdated && (
          <Text style={{ fontSize: 11, color: C.textTertiary, textAlign: "center", marginTop: 6 }}>
            Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Text>
        )}

        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {insight && (
          <>
            {/* Score ring */}
            <View style={s.card}>
              <HiveScoreRing score={insight.hiveScore} signal={insight.hiveSignal} />
              <View style={s.metaRow}>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Divergência</Text>
                  <Text style={[s.metaValue, { color: insight.divergenceIndex > 0.4 ? C.danger : insight.divergenceIndex > 0.2 ? C.warning : C.success }]}>
                    {(insight.divergenceIndex * 100).toFixed(0)}%
                  </Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Participação</Text>
                  <Text style={[s.metaValue, { color: C.success }]}>{(insight.participationRate * 100).toFixed(0)}%</Text>
                </View>
                <View style={s.metaItem}>
                  <Text style={s.metaLabel}>Cérebros Ativos</Text>
                  <Text style={[s.metaValue, { color: planTheme.primary }]}>{insight.activeBrainCount}</Text>
                </View>
              </View>
            </View>

            {/* Narrative */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📖 Narrativa da Colmeia</Text>
              <Text style={s.narrative}>{insight.narrative}</Text>
              {insight.confluence && (
                <Text style={[s.narrative, { color: planTheme.primary, marginTop: 6 }]}>{insight.confluence}</Text>
              )}
            </View>

            {/* Category breakdown */}
            {insight.categoryBreakdown.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>📊 Por Categoria</Text>
                {insight.categoryBreakdown.map((cat) => (
                  <CategoryRow key={cat.category} cat={cat} />
                ))}
                <View style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: C.success }]} /><Text style={s.legendLabel}>Bullish</Text>
                  <View style={[s.legendDot, { backgroundColor: C.danger }]} /><Text style={s.legendLabel}>Bearish</Text>
                  <View style={[s.legendDot, { backgroundColor: C.border }]} /><Text style={s.legendLabel}>Neutro</Text>
                </View>
              </View>
            )}

            {/* Top bulls */}
            {insight.topBullishBrains.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>🐂 Top Bullish</Text>
                {insight.topBullishBrains.map((b) => (
                  <View key={b.brainId} style={s.brainRow}>
                    <View style={[s.brainDot, { backgroundColor: C.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.brainId}>{formatBrainId(b.brainId)}</Text>
                      <Text style={s.brainEvidence} numberOfLines={1}>{b.evidence}</Text>
                    </View>
                    <Text style={[s.brainScore, { color: C.success }]}>{b.score}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Top bears */}
            {insight.topBearishBrains.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>🐻 Top Bearish</Text>
                {insight.topBearishBrains.map((b) => (
                  <View key={b.brainId} style={s.brainRow}>
                    <View style={[s.brainDot, { backgroundColor: C.danger }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.brainId}>{formatBrainId(b.brainId)}</Text>
                      <Text style={s.brainEvidence} numberOfLines={1}>{b.evidence}</Text>
                    </View>
                    <Text style={[s.brainScore, { color: C.danger }]}>{b.score}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Community consensus — Sprint 11 */}
            {community && community.participantCount >= 5 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>🌐 Consenso da Comunidade</Text>
                <View style={s.communityBarWrap}>
                  <View style={[s.communityBar, { flex: community.bullishPct, backgroundColor: C.success }]} />
                  <View style={[s.communityBar, { flex: community.neutralPct, backgroundColor: C.border }]} />
                  <View style={[s.communityBar, { flex: community.bearishPct, backgroundColor: C.danger }]} />
                </View>
                <View style={s.communityLegend}>
                  <Text style={[s.communityPct, { color: C.success }]}>{community.bullishPct.toFixed(0)}% Bull</Text>
                  <Text style={[s.communityPct, { color: C.textSecondary }]}>{community.neutralPct.toFixed(0)}% Neutro</Text>
                  <Text style={[s.communityPct, { color: C.danger }]}>{community.bearishPct.toFixed(0)}% Bear</Text>
                </View>
                <Text style={s.communityMeta}>{community.participantCount} traders anônimos · K-anonymity protegida</Text>
              </View>
            )}

            <Text style={s.timestamp}>Atualizado: {new Date(insight.generatedAt).toLocaleTimeString()}</Text>
          </>
        )}

        {!insight && !loading && !error && (
          <View style={s.emptyState}>
            <Ionicons name="git-network-outline" size={48} color={C.textTertiary} />
            <Text style={s.emptyText}>Selecione um símbolo e clique em Analisar</Text>
          </View>
        )}

        {/* Opt-in toggle — Sprint 11 */}
        <View style={s.optInCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.optInTitle}>🤝 Compartilhamento Anônimo</Text>
            <Text style={s.optInSub}>
              {optIn
                ? "Seus sinais contribuem para o consenso da comunidade. Identidade protegida."
                : "Ative para contribuir anonimamente e ver o consenso de outros traders."}
            </Text>
          </View>
          {optInLoading
            ? <ActivityIndicator color={C.primary} style={{ marginLeft: 8 }} />
            : (
              <Switch
                value={optIn}
                onValueChange={() => void toggleOptIn()}
                trackColor={{ false: C.border, true: C.primary + "88" }}
                thumbColor={optIn ? C.primary : C.textSecondary}
              />
            )}
        </View>
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
  analyseBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  analyseBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  errorBox:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.danger + "22", borderRadius: 10, padding: 12 },
  errorText:    { color: C.danger, fontSize: 13, flex: 1 },
  card:         { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 10 },
  metaRow:      { flexDirection: "row", justifyContent: "space-around", marginTop: 4 },
  metaItem:     { alignItems: "center" },
  metaLabel:    { fontSize: 11, color: C.textSecondary, marginBottom: 2 },
  metaValue:    { fontSize: 18, fontWeight: "700" },
  narrative:    { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  catRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  catLabel:     { fontSize: 11, color: C.textSecondary, width: 90, textTransform: "capitalize" },
  catBar:       { flex: 1, flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: C.border },
  catBull:      { backgroundColor: C.success },
  catBear:      { backgroundColor: C.danger },
  catNeutral:   { backgroundColor: C.border },
  catScore:     { fontSize: 12, fontWeight: "700", width: 28, textAlign: "right" },
  legendRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendLabel:  { fontSize: 11, color: C.textSecondary, marginRight: 8 },
  brainRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  brainDot:     { width: 8, height: 8, borderRadius: 4 },
  brainId:      { fontSize: 12, fontWeight: "600", color: C.text, textTransform: "capitalize" },
  brainEvidence:{ fontSize: 11, color: C.textTertiary },
  brainScore:   { fontSize: 14, fontWeight: "700" },
  timestamp:    { fontSize: 11, color: C.textTertiary, textAlign: "center" },
  emptyState:   { alignItems: "center", gap: 12, paddingVertical: 48 },
  emptyText:    { fontSize: 14, color: C.textSecondary, textAlign: "center" },
  // Community consensus
  communityBarWrap: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  communityBar:     { height: "100%" },
  communityLegend:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  communityPct:     { fontSize: 12, fontWeight: "700" },
  communityMeta:    { fontSize: 10, color: C.textSecondary, textAlign: "center" },
  // Opt-in toggle
  optInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  optInTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 3 },
  optInSub:   { fontSize: 11, color: C.textSecondary, lineHeight: 16 },
});
