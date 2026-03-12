/**
 * Evolvus Core Quantum — Ecosystem Health Dashboard (Sprint LXVIII)
 *
 * Shows a real-time overview of all Ecosystem components:
 *   - Services (API, Database, Redis)
 *   - System metrics (memory, load, uptime)
 *   - Cache statistics (hit rate)
 *   - Active AlertManager alerts
 *   - Bot counts
 *
 * Auto-refreshes every 30 seconds.
 * Access restricted to Enterprise users (enforced server-side).
 *
 * Endpoint: GET /api/health/dashboard
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;
const POLL_INTERVAL_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface HealthDashboard {
  timestamp: string;
  overallStatus: "healthy" | "degraded" | "critical";
  services: ServiceStatus[];
  system: {
    uptimeSeconds: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    memoryPercent: number;
    loadAvg1m: number;
    nodeVersion: string;
    platform: string;
  };
  cache: {
    hits: number;
    misses: number;
    sets: number;
    errors: number;
    hitRatePercent: number;
  };
  alerts: {
    firing: number;
    resolved: number;
    rules: string[];
  };
  bots: {
    total: number;
    byPlan: Record<string, number>;
    note?: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HealthDashboardScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<HealthDashboard>("/api/health/dashboard");
      setDashboard(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    pollRef.current = setInterval(() => {
      void fetchDashboard(true);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchDashboard();
  }, [fetchDashboard]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function statusColor(ok: boolean): string {
    return ok ? "#22c55e" : "#ef4444";
  }

  function overallColor(status: HealthDashboard["overallStatus"]): string {
    if (status === "healthy") return "#22c55e";
    if (status === "degraded") return "#f59e0b";
    return "#ef4444";
  }

  function fmtUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  if (loading && !dashboard) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Carregando dashboard…</Text>
      </View>
    );
  }

  if (error && !dashboard) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + webTopInset }]}>
        <Ionicons name="warning-outline" size={40} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => fetchDashboard()}>
          <Text style={styles.retryBtnText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const d = dashboard!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + webTopInset + 8, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      testID="health-dashboard-scroll"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="health-back-btn">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.title}>🏥 Saúde do Ecossistema</Text>
      </View>

      {/* Overall status */}
      <View style={[styles.card, { borderColor: overallColor(d.overallStatus) }]}>
        <View style={styles.row}>
          <View
            style={[styles.dot, { backgroundColor: overallColor(d.overallStatus) }]}
          />
          <Text style={[styles.overallText, { color: overallColor(d.overallStatus) }]}>
            {d.overallStatus.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.timestamp}>
          Última atualização: {new Date(d.timestamp).toLocaleTimeString("pt-BR")}
        </Text>
        <Text style={styles.hint}>Atualiza automaticamente a cada 30s</Text>
      </View>

      {/* Services */}
      <Text style={styles.sectionTitle}>Serviços</Text>
      {d.services.map((svc) => (
        <View key={svc.name} style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: statusColor(svc.ok) }]} />
            <Text style={styles.serviceName}>{svc.name.toUpperCase()}</Text>
            {svc.latencyMs !== undefined && (
              <Text style={styles.latency}>{svc.latencyMs}ms</Text>
            )}
          </View>
          {svc.error && <Text style={styles.errorDetail}>{svc.error}</Text>}
        </View>
      ))}

      {/* System Metrics */}
      <Text style={styles.sectionTitle}>Sistema</Text>
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Memória usada</Text>
          <Text style={styles.metricValue}>
            {d.system.memoryUsedMb} MB / {d.system.memoryTotalMb} MB ({d.system.memoryPercent}%)
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Load (1m)</Text>
          <Text style={styles.metricValue}>{d.system.loadAvg1m}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Uptime</Text>
          <Text style={styles.metricValue}>{fmtUptime(d.system.uptimeSeconds)}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Node.js</Text>
          <Text style={styles.metricValue}>{d.system.nodeVersion}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Plataforma</Text>
          <Text style={styles.metricValue}>{d.system.platform}</Text>
        </View>
      </View>

      {/* Cache */}
      <Text style={styles.sectionTitle}>Cache</Text>
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Hit rate</Text>
          <Text
            style={[
              styles.metricValue,
              { color: d.cache.hitRatePercent >= 70 ? "#22c55e" : "#f59e0b" },
            ]}
          >
            {d.cache.hitRatePercent}%
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Hits / Misses</Text>
          <Text style={styles.metricValue}>
            {d.cache.hits} / {d.cache.misses}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Sets / Erros</Text>
          <Text style={styles.metricValue}>
            {d.cache.sets} / {d.cache.errors}
          </Text>
        </View>
      </View>

      {/* Alerts */}
      <Text style={styles.sectionTitle}>Alertas</Text>
      <View style={[styles.card, d.alerts.firing > 0 && styles.alertCard]}>
        <View style={styles.row}>
          <Ionicons
            name={d.alerts.firing > 0 ? "warning" : "checkmark-circle"}
            size={18}
            color={d.alerts.firing > 0 ? "#ef4444" : "#22c55e"}
          />
          <Text style={styles.metricValue}>
            {d.alerts.firing} ativos · {d.alerts.resolved} resolvidos
          </Text>
        </View>
        {d.alerts.rules.map((rule) => (
          <Text key={rule} style={styles.alertRule}>
            ⚠ {rule}
          </Text>
        ))}
      </View>

      {/* Bots */}
      <Text style={styles.sectionTitle}>Bots</Text>
      <View style={styles.card}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Total ativo</Text>
          <Text style={styles.metricValue}>{d.bots.total}</Text>
        </View>
        {Object.entries(d.bots.byPlan).map(([plan, count]) => (
          <View key={plan} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{plan}</Text>
            <Text style={styles.metricValue}>{count}</Text>
          </View>
        ))}
        {d.bots.note && (
          <Text style={[styles.hint, { marginTop: 6 }]}>{d.bots.note}</Text>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "700", color: C.text },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  alertCard: { borderColor: "#ef4444" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  overallText: { fontSize: 18, fontWeight: "700" },
  timestamp: { fontSize: 12, color: C.textSecondary, marginTop: 4 },
  hint: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
  },
  serviceName: { flex: 1, fontSize: 14, fontWeight: "600", color: C.text },
  latency: { fontSize: 12, color: C.textSecondary },
  errorDetail: { fontSize: 11, color: "#ef4444", marginTop: 4 },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  metricLabel: { fontSize: 13, color: C.textSecondary },
  metricValue: { fontSize: 13, fontWeight: "600", color: C.text },
  alertRule: { fontSize: 13, color: "#ef4444", marginTop: 4 },
  loadingText: { color: C.textSecondary, marginTop: 12, fontSize: 14 },
  errorText: { color: "#ef4444", marginTop: 12, fontSize: 14, textAlign: "center" },
  retryBtn: {
    marginTop: 16,
    backgroundColor: C.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
