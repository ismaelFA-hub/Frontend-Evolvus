import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface AuditEntry {
  id: string;
  action: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  login: { label: "Login", icon: "log-in-outline", color: C.success },
  logout: { label: "Logout", icon: "log-out-outline", color: C.textSecondary },
  register: { label: "Cadastro", icon: "person-add-outline", color: C.primary },
  password_reset: { label: "Senha redefinida", icon: "key-outline", color: C.warning },
  totp_setup: { label: "2FA configurado", icon: "shield-outline", color: C.success },
  totp_enabled: { label: "2FA ativado", icon: "shield-checkmark-outline", color: C.success },
  totp_disabled: { label: "2FA desativado", icon: "shield-outline", color: C.danger },
  profile_updated: { label: "Perfil atualizado", icon: "person-outline", color: C.primary },
  api_key_added: { label: "Chave API adicionada", icon: "key-outline", color: C.success },
  api_key_deleted: { label: "Chave API removida", icon: "trash-outline", color: C.danger },
  user_level_updated: { label: "Nível atualizado", icon: "trending-up-outline", color: C.primary },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UserAuditScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/security/audit-log");
      const data = await res.json();
      setEntries(data.logs || data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>🔍 Auditoria da Conta</Text>
          <Text style={s.subtitle}>Histórico de atividades</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
      >
        {entries.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="document-outline" size={40} color={C.textTertiary} />
            <Text style={s.emptyText}>Nenhuma atividade registrada ainda.</Text>
          </View>
        ) : (
          entries.map((entry, i) => {
            const meta = ACTION_LABELS[entry.action] || {
              label: entry.action.replace(/_/g, " "),
              icon: "ellipse-outline",
              color: C.textSecondary,
            };
            return (
              <View key={entry.id || i} style={s.entryCard}>
                <View style={[s.iconContainer, { backgroundColor: meta.color + "20" }]}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                </View>
                <View style={s.entryInfo}>
                  <View style={s.entryTop}>
                    <Text style={s.entryLabel}>{meta.label}</Text>
                    {!entry.success && (
                      <View style={s.failBadge}>
                        <Text style={s.failBadgeText}>Falhou</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.entryTime}>{formatTime(entry.createdAt)}</Text>
                  {entry.ip && <Text style={s.entryIp}>IP: {entry.ip}</Text>}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <Text style={s.entryMeta} numberOfLines={1}>
                      {Object.entries(entry.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                    </Text>
                  )}
                </View>
                <View style={[s.successDot, { backgroundColor: entry.success ? C.success : C.danger }]} />
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  scroll: { paddingHorizontal: 20, gap: 10, paddingTop: 8 },
  emptyCard: { alignItems: "center", gap: 12, padding: 48 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  entryCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  iconContainer: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  entryInfo: { flex: 1, gap: 3 },
  entryTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  entryLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  failBadge: { backgroundColor: C.danger + "30", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  failBadgeText: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.danger },
  entryTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  entryIp: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  entryMeta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  successDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
