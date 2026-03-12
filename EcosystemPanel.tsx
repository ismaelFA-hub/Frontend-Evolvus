/**
 * EcosystemPanel — Unified Chart Ecosystem Intelligence
 *
 * Integrates 4 live service layers into the asset chart:
 *   💡 Brain Score  — HiveMind 35-brain AI consensus
 *   ⚡ Regime       — Transition detector early-warning
 *   💙 Sentimento   — News + social sentiment score
 *   🌐 Social       — Reddit + Telegram public signals
 *
 * Rules:
 *   • Maximum 2 layers active simultaneously
 *   • Each layer has its own fetch + detail panel
 *   • Overlay data pushed to parent via onOverlayUpdate()
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;
const MAX_ACTIVE = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OverlayData {
  brain: { score: number; signal: string } | null;
  regime: { urgency: string; direction: string } | null;
  sentiment: { score: number } | null;
  social: { bullish: number; bearish: number } | null;
}

interface HiveInsight {
  hiveScore: number;
  hiveSignal: string;
  divergenceIndex: number;
  activeBrainCount: number;
  categoryBreakdown: { category: string; bullish: number; bearish: number; totalBrains: number; categoryScore: number }[];
  topBullishBrains: { brainId: string; score: number; evidence: string }[];
  topBearishBrains: { brainId: string; score: number; evidence: string }[];
  narrative: string;
  transitionWarning?: {
    urgency: string;
    precursor: string;
    candlesUntilTransition: number;
    likelyNewDirection: string;
    confidence: number;
  };
}

interface SentimentData {
  sentimentScore: number;
  label: string;
  narrative?: string;
  sources?: { name: string; score: number; weight: number }[];
}

interface SocialData {
  reddit?: { bullishCount: number; bearishCount: number; avgScore: number };
  telegram?: { bullishCount: number; bearishCount: number };
  combined?: { bullishPct: number; bearishPct: number; neutralPct: number };
}

// ─── Layer Config ─────────────────────────────────────────────────────────────

type LayerId = "brain" | "regime" | "sentiment" | "social";

interface LayerConfig {
  id: LayerId;
  label: string;
  icon: string;
  color: string;
  emoji: string;
}

const LAYERS: LayerConfig[] = [
  { id: "brain",     label: "Brain Score", icon: "pulse-outline",      color: "#7B61FF", emoji: "💡" },
  { id: "regime",    label: "Regime",      icon: "warning-outline",    color: "#F59E0B", emoji: "⚡" },
  { id: "sentiment", label: "Sentimento",  icon: "heart-outline",      color: "#00D4AA", emoji: "💙" },
  { id: "social",    label: "Social",      icon: "globe-outline",      color: "#3B82F6", emoji: "🌐" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signalColor(sig: string) {
  if (!sig) return C.textSecondary;
  const s = sig.toUpperCase();
  if (s.includes("BUY")) return C.success;
  if (s.includes("SELL")) return C.danger;
  return C.textSecondary;
}

function urgencyColor(u: string) {
  switch (u?.toUpperCase()) {
    case "CRITICAL": return C.danger;
    case "HIGH":     return "#EF4444";
    case "MEDIUM":   return C.warning;
    default:         return C.textSecondary;
  }
}

function sentimentLabel(score: number) {
  if (score >= 0.6)  return "Muito Bullish";
  if (score >= 0.2)  return "Bullish";
  if (score <= -0.6) return "Muito Bearish";
  if (score <= -0.2) return "Bearish";
  return "Neutro";
}

function formatBrainId(id: string) {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Detail Panels ────────────────────────────────────────────────────────────

function BrainPanel({ data }: { data: HiveInsight }) {
  const scoreColor =
    data.hiveScore >= 65 ? C.success :
    data.hiveScore >= 45 ? C.warning : C.danger;

  return (
    <View style={p.card}>
      <View style={p.panelHeader}>
        <Text style={p.panelTitle}>💡 Brain Score</Text>
        <View style={[p.signalBadge, { backgroundColor: signalColor(data.hiveSignal) + "22", borderColor: signalColor(data.hiveSignal) }]}>
          <Text style={[p.signalText, { color: signalColor(data.hiveSignal) }]}>{data.hiveSignal?.replace(/_/g, " ")}</Text>
        </View>
      </View>

      <View style={p.scoreRow}>
        <Text style={[p.bigScore, { color: scoreColor }]}>{data.hiveScore}</Text>
        <View style={p.scoreInfo}>
          <Text style={p.scoreLabel}>{data.activeBrainCount} cérebros ativos</Text>
          <Text style={p.scoreLabel}>Div: {(data.divergenceIndex * 100).toFixed(0)}%</Text>
        </View>
        <View style={p.scoreTrack}>
          <View style={[p.scoreFill, { width: `${data.hiveScore}%`, backgroundColor: scoreColor }]} />
        </View>
      </View>

      {data.categoryBreakdown?.slice(0, 3).map((cat) => {
        const bullPct = cat.totalBrains > 0 ? (cat.bullish / cat.totalBrains) * 100 : 0;
        const bearPct = cat.totalBrains > 0 ? (cat.bearish / cat.totalBrains) * 100 : 0;
        return (
          <View key={cat.category} style={p.catRow}>
            <Text style={p.catLabel}>{cat.category.replace(/_/g, " ")}</Text>
            <View style={p.catBar}>
              <View style={[p.catFill, { width: `${bullPct}%`, backgroundColor: C.success }]} />
              <View style={[p.catFill, { width: `${bearPct}%`, backgroundColor: C.danger }]} />
            </View>
            <Text style={[p.catScore, { color: cat.categoryScore >= 60 ? C.success : cat.categoryScore >= 40 ? C.warning : C.danger }]}>
              {cat.categoryScore}
            </Text>
          </View>
        );
      })}

      {data.topBullishBrains?.[0] && (
        <View style={p.topBrain}>
          <View style={[p.brainDot, { backgroundColor: C.success }]} />
          <Text style={p.brainLabel} numberOfLines={1}>
            {formatBrainId(data.topBullishBrains[0].brainId)}
          </Text>
          <Text style={[p.brainScore, { color: C.success }]}>{data.topBullishBrains[0].score}</Text>
        </View>
      )}
    </View>
  );
}

function RegimePanel({ data }: { data: NonNullable<HiveInsight["transitionWarning"]> }) {
  const uc = urgencyColor(data.urgency);
  return (
    <View style={p.card}>
      <View style={p.panelHeader}>
        <Text style={p.panelTitle}>⚡ Regime Transition</Text>
        <View style={[p.signalBadge, { backgroundColor: uc + "22", borderColor: uc }]}>
          <Text style={[p.signalText, { color: uc }]}>{data.urgency}</Text>
        </View>
      </View>

      <View style={p.regimeGrid}>
        <View style={p.regimeStat}>
          <Text style={p.regimeStatLabel}>Precursor</Text>
          <Text style={[p.regimeStatValue, { color: uc }]}>{data.precursor?.replace(/_/g, " ") ?? "—"}</Text>
        </View>
        <View style={p.regimeStat}>
          <Text style={p.regimeStatLabel}>Direção</Text>
          <Text style={[p.regimeStatValue, { color: data.likelyNewDirection?.toLowerCase().includes("bull") ? C.success : data.likelyNewDirection?.toLowerCase().includes("bear") ? C.danger : C.textSecondary }]}>
            {data.likelyNewDirection ?? "—"}
          </Text>
        </View>
        <View style={p.regimeStat}>
          <Text style={p.regimeStatLabel}>Velas Restantes</Text>
          <Text style={[p.regimeStatValue, { color: C.warning }]}>{data.candlesUntilTransition ?? "—"}</Text>
        </View>
        <View style={p.regimeStat}>
          <Text style={p.regimeStatLabel}>Confiança</Text>
          <Text style={p.regimeStatValue}>{data.confidence ? `${(data.confidence * 100).toFixed(0)}%` : "—"}</Text>
        </View>
      </View>
    </View>
  );
}

function SentimentPanel({ data }: { data: SentimentData }) {
  const score = data.sentimentScore ?? 0;
  const fillPct = ((score + 1) / 2) * 100;
  const color = score > 0.2 ? C.success : score < -0.2 ? C.danger : C.warning;

  return (
    <View style={p.card}>
      <View style={p.panelHeader}>
        <Text style={p.panelTitle}>💙 Sentimento</Text>
        <View style={[p.signalBadge, { backgroundColor: color + "22", borderColor: color }]}>
          <Text style={[p.signalText, { color }]}>{data.label ?? sentimentLabel(score)}</Text>
        </View>
      </View>

      <View style={p.sentBar}>
        <Text style={p.sentEndLabel}>Bear</Text>
        <View style={p.sentTrack}>
          <View style={[p.sentFill, { left: `${Math.min(fillPct, 50)}%`, width: `${Math.abs(fillPct - 50)}%`, backgroundColor: color }]} />
          <View style={[p.sentCenter, { left: "50%" }]} />
        </View>
        <Text style={p.sentEndLabel}>Bull</Text>
      </View>

      <Text style={p.sentScore}>{score >= 0 ? "+" : ""}{score.toFixed(2)}</Text>

      {data.narrative && (
        <Text style={p.narrative} numberOfLines={2}>{data.narrative}</Text>
      )}

      {data.sources && data.sources.length > 0 && (
        <View style={p.sources}>
          {data.sources.slice(0, 3).map((s, i) => (
            <View key={i} style={p.sourceRow}>
              <Text style={p.sourceName}>{s.name}</Text>
              <Text style={[p.sourceScore, { color: s.score > 0 ? C.success : s.score < 0 ? C.danger : C.textSecondary }]}>
                {s.score >= 0 ? "+" : ""}{s.score.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SocialPanel({ data }: { data: SocialData }) {
  const reddit = data.reddit;
  const combined = data.combined;
  const total = reddit ? reddit.bullishCount + reddit.bearishCount : 0;
  const bullPct = total > 0 ? (reddit!.bullishCount / total) * 100 : 50;

  return (
    <View style={p.card}>
      <Text style={p.panelTitle}>🌐 Social Sentiment</Text>

      {reddit && (
        <View style={p.socialSection}>
          <Text style={p.socialSource}>Reddit</Text>
          <View style={p.socialBar}>
            <View style={[p.socialFill, { width: `${bullPct}%`, backgroundColor: C.success }]} />
            <View style={[p.socialFill, { width: `${100 - bullPct}%`, backgroundColor: C.danger }]} />
          </View>
          <View style={p.socialLegend}>
            <Text style={[p.socialPct, { color: C.success }]}>{reddit.bullishCount} Bullish</Text>
            <Text style={[p.socialPct, { color: C.danger }]}>{reddit.bearishCount} Bearish</Text>
          </View>
          <Text style={p.socialMeta}>Score médio dos posts: {reddit.avgScore.toFixed(0)}</Text>
        </View>
      )}

      {combined && (
        <View style={p.socialSection}>
          <Text style={p.socialSource}>Agregado</Text>
          <View style={p.socialBar}>
            <View style={[p.socialFill, { width: `${combined.bullishPct}%`, backgroundColor: C.success }]} />
            <View style={[p.socialFill, { width: `${combined.neutralPct}%`, backgroundColor: C.border }]} />
            <View style={[p.socialFill, { width: `${combined.bearishPct}%`, backgroundColor: C.danger }]} />
          </View>
          <View style={p.socialLegend}>
            <Text style={[p.socialPct, { color: C.success }]}>{combined.bullishPct.toFixed(0)}%</Text>
            <Text style={[p.socialPct, { color: C.textSecondary }]}>{combined.neutralPct.toFixed(0)}%</Text>
            <Text style={[p.socialPct, { color: C.danger }]}>{combined.bearishPct.toFixed(0)}%</Text>
          </View>
        </View>
      )}

      {!reddit && !combined && (
        <Text style={p.narrative}>Dados sociais ainda não disponíveis para este símbolo.</Text>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  symbol: string;
  interval: string;
  onOverlayUpdate: (data: OverlayData) => void;
}

export default function EcosystemPanel({ symbol, interval, onOverlayUpdate }: Props) {
  const [active, setActive] = useState<LayerId[]>([]);
  const [hiveData, setHiveData] = useState<HiveInsight | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [socialData, setSocialData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState<Partial<Record<LayerId, boolean>>>({});
  const prevSymbol = useRef<string>("");

  // Fetch hive + regime data (shared endpoint)
  const fetchHive = useCallback(async (sym: string, ivl: string) => {
    setLoading((l) => ({ ...l, brain: true, regime: true }));
    try {
      const res = await apiRequest("GET", `/api/insights/${sym}?interval=${ivl}`);
      if (res.ok) setHiveData(await res.json() as HiveInsight);
    } catch { /* ignore */ } finally {
      setLoading((l) => ({ ...l, brain: false, regime: false }));
    }
  }, []);

  const fetchSentiment = useCallback(async (sym: string) => {
    setLoading((l) => ({ ...l, sentiment: true }));
    try {
      const res = await apiRequest("GET", `/api/sentiment/${sym}`);
      if (res.ok) setSentimentData(await res.json() as SentimentData);
    } catch { /* ignore */ } finally {
      setLoading((l) => ({ ...l, sentiment: false }));
    }
  }, []);

  const fetchSocial = useCallback(async (sym: string) => {
    setLoading((l) => ({ ...l, social: true }));
    try {
      const res = await apiRequest("GET", `/api/sentiment/social/${sym}`);
      if (res.ok) setSocialData(await res.json() as SocialData);
    } catch { /* ignore */ } finally {
      setLoading((l) => ({ ...l, social: false }));
    }
  }, []);

  // Reset and re-fetch when symbol changes
  useEffect(() => {
    if (symbol === prevSymbol.current) return;
    prevSymbol.current = symbol;
    setHiveData(null);
    setSentimentData(null);
    setSocialData(null);
    if (active.includes("brain") || active.includes("regime")) fetchHive(symbol, interval);
    if (active.includes("sentiment")) fetchSentiment(symbol);
    if (active.includes("social")) fetchSocial(symbol);
  }, [symbol, interval, active, fetchHive, fetchSentiment, fetchSocial]);

  // Push overlay data up on every data change
  useEffect(() => {
    const overlay: OverlayData = {
      brain: active.includes("brain") && hiveData
        ? { score: hiveData.hiveScore, signal: hiveData.hiveSignal }
        : null,
      regime: active.includes("regime") && hiveData?.transitionWarning
        ? { urgency: hiveData.transitionWarning.urgency, direction: hiveData.transitionWarning.likelyNewDirection }
        : null,
      sentiment: active.includes("sentiment") && sentimentData
        ? { score: sentimentData.sentimentScore }
        : null,
      social: active.includes("social") && socialData?.reddit
        ? {
            bullish: socialData.reddit.bullishCount,
            bearish: socialData.reddit.bearishCount,
          }
        : null,
    };
    onOverlayUpdate(overlay);
  }, [active, hiveData, sentimentData, socialData, onOverlayUpdate]);

  const toggleLayer = (id: LayerId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActive((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ACTIVE) {
        // Deselect the oldest (first) to make room
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });

    // Lazy fetch on activation
    if (!active.includes(id)) {
      if ((id === "brain" || id === "regime") && !hiveData) fetchHive(symbol, interval);
      if (id === "sentiment" && !sentimentData) fetchSentiment(symbol);
      if (id === "social" && !socialData) fetchSocial(symbol);
    }
  };

  return (
    <View style={s.container}>
      {/* Layer toggle row */}
      <View style={s.layerRow}>
        <Text style={s.layerLabel}>Camadas · máx {MAX_ACTIVE}</Text>
        <View style={s.chips}>
          {LAYERS.map((layer) => {
            const isActive = active.includes(layer.id);
            const isLoading = loading[layer.id];
            return (
              <Pressable
                key={layer.id}
                style={[s.chip, isActive && { backgroundColor: layer.color + "22", borderColor: layer.color }]}
                onPress={() => toggleLayer(layer.id)}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color={layer.color} style={{ width: 14, height: 14 }} />
                  : <Text style={s.chipEmoji}>{layer.emoji}</Text>
                }
                <Text style={[s.chipLabel, isActive && { color: layer.color }]}>{layer.label}</Text>
                {isActive && <View style={[s.activeDot, { backgroundColor: layer.color }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Detail panels for active layers */}
      {active.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.panelScroll} contentContainerStyle={s.panelContent}>
          {active.map((id) => (
            <View key={id} style={s.panelWrapper}>
              {id === "brain" && (
                loading.brain
                  ? <LoadingCard label="Brain Score" color="#7B61FF" />
                  : hiveData
                    ? <BrainPanel data={hiveData} />
                    : <EmptyCard label="Brain Score" onRefresh={() => fetchHive(symbol, interval)} />
              )}
              {id === "regime" && (
                loading.regime
                  ? <LoadingCard label="Regime" color="#F59E0B" />
                  : hiveData?.transitionWarning
                    ? <RegimePanel data={hiveData.transitionWarning} />
                    : <EmptyCard label="Regime" onRefresh={() => fetchHive(symbol, interval)} extra="Sem transição detectada" />
              )}
              {id === "sentiment" && (
                loading.sentiment
                  ? <LoadingCard label="Sentimento" color="#00D4AA" />
                  : sentimentData
                    ? <SentimentPanel data={sentimentData} />
                    : <EmptyCard label="Sentimento" onRefresh={() => fetchSentiment(symbol)} />
              )}
              {id === "social" && (
                loading.social
                  ? <LoadingCard label="Social" color="#3B82F6" />
                  : <SocialPanel data={socialData ?? {}} />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Utility Panels ───────────────────────────────────────────────────────────

function LoadingCard({ label, color }: { label: string; color: string }) {
  return (
    <View style={[p.card, p.centerCard]}>
      <ActivityIndicator color={color} />
      <Text style={[p.narrative, { marginTop: 8 }]}>Carregando {label}...</Text>
    </View>
  );
}

function EmptyCard({ label, onRefresh, extra }: { label: string; onRefresh: () => void; extra?: string }) {
  return (
    <View style={[p.card, p.centerCard]}>
      <Ionicons name="cloud-offline-outline" size={24} color={C.textSecondary} />
      <Text style={p.narrative}>{extra ?? `${label} indisponível`}</Text>
      <Pressable onPress={onRefresh} style={p.retryBtn}>
        <Text style={p.retryText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { gap: 8 },
  layerRow: { gap: 6 },
  layerLabel: { fontSize: 10, color: C.textSecondary, letterSpacing: 0.8, textTransform: "uppercase" },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, position: "relative",
  },
  chipEmoji: { fontSize: 12 },
  chipLabel: { fontSize: 11, fontWeight: "600", color: C.textSecondary },
  activeDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 2 },
  panelScroll: { marginHorizontal: -16 },
  panelContent: { paddingHorizontal: 16, gap: 10 },
  panelWrapper: { width: 280 },
});

const p = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, gap: 10,
  },
  centerCard: { alignItems: "center", justifyContent: "center", minHeight: 120 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  signalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  signalText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  scoreRow: { alignItems: "flex-start", gap: 4 },
  bigScore: { fontSize: 36, fontWeight: "800", lineHeight: 40 },
  scoreInfo: { flexDirection: "row", gap: 12 },
  scoreLabel: { fontSize: 11, color: C.textSecondary },
  scoreTrack: { width: "100%", height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 2 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  catLabel: { fontSize: 10, color: C.textSecondary, width: 70, textTransform: "capitalize" },
  catBar: { flex: 1, height: 8, backgroundColor: C.border, borderRadius: 4, overflow: "hidden", flexDirection: "row" },
  catFill: { height: "100%" },
  catScore: { fontSize: 11, fontWeight: "700", width: 22, textAlign: "right" },
  topBrain: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#ffffff08", borderRadius: 8, padding: 8 },
  brainDot: { width: 7, height: 7, borderRadius: 4 },
  brainLabel: { flex: 1, fontSize: 11, color: C.text },
  brainScore: { fontSize: 13, fontWeight: "700" },
  regimeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  regimeStat: { width: "48%", backgroundColor: "#ffffff08", borderRadius: 8, padding: 8 },
  regimeStatLabel: { fontSize: 10, color: C.textSecondary, marginBottom: 3 },
  regimeStatValue: { fontSize: 13, fontWeight: "700", color: C.text },
  sentBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  sentTrack: { flex: 1, height: 8, backgroundColor: C.border, borderRadius: 4, position: "relative", overflow: "hidden" },
  sentFill: { position: "absolute", height: "100%", borderRadius: 4 },
  sentCenter: { position: "absolute", width: 2, height: "100%", backgroundColor: C.textSecondary, marginLeft: -1 },
  sentEndLabel: { fontSize: 9, color: C.textSecondary, width: 28 },
  sentScore: { fontSize: 22, fontWeight: "800", color: C.text },
  narrative: { fontSize: 11, color: C.textSecondary, lineHeight: 16 },
  sources: { gap: 4, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  sourceRow: { flexDirection: "row", justifyContent: "space-between" },
  sourceName: { fontSize: 11, color: C.textSecondary },
  sourceScore: { fontSize: 11, fontWeight: "700" },
  socialSection: { gap: 6 },
  socialSource: { fontSize: 10, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  socialBar: { height: 10, backgroundColor: C.border, borderRadius: 5, overflow: "hidden", flexDirection: "row" },
  socialFill: { height: "100%" },
  socialLegend: { flexDirection: "row", justifyContent: "space-between" },
  socialPct: { fontSize: 11, fontWeight: "600" },
  socialMeta: { fontSize: 10, color: C.textSecondary },
  retryBtn: { marginTop: 4, padding: 6 },
  retryText: { fontSize: 11, color: C.primary },
});
