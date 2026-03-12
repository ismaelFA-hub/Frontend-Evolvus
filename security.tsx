/**
 * Evolvus Core Quantum — Admin IP Security Dashboard (Sprint LXIV)
 *
 * Shows all flagged/suspicious IPs with counts and options to block/unblock.
 * Uses the backend endpoints:
 *   GET  /admin/security       — list flagged IPs
 *   POST /admin/security/block  — block an IP
 *   POST /admin/security/unblock — unblock an IP
 *
 * Access is restricted to Enterprise users (enforced server-side).
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface IpEntry {
  ipAddress: string;
  userCount: number;
  totalRequests: number;
  firstSeen: string;
  lastSeen: string;
  flagged: boolean;
  blocked: boolean;
}

export default function AdminSecurityScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [ips, setIps] = useState<IpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("GET", "/admin/security");
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { flaggedIps: IpEntry[] };
      setIps(data.flaggedIps ?? []);
    } catch (err) {
      setError((err as Error).message ?? "Falha ao carregar IPs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBlock = useCallback(async (ip: string, currentlyBlocked: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const action = currentlyBlocked ? "unblock" : "block";
    Alert.alert(
      currentlyBlocked ? "Desbloquear IP" : "Bloquear IP",
      `Deseja ${currentlyBlocked ? "desbloquear" : "bloquear"} o IP ${ip}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: currentlyBlocked ? "Desbloquear" : "Bloquear",
          style: currentlyBlocked ? "default" : "destructive",
          onPress: async () => {
            setActioning(ip);
            try {
              const res = await apiRequest("POST", `/admin/security/${action}`, { ip });
              if (!res.ok) {
                const d = await res.json() as { message?: string };
                Alert.alert("Erro", d.message ?? "Falha na operação.");
              } else {
                setIps((prev) =>
                  prev.map((entry) =>
                    entry.ipAddress === ip ? { ...entry, blocked: !currentlyBlocked } : entry,
                  ),
                );
              }
            } catch {
              Alert.alert("Erro", "Não foi possível executar a ação.");
            } finally {
              setActioning(null);
            }
          },
        },
      ],
    );
  }, []);

  const flaggedCount = ips.filter((e) => e.flagged).length;
  const blockedCount = ips.filter((e) => e.blocked).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.backBtn}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>🛡️ Segurança — IPs</Text>
        <Pressable
          onPress={() => { setRefreshing(true); load(true); }}
          style={styles.backBtn}
          accessibilityLabel="Recarregar"
          accessibilityRole="button"
        >
          <Ionicons name="refresh" size={22} color={C.text} />
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{ips.length}</Text>
          <Text style={styles.statLabel}>IPs Monitorados</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#F7931A30" }]}>
          <Text style={[styles.statValue, { color: "#F7931A" }]}>{flaggedCount}</Text>
          <Text style={styles.statLabel}>Flagged</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#EF444430" }]}>
          <Text style={[styles.statValue, { color: "#EF4444" }]}>{blockedCount}</Text>
          <Text style={styles.statLabel}>Bloqueados</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={styles.loadingText}>Carregando IPs...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={C.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : ips.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark" size={64} color="#10B981" />
          <Text style={[styles.emptyText, { color: "#10B981" }]}>Nenhum IP suspeito detectado</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
        >
          {ips.map((entry) => (
            <View
              key={entry.ipAddress}
              style={[
                styles.ipCard,
                entry.blocked && { borderColor: "#EF4444", borderWidth: 1.5 },
                entry.flagged && !entry.blocked && { borderColor: "#F7931A", borderWidth: 1.5 },
              ]}
              accessibilityRole="article"
              accessibilityLabel={`IP ${entry.ipAddress}`}
            >
              <View style={styles.ipRow}>
                <View style={styles.ipInfo}>
                  <View style={styles.ipAddressRow}>
                    <Ionicons
                      name={entry.blocked ? "ban" : entry.flagged ? "warning" : "globe"}
                      size={16}
                      color={entry.blocked ? "#EF4444" : entry.flagged ? "#F7931A" : C.textSecondary}
                    />
                    <Text style={[styles.ipAddress, entry.blocked && { color: "#EF4444" }]}>
                      {entry.ipAddress}
                    </Text>
                    {entry.blocked && (
                      <View style={styles.blockedBadge}>
                        <Text style={styles.blockedBadgeText}>BLOQUEADO</Text>
                      </View>
                    )}
                    {entry.flagged && !entry.blocked && (
                      <View style={styles.flaggedBadge}>
                        <Text style={styles.flaggedBadgeText}>SUSPEITO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.ipMeta}>
                    {entry.userCount} conta(s) · {entry.totalRequests} reqs
                  </Text>
                  <Text style={styles.ipMeta}>
                    Último acesso: {new Date(entry.lastSeen).toLocaleString("pt-BR")}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.actionBtn,
                    { backgroundColor: entry.blocked ? "#10B98120" : "#EF444420" },
                  ]}
                  onPress={() => handleBlock(entry.ipAddress, entry.blocked)}
                  disabled={actioning === entry.ipAddress}
                  accessibilityRole="button"
                  accessibilityLabel={entry.blocked ? "Desbloquear IP" : "Bloquear IP"}
                >
                  {actioning === entry.ipAddress ? (
                    <ActivityIndicator size="small" color={entry.blocked ? "#10B981" : "#EF4444"} />
                  ) : (
                    <>
                      <Ionicons
                        name={entry.blocked ? "lock-open" : "ban"}
                        size={18}
                        color={entry.blocked ? "#10B981" : "#EF4444"}
                      />
                      <Text style={[styles.actionBtnText, { color: entry.blocked ? "#10B981" : "#EF4444" }]}>
                        {entry.blocked ? "Desbloquear" : "Bloquear"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ))}

          {/* Info note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle" size={16} color={C.textSecondary} />
            <Text style={styles.infoNoteText}>
              IPs com mais de 3 contas são automaticamente flagged. IPs usados em contas com trial são bloqueados para novos registros.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: C.text },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: C.text },
  statLabel: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.textSecondary },
  errorText: { marginTop: 12, fontSize: 14, color: C.error, textAlign: "center" },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.error,
  },
  retryBtnText: { fontSize: 14, fontWeight: "600", color: C.error },
  scrollContent: { padding: 16, gap: 10 },
  ipCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  ipRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ipInfo: { flex: 1, gap: 4 },
  ipAddressRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  ipAddress: { fontSize: 14, fontWeight: "700", color: C.text, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  blockedBadge: {
    backgroundColor: "#EF444420",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockedBadgeText: { fontSize: 10, fontWeight: "700", color: "#EF4444" },
  flaggedBadge: {
    backgroundColor: "#F7931A20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flaggedBadgeText: { fontSize: 10, fontWeight: "700", color: "#F7931A" },
  ipMeta: { fontSize: 12, color: C.textSecondary },
  actionBtn: {
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 90,
  },
  actionBtnText: { fontSize: 11, fontWeight: "700" },
  infoNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  infoNoteText: { flex: 1, fontSize: 12, color: C.textSecondary, lineHeight: 18 },
});
