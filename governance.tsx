/**
 * Evolvus Core Quantum — Módulo 13: Governança DAO
 *
 * Visualiza e gerencia a governança descentralizada do ecossistema:
 * - Lista de propostas com status (pending/approved/rejected/expired)
 * - Configuração atual do DAO (threshold, sizing, cérebros desativados)
 * - Log de decisões tomadas
 * - Criação de novas propostas
 *
 * Rotas: GET /api/governance/proposals
 *        POST /api/governance/proposals
 *        GET /api/governance/config
 *        GET /api/governance/decisions
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator,
  TextInput, Modal,
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

type ProposalType = "risk_adjustment" | "strategy_disable" | "strategy_enable" | "threshold_adjust" | "sizing_multiplier";
type ProposalStatus = "pending" | "approved" | "rejected" | "expired";

interface Vote { brainId: string; approve: boolean; weight: number; reasoning: string }

interface GovernanceProposal {
  id: string;
  type: ProposalType;
  payload: Record<string, unknown>;
  proposedBy: string;
  justification: string;
  status: ProposalStatus;
  votes: Vote[];
  approvalRatio: number;
  createdAt: string;
  resolvedAt?: string;
  outcome: string;
}

interface DAOConfig {
  sizingMultiplier: number;
  entryThreshold: number;
  disabledBrains: string[];
  defaultStopLoss: number;
  defaultTakeProfit: number;
}

interface GovernanceDecision {
  proposalId: string;
  type: ProposalType;
  payload: Record<string, unknown>;
  approvalRatio: number;
  resolvedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function statusColor(s: ProposalStatus): string {
  if (s === "approved") return C.success;
  if (s === "rejected") return C.danger;
  if (s === "expired") return C.textTertiary;
  return C.warning;
}

function statusIcon(s: ProposalStatus): string {
  if (s === "approved") return "checkmark-circle";
  if (s === "rejected") return "close-circle";
  if (s === "expired") return "time-outline";
  return "hourglass-outline";
}

function typeLabel(t: ProposalType): string {
  const map: Record<ProposalType, string> = {
    risk_adjustment: "Ajuste de Risco",
    strategy_disable: "Desativar Estratégia",
    strategy_enable: "Ativar Estratégia",
    threshold_adjust: "Ajustar Threshold",
    sizing_multiplier: "Multiplicador de Sizing",
  };
  return map[t] ?? t;
}

const PROPOSAL_TYPES: ProposalType[] = [
  "risk_adjustment", "strategy_disable", "strategy_enable",
  "threshold_adjust", "sizing_multiplier",
];

// ─── Proposal card ────────────────────────────────────────────────────

function ProposalCard({ p }: { p: GovernanceProposal }) {
  const approveCount = p.votes.filter((v) => v.approve).length;
  const rejectCount = p.votes.length - approveCount;
  return (
    <View style={s.proposalCard}>
      <View style={s.proposalHeader}>
        <View style={[s.statusBadge, { backgroundColor: statusColor(p.status) + "22" }]}>
          <Ionicons name={statusIcon(p.status) as never} size={12} color={statusColor(p.status)} />
          <Text style={[s.statusText, { color: statusColor(p.status) }]}>{p.status.toUpperCase()}</Text>
        </View>
        <Text style={s.proposalType}>{typeLabel(p.type)}</Text>
      </View>
      <Text style={s.proposalJustification} numberOfLines={2}>{p.justification}</Text>
      {/* Vote bar */}
      <View style={s.voteRow}>
        <View style={[s.voteBar, { flex: approveCount || 1, backgroundColor: C.success }]} />
        <View style={[s.voteBar, { flex: rejectCount || 1, backgroundColor: C.danger }]} />
      </View>
      <View style={s.voteStats}>
        <Text style={s.voteLabel}>✅ {approveCount} aprovam · ❌ {rejectCount} rejeitam</Text>
        <Text style={s.approvalRatio}>{(p.approvalRatio * 100).toFixed(0)}%</Text>
      </View>
      {p.outcome !== "" && (
        <Text style={s.outcome} numberOfLines={2}>{p.outcome}</Text>
      )}
      <Text style={s.timestamp}>{new Date(p.createdAt).toLocaleDateString()}</Text>
    </View>
  );
}

// ─── New Proposal Modal ───────────────────────────────────────────────

interface NewProposalModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (type: ProposalType, justification: string, payload: Record<string, unknown>) => Promise<void>;
  planPrimary: string;
}

function NewProposalModal({ visible, onClose, onSubmit, planPrimary }: NewProposalModalProps) {
  const [type, setType] = useState<ProposalType>("threshold_adjust");
  const [justification, setJustification] = useState("");
  const [value, setValue] = useState("");
  const [brainId, setBrainId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setValidationError(null);
    // ── Per-type validation ──────────────────────────────────────────
    if (type === "threshold_adjust") {
      const v = parseFloat(value);
      if (isNaN(v) || v < 50 || v > 95) { setValidationError("Threshold deve estar entre 50 e 95."); return; }
    } else if (type === "sizing_multiplier") {
      const v = parseFloat(value);
      if (isNaN(v) || v < 0.1 || v > 3.0) { setValidationError("Multiplicador deve estar entre 0.1 e 3.0."); return; }
    } else if (type === "risk_adjustment") {
      const v = parseFloat(value);
      if (isNaN(v) || v < 0.5 || v > 15) { setValidationError("Stop Loss % deve estar entre 0.5 e 15."); return; }
    } else if (type === "strategy_disable" || type === "strategy_enable") {
      if (!brainId.trim()) { setValidationError("Brain ID é obrigatório."); return; }
    }
    if (!justification.trim() || justification.trim().length < 10) {
      setValidationError("Justificativa deve ter pelo menos 10 caracteres.");
      return;
    }

    let payload: Record<string, unknown> = {};
    if (type === "threshold_adjust") payload = { newThreshold: parseFloat(value) };
    else if (type === "sizing_multiplier") payload = { sizingMultiplier: parseFloat(value) };
    else if (type === "strategy_disable" || type === "strategy_enable") payload = { targetBrainId: brainId };
    else if (type === "risk_adjustment") payload = { riskAdjustment: { stopLossPercent: parseFloat(value) } };
    setSubmitting(true);
    await onSubmit(type, justification, payload);
    setSubmitting(false);
    setValue("");
    setBrainId("");
    setJustification("");
    setValidationError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.sheetHeader}>
            <Text style={m.sheetTitle}>Nova Proposta</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.text} /></Pressable>
          </View>

          <ScrollView style={m.sheetScroll} showsVerticalScrollIndicator={false}>
            <Text style={m.fieldLabel}>Tipo de Proposta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {PROPOSAL_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[m.typeChip, type === t && { backgroundColor: planPrimary, borderColor: planPrimary }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setType(t); }}
                >
                  <Text style={[m.typeChipText, type === t && { color: "#fff" }]}>{typeLabel(t)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {(type === "threshold_adjust" || type === "sizing_multiplier" || type === "risk_adjustment") && (
              <>
                <Text style={m.fieldLabel}>
                  {type === "threshold_adjust" ? "Novo Threshold (60-90)" :
                   type === "sizing_multiplier" ? "Multiplicador (0.1-2.0)" :
                   "Stop Loss % (1-10)"}
                </Text>
                <TextInput
                  style={m.input}
                  value={value}
                  onChangeText={setValue}
                  keyboardType="decimal-pad"
                  placeholder={type === "threshold_adjust" ? "ex: 70" : "ex: 0.8"}
                  placeholderTextColor={C.textTertiary}
                />
              </>
            )}

            {(type === "strategy_disable" || type === "strategy_enable") && (
              <>
                <Text style={m.fieldLabel}>Brain ID</Text>
                <TextInput
                  style={m.input}
                  value={brainId}
                  onChangeText={setBrainId}
                  placeholder="ex: rsi_divergence"
                  placeholderTextColor={C.textTertiary}
                />
              </>
            )}

            <Text style={m.fieldLabel}>Justificativa</Text>
            <TextInput
              style={[m.input, m.textarea]}
              value={justification}
              onChangeText={setJustification}
              multiline
              numberOfLines={3}
              placeholder="Explique o motivo da proposta..."
              placeholderTextColor={C.textTertiary}
              accessibilityLabel="Justificativa da proposta"
            />

            {validationError && (
              <View style={{ backgroundColor: "#FF3B3011", borderRadius: 8, padding: 8, marginBottom: 8 }}>
                <Text style={{ color: C.danger, fontSize: 12 }}>⚠️ {validationError}</Text>
              </View>
            )}

            <Pressable
              style={[m.submitBtn, { backgroundColor: planPrimary }, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={m.submitBtnText}>Submeter Proposta</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const m = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" },
  sheetHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle:    { fontSize: 17, fontWeight: "700", color: C.text },
  sheetScroll:   { gap: 12 },
  fieldLabel:    { fontSize: 12, color: C.textSecondary, marginBottom: 6, marginTop: 12 },
  typeChip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginRight: 8, backgroundColor: C.background },
  typeChipText:  { fontSize: 12, fontWeight: "600", color: C.text },
  input:         { backgroundColor: C.background, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 13 },
  textarea:      { height: 80, textAlignVertical: "top" },
  submitBtn:     { marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 8 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});

// ─── Main screen ──────────────────────────────────────────────────────

type Tab = "proposals" | "config" | "decisions";

export default function GovernanceScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [tab, setTab] = useState<Tab>("proposals");
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [config, setConfig] = useState<DAOConfig | null>(null);
  const [decisions, setDecisions] = useState<GovernanceDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ProposalType | "all">("all");

  const loadData = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      if (t === "proposals") {
        const url = statusFilter !== "all" ? `/api/governance/proposals?status=${statusFilter}` : "/api/governance/proposals";
        const res = await apiRequest("GET", url);
        const data = await res.json() as { proposals: GovernanceProposal[] };
        setProposals(data.proposals ?? []);
      } else if (t === "config") {
        const res = await apiRequest("GET", "/api/governance/config");
        const data = await res.json() as { config: DAOConfig };
        setConfig(data.config);
      } else {
        const res = await apiRequest("GET", "/api/governance/decisions");
        const data = await res.json() as { decisions: GovernanceDecision[] };
        setDecisions(data.decisions ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadData(tab); }, [tab, loadData]);

  const submitProposal = async (type: ProposalType, justification: string, payload: Record<string, unknown>) => {
    try {
      const res = await apiRequest("POST", "/api/governance/proposals", { type, payload, justification });
      if (!res.ok) throw new Error("Falha ao submeter proposta");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadData("proposals");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "proposals", label: "Propostas", icon: "document-text-outline" },
    { key: "config",    label: "Config DAO", icon: "settings-outline" },
    { key: "decisions", label: "Decisões", icon: "checkmark-done-outline" },
  ];

  const STATUS_FILTERS: (ProposalStatus | "all")[] = ["all", "pending", "approved", "rejected", "expired"];

  return (
    <View style={[s.root, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('governance')}</Text>
          <Text style={s.subtitle}>Votação descentralizada dos 35 cérebros</Text>
        </View>
        <Pressable
          style={[s.newBtn, { backgroundColor: planTheme.primary }]}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.newBtnText}>Nova</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[s.tabBtn, tab === t.key && { borderBottomColor: planTheme.primary, borderBottomWidth: 2 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(t.key); }}
          >
            <Ionicons name={t.icon as never} size={16} color={tab === t.key ? planTheme.primary : C.textSecondary} />
            <Text style={[s.tabText, tab === t.key && { color: planTheme.primary }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {loading && <ActivityIndicator color={planTheme.primary} style={{ marginTop: 32 }} />}

        {/* Proposals tab */}
        {!loading && tab === "proposals" && (
          <>
            {/* Status filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {STATUS_FILTERS.map((sf) => (
                <Pressable
                  key={sf}
                  style={[s.chip, statusFilter === sf && { backgroundColor: planTheme.primary }]}
                  onPress={() => { setStatusFilter(sf); }}
                >
                  <Text style={[s.chipText, statusFilter === sf && { color: "#fff" }]}>{sf === "all" ? "Todas" : sf.toUpperCase()}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* Type filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(["all", ...PROPOSAL_TYPES] as Array<ProposalType | "all">).map((tf) => (
                <Pressable
                  key={tf}
                  style={[s.chip, typeFilter === tf && { backgroundColor: planTheme.accent ?? "#6C63FF" }]}
                  onPress={() => setTypeFilter(tf)}
                >
                  <Text style={[s.chipText, typeFilter === tf && { color: "#fff" }]}>
                    {tf === "all" ? "Tipo: Todos" : typeLabel(tf)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {(() => {
              const filtered = proposals.filter((p) =>
                (typeFilter === "all" || p.type === typeFilter)
              );
              if (filtered.length === 0) return (
                <View style={s.emptyState}>
                  <Ionicons name="document-text-outline" size={40} color={C.textTertiary} />
                  <Text style={s.emptyText}>Nenhuma proposta encontrada</Text>
                  <Pressable style={[s.emptyBtn, { borderColor: planTheme.primary }]} onPress={() => setShowModal(true)}>
                    <Text style={[s.emptyBtnText, { color: planTheme.primary }]}>Criar primeira proposta</Text>
                  </Pressable>
                </View>
              );
              return filtered.map((p) => <ProposalCard key={p.id} p={p} />);
            })()}
          </>
        )}

        {/* Config tab */}
        {!loading && tab === "config" && config && (
          <View style={s.card}>
            <Text style={s.cardTitle}>⚙️ Configuração Atual do DAO</Text>
            {[
              { label: "Threshold de Entrada", value: `${config.entryThreshold}%`, color: C.warning },
              { label: "Multiplicador de Sizing", value: `${config.sizingMultiplier.toFixed(2)}×`, color: planTheme.primary },
              { label: "Stop Loss Padrão", value: `${config.defaultStopLoss}%`, color: C.danger },
              { label: "Take Profit Padrão", value: `${config.defaultTakeProfit}%`, color: C.success },
            ].map((row) => (
              <View key={row.label} style={s.configRow}>
                <Text style={s.configLabel}>{row.label}</Text>
                <Text style={[s.configValue, { color: row.color }]}>{row.value}</Text>
              </View>
            ))}
            <View style={s.configRow}>
              <Text style={s.configLabel}>Cérebros Desativados</Text>
              <Text style={[s.configValue, { color: config.disabledBrains.length > 0 ? C.danger : C.success }]}>
                {config.disabledBrains.length === 0 ? "Nenhum" : config.disabledBrains.join(", ")}
              </Text>
            </View>
          </View>
        )}

        {/* Decisions tab */}
        {!loading && tab === "decisions" && (
          decisions.length === 0
            ? (
              <View style={s.emptyState}>
                <Ionicons name="checkmark-done-outline" size={40} color={C.textTertiary} />
                <Text style={s.emptyText}>Nenhuma decisão registrada</Text>
              </View>
            )
            : decisions.map((d) => (
              <View key={d.proposalId} style={s.decisionCard}>
                <View style={s.decisionHeader}>
                  <Text style={s.decisionType}>{typeLabel(d.type)}</Text>
                  <Text style={[s.decisionRatio, { color: d.approvalRatio >= 0.5 ? C.success : C.danger }]}>
                    {(d.approvalRatio * 100).toFixed(0)}%
                  </Text>
                </View>
                <Text style={s.decisionDate}>{new Date(d.resolvedAt).toLocaleDateString()}</Text>
              </View>
            ))
        )}
      </ScrollView>

      <NewProposalModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={submitProposal}
        planPrimary={planTheme.primary}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.background },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  backBtn:        { padding: 4 },
  title:          { fontSize: 18, fontWeight: "700", color: C.text },
  subtitle:       { fontSize: 12, color: C.textSecondary },
  newBtn:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  newBtnText:     { fontSize: 13, fontWeight: "700", color: "#fff" },
  tabRow:         { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, marginHorizontal: 16 },
  tabBtn:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 },
  tabText:        { fontSize: 12, fontWeight: "600", color: C.textSecondary },
  scroll:         { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12, gap: 10 },
  errorBox:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.danger + "22", borderRadius: 10, padding: 12 },
  errorText:      { color: C.danger, fontSize: 13, flex: 1 },
  chip:           { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: C.surface, marginRight: 8, borderWidth: 1, borderColor: C.border },
  chipText:       { fontSize: 11, fontWeight: "600", color: C.text },
  proposalCard:   { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  proposalHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  statusBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText:     { fontSize: 10, fontWeight: "700" },
  proposalType:   { fontSize: 13, fontWeight: "700", color: C.text },
  proposalJustification: { fontSize: 12, color: C.textSecondary, marginBottom: 8 },
  voteRow:        { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", gap: 1, marginBottom: 4 },
  voteBar:        { borderRadius: 3 },
  voteStats:      { flexDirection: "row", justifyContent: "space-between" },
  voteLabel:      { fontSize: 11, color: C.textSecondary },
  approvalRatio:  { fontSize: 13, fontWeight: "700", color: C.text },
  outcome:        { fontSize: 11, color: C.textTertiary, marginTop: 4, fontStyle: "italic" },
  timestamp:      { fontSize: 10, color: C.textTertiary, marginTop: 6, textAlign: "right" },
  card:           { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle:      { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 12 },
  configRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  configLabel:    { fontSize: 13, color: C.textSecondary },
  configValue:    { fontSize: 13, fontWeight: "700" },
  decisionCard:   { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  decisionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  decisionType:   { fontSize: 13, fontWeight: "600", color: C.text },
  decisionRatio:  { fontSize: 15, fontWeight: "800" },
  decisionDate:   { fontSize: 11, color: C.textTertiary, marginTop: 2 },
  emptyState:     { alignItems: "center", gap: 12, paddingVertical: 48 },
  emptyText:      { fontSize: 14, color: C.textSecondary, textAlign: "center" },
  emptyBtn:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  emptyBtnText:   { fontSize: 13, fontWeight: "600" },
});
