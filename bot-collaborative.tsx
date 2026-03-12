/**
 * Bot Colaborativo — XAI Multi-Agente
 *
 * Coordena múltiplos bots para evitar colisões, aprovação de ações
 * e fornece explicações XAI para cada decisão tomada.
 *
 * Rotas: GET  /api/bot-collaborative/status    — status
 *        POST /api/bot-collaborative/register  — registrar bot
 *        POST /api/bot-collaborative/coordinate — coordenar ação
 *        POST /api/bot-collaborative/collision  — detectar colisão
 *        POST /api/bot-collaborative/explain    — explicar (XAI)
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

interface CollabStatus {
  status: string;
  activeBotsCount: number;
  collisionsAvoided: number;
  totalCoordinations: number;
}

interface CoordinationResult {
  approved: boolean;
  reason: string;
  alternatives?: string[];
}

interface CollisionResult {
  hasCollision: boolean;
  severity: string;
  recommendation: string;
}

interface XAIExplanation {
  explanation: string;
  factors: string[];
  confidence: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === "NONE" || s === "none") return C.success;
  if (s === "LOW" || s === "low") return C.success;
  if (s === "MEDIUM" || s === "medium") return C.warning;
  return C.danger;
}

function confColor(c: number) {
  if (c >= 0.7) return C.success;
  if (c >= 0.4) return C.warning;
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

export default function BotCollaborativeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary, primaryDim } = usePlanTheme();

  const [status, setStatus] = useState<CollabStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [registerResult, setRegisterResult] = useState<string | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(false);

  const [coordination, setCoordination] = useState<CoordinationResult | null>(null);
  const [loadingCoord, setLoadingCoord] = useState(false);

  const [collision, setCollision] = useState<CollisionResult | null>(null);
  const [loadingCollision, setLoadingCollision] = useState(false);

  const [xaiResult, setXaiResult] = useState<XAIExplanation | null>(null);
  const [loadingXai, setLoadingXai] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/bot-collaborative/status");
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

  async function registerBot() {
    setLoadingRegister(true);
    try {
      const res = await apiRequest("POST", "/api/bot-collaborative/register", {
        botId: "bot-1",
        type: "GRID",
        exchange: "binance",
        symbol: "BTCUSDT",
      });
      const data = await res.json();
      setRegisterResult(data?.message ?? data?.botId ?? "Bot registrado com sucesso.");
      loadStatus();
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao registrar bot.");
    } finally {
      setLoadingRegister(false);
    }
  }

  async function coordinateAction() {
    setLoadingCoord(true);
    try {
      const res = await apiRequest("POST", "/api/bot-collaborative/coordinate", {
        requestingBotId: "bot-1",
        action: "OPEN_LONG",
        symbol: "BTCUSDT",
        size: 100,
      });
      const data = await res.json();
      setCoordination(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na coordenação.");
    } finally {
      setLoadingCoord(false);
    }
  }

  async function detectCollision() {
    setLoadingCollision(true);
    try {
      const res = await apiRequest("POST", "/api/bot-collaborative/collision", {
        botId1: "bot-1",
        botId2: "bot-2",
        symbol: "BTCUSDT",
      });
      const data = await res.json();
      setCollision(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na detecção de colisão.");
    } finally {
      setLoadingCollision(false);
    }
  }

  async function explainDecision() {
    setLoadingXai(true);
    try {
      const res = await apiRequest("POST", "/api/bot-collaborative/explain", {
        botId: "bot-1",
        decision: "OPEN_LONG",
        context: {},
      });
      const data = await res.json();
      setXaiResult(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na explicação XAI.");
    } finally {
      setLoadingXai(false);
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
          <Text style={s.title}>{t('botCollaborative')}</Text>
          <Text style={s.sub}>XAI Multi-Agente</Text>
        </View>
        <View style={[s.badge, { backgroundColor: primaryDim, borderColor: `${primary}40` }]}>
          <Ionicons name="people" size={14} color={primary} />
          <Text style={[s.badgeText, { color: primary }]}>XAI</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* ── Status ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="pulse-outline" title="Status do Ecossistema" color={primary} />
          {loadingStatus ? (
            <ActivityIndicator color={primary} />
          ) : status ? (
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.activeBotsCount ?? 0}</Text>
                <Text style={s.statLbl}>Bots Ativos</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.success }]}>{status.collisionsAvoided ?? 0}</Text>
                <Text style={s.statLbl}>Colisões Evitadas</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.totalCoordinations ?? 0}</Text>
                <Text style={s.statLbl}>Coordenações</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>Sem dados de status</Text>
          )}
          {status?.status && (
            <View style={s.statusRow}>
              <View style={[s.dot, { backgroundColor: status.status === "active" ? C.success : C.warning }]} />
              <Text style={[s.statusText, { color: status.status === "active" ? C.success : C.warning }]}>
                {status.status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* ── Registrar Bot ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="add-circle-outline" title="Registrar Bot" color={primary} />
          <Text style={s.cardDesc}>Registra o bot-1 (GRID/Binance/BTC) no ecossistema colaborativo.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={registerBot} disabled={loadingRegister}>
            {loadingRegister ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Registrar Bot</Text>}
          </Pressable>
          {registerResult && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Ionicons name="checkmark-circle" size={16} color={C.success} />
                <Text style={[s.resultVal, { color: C.success, flex: 1 }]}>{registerResult}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Coordenar ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="git-merge-outline" title="Coordenar Ação" color={primary} />
          <Text style={s.cardDesc}>Solicita aprovação para OPEN_LONG no BTCUSDT (size: $100).</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={coordinateAction} disabled={loadingCoord}>
            {loadingCoord ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Coordenar OPEN_LONG</Text>}
          </Pressable>
          {coordination && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Decisão</Text>
                <View style={[s.pill, { backgroundColor: coordination.approved ? `${C.success}25` : `${C.danger}25` }]}>
                  <Ionicons
                    name={coordination.approved ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={coordination.approved ? C.success : C.danger}
                  />
                  <Text style={[s.pillText, { color: coordination.approved ? C.success : C.danger }]}>
                    {coordination.approved ? "APROVADO" : "NEGADO"}
                  </Text>
                </View>
              </View>
              <Text style={s.xaiText}>{coordination.reason}</Text>
              {coordination.alternatives && coordination.alternatives.length > 0 && (
                <View style={{ gap: 4, marginTop: 4 }}>
                  <Text style={s.altLabel}>Alternativas</Text>
                  {coordination.alternatives.map((alt, i) => (
                    <View key={i} style={s.altRow}>
                      <Ionicons name="arrow-forward-circle-outline" size={12} color={primary} />
                      <Text style={[s.altText, { color: C.textSecondary }]}>{alt}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Detectar Colisão ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="warning-outline" title="Detectar Colisão (bot-1 vs bot-2)" color={primary} />
          <Text style={s.cardDesc}>Verifica se dois bots estão em conflito no BTCUSDT.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={detectCollision} disabled={loadingCollision}>
            {loadingCollision ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Detectar Colisão</Text>}
          </Pressable>
          {collision && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Colisão</Text>
                <View style={[s.pill, { backgroundColor: collision.hasCollision ? `${C.danger}25` : `${C.success}25` }]}>
                  <Ionicons
                    name={collision.hasCollision ? "alert-circle" : "shield-checkmark"}
                    size={14}
                    color={collision.hasCollision ? C.danger : C.success}
                  />
                  <Text style={[s.pillText, { color: collision.hasCollision ? C.danger : C.success }]}>
                    {collision.hasCollision ? "DETECTADA" : "SEM COLISÃO"}
                  </Text>
                </View>
              </View>
              {collision.hasCollision && (
                <View style={s.resultRow}>
                  <Text style={s.resultLbl}>Severidade</Text>
                  <Text style={[s.resultVal, { color: severityColor(collision.severity) }]}>
                    {collision.severity?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={s.xaiText}>{collision.recommendation}</Text>
            </View>
          )}
        </View>

        {/* ── XAI Explicar ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="bulb-outline" title="Explicação XAI" color={primary} />
          <Text style={s.cardDesc}>Explica a decisão OPEN_LONG do bot-1 com fatores determinantes.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={explainDecision} disabled={loadingXai}>
            {loadingXai ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Explicar Decisão</Text>}
          </Pressable>
          {xaiResult && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: confColor(xaiResult.confidence) }]}>
                  {(xaiResult.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <Text style={s.xaiExplanation}>{xaiResult.explanation}</Text>
              {xaiResult.factors?.length > 0 && (
                <View style={{ gap: 4, marginTop: 4 }}>
                  <Text style={s.factorsLabel}>Fatores Determinantes</Text>
                  {xaiResult.factors.map((f, i) => (
                    <View key={i} style={s.factorRow}>
                      <View style={[s.factorDot, { backgroundColor: primary }]} />
                      <Text style={s.factorText}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
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
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.5 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  resultBox: { borderRadius: 10, padding: 12, gap: 6 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultLbl: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  resultVal: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  xaiText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  xaiExplanation: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18, marginTop: 4 },
  altLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  altRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  altText: { fontFamily: "Inter_400Regular", fontSize: 11, flex: 1 },
  factorsLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  factorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  factorDot: { width: 5, height: 5, borderRadius: 3 },
  factorText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
});
