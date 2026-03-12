/**
 * DCA Inteligente — IA de Acumulação
 *
 * Analisa condições para DCA, detecta suporte/resistência, ajusta tamanho
 * pelo sentimento e calcula stop-loss dinâmico usando IA.
 *
 * Rotas: GET  /api/dca-intelligent/status           — status
 *        POST /api/dca-intelligent/analyze           — análise DCA
 *        POST /api/dca-intelligent/support-levels    — suporte e resistência
 *        POST /api/dca-intelligent/sentiment-size    — tamanho por sentimento
 *        POST /api/dca-intelligent/dynamic-stop-loss — stop-loss dinâmico
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

interface DCAStatus {
  status: string;
  activeDCAs: number;
  totalAccumulated: number;
  lastAnalysis: string | null;
}

interface DCAAnalysis {
  recommendation: string;
  score: number;
  optimalEntry: number;
}

interface SupportLevel {
  price: number;
  strength: number;
  type: "support" | "resistance";
}

interface SentimentSize {
  adjustedSize: number;
  reasoning: string;
}

interface DynamicStopLoss {
  stopLossPrice: number;
  reasoning: string;
  riskPercent: number;
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

export default function DCAInteligenteScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary, primaryDim } = usePlanTheme();

  const [status, setStatus] = useState<DCAStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analysis, setAnalysis] = useState<DCAAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [levels, setLevels] = useState<SupportLevel[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);

  const [sentimentSize, setSentimentSize] = useState<SentimentSize | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  const [stopLoss, setStopLoss] = useState<DynamicStopLoss | null>(null);
  const [loadingStop, setLoadingStop] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/dca-intelligent/status");
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

  async function analyzeDCA() {
    setLoadingAnalysis(true);
    try {
      const res = await apiRequest("POST", "/api/dca-intelligent/analyze", {
        symbol: "BTCUSDT",
        candles: [],
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na análise DCA.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function fetchSupportLevels() {
    setLoadingLevels(true);
    try {
      const res = await apiRequest("POST", "/api/dca-intelligent/support-levels", {
        symbol: "BTCUSDT",
        candles: [],
        currentPrice: 104000,
      });
      const data = await res.json();
      setLevels(Array.isArray(data?.levels) ? data.levels : Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao buscar níveis.");
    } finally {
      setLoadingLevels(false);
    }
  }

  async function calcSentimentSize() {
    setLoadingSentiment(true);
    try {
      const res = await apiRequest("POST", "/api/dca-intelligent/sentiment-size", {
        symbol: "BTCUSDT",
        baseSizeUSD: 100,
        sentimentScore: 0.6,
      });
      const data = await res.json();
      setSentimentSize(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao calcular tamanho.");
    } finally {
      setLoadingSentiment(false);
    }
  }

  async function calcDynamicStop() {
    setLoadingStop(true);
    try {
      const res = await apiRequest("POST", "/api/dca-intelligent/dynamic-stop-loss", {
        symbol: "BTCUSDT",
        entryPrice: 104000,
        candles: [],
      });
      const data = await res.json();
      setStopLoss(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao calcular stop-loss.");
    } finally {
      setLoadingStop(false);
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
          <Text style={s.title}>{t('dcaIntelligent')}</Text>
          <Text style={s.sub}>IA de Acumulação</Text>
        </View>
        <View style={[s.badge, { backgroundColor: primaryDim, borderColor: `${primary}40` }]}>
          <Ionicons name="trending-up" size={14} color={primary} />
          <Text style={[s.badgeText, { color: primary }]}>DCA</Text>
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
                <Text style={[s.statVal, { color: primary }]}>{status.activeDCAs ?? 0}</Text>
                <Text style={s.statLbl}>DCAs Ativos</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.success }]}>${fmt(status.totalAccumulated ?? 0, 0)}</Text>
                <Text style={s.statLbl}>Acumulado</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>Sem dados</Text>
          )}
        </View>

        {/* ── Analisar DCA ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="analytics-outline" title="Analisar DCA (BTCUSDT)" color={primary} />
          <Text style={s.cardDesc}>Avalia o momento ideal para DCA no BTC.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={analyzeDCA} disabled={loadingAnalysis}>
            {loadingAnalysis ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Analisar DCA</Text>}
          </Pressable>
          {analysis && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Score</Text>
                <Text style={[s.resultVal, { color: scoreColor(analysis.score) }]}>
                  {(analysis.score * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Entrada Ótima</Text>
                <Text style={[s.resultVal, { color: primary }]}>${fmt(analysis.optimalEntry, 0)}</Text>
              </View>
              <Text style={s.xaiText}>{analysis.recommendation}</Text>
            </View>
          )}
        </View>

        {/* ── Suporte & Resistência ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="layers-outline" title="Suporte & Resistência" color={primary} />
          <Text style={s.cardDesc}>Detecta zonas de suporte e resistência para entradas DCA.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={fetchSupportLevels} disabled={loadingLevels}>
            {loadingLevels ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Buscar Níveis</Text>}
          </Pressable>
          {levels.length > 0 && (
            <View style={{ gap: 6, marginTop: 4 }}>
              {levels.map((l, i) => (
                <View key={i} style={[s.levelRow, { backgroundColor: primaryDim, borderLeftColor: l.type === "support" ? C.success : C.danger, borderLeftWidth: 3 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.levelType, { color: l.type === "support" ? C.success : C.danger }]}>
                      {l.type === "support" ? "SUPORTE" : "RESISTÊNCIA"}
                    </Text>
                    <Text style={s.levelPrice}>${fmt(l.price, 0)}</Text>
                  </View>
                  <View style={[s.strengthPill, { backgroundColor: `${scoreColor(l.strength)}20` }]}>
                    <Text style={[s.strengthText, { color: scoreColor(l.strength) }]}>
                      {(l.strength * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Tamanho por Sentimento ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="heart-outline" title="Tamanho por Sentimento" color={primary} />
          <Text style={s.cardDesc}>Ajusta o tamanho da entrada DCA pelo sentimento atual (base: $100).</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={calcSentimentSize} disabled={loadingSentiment}>
            {loadingSentiment ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Calcular Tamanho</Text>}
          </Pressable>
          {sentimentSize && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Tamanho Base</Text>
                <Text style={s.resultVal}>$100.00</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Tamanho Ajustado</Text>
                <Text style={[s.resultVal, { color: primary }]}>${fmt(sentimentSize.adjustedSize)}</Text>
              </View>
              <Text style={s.xaiText}>{sentimentSize.reasoning}</Text>
            </View>
          )}
        </View>

        {/* ── Stop Loss Dinâmico ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="shield-outline" title="Stop Loss Dinâmico" color={primary} />
          <Text style={s.cardDesc}>Calcula stop-loss adaptativo para entrada em $104.000.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={calcDynamicStop} disabled={loadingStop}>
            {loadingStop ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Calcular Stop</Text>}
          </Pressable>
          {stopLoss && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Preço de Stop</Text>
                <Text style={[s.resultVal, { color: C.danger }]}>${fmt(stopLoss.stopLossPrice, 0)}</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Risco</Text>
                <Text style={[s.resultVal, { color: C.warning }]}>{fmt(stopLoss.riskPercent)}%</Text>
              </View>
              <Text style={s.xaiText}>{stopLoss.reasoning}</Text>
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
  levelRow: { flexDirection: "row", alignItems: "center", borderRadius: 8, padding: 10, gap: 8 },
  levelType: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.5 },
  levelPrice: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, marginTop: 2 },
  strengthPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  strengthText: { fontFamily: "Inter_700Bold", fontSize: 12 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
});
