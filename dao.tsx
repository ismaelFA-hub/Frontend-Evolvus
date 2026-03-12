import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface Vote {
  brainId: string;
  vote: "approve" | "reject" | "abstain";
  weight: number;
  reason: string;
}

interface Proposal {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  proposedBy: string;
  reason: string;
  votes: Vote[];
  approvalRatio: number;
  status: "pending" | "approved" | "rejected" | "expired";
  outcome?: string;
  createdAt: string;
}

interface DAOConfig {
  approvalThreshold: number;
  quorum: number;
  minBrainAccuracy: number;
  disabledBrains: string[];
}

interface Decision {
  proposalId: string;
  type: string;
  outcome: string;
  appliedAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  approved: "#00D4AA",
  rejected: "#FF4D4D",
  pending: "#F7931A",
  expired: "#6B7A99",
};

const STATUS_ICON: Record<string, string> = {
  approved: "checkmark-circle",
  rejected: "close-circle",
  pending: "time",
  expired: "ban",
};

function ProposalCard({ p, primary }: { p: Proposal; primary: string }) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLOR[p.status] ?? C.textTertiary;

  return (
    <Pressable style={[styles.card, { borderColor: color + "33" }]} onPress={() => setExpanded(!expanded)}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={STATUS_ICON[p.status] as any} size={18} color={color} />
          <Text style={[styles.proposalType, { color }]}>{p.type.replace(/_/g, " ")}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.statusText, { color }]}>{p.status}</Text>
        </View>
      </View>

      <Text style={styles.proposalReason} numberOfLines={expanded ? undefined : 2}>{p.reason || "Sem razão informada"}</Text>

      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>Aprovação: {(p.approvalRatio * 100).toFixed(0)}%</Text>
        <Text style={styles.metaText}>Votos: {p.votes.length}</Text>
        <Text style={styles.metaText}>{new Date(p.createdAt).toLocaleDateString()}</Text>
      </View>

      {expanded && (
        <View style={styles.voteList}>
          <Text style={styles.voteTitle}>Votos dos cérebros:</Text>
          {p.votes.slice(0, 5).map((v) => (
            <View key={v.brainId} style={styles.voteRow}>
              <Ionicons
                name={v.vote === "approve" ? "thumbs-up" : v.vote === "reject" ? "thumbs-down" : "remove"}
                size={12}
                color={v.vote === "approve" ? "#00D4AA" : v.vote === "reject" ? "#FF4D4D" : C.textTertiary}
              />
              <Text style={styles.voteBrain}>{v.brainId}</Text>
              <Text style={styles.voteReason}>{v.reason}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function DAOScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;
  const webTopInset = typeof window !== "undefined" ? 67 : 0;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [config, setConfig] = useState<DAOConfig | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"proposals" | "decisions" | "submit">("proposals");
  const [filter, setFilter] = useState<"all" | "approved" | "rejected" | "pending">("all");
  const [submitType, setSubmitType] = useState("risk_adjustment");
  const [submitReason, setSubmitReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, cfg, d] = await Promise.all([
        apiRequest("GET", "/api/dao/proposals") as Promise<Proposal[]>,
        apiRequest("GET", "/api/dao/config") as Promise<DAOConfig>,
        apiRequest("GET", "/api/dao/decisions") as Promise<Decision[]>,
      ]);
      setProposals(p ?? []);
      setConfig(cfg ?? null);
      setDecisions(d ?? []);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredProposals = filter === "all" ? proposals : proposals.filter((p) => p.status === filter);

  async function handleSubmit() {
    if (!submitReason.trim()) { setSubmitMsg("Informe uma razão para a proposta."); return; }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      await apiRequest("POST", "/api/dao/proposals", {
        type: submitType,
        payload: { reason: submitReason },
        reason: submitReason,
      });
      setSubmitMsg("Proposta enviada com sucesso!");
      setSubmitReason("");
      load();
    } catch (e: any) {
      setSubmitMsg("Erro ao enviar proposta.");
    }
    setSubmitting(false);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={[styles.title, { color: primary }]}>DAO de Estratégias</Text>
          <Text style={styles.subtitle}>Governança autônoma por cérebros IA</Text>
        </View>
      </View>

      {config && (
        <View style={[styles.configRow, { borderColor: primary + "33" }]}>
          <Text style={styles.configItem}>Quórum: {(config.quorum * 100).toFixed(0)}%</Text>
          <Text style={styles.configItem}>Aprovação: {(config.approvalThreshold * 100).toFixed(0)}%</Text>
          <Text style={styles.configItem}>Precisão mín: {(config.minBrainAccuracy * 100).toFixed(0)}%</Text>
        </View>
      )}

      <View style={styles.tabRow}>
        {(["proposals", "decisions", "submit"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && { borderBottomColor: primary, borderBottomWidth: 2 }]}
          >
            <Text style={[styles.tabText, tab === t && { color: primary }]}>
              {t === "proposals" ? "Propostas" : t === "decisions" ? "Decisões" : "Enviar"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={primary} size="large" /></View>
      ) : tab === "proposals" ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {(["all", "approved", "rejected", "pending"] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterBtn, filter === f && { backgroundColor: primary + "33", borderColor: primary }]}
              >
                <Text style={[styles.filterText, filter === f && { color: primary }]}>{f}</Text>
              </Pressable>
            ))}
          </View>
          {filteredProposals.length === 0 ? (
            <Text style={styles.empty}>Nenhuma proposta encontrada.</Text>
          ) : (
            filteredProposals.map((p) => <ProposalCard key={p.id} p={p} primary={primary} />)
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      ) : tab === "decisions" ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {decisions.length === 0 ? (
            <Text style={styles.empty}>Nenhuma decisão registrada.</Text>
          ) : (
            decisions.map((d, i) => (
              <View key={i} style={styles.decisionCard}>
                <Text style={[styles.decisionType, { color: primary }]}>{d.type.replace(/_/g, " ")}</Text>
                <Text style={styles.decisionOutcome}>{d.outcome}</Text>
                <Text style={styles.decisionDate}>{new Date(d.appliedAt).toLocaleString()}</Text>
              </View>
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.submitForm} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Tipo de proposta</Text>
          <View style={styles.typeRow}>
            {["risk_adjustment", "brain_weight_override", "strategy_toggle"].map((t) => (
              <Pressable
                key={t}
                onPress={() => setSubmitType(t)}
                style={[styles.typeBtn, submitType === t && { backgroundColor: primary + "33", borderColor: primary }]}
              >
                <Text style={[styles.typeText, submitType === t && { color: primary }]}>
                  {t.replace(/_/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Razão / Justificativa</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Descreva o motivo da proposta..."
            placeholderTextColor={C.textTertiary}
            value={submitReason}
            onChangeText={setSubmitReason}
          />

          {!!submitMsg && (
            <Text style={[styles.submitMsg, { color: submitMsg.includes("sucesso") ? "#00D4AA" : "#FF4D4D" }]}>
              {submitMsg}
            </Text>
          )}

          <Pressable
            style={[styles.submitBtn, { backgroundColor: primary }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.submitBtnText}>Enviar Proposta</Text>}
          </Pressable>
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  configRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
  },
  configItem: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, marginHorizontal: 16 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textTertiary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textTertiary },
  empty: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textTertiary, textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  proposalType: { fontFamily: "Inter_700Bold", fontSize: 13, textTransform: "uppercase" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  proposalReason: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  cardMeta: { flexDirection: "row", gap: 12 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  voteList: { gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  voteTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textTertiary, marginBottom: 4 },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  voteBrain: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, flex: 1 },
  voteReason: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary, flex: 2 },
  decisionCard: { backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 8, gap: 4 },
  decisionType: { fontFamily: "Inter_700Bold", fontSize: 13, textTransform: "uppercase" },
  decisionOutcome: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  decisionDate: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary },
  submitForm: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  typeText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textTertiary },
  textArea: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    minHeight: 100,
    color: C.text,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlignVertical: "top",
  },
  submitMsg: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#000" },
});
