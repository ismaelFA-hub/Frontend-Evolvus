import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";
import { apiRequest } from "@/lib/query-client";

interface Allocation {
  botId: string;
  allocationPct: number;
  reason: string;
}

function PieSlice({ pct, total, color, index }: { pct: number; total: number; color: string; index: number }) {
  const bar = Math.round((pct / 100) * 20);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
      <View style={[{ width: bar * 4, height: 12, borderRadius: 3, backgroundColor: color }]} />
      <Text style={{ color: "#888", marginLeft: 6, fontSize: 11 }}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

const ALLOCATION_COLORS = ["#00d4ff", "#ff6b6b", "#ffd700", "#00ff88", "#ff00ff", "#ff8c00"];

export default function PortfolioOrchestrator() {
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [error, setError] = useState("");
  const [optimizedAt, setOptimizedAt] = useState<string | null>(null);

  const handleOptimize = async () => {
    setLoading(true);
    setError("");
    try {
      const data: any = await apiRequest("POST", "/api/orchestrator/optimize");
      setAllocations(data.allocations ?? data ?? []);
      setOptimizedAt(data.optimizedAt ?? new Date().toISOString());
    } catch (e: any) {
      setError(e.message ?? "Erro ao otimizar portfólio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Orquestrador de Portfólio</Text>
      <Text style={styles.subtitle}>Alocação dinâmica baseada em Sharpe, Drawdown e Regime de Mercado</Text>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleOptimize}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text style={styles.buttonText}>Otimizar Portfólio</Text>
        )}
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {optimizedAt && (
        <Text style={styles.timestamp}>
          Otimizado em: {new Date(optimizedAt).toLocaleTimeString("pt-BR")}
        </Text>
      )}

      {allocations.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Distribuição Atual</Text>
          {allocations.map((a, i) => (
            <PieSlice key={a.botId} pct={a.allocationPct} total={100} color={ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]} index={i} />
          ))}
        </View>
      )}

      <FlatList
        data={allocations}
        keyExtractor={(item) => item.botId}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Pressione o botão para otimizar seus bots</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={[styles.botCard, { borderLeftColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }]}>
            <View style={styles.botHeader}>
              <Text style={styles.botId} numberOfLines={1}>🤖 {item.botId.substring(0, 8)}...</Text>
              <Text style={[styles.botPct, { color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }]}>
                {item.allocationPct.toFixed(2)}%
              </Text>
            </View>
            <Text style={styles.botReason} numberOfLines={2}>{item.reason}</Text>
            <View style={styles.barContainer}>
              <View style={[styles.bar, {
                width: `${Math.min(item.allocationPct, 100)}%`,
                backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
              }]} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050510", padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#00ff88", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  button: { backgroundColor: "#00ff88", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#000", fontWeight: "bold", fontSize: 15 },
  errorText: { color: "#ff6b6b", textAlign: "center", marginVertical: 8 },
  timestamp: { color: "#555", fontSize: 11, textAlign: "center", marginBottom: 12 },
  summaryCard: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#1a1a3e" },
  summaryTitle: { color: "#aaa", fontSize: 12, marginBottom: 8 },
  emptyContainer: { alignItems: "center", paddingTop: 40 },
  emptyText: { color: "#555", fontSize: 14 },
  botCard: { backgroundColor: "#0d0d1a", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  botHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  botId: { color: "#fff", fontWeight: "bold", fontSize: 13, flex: 1 },
  botPct: { fontSize: 18, fontWeight: "bold" },
  botReason: { color: "#888", fontSize: 11, marginBottom: 8 },
  barContainer: { height: 4, backgroundColor: "#1a1a3e", borderRadius: 2, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 2 },
});
