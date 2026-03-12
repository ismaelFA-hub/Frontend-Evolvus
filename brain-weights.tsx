/**
 * Evolvus Core Quantum — Brain Weights Manager
 *
 * Visualiza e gerencia os pesos adaptativos dos 35 microcérebros.
 * - Ranking dos cérebros mais e menos confiáveis
 * - Barra de peso relativo para cada cérebro
 * - Ação de reset (volta tudo para neutro 1.0)
 *
 * Rotas: GET  /api/ai/brain/weights          — pesos atuais + ranking
 *        POST /api/ai/brain/weights/reset     — reset para neutro (1.0)
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
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

interface BrainWeight {
  brainId: string;
  weight: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  winRate: number;
}

interface WeightRankEntry {
  brainId: string;
  weight: number;
}

interface WeightRanking {
  top: WeightRankEntry[];
  bottom: WeightRankEntry[];
}

interface WeightsResponse {
  weights: BrainWeight[];
  ranking: WeightRanking;
  totalTracked: number;
  info: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function weightColor(w: number): string {
  if (w >= 1.3) return C.success;
  if (w >= 1.1) return "#8BC34A";
  if (w >= 0.9) return C.textSecondary;
  if (w >= 0.7) return C.warning;
  return C.danger;
}

function formatBrainId(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Weight Bar ───────────────────────────────────────────────────────

function WeightRow({ brain, maxWeight }: { brain: BrainWeight; maxWeight: number }) {
  const { primary } = usePlanTheme();
  const barPct = maxWeight > 0 ? Math.min((brain.weight / maxWeight) * 100, 100) : 0;
  const neutralBarPct = maxWeight > 0 ? (1.0 / maxWeight) * 100 : 50;
  const color = weightColor(brain.weight);

  return (
    <View style={wr.container}>
      <View style={wr.labelRow}>
        <Text style={wr.name}>{formatBrainId(brain.brainId)}</Text>
        <Text style={[wr.weight, { color }]}>{fmt(brain.weight, 3)}×</Text>
      </View>
      <View style={wr.barTrack}>
        {/* Neutral reference line */}
        <View style={[wr.neutralLine, { left: `${neutralBarPct}%` }]} />
        <View style={[wr.bar, { width: `${barPct}%`, backgroundColor: color }]} />
      </View>
      <View style={wr.stats}>
        <Text style={wr.stat}>✓ {brain.winCount}</Text>
        <Text style={wr.stat}>✗ {brain.lossCount}</Text>
        <Text style={wr.stat}>Win {brain.totalTrades > 0 ? fmt(brain.winRate * 100, 0) : "—"}%</Text>
        <Text style={wr.stat}>{brain.totalTrades} ops</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function BrainWeightsScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary } = usePlanTheme();
  const [data, setData] = useState<WeightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sortBy, setSortBy] = useState<"weight" | "winRate" | "totalTrades">("weight");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<WeightsResponse>("GET", "/api/ai/brain/weights");
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const handleReset = useCallback(() => {
    Alert.alert(
      "Resetar Pesos",
      "Todos os pesos dos 35 cérebros serão revertidos para neutro (1.0). O histórico de acertos não é apagado — apenas a influência no consenso é igualada. Confirmar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resetar", style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await apiRequest("POST", "/api/ai/brain/weights/reset");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              load();
            } catch (e: any) {
              Alert.alert("Erro", e.message ?? "Falha ao resetar pesos.");
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }, [load]);

  const sorted = data?.weights
    ? [...data.weights].sort((a, b) => {
        if (sortBy === "weight") return b.weight - a.weight;
        if (sortBy === "winRate") return b.winRate - a.winRate;
        return b.totalTrades - a.totalTrades;
      })
    : [];

  const maxWeight = sorted.length > 0 ? Math.max(...sorted.map(w => w.weight), 1.5) : 1.5;
  const tracked = sorted.filter(b => b.totalTrades > 0).length;
  const avgWeight = sorted.length > 0 ? sorted.reduce((s, b) => s + b.weight, 0) / sorted.length : 1;
  const topBrain = sorted[0];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('brainWeights')}</Text>
          <Text style={s.sub}>Ranking adaptativo dos 35 microcérebros</Text>
        </View>
        <Pressable
          style={[s.resetBtn, { borderColor: `${C.danger}50` }]}
          onPress={handleReset}
          disabled={resetting}
        >
          {resetting
            ? <ActivityIndicator size="small" color={C.danger} />
            : <Ionicons name="refresh-outline" size={18} color={C.danger} />}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {loading ? (
          <ActivityIndicator color={primary} style={{ marginTop: 48 }} />
        ) : !data ? (
          <View style={s.empty}>
            <Ionicons name="scale-outline" size={48} color={C.textSecondary} />
            <Text style={s.emptyText}>Sem dados de pesos</Text>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <View style={s.cards}>
              <View style={[s.card, { borderColor: `${primary}30` }]}>
                <Text style={[s.cardVal, { color: primary }]}>{data.totalTracked}</Text>
                <Text style={s.cardLbl}>Cérebros</Text>
              </View>
              <View style={[s.card, { borderColor: `${primary}30` }]}>
                <Text style={[s.cardVal, { color: primary }]}>{tracked}</Text>
                <Text style={s.cardLbl}>Com histórico</Text>
              </View>
              <View style={[s.card, { borderColor: `${primary}30` }]}>
                <Text style={[s.cardVal, { color: weightColor(avgWeight) }]}>{fmt(avgWeight, 3)}×</Text>
                <Text style={s.cardLbl}>Peso médio</Text>
              </View>
              {topBrain && (
                <View style={[s.card, { borderColor: `${C.success}30` }]}>
                  <Text style={[s.cardVal, { color: C.success }]}>{fmt(topBrain.weight, 3)}×</Text>
                  <Text style={s.cardLbl}>Melhor peso</Text>
                </View>
              )}
            </View>

            {/* Info banner */}
            <View style={[s.info, { borderColor: `${primary}30` }]}>
              <Ionicons name="information-circle-outline" size={15} color={primary} />
              <Text style={[s.infoText, { color: C.textSecondary }]}>{data.info}</Text>
            </View>

            {/* Sort bar */}
            <View style={[s.sortRow, { borderColor: `${primary}20` }]}>
              {(["weight", "winRate", "totalTrades"] as const).map(opt => (
                <Pressable
                  key={opt}
                  style={[s.sortBtn, sortBy === opt && { backgroundColor: primary }]}
                  onPress={() => setSortBy(opt)}
                >
                  <Text style={[s.sortText, sortBy === opt && { color: "#000" }]}>
                    {opt === "weight" ? "Peso" : opt === "winRate" ? "Win Rate" : "Operações"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Top / Bottom highlights */}
            {data.ranking.top.length > 0 && (
              <View style={[s.rankBox, { borderColor: `${C.success}30` }]}>
                <Text style={[s.rankTitle, { color: C.success }]}>🏆 Top 5 mais confiáveis</Text>
                {data.ranking.top.map((b, i) => (
                  <Text key={b.brainId} style={s.rankItem}>
                    {i + 1}. {formatBrainId(b.brainId)} — <Text style={{ color: C.success }}>{fmt(b.weight, 3)}×</Text>
                  </Text>
                ))}
              </View>
            )}

            {data.ranking.bottom.length > 0 && (
              <View style={[s.rankBox, { borderColor: `${C.danger}30` }]}>
                <Text style={[s.rankTitle, { color: C.danger }]}>⚠️ Bottom 5 menos confiáveis</Text>
                {data.ranking.bottom.map((b, i) => (
                  <Text key={b.brainId} style={s.rankItem}>
                    {i + 1}. {formatBrainId(b.brainId)} — <Text style={{ color: C.danger }}>{fmt(b.weight, 3)}×</Text>
                  </Text>
                ))}
              </View>
            )}

            {/* Full weight list */}
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>
              Todos os {sorted.length} cérebros
            </Text>
            {sorted.map(brain => (
              <WeightRow key={brain.brainId} brain={brain} maxWeight={maxWeight} />
            ))}
          </>
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
  resetBtn: { padding: 8, borderWidth: 1, borderRadius: 8 },
  content: { padding: 16, gap: 12 },
  cards: { flexDirection: "row", gap: 8 },
  card: { flex: 1, backgroundColor: "#111", borderWidth: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  cardVal: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cardLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2, textAlign: "center" },
  info: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  infoText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  sortRow: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  sortBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  sortText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  rankBox: { backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  rankTitle: { fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 4 },
  rankItem: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, paddingVertical: 1 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
});

const wr = StyleSheet.create({
  container: { backgroundColor: "#111", borderRadius: 10, padding: 12, gap: 6 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text, flex: 1 },
  weight: { fontFamily: "Inter_700Bold", fontSize: 13 },
  barTrack: { height: 6, backgroundColor: "#222", borderRadius: 3, overflow: "hidden", position: "relative" },
  bar: { height: "100%", borderRadius: 3 },
  neutralLine: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "#ffffff30" },
  stats: { flexDirection: "row", gap: 10 },
  stat: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
});
