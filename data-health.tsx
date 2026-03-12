/**
 * Evolvus Core Quantum — Data Pipeline Health Dashboard (Module 16)
 *
 * Admin screen for monitoring the data ingestion pipeline:
 * - Overall pipeline status (healthy / degraded / offline)
 * - Per-exchange source status with online/offline indicator
 * - Aggregated metrics: symbols, candles, funding rates, errors
 * - Auto-refresh every 30 seconds
 *
 * Routes consumed:
 *   GET /api/data-ingestion/health
 *   GET /api/data-ingestion/metrics
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

// ── Types ─────────────────────────────────────────────────────────────

interface SourceStatus {
  id: string;
  online: boolean;
  lastUpdateMs: number;
  symbolCount: number;
  errorRate: number;
}

interface PipelineHealth {
  status: "healthy" | "degraded" | "offline";
  sources: SourceStatus[];
  totalSymbols: number;
  activeWorkers: number;
}

interface WorkerMetrics {
  exchangeId: string;
  symbolsMonitored: number;
  candlesPublished: number;
  fundingPublished: number;
  oiPublished: number;
  orderBooksPublished: number;
  errors: number;
  lastUpdateMs: number;
}

interface AggregatedMetrics {
  workers: WorkerMetrics[];
  totals: {
    symbolsMonitored: number;
    candlesPublished: number;
    fundingPublished: number;
    oiPublished: number;
    orderBooksPublished: number;
    errors: number;
  };
  activeWorkers: number;
  lastUpdatedMs: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case "healthy":  return "#22c55e";
    case "degraded": return "#eab308";
    case "offline":  return "#ef4444";
    default:         return C.textSecondary;
  }
}

function statusIcon(status: string): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case "healthy":  return "checkmark-circle";
    case "degraded": return "warning";
    case "offline":  return "close-circle";
    default:         return "help-circle";
  }
}

function formatRelativeTime(ms: number): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

// ── Component ─────────────────────────────────────────────────────────

export default function DataHealthScreen() {
  const insets = useSafeAreaInsets();
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [healthRes, metricsRes] = await Promise.all([
        apiRequest("GET", "/api/data-ingestion/health"),
        apiRequest("GET", "/api/data-ingestion/metrics"),
      ]);
      setHealth(await healthRes.json());
      setMetrics(await metricsRes.json());
    } catch (e) {
      setError("Failed to load pipeline data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00D4FF" />
          <Text style={styles.loadingText}>Loading pipeline data…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#00D4FF" />
        </Pressable>
        <Text style={styles.headerTitle}>Data Pipeline Health</Text>
        <Pressable onPress={() => load()} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4FF" />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Overall Status */}
        {health && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PIPELINE STATUS</Text>
            <View style={styles.statusRow}>
              <Ionicons
                name={statusIcon(health.status)}
                size={28}
                color={statusColor(health.status)}
              />
              <Text style={[styles.statusText, { color: statusColor(health.status) }]}>
                {health.status.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Summary Metrics */}
        {health && metrics && (
          <View style={styles.metricsGrid}>
            <MetricCard label="Total Symbols" value={health.totalSymbols} icon="analytics" />
            <MetricCard label="Active Workers" value={health.activeWorkers} icon="pulse" />
            <MetricCard label="Exchanges" value={health.sources.length} icon="globe" />
            <MetricCard label="Candles Published" value={metrics.totals.candlesPublished} icon="bar-chart" />
            <MetricCard label="Funding Rates" value={metrics.totals.fundingPublished} icon="cash" />
            <MetricCard label="Total Errors" value={metrics.totals.errors} icon="warning" accent="#ef4444" />
          </View>
        )}

        {/* Source Status */}
        {health && health.sources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exchange Sources</Text>
            {health.sources.map((src) => (
              <SourceRow key={src.id} source={src} />
            ))}
          </View>
        )}

        {health && health.sources.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={40} color={C.textSecondary} />
            <Text style={styles.emptyText}>No workers registered yet.</Text>
            <Text style={styles.emptySubtext}>Exchange workers will appear here once the pipeline starts.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-Components ────────────────────────────────────────────────────

function MetricCard({ label, value, icon, accent }: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} color={accent ?? "#00D4FF"} />
      <Text style={[styles.metricValue, accent ? { color: accent } : {}]}>
        {value.toLocaleString()}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SourceRow({ source }: { source: SourceStatus }) {
  const errorPct = (source.errorRate * 100).toFixed(1);
  return (
    <View style={styles.sourceRow}>
      <View style={[styles.onlineDot, { backgroundColor: source.online ? "#22c55e" : "#ef4444" }]} />
      <View style={styles.sourceInfo}>
        <Text style={styles.sourceName}>{source.id.toUpperCase()}</Text>
        <Text style={styles.sourceDetail}>
          {source.symbolCount} symbols · {formatRelativeTime(source.lastUpdateMs)} · err {errorPct}%
        </Text>
      </View>
      <Text style={[styles.sourceStatus, { color: source.online ? "#22c55e" : "#ef4444" }]}>
        {source.online ? "ONLINE" : "OFFLINE"}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D1A",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E3A",
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  refreshBtn: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    padding: 12,
    backgroundColor: "#2D0A0A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: "#12122A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E1E3A",
  },
  cardLabel: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: "44%",
    padding: 14,
    backgroundColor: "#12122A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E1E3A",
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  metricLabel: {
    color: C.textSecondary,
    fontSize: 11,
    textAlign: "center",
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#12122A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1E1E3A",
    marginBottom: 8,
    gap: 12,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  sourceDetail: {
    color: C.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  sourceStatus: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtext: {
    color: C.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
});
