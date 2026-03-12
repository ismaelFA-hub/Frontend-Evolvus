/**
 * Grid Evolutivo — IA Adaptativa
 *
 * Analisa ativos e calcula limites adaptativos para o Grid Trading usando IA.
 * DIFERENTE de grid-trading.tsx que faz execução — este faz análise inteligente.
 *
 * Rotas: GET  /api/grid-evolutivo/status          — status
 *        POST /api/grid-evolutivo/analyze         — analisar ativo
 *        POST /api/grid-evolutivo/score-assets    — score de múltiplos ativos
 *        POST /api/grid-evolutivo/adaptive-bounds — limites adaptativos
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────

interface GridEvoStatus {
  status: string;
  analyzedAssets: number;
  lastAnalysis: string | null;
  adaptiveBotsActive: number;
}

interface AssetAnalysis {
  suitability: string;
  score: number;
  recommendation: string;
}

interface AssetScore {
  symbol: string;
  score: number;
  suitability: string;
}

interface AdaptiveBounds {
  lowerBound: number;
  upperBound: number;
  gridCount: number;
  confidence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 0.7) return C.success;
  if (score >= 0.4) return C.warning;
  return C.danger;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function SectionHeader({ icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <View style={sh.row}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={sh.title}>{title}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function GridEvolutivoScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary, primaryDim } = usePlanTheme();

  const [status, setStatus] = useState<GridEvoStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analysis, setAnalysis] = useState<AssetAnalysis | null>(null);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);

  const [scores, setScores] = useState<AssetScore[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  const [bounds, setBounds] = useState<AdaptiveBounds | null>(null);
  const [loadingBounds, setLoadingBounds] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/grid-evolutivo/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadStatus(); }, [loadStatus]);

  async function analyzeAsset() {
    setLoadingAnalyze(true);
    try {
      const res = await apiRequest("POST", "/api/grid-evolutivo/analyze", {
        symbol: "BTCUSDT",
        candles: [],
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao analisar ativo.");
    } finally {
      setLoadingAnalyze(false);
    }
  }

  async function scoreAssets() {
    setLoadingScores(true);
    try {
      const res = await apiRequest("POST", "/api/grid-evolutivo/score-assets", {
        symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
        candles: {},
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.scores ?? data?.assets ?? [];
      setScores(list);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao rankear ativos.");
    } finally {
      setLoadingScores(false);
    }
  }

  async function calcAdaptiveBounds() {
    setLoadingBounds(true);
    try {
      const res = await apiRequest("POST", "/api/grid-evolutivo/adaptive-bounds", {
        symbol: "BTCUSDT",
        currentPrice: 104000,
        atr: 2500,
        candles: [],
      });
      const data = await res.json();
      setBounds(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao calcular limites.");
    } finally {
      setLoadingBounds(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('gridEvolutive')}</Text>
          <Text style={s.sub}>IA Adaptativa</Text>
        </View>
        <View style={[s.badge, { backgroundColor: primaryDim, borderColor: `${primary}40` }]}>
          <Ionicons name="git-branch" size={14} color={primary} />
          <Text style={[s.badgeText, { color: primary }]}>AI</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* ── Status ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="pulse-outline" title="Status" color={primary} />
          {loadingStatus ? (
            <ActivityIndicator color={primary} />
          ) : status ? (
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: status.status === "active" ? C.success : C.warning }]}>
                  {status.status?.toUpperCase() ?? "—"}
                </Text>
                <Text style={s.statLbl}>Status</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.analyzedAssets ?? 0}</Text>
                <Text style={s.statLbl}>Ativos</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.adaptiveBotsActive ?? 0}</Text>
                <Text style={s.statLbl}>Bots Ativos</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>Sem dados</Text>
          )}
        </View>

        {/* ── Analisar Ativo ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="search-outline" title="Analisar Ativo (BTCUSDT)" color={primary} />
          <Text style={s.cardDesc}>Avalia a adequação do BTCUSDT para estratégia Grid.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={analyzeAsset} disabled={loadingAnalyze}>
            {loadingAnalyze ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Analisar Ativo</Text>}
          </Pressable>
          {analysis && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Adequação</Text>
                <Text style={[s.resultVal, { color: primary }]}>{analysis.suitability}</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Score</Text>
                <Text style={[s.resultVal, { color: scoreColor(analysis.score) }]}>
                  {(analysis.score * 100).toFixed(1)}%
                </Text>
              </View>
              <Text style={s.xaiText}>{analysis.recommendation}</Text>
            </View>
          )}
        </View>

        {/* ── Score de Ativos ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="bar-chart-outline" title="Score de Ativos" color={primary} />
          <Text style={s.cardDesc}>Rankeia BTC, ETH e SOL por adequação ao Grid.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={scoreAssets} disabled={loadingScores}>
            {loadingScores ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Rankear Ativos</Text>}
          </Pressable>
          {scores.length > 0 && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {scores.map((a, i) => (
                <View key={a.symbol} style={[s.rankRow, { backgroundColor: primaryDim }]}>
                  <Text style={[s.rankPos, { color: primary }]}>#{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rankSymbol}>{a.symbol}</Text>
                    <Text style={s.rankSuit}>{a.suitability}</Text>
                  </View>
                  <View style={[s.scorePill, { backgroundColor: `${scoreColor(a.score)}20` }]}>
                    <Text style={[s.scorePillText, { color: scoreColor(a.score) }]}>
                      {(a.score * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Limites Adaptativos ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="resize-outline" title="Limites Adaptativos (BTC)" color={primary} />
          <Text style={s.cardDesc}>Calcula piso/teto e número de níveis com base no ATR atual.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={calcAdaptiveBounds} disabled={loadingBounds}>
            {loadingBounds ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Calcular Limites</Text>}
          </Pressable>
          {bounds && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.boundsRow}>
                <View style={s.boundsItem}>
                  <Text style={s.resultLbl}>Piso</Text>
                  <Text style={[s.resultVal, { color: C.danger }]}>${fmt(bounds.lowerBound, 0)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={C.textSecondary} />
                <View style={s.boundsItem}>
                  <Text style={s.resultLbl}>Teto</Text>
                  <Text style={[s.resultVal, { color: C.success }]}>${fmt(bounds.upperBound, 0)}</Text>
                </View>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Níveis</Text>
                <Text style={[s.resultVal, { color: primary }]}>{bounds.gridCount}</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: scoreColor(bounds.confidence) }]}>
                  {(bounds.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>
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
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  statsGrid: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statVal: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center", paddingVertical: 8 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  resultBox: { borderRadius: 10, padding: 12, gap: 6 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultLbl: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  resultVal: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  xaiText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18, marginTop: 4 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 8, padding: 10 },
  rankPos: { fontFamily: "Inter_700Bold", fontSize: 16, width: 28 },
  rankSymbol: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  rankSuit: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  scorePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  scorePillText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  boundsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  boundsItem: { alignItems: "center", gap: 2 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
});
