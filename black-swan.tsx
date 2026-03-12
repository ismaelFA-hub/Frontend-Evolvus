import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { apiRequest } from "@/lib/query-client";

interface BlackSwanAlert {
  severity: "info" | "warning" | "critical";
  indicator: string;
  message: string;
  timestamp: string;
  suggestedAction: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ff4444",
  warning: "#ffbb33",
  info: "#33b5e5",
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🚨",
  warning: "⚠️",
  info: "ℹ️",
};

const INDICATOR_LABELS: Record<string, string> = {
  options: "Opções",
  onchain: "On-Chain",
  onchain_whale: "Whales",
  macro: "Macro",
  fear_greed: "Fear & Greed",
  volatility: "Volatilidade",
};

export default function BlackSwanMonitor() {
  const [alerts, setAlerts] = useState<BlackSwanAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data: any = await apiRequest("GET", "/api/blackswan/alerts");
      setAlerts(data.alerts ?? data ?? []);
      setCheckedAt(data.checkedAt ?? new Date().toISOString());
    } catch (e: any) {
      console.error("BlackSwan fetch error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(), 60_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const statusColor =
    alerts.some((a) => a.severity === "critical") ? "#ff4444" :
    alerts.some((a) => a.severity === "warning") ? "#ffbb33" :
    "#00ff88";

  const statusText =
    alerts.some((a) => a.severity === "critical") ? "CRÍTICO" :
    alerts.some((a) => a.severity === "warning") ? "ALERTA" :
    "NORMAL";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monitor de Cisnes Negros</Text>
      <Text style={styles.subtitle}>Detecção de riscos de cauda em tempo real</Text>

      <View style={[styles.statusCard, { borderColor: statusColor }]}>
        <Text style={styles.statusLabel}>Status do Mercado</Text>
        <Text style={[styles.statusValue, { color: statusColor }]}>{statusText}</Text>
        {checkedAt && (
          <Text style={styles.checkedAt}>
            Última verificação: {new Date(checkedAt).toLocaleTimeString("pt-BR")}
          </Text>
        )}
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchAlerts(true)}>
          <Text style={styles.refreshText}>Verificar agora</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00d4ff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(_, idx) => idx.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAlerts(true)} tintColor="#00d4ff" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>Nenhum alerta detectado</Text>
              <Text style={styles.emptySubtext}>Todos os indicadores dentro do normal</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.alertCard, { borderLeftColor: SEVERITY_COLORS[item.severity] }]}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertIcon}>{SEVERITY_ICONS[item.severity]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertSeverity, { color: SEVERITY_COLORS[item.severity] }]}>
                    {item.severity.toUpperCase()}
                  </Text>
                  <Text style={styles.alertIndicator}>
                    {INDICATOR_LABELS[item.indicator] ?? item.indicator}
                  </Text>
                </View>
                <Text style={styles.alertTime}>
                  {new Date(item.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={styles.alertMessage}>{item.message}</Text>
              <View style={styles.actionBox}>
                <Text style={styles.actionLabel}>Ação sugerida:</Text>
                <Text style={styles.actionText}>{item.suggestedAction}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050510", padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#ff4444", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  statusCard: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 16, borderWidth: 2, marginBottom: 16, alignItems: "center" },
  statusLabel: { color: "#888", fontSize: 12, marginBottom: 4 },
  statusValue: { fontSize: 28, fontWeight: "bold", letterSpacing: 4 },
  checkedAt: { color: "#555", fontSize: 11, marginTop: 6 },
  refreshBtn: { marginTop: 12, backgroundColor: "#1a1a3e", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  refreshText: { color: "#00d4ff", fontSize: 13 },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#00ff88", fontSize: 18, fontWeight: "bold" },
  emptySubtext: { color: "#555", fontSize: 13, marginTop: 4 },
  alertCard: { backgroundColor: "#0d0d1a", borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 4 },
  alertHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  alertIcon: { fontSize: 20, marginRight: 8 },
  alertSeverity: { fontSize: 12, fontWeight: "bold" },
  alertIndicator: { color: "#888", fontSize: 11 },
  alertTime: { color: "#555", fontSize: 11 },
  alertMessage: { color: "#ddd", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  actionBox: { backgroundColor: "#111122", borderRadius: 8, padding: 8 },
  actionLabel: { color: "#888", fontSize: 11, marginBottom: 2 },
  actionText: { color: "#ffd700", fontSize: 12 },
});
