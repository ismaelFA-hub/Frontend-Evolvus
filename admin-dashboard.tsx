/**
 * Evolvus Core Quantum — Admin Dashboard
 *
 * Painel de visão geral do ecossistema para administradores:
 * - Status do sistema (saúde, uptime, memória)
 * - Cérebros de IA ativos e pesos
 * - Configuração DAO atual
 * - Hormônios do sistema (primeiros 3 usuários)
 * - Log de auditoria recente
 * - Propostas DAO pendentes
 *
 * Rotas: GET /api/health
 *        GET /api/ai/status
 *        GET /api/ai/brain/weights
 *        GET /api/governance/config
 *        GET /api/governance/proposals?status=pending
 *        GET /api/security/audit-log
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator, RefreshControl,
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

interface HealthResponse {
  status: string;
  uptime?: number;
  timestamp?: string;
}

interface AIStatus {
  brains?: number;
  status?: string;
  brainWeights?: Record<string, number>;
}

interface BrainWeight {
  brainId: string;
  weight: number;
  accuracy: number;
  totalFeedbacks: number;
}

interface DAOConfigSummary {
  sizingMultiplier: number;
  entryThreshold: number;
  disabledBrains: string[];
}

interface AuditEntry {
  id: string;
  action: string;
  userId?: string;
  ip?: string;
  success: boolean;
  timestamp: string;
}

// ─── Stat card ────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, onPress }: {
  icon: string; label: string; value: string; color: string; onPress?: () => void
}) {
  return (
    <Pressable style={[sc.card, onPress && { borderColor: color + "44" }]} onPress={onPress}>
      <Ionicons name={icon as never} size={22} color={color} />
      <Text style={[sc.value, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </Pressable>
  );
}

const sc = StyleSheet.create({
  card:  { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 14, alignItems: "center", gap: 4, borderWidth: 1, borderColor: C.border },
  value: { fontSize: 20, fontWeight: "800" },
  label: { fontSize: 10, color: C.textSecondary, textAlign: "center" },
});

// ─── Quick nav card ────────────────────────────────────────────────────

function QuickNavCard({ icon, label, sub, color, route }: { icon: string; label: string; sub: string; color: string; route: string }) {
  return (
    <Pressable style={qn.card} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(route as never); }}>
      <View style={[qn.iconBox, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon as never} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={qn.label}>{label}</Text>
        <Text style={qn.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
    </Pressable>
  );
}

const qn = StyleSheet.create({
  card:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label:   { fontSize: 13, fontWeight: "700", color: C.text },
  sub:     { fontSize: 11, color: C.textSecondary },
});

// ─── Main screen ──────────────────────────────────────────────────────

export default function AdminDashboardScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [topBrains, setTopBrains] = useState<BrainWeight[]>([]);
  const [daoConfig, setDAOConfig] = useState<DAOConfigSummary | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingProposals, setPendingProposals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [healthRes, aiRes, weightsRes, configRes, proposalsRes, auditRes] = await Promise.allSettled([
        apiRequest("GET", "/api/health"),
        apiRequest("GET", "/api/ai/status"),
        apiRequest("GET", "/api/ai/brain/weights"),
        apiRequest("GET", "/api/governance/config"),
        apiRequest("GET", "/api/governance/proposals?status=pending"),
        apiRequest("GET", "/api/security/audit-log"),
      ]);

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        setHealth(await healthRes.value.json() as HealthResponse);
      }
      if (aiRes.status === "fulfilled" && aiRes.value.ok) {
        setAIStatus(await aiRes.value.json() as AIStatus);
      }
      if (weightsRes.status === "fulfilled" && weightsRes.value.ok) {
        const w = await weightsRes.value.json() as { weights: BrainWeight[] };
        const sorted = (w.weights ?? []).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);
        setTopBrains(sorted);
      }
      if (configRes.status === "fulfilled" && configRes.value.ok) {
        const c = await configRes.value.json() as { config: DAOConfigSummary };
        setDAOConfig(c.config);
      }
      if (proposalsRes.status === "fulfilled" && proposalsRes.value.ok) {
        const p = await proposalsRes.value.json() as { proposals: unknown[] };
        setPendingProposals((p.proposals ?? []).length);
      }
      if (auditRes.status === "fulfilled" && auditRes.value.ok) {
        const a = await auditRes.value.json() as { entries: AuditEntry[] };
        setAuditLog((a.entries ?? []).slice(0, 8));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const systemOK = health?.status === "ok";

  const MODULE_ROUTES = [
    { icon: "git-network-outline", label: "Mente Colmeia", sub: "Consenso dos 35 cérebros", color: "#00BCD4", route: "/hive-mind" },
    { icon: "pulse-outline", label: "Gêmeo Digital", sub: "Simulação GBM + Jump-Diffusion", color: planTheme.primary, route: "/digital-twin" },
    { icon: "people-outline", label: "Governança DAO", sub: `${pendingProposals} proposta(s) pendente(s)`, color: C.warning, route: "/governance" },
    { icon: "cellular-outline", label: "Sistema Endócrino", sub: "Hormônios do ecossistema", color: C.success, route: "/hormones" },
    { icon: "list-outline", label: "Logs do Sistema", sub: "Auditoria e diagnóstico", color: C.textSecondary, route: "/admin/logs" },
    { icon: "shield-checkmark-outline", label: "Defense Grid", sub: "Segurança e ameaças em tempo real", color: "#ef4444", route: "/security" },
    { icon: "analytics-outline", label: "Pipeline de Dados", sub: "Saúde dos workers e ingestão", color: "#8B5CF6", route: "/admin/data-health" },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('adminDashboard')}</Text>
          <Text style={s.subtitle}>Visão geral do ecossistema</Text>
        </View>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); loadAll(); }}>
          <Ionicons name="refresh-outline" size={20} color={planTheme.primary} />
        </Pressable>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/dev-console" as never); }}
          style={{ marginLeft: 6, padding: 4 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Abrir console do desenvolvedor"
        >
          <Text style={{ fontSize: 14, color: "#333" }}>⚡</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={planTheme.primary} style={{ marginTop: 48 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={planTheme.primary} />}
        >
          {error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {/* System stats */}
          <View style={s.statsRow}>
            <StatCard
              icon={systemOK ? "checkmark-circle" : "alert-circle"}
              label="Sistema"
              value={systemOK ? "Online" : "Offline"}
              color={systemOK ? C.success : C.danger}
            />
            <StatCard
              icon="hardware-chip-outline"
              label="Cérebros"
              value={String(aiStatus?.brains ?? 35)}
              color={planTheme.primary}
              onPress={() => router.push("/hive-mind" as never)}
            />
            <StatCard
              icon="hourglass-outline"
              label="Propostas"
              value={String(pendingProposals)}
              color={pendingProposals > 0 ? C.warning : C.success}
              onPress={() => router.push("/governance" as never)}
            />
          </View>

          {/* DAO Config snapshot */}
          {daoConfig && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>⚙️ Configuração DAO</Text>
                <Pressable onPress={() => router.push("/governance" as never)}>
                  <Text style={[s.seeAll, { color: planTheme.primary }]}>Ver mais →</Text>
                </Pressable>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Threshold de Entrada</Text>
                <Text style={[s.infoValue, { color: C.warning }]}>{daoConfig.entryThreshold}%</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Sizing Multiplier</Text>
                <Text style={[s.infoValue, { color: planTheme.primary }]}>{daoConfig.sizingMultiplier.toFixed(2)}×</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Cérebros Desativados</Text>
                <Text style={[s.infoValue, { color: daoConfig.disabledBrains.length > 0 ? C.danger : C.success }]}>
                  {daoConfig.disabledBrains.length === 0 ? "Nenhum" : String(daoConfig.disabledBrains.length)}
                </Text>
              </View>
            </View>
          )}

          {/* Top brains */}
          {topBrains.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>🧠 Top 5 Cérebros (accuracy)</Text>
                <Pressable onPress={() => router.push("/hive-mind" as never)}>
                  <Text style={[s.seeAll, { color: planTheme.primary }]}>Analisar →</Text>
                </Pressable>
              </View>
              {topBrains.map((b, i) => (
                <View key={b.brainId} style={s.brainRow}>
                  <Text style={s.brainRank}>#{i + 1}</Text>
                  <Text style={s.brainId}>{b.brainId.replace(/_/g, " ")}</Text>
                  <Text style={[s.brainAcc, { color: b.accuracy >= 0.6 ? C.success : b.accuracy >= 0.45 ? C.warning : C.danger }]}>
                    {(b.accuracy * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Quick navigation to modules */}
          <Text style={s.sectionTitle}>Módulos 11-14</Text>
          {MODULE_ROUTES.map((m) => (
            <QuickNavCard key={m.route} {...m} />
          ))}

          {/* AI Tools section */}
          <Text style={s.sectionTitle}>Ferramentas de IA</Text>
          <QuickNavCard icon="scale-outline" label="Pesos dos Cérebros" sub="Ranking adaptativo dos 35 microcérebros" color="#7C3AED" route="/brain-weights" />
          <QuickNavCard icon="radio-outline" label="Detector de Regime" sub="Detecta regime de mercado via ML" color="#0891B2" route="/ai-regime" />
          <QuickNavCard icon="sparkles-outline" label="IA Explicável" sub="Explicação Layer 7 em linguagem natural" color="#D97706" route="/ai-explain" />

          {/* Audit log */}
          {auditLog.length > 0 && (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>📋 Auditoria Recente</Text>
              </View>
              {auditLog.map((entry) => (
                <View key={entry.id} style={s.auditRow}>
                  <Ionicons
                    name={entry.success ? "checkmark-circle-outline" : "close-circle-outline"}
                    size={14}
                    color={entry.success ? C.success : C.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.auditAction}>{entry.action.replace(/_/g, " ")}</Text>
                    <Text style={s.auditMeta}>{entry.userId ?? "anon"} · {entry.ip ?? ""}</Text>
                  </View>
                  <Text style={s.auditTime}>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  errorBox:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.danger + "22", borderRadius: 10, padding: 12 },
  errorText:    { color: C.danger, fontSize: 13, flex: 1 },
  statsRow:     { flexDirection: "row", gap: 10 },
  card:         { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: C.text },
  seeAll:       { fontSize: 12, fontWeight: "600" },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLabel:    { fontSize: 12, color: C.textSecondary },
  infoValue:    { fontSize: 13, fontWeight: "700" },
  brainRow:     { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  brainRank:    { fontSize: 11, color: C.textTertiary, width: 22 },
  brainId:      { flex: 1, fontSize: 12, color: C.text, textTransform: "capitalize" },
  brainAcc:     { fontSize: 13, fontWeight: "700" },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  auditRow:     { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  auditAction:  { fontSize: 12, color: C.text, textTransform: "capitalize" },
  auditMeta:    { fontSize: 10, color: C.textTertiary },
  auditTime:    { fontSize: 10, color: C.textTertiary },
});
