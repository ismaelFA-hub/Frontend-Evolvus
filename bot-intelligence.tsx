/**
 * Bot Intelligence — Meta-Orquestrador IA
 *
 * Orquestra e avalia todos os bots usando IA para selecionar o melhor
 * conforme o regime de mercado atual.
 *
 * Rotas: GET  /api/bot-intelligence/status        — status do orquestrador
 *        POST /api/bot-intelligence/regime-score  — score por regime
 *        POST /api/bot-intelligence/assess        — avaliar bots
 *        POST /api/bot-intelligence/orchestrate   — orquestrar agora
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

interface BotStatus {
  status: string;
  activeBotsCount: number;
  lastOrchestration: string | null;
  regimesAnalyzed: number;
  metrics?: Record<string, unknown>;
}

interface RegimeScore {
  botType: string;
  regime: string;
  score: number;
  recommendation: string;
  confidence?: number;
}

interface BotAssessment {
  botType: string;
  score: number;
  recommendation: string;
}

interface OrchestrationResult {
  selectedBot: string;
  reason: string;
  xaiExplanation: string;
  confidence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 0.7) return C.success;
  if (score >= 0.4) return C.warning;
  return C.danger;
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

export default function BotIntelligenceScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary, primaryDim } = usePlanTheme();

  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [regimeScore, setRegimeScore] = useState<RegimeScore | null>(null);
  const [loadingRegime, setLoadingRegime] = useState(false);

  const [assessments, setAssessments] = useState<BotAssessment[]>([]);
  const [loadingAssess, setLoadingAssess] = useState(false);

  const [orchestration, setOrchestration] = useState<OrchestrationResult | null>(null);
  const [loadingOrchestrate, setLoadingOrchestrate] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/bot-intelligence/status");
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadStatus(); }, [loadStatus]);

  async function calcRegimeScore() {
    setLoadingRegime(true);
    try {
      const res = await apiRequest("POST", "/api/bot-intelligence/regime-score", {
        botType: "GRID",
        regime: "RANGING",
        candles: [],
      });
      const data = await res.json();
      setRegimeScore(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao calcular score.");
    } finally {
      setLoadingRegime(false);
    }
  }

  async function assessBots() {
    setLoadingAssess(true);
    try {
      const res = await apiRequest("POST", "/api/bot-intelligence/assess", {
        regime: "RANGING",
        candles: [],
        hormoneState: null,
      });
      const data = await res.json();
      setAssessments(Array.isArray(data?.assessments) ? data.assessments : Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao avaliar bots.");
    } finally {
      setLoadingAssess(false);
    }
  }

  async function orchestrate() {
    setLoadingOrchestrate(true);
    try {
      const res = await apiRequest("POST", "/api/bot-intelligence/orchestrate", {
        candles: [],
        hormoneState: null,
      });
      const data = await res.json();
      setOrchestration(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao orquestrar.");
    } finally {
      setLoadingOrchestrate(false);
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
          <Text style={s.title}>{t('botIntelligence')}</Text>
          <Text style={s.sub}>Meta-Orquestrador IA</Text>
        </View>
        <View style={[s.badge, { backgroundColor: primaryDim, borderColor: `${primary}40` }]}>
          <Ionicons name="hardware-chip" size={14} color={primary} />
          <Text style={[s.badgeText, { color: primary }]}>IA</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* ── Status Card ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="pulse-outline" title="Status do Orquestrador" color={primary} />
          {loadingStatus ? (
            <ActivityIndicator color={primary} style={{ marginTop: 8 }} />
          ) : status ? (
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: status.status === "active" ? C.success : C.warning }]}>
                  {status.status?.toUpperCase() ?? "—"}
                </Text>
                <Text style={s.statLbl}>Status</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.activeBotsCount ?? 0}</Text>
                <Text style={s.statLbl}>Bots Ativos</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.regimesAnalyzed ?? 0}</Text>
                <Text style={s.statLbl}>Regimes</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>Sem dados de status</Text>
          )}
          {status?.lastOrchestration && (
            <Text style={s.meta}>Última orquestração: {new Date(status.lastOrchestration).toLocaleString("pt-BR")}</Text>
          )}
        </View>

        {/* ── Regime Score ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="speedometer-outline" title="Score por Regime" color={primary} />
          <Text style={s.cardDesc}>Calcula a adequação do bot GRID para o regime RANGING atual.</Text>
          <Pressable
            style={[s.btn, { backgroundColor: primary }]}
            onPress={calcRegimeScore}
            disabled={loadingRegime}
          >
            {loadingRegime
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.btnText}>Calcular Score</Text>
            }
          </Pressable>
          {regimeScore && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Score</Text>
                <Text style={[s.resultVal, { color: scoreColor(regimeScore.score) }]}>
                  {(regimeScore.score * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Bot</Text>
                <Text style={s.resultVal}>{regimeScore.botType}</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Regime</Text>
                <Text style={s.resultVal}>{regimeScore.regime}</Text>
              </View>
              {regimeScore.confidence !== undefined && (
                <View style={s.resultRow}>
                  <Text style={s.resultLbl}>Confiança</Text>
                  <Text style={[s.resultVal, { color: primary }]}>{(regimeScore.confidence * 100).toFixed(1)}%</Text>
                </View>
              )}
              <Text style={[s.recommendation, { color: C.textSecondary }]}>{regimeScore.recommendation}</Text>
            </View>
          )}
        </View>

        {/* ── Bot Assessment ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="analytics-outline" title="Avaliação de Bots" color={primary} />
          <Text style={s.cardDesc}>Avalia todos os bots disponíveis para o regime atual.</Text>
          <Pressable
            style={[s.btn, { backgroundColor: primary }]}
            onPress={assessBots}
            disabled={loadingAssess}
          >
            {loadingAssess
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.btnText}>Avaliar Bots</Text>
            }
          </Pressable>
          {assessments.length > 0 && (
            <View style={{ gap: 8, marginTop: 4 }}>
              {assessments.map((a, i) => (
                <View key={i} style={[s.assessRow, { backgroundColor: primaryDim, borderColor: `${scoreColor(a.score)}30` }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.assessBot}>{a.botType}</Text>
                    <Text style={s.assessRec} numberOfLines={2}>{a.recommendation}</Text>
                  </View>
                  <Text style={[s.assessScore, { color: scoreColor(a.score) }]}>
                    {(a.score * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Orchestrate ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="git-network-outline" title="Orquestração" color={primary} />
          <Text style={s.cardDesc}>Seleciona e ativa o melhor bot com explicação XAI.</Text>
          <Pressable
            style={[s.btn, { backgroundColor: primary }]}
            onPress={orchestrate}
            disabled={loadingOrchestrate}
          >
            {loadingOrchestrate
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.btnText}>Orquestrar Agora</Text>
            }
          </Pressable>
          {orchestration && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Bot Selecionado</Text>
                <Text style={[s.resultVal, { color: primary }]}>{orchestration.selectedBot}</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: scoreColor(orchestration.confidence) }]}>
                  {(orchestration.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <Text style={s.xaiLabel}>Motivo</Text>
              <Text style={[s.xaiText, { color: C.textSecondary }]}>{orchestration.reason}</Text>
              <Text style={s.xaiLabel}>Explicação XAI</Text>
              <Text style={[s.xaiText, { color: C.textSecondary }]}>{orchestration.xaiExplanation}</Text>
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
  meta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center", paddingVertical: 8 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  resultBox: { borderRadius: 10, padding: 12, gap: 6 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultLbl: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  resultVal: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  recommendation: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 4 },
  assessRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 8, padding: 10, borderWidth: 1 },
  assessBot: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  assessRec: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  assessScore: { fontFamily: "Inter_700Bold", fontSize: 18 },
  xaiLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  xaiText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
});
