/**
 * Sprint LXIX — Enterprise Team Management Screen
 *
 * Allows Enterprise users to:
 *   - View current team members (with status badges)
 *   - Invite new members by email
 *   - Remove existing members
 *
 * Access is restricted to Enterprise plan users (enforced server-side).
 * Route: /enterprise/users
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: number;
  enterpriseId: string;
  memberEmail: string;
  memberId: string | null;
  status: "pending" | "active" | "removed";
  invitedAt: string;
  joinedAt: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnterpriseUsersScreen() {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ─── Fetch members ─────────────────────────────────────────────────────────

  const fetchMembers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiRequest<TeamMember[]>("/api/enterprise/members");
      setMembers(data ?? []);
    } catch {
      setErrorMsg("Não foi possível carregar os membros da equipe.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ─── Invite ───────────────────────────────────────────────────────────────

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes("@")) {
      setErrorMsg("Insira um endereço de e-mail válido.");
      return;
    }
    setInviting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiRequest("/api/enterprise/invite", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccessMsg(`Convite enviado para ${email} ✉️`);
      setInviteEmail("");
      fetchMembers(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar convite.";
      setErrorMsg(msg);
    } finally {
      setInviting(false);
    }
  };

  // ─── Remove ───────────────────────────────────────────────────────────────

  const handleRemove = (member: TeamMember) => {
    if (Platform.OS === "web") {
      if (!confirm(`Remover ${member.memberEmail} da equipe?`)) return;
      doRemove(member.memberId!);
    } else {
      Alert.alert(
        "Remover membro",
        `Remover ${member.memberEmail} da equipe?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Remover", style: "destructive", onPress: () => doRemove(member.memberId!) },
        ],
      );
    }
  };

  const doRemove = async (memberId: string) => {
    setErrorMsg(null);
    try {
      await apiRequest(`/api/enterprise/members/${memberId}`, { method: "DELETE" });
      setSuccessMsg("Membro removido com sucesso.");
      fetchMembers(true);
    } catch {
      setErrorMsg("Falha ao remover membro.");
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const statusLabel = (status: TeamMember["status"]) => {
    if (status === "active") return { text: "Ativo", color: "#22C55E" };
    if (status === "pending") return { text: "Pendente", color: "#F59E0B" };
    return { text: "Removido", color: "#6B7280" };
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Voltar"
          testID="enterprise-back-btn"
        >
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gerenciar Equipe</Text>
        <Pressable
          onPress={() => fetchMembers()}
          accessibilityLabel="Atualizar"
          testID="enterprise-refresh-btn"
        >
          <Ionicons name="refresh" size={20} color={C.muted} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Invite section */}
        <View style={styles.card} testID="enterprise-invite-section">
          <Text style={styles.cardTitle}>Convidar Membro</Text>
          <Text style={styles.cardDesc}>
            Insira o e-mail do colaborador para enviar um convite de acesso à sua conta Enterprise.
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="email@empresa.com"
              placeholderTextColor={C.muted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              testID="enterprise-invite-email-input"
              accessibilityLabel="E-mail do convidado"
            />
            <Pressable
              style={[styles.inviteBtn, inviting && styles.btnDisabled]}
              onPress={handleInvite}
              disabled={inviting}
              testID="enterprise-invite-btn"
              accessibilityLabel="Enviar convite"
            >
              {inviting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.inviteBtnText}>Convidar</Text>
              }
            </Pressable>
          </View>
          {successMsg && (
            <Text style={styles.successText} testID="enterprise-success-msg">{successMsg}</Text>
          )}
          {errorMsg && (
            <Text style={styles.errorText} testID="enterprise-error-msg">{errorMsg}</Text>
          )}
        </View>

        {/* Members list */}
        <View style={styles.card} testID="enterprise-members-list">
          <Text style={styles.cardTitle}>
            Membros da Equipe {members.length > 0 && `(${members.filter(m => m.status !== "removed").length})`}
          </Text>
          {loading
            ? <ActivityIndicator size="large" color={C.primary} style={{ marginVertical: 24 }} />
            : members.filter(m => m.status !== "removed").length === 0
            ? (
              <Text style={styles.emptyText}>
                Nenhum membro ainda. Convide colaboradores acima.
              </Text>
            )
            : members.filter(m => m.status !== "removed").map((member) => {
              const badge = statusLabel(member.status);
              return (
                <View key={member.id} style={styles.memberRow} testID={`enterprise-member-${member.id}`}>
                  <Ionicons
                    name={member.status === "active" ? "person-circle" : "mail"}
                    size={36}
                    color={badge.color}
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberEmail}>{member.memberEmail}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusBadge, { backgroundColor: badge.color + "33" }]}>
                        <Text style={[styles.statusText, { color: badge.color }]}>{badge.text}</Text>
                      </View>
                      {member.invitedAt && (
                        <Text style={styles.dateText}>
                          Convidado: {new Date(member.invitedAt).toLocaleDateString("pt-BR")}
                        </Text>
                      )}
                    </View>
                  </View>
                  {member.status === "active" && member.memberId && (
                    <Pressable
                      onPress={() => handleRemove(member)}
                      style={styles.removeBtn}
                      testID={`enterprise-remove-${member.id}`}
                      accessibilityLabel={`Remover ${member.memberEmail}`}
                    >
                      <Ionicons name="person-remove" size={18} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              );
            })
          }
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={C.muted} />
          <Text style={styles.infoText}>
            Membros da equipe têm acesso às funcionalidades compartilhadas da sua conta Enterprise.
            Gerencie permissões individuais em Configurações.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backBtn: { marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: Colors.dark.text },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.dark.text },
  cardDesc: { fontSize: 13, color: Colors.dark.muted, lineHeight: 18 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.dark.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inviteBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 90,
  },
  btnDisabled: { opacity: 0.5 },
  inviteBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  successText: { color: "#22C55E", fontSize: 13 },
  errorText: { color: "#EF4444", fontSize: 13 },
  emptyText: { color: Colors.dark.muted, fontSize: 14, textAlign: "center", paddingVertical: 16 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  memberEmail: { fontSize: 14, color: Colors.dark.text, fontWeight: "500" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600" },
  dateText: { fontSize: 11, color: Colors.dark.muted },
  removeBtn: { padding: 8 },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.dark.muted, lineHeight: 16 },
});
