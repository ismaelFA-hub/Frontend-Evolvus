/**
 * Evolvus Core Quantum — Security Dashboard (Module 15: Defense Grid)
 *
 * Admin screen for real-time security monitoring:
 * - Active threat summary (by severity)
 * - Blocked IPs list
 * - Incident timeline (last 24h)
 * - Manual actions: block IP, unblock IP, resolve incident
 *
 * Routes: GET  /api/security/health
 *         GET  /api/security/threats
 *         GET  /api/security/blocked
 *         GET  /api/security/timeline
 *         POST /api/security/respond
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

// ── Types ────────────────────────────────────────────────────

interface IncidentSummary {
  low: number;
  medium: number;
  high: number;
  critical: number;
  total: number;
}

interface SecurityHealth {
  status: "healthy" | "degraded" | "critical";
  summary: IncidentSummary;
  recentAlerts: SecurityIncident[];
  blockedIpCount: number;
  honeypotPathCount: number;
}

interface SecurityIncident {
  id: number;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  sourceIp?: string;
  userId?: number;
  endpoint?: string;
  description: string;
  action: string;
  resolved: boolean;
  resolvedAt?: string;
}

interface BlockedIp {
  ip: string;
  reason: string;
  expiresAt: number;
}

// ── Helpers ──────────────────────────────────────────────────

function severityColor(s: string): string {
  switch (s) {
    case "critical": return "#ef4444";
    case "high":     return "#f97316";
    case "medium":   return "#eab308";
    case "low":      return "#22c55e";
    default:         return "#6b7280";
  }
}

function statusColor(s: string): string {
  switch (s) {
    case "critical": return "#ef4444";
    case "degraded": return "#f97316";
    default:         return "#22c55e";
  }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

// ── Main Component ───────────────────────────────────────────

export default function SecurityScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { theme } = usePlanTheme();
  const C = Colors[theme ?? "dark"] ?? Colors.dark;

  const [health, setHealth] = useState<SecurityHealth | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockIpInput, setBlockIpInput] = useState("");
  const [responding, setResponding] = useState(false);
  const [tab, setTab] = useState<"threats" | "blocked" | "timeline">("threats");

  const fetchAll = useCallback(async () => {
    try {
      const [h, t, b] = await Promise.all([
        apiRequest<SecurityHealth>("GET", "/api/security/health"),
        apiRequest<{ incidents: SecurityIncident[] }>("GET", "/api/security/threats"),
        apiRequest<{ blockedIps: BlockedIp[] }>("GET", "/api/security/blocked"),
      ]);
      setHealth(h);
      setIncidents(t.incidents ?? []);
      setBlocked(b.blockedIps ?? []);
    } catch (e) {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    const id = setInterval(fetchAll, 30_000); // poll every 30s
    return () => clearInterval(id);
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const respond = useCallback(async (action: object) => {
    setResponding(true);
    try {
      await apiRequest("POST", "/api/security/respond", action);
      await fetchAll();
    } catch (e) {
      Alert.alert("Error", "Action failed. Check your permissions.");
    } finally {
      setResponding(false);
    }
  }, [fetchAll]);

  const handleBlockIp = () => {
    const ip = blockIpInput.trim();
    if (!ip) return;
    Alert.alert("Block IP", `Block ${ip} for 30 minutes?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block", style: "destructive",
        onPress: () => respond({ action: "block_ip", ip }),
      },
    ]);
  };

  const handleUnblockIp = (ip: string) => {
    Alert.alert("Unblock IP", `Unblock ${ip}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Unblock", onPress: () => respond({ action: "unblock_ip", ip }) },
    ]);
  };

  const handleResolve = (id: number) => {
    Alert.alert("Resolve Incident", "Mark this incident as resolved?", [
      { text: "Cancel", style: "cancel" },
      { text: "Resolve", onPress: () => respond({ action: "resolve_incident", incidentId: id }) },
    ]);
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

  const statusText = health?.status ?? "unknown";

  return (
    <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={[s.title, { color: C.text }]}>{t('security')}</Text>
        <View style={[s.statusBadge, { backgroundColor: statusColor(statusText) + "22", borderColor: statusColor(statusText) }]}>
          <Text style={[s.statusText, { color: statusColor(statusText) }]}>{statusText.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.tint} />}
      >
        {/* Summary Cards */}
        {health && (
          <View style={s.cardRow}>
            {(["critical", "high", "medium", "low"] as const).map((sev) => (
              <View key={sev} style={[s.severityCard, { backgroundColor: C.card, borderColor: severityColor(sev) }]}>
                <Text style={[s.sevCount, { color: severityColor(sev) }]}>{health.summary[sev]}</Text>
                <Text style={[s.sevLabel, { color: C.subtext }]}>{sev}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Stats row */}
        {health && (
          <View style={[s.statsRow, { backgroundColor: C.card }]}>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: C.text }]}>{health.blockedIpCount}</Text>
              <Text style={[s.statLabel, { color: C.subtext }]}>Blocked IPs</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: C.text }]}>{health.summary.total}</Text>
              <Text style={[s.statLabel, { color: C.subtext }]}>Open Incidents</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statNum, { color: C.text }]}>{health.honeypotPathCount}</Text>
              <Text style={[s.statLabel, { color: C.subtext }]}>Honeypots</Text>
            </View>
          </View>
        )}

        {/* Block IP input */}
        <View style={[s.blockRow, { backgroundColor: C.card }]}>
          <TextInput
            style={[s.ipInput, { color: C.text, borderColor: C.border }]}
            placeholder="IP to block (e.g. 1.2.3.4)"
            placeholderTextColor={C.subtext}
            value={blockIpInput}
            onChangeText={setBlockIpInput}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
          <Pressable
            style={[s.blockBtn, { backgroundColor: "#ef4444" }]}
            onPress={handleBlockIp}
            disabled={responding}
          >
            <Text style={s.blockBtnText}>Block IP</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={[s.tabs, { backgroundColor: C.card }]}>
          {(["threats", "blocked", "timeline"] as const).map((t2) => (
            <Pressable
              key={t2}
              style={[s.tabBtn, tab === t2 && { borderBottomColor: C.tint, borderBottomWidth: 2 }]}
              onPress={() => setTab(t2)}
            >
              <Text style={[s.tabText, { color: tab === t2 ? C.tint : C.subtext }]}>
                {t2.charAt(0).toUpperCase() + t2.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Incidents tab */}
        {tab === "threats" && (
          <View>
            {incidents.length === 0 ? (
              <Text style={[s.empty, { color: C.subtext }]}>✅ No open threats</Text>
            ) : incidents.map((inc) => (
              <View key={inc.id} style={[s.incidentRow, { backgroundColor: C.card, borderLeftColor: severityColor(inc.severity) }]}>
                <View style={s.incHeader}>
                  <Text style={[s.incType, { color: severityColor(inc.severity) }]}>{inc.type.replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={[s.incTime, { color: C.subtext }]}>{fmtDate(inc.timestamp)}</Text>
                </View>
                <Text style={[s.incDesc, { color: C.text }]} numberOfLines={2}>{inc.description}</Text>
                {inc.sourceIp && <Text style={[s.incMeta, { color: C.subtext }]}>IP: {inc.sourceIp}</Text>}
                <Pressable style={s.resolveBtn} onPress={() => handleResolve(inc.id)}>
                  <Text style={s.resolveBtnText}>✓ Resolve</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Blocked IPs tab */}
        {tab === "blocked" && (
          <View>
            {blocked.length === 0 ? (
              <Text style={[s.empty, { color: C.subtext }]}>No IPs currently blocked</Text>
            ) : blocked.map((b) => (
              <View key={b.ip} style={[s.incidentRow, { backgroundColor: C.card, borderLeftColor: "#ef4444" }]}>
                <View style={s.incHeader}>
                  <Text style={[s.incType, { color: C.text }]}>{b.ip}</Text>
                  <Text style={[s.incTime, { color: C.subtext }]}>Exp: {fmtTime(new Date(b.expiresAt).toISOString())}</Text>
                </View>
                <Text style={[s.incMeta, { color: C.subtext }]}>{b.reason}</Text>
                <Pressable style={[s.resolveBtn, { backgroundColor: "#22c55e22" }]} onPress={() => handleUnblockIp(b.ip)}>
                  <Text style={[s.resolveBtnText, { color: "#22c55e" }]}>↑ Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Timeline tab — recent alerts from health endpoint */}
        {tab === "timeline" && (
          <View>
            {(health?.recentAlerts ?? []).length === 0 ? (
              <Text style={[s.empty, { color: C.subtext }]}>No recent high-severity alerts</Text>
            ) : (health?.recentAlerts ?? []).map((inc) => (
              <View key={inc.id} style={[s.incidentRow, { backgroundColor: C.card, borderLeftColor: severityColor(inc.severity) }]}>
                <View style={s.incHeader}>
                  <Text style={[s.incType, { color: severityColor(inc.severity) }]}>{inc.type.replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={[s.incTime, { color: C.subtext }]}>{fmtDate(inc.timestamp)}</Text>
                </View>
                <Text style={[s.incDesc, { color: C.text }]} numberOfLines={2}>{inc.description}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  severityCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: "center" },
  sevCount: { fontSize: 22, fontWeight: "800" },
  sevLabel: { fontSize: 10, textTransform: "uppercase", marginTop: 2 },
  statsRow: { flexDirection: "row", borderRadius: 10, padding: 12, marginBottom: 12 },
  stat: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  blockRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, padding: 10, gap: 8, marginBottom: 12 },
  ipInput: { flex: 1, height: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 14 },
  blockBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  blockBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  tabs: { flexDirection: "row", borderRadius: 10, marginBottom: 12, overflow: "hidden" },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabText: { fontSize: 13, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 20, fontSize: 14 },
  incidentRow: { borderRadius: 10, borderLeftWidth: 4, padding: 12, marginBottom: 8 },
  incHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  incType: { fontSize: 11, fontWeight: "700" },
  incTime: { fontSize: 11 },
  incDesc: { fontSize: 13, marginBottom: 4 },
  incMeta: { fontSize: 11, marginBottom: 6 },
  resolveBtn: { alignSelf: "flex-start", backgroundColor: "#22c55e22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  resolveBtnText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
});
