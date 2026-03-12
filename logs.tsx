/**
 * Evolvus Core Quantum — Admin Logs Page
 *
 * Exibe logs de auditoria do sistema com filtros por módulo/ação, nível e data.
 * Rota: GET /api/security/audit-log?limit=200
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
  ActivityIndicator, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { usePlanTheme } from "@/lib/theme-context";

const C = Colors.dark;

// ─── Constants ────────────────────────────────────────────────────────
const DEFAULT_LOG_LIMIT = 200;

// ─── Types ────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  ip: string;
  userAgent: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function levelColor(success: boolean, action: string): string {
  if (!success) return C.danger;
  if (action.startsWith("bot_") || action.startsWith("trade_")) return "#8BC34A";
  if (action.startsWith("dao_") || action.startsWith("endocrine_")) return "#7C3AED";
  return C.textSecondary;
}

function levelIcon(success: boolean): string {
  return success ? "checkmark-circle-outline" : "alert-circle-outline";
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}

// ─── Module categories ────────────────────────────────────────────────

const MODULE_PREFIXES: Record<string, string> = {
  "bot_":         "Bot",
  "trade_":       "Trade",
  "dao_":         "DAO",
  "endocrine_":   "Endócrino",
  "multi_tf_":    "Multi-TF",
  "login":        "Auth",
  "logout":       "Auth",
  "api_key_":     "API Keys",
};

function detectModule(action: string): string {
  for (const [prefix, label] of Object.entries(MODULE_PREFIXES)) {
    if (action.startsWith(prefix) || action === prefix.replace("_", "")) return label;
  }
  return "Sistema";
}

const ALL_MODULES = ["Todos", "Bot", "Trade", "DAO", "Endócrino", "Multi-TF", "Auth", "API Keys", "Sistema"];
const ALL_LEVELS  = ["Todos", "Sucesso", "Erro"];

// ─── Log entry row ────────────────────────────────────────────────────

function LogRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = levelColor(entry.success, entry.action);

  return (
    <Pressable style={r.row} onPress={() => setExpanded((v) => !v)}>
      <View style={r.rowHeader}>
        <Ionicons name={levelIcon(entry.success) as never} size={14} color={color} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[r.action, { color }]} numberOfLines={1}>{entry.action}</Text>
          <Text style={r.ts}>{formatTs(entry.timestamp)}</Text>
        </View>
        <View style={[r.badge, { borderColor: color }]}>
          <Text style={[r.badgeText, { color }]}>{detectModule(entry.action)}</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={C.textTertiary} />
      </View>
      {expanded && (
        <View style={r.detail}>
          <Text style={r.detailLine}>IP: {entry.ip}</Text>
          <Text style={r.detailLine}>User Agent: {entry.userAgent}</Text>
          {entry.metadata && (
            <Text style={r.detailLine}>{JSON.stringify(entry.metadata, null, 2)}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const r = StyleSheet.create({
  row:        { backgroundColor: C.card, borderRadius: 8, padding: 10, marginBottom: 6 },
  rowHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  action:     { fontSize: 13, fontWeight: "600" },
  ts:         { fontSize: 10, color: C.textTertiary, marginTop: 1 },
  badge:      { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText:  { fontSize: 9, fontWeight: "700" },
  detail:     { marginTop: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  detailLine: { fontSize: 11, color: C.textSecondary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", marginBottom: 2 },
});

// ─── Main screen ──────────────────────────────────────────────────────

export default function AdminLogsScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState("Todos");
  const [levelFilter, setLevelFilter] = useState("Todos");
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("GET", `/api/security/audit-log?limit=${DEFAULT_LOG_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { logs: AuditEntry[] };
      setLogs(data.logs ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = logs.filter((entry) => {
    if (moduleFilter !== "Todos" && detectModule(entry.action) !== moduleFilter) return false;
    if (levelFilter === "Sucesso" && !entry.success) return false;
    if (levelFilter === "Erro" && entry.success) return false;
    if (search && !entry.action.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View style={[s.screen, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>📋 Logs do Sistema</Text>
        <Pressable onPress={loadLogs} style={s.refreshBtn}>
          {loading ? <ActivityIndicator size="small" color={C.text} /> : <Ionicons name="refresh" size={20} color={C.text} />}
        </Pressable>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.textTertiary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por ação..."
          placeholderTextColor={C.textTertiary}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={C.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Module filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {ALL_MODULES.map((m) => (
          <Pressable
            key={m}
            style={[s.chip, moduleFilter === m && { backgroundColor: planTheme.primary, borderColor: planTheme.primary }]}
            onPress={() => setModuleFilter(m)}
          >
            <Text style={[s.chipText, moduleFilter === m && { color: "#fff" }]}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Level filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.filterScroll, { marginBottom: 8 }]} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {ALL_LEVELS.map((l) => (
          <Pressable
            key={l}
            style={[s.chip, levelFilter === l && { backgroundColor: l === "Erro" ? C.danger : C.success, borderColor: "transparent" }]}
            onPress={() => setLevelFilter(l)}
          >
            <Text style={[s.chipText, levelFilter === l && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
        <Text style={[s.chipText, { marginLeft: 8, lineHeight: 28 }]}>{filtered.length} entradas</Text>
      </ScrollView>

      {/* Error */}
      {error && (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* Logs list */}
      <ScrollView style={s.list} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {filtered.length === 0 && !loading && (
          <View style={s.empty}>
            <Ionicons name="list-outline" size={40} color={C.textTertiary} />
            <Text style={s.emptyText}>Nenhum log encontrado</Text>
          </View>
        )}
        {filtered.map((entry) => <LogRow key={entry.id} entry={entry} />)}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: C.background },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:     { padding: 4, marginRight: 8 },
  title:       { flex: 1, fontSize: 18, fontWeight: "700", color: C.text },
  refreshBtn:  { padding: 4 },
  searchRow:   { flexDirection: "row", alignItems: "center", margin: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  filterScroll:{ maxHeight: 40, marginBottom: 0 },
  chip:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, marginBottom: 6 },
  chipText:    { fontSize: 11, color: C.textSecondary, fontWeight: "600" },
  errorBox:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF3B3011", borderRadius: 8, margin: 16, padding: 10 },
  errorText:   { flex: 1, fontSize: 12, color: C.danger },
  list:        { flex: 1 },
  empty:       { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText:   { color: C.textTertiary, fontSize: 14 },
});
