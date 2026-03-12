import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { apiRequest } from "@/lib/query-client";

interface DexStatus {
  available: boolean;
  networks: string[];
  message: string;
}

const NETWORK_ICONS: Record<string, string> = {
  ethereum: "⟠",
  polygon: "⬟",
  arbitrum: "🔵",
  optimism: "🔴",
  base: "🔷",
};

export default function DexFallback() {
  const [status, setStatus] = useState<DexStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("GET", "/api/dex/status")
      .then((d: any) => setStatus(d))
      .catch(() => setStatus({ available: false, networks: ["ethereum", "polygon", "arbitrum"], message: "Status indisponível" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>DEX Fallback</Text>
      <Text style={styles.subtitle}>Roteamento de ordens descentralizado em caso de falha das exchanges</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#7b2fff" style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={[styles.statusCard, { borderColor: status?.available ? "#00ff88" : "#ff6b6b" }]}>
            <Text style={styles.statusDot}>{status?.available ? "🟢" : "🔴"}</Text>
            <Text style={[styles.statusText, { color: status?.available ? "#00ff88" : "#ff6b6b" }]}>
              {status?.available ? "DEX Disponível" : "Em Desenvolvimento"}
            </Text>
            <Text style={styles.statusMessage}>{status?.message}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Redes Suportadas</Text>
            {status?.networks.map((network) => (
              <View key={network} style={styles.networkCard}>
                <Text style={styles.networkIcon}>{NETWORK_ICONS[network] ?? "🔗"}</Text>
                <View>
                  <Text style={styles.networkName}>{network.charAt(0).toUpperCase() + network.slice(1)}</Text>
                  <Text style={styles.networkStatus}>Em breve</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Como Funciona</Text>
            {[
              { icon: "🔍", title: "Detecção de Falha", desc: "Monitoramento contínuo da disponibilidade das exchanges centralizadas" },
              { icon: "🔄", title: "Roteamento Automático", desc: "Em caso de falha, ordens são redirecionadas para DEXs (Uniswap, 1inch)" },
              { icon: "⛽", title: "Gas Otimizado", desc: "Seleção automática da rota mais barata via agregadores de liquidez" },
              { icon: "🔐", title: "Auto-custódia", desc: "Fundos permanecem em sua carteira durante as operações DEX" },
            ].map((item, idx) => (
              <View key={idx} style={styles.featureCard}>
                <Text style={styles.featureIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.roadmapCard}>
            <Text style={styles.roadmapTitle}>Roadmap</Text>
            {[
              { phase: "Q2 2025", item: "Integração Uniswap V3 (Ethereum)" },
              { phase: "Q3 2025", item: "1inch Aggregator + Polygon" },
              { phase: "Q4 2025", item: "Arbitrum + Optimism" },
              { phase: "Q1 2026", item: "Ativação automática cross-chain" },
            ].map((r, idx) => (
              <View key={idx} style={styles.roadmapItem}>
                <Text style={styles.roadmapPhase}>{r.phase}</Text>
                <Text style={styles.roadmapText}>{r.item}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050510" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "bold", color: "#7b2fff", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  statusCard: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 16, borderWidth: 2, alignItems: "center", marginBottom: 20 },
  statusDot: { fontSize: 32, marginBottom: 8 },
  statusText: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  statusMessage: { color: "#888", fontSize: 13, textAlign: "center", lineHeight: 18 },
  section: { marginBottom: 20 },
  sectionTitle: { color: "#aaa", fontSize: 14, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  networkCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#0d0d1a", borderRadius: 10, padding: 12, marginBottom: 8, gap: 12 },
  networkIcon: { fontSize: 24 },
  networkName: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  networkStatus: { color: "#666", fontSize: 11 },
  featureCard: { flexDirection: "row", backgroundColor: "#0d0d1a", borderRadius: 10, padding: 12, marginBottom: 8, gap: 12, alignItems: "flex-start" },
  featureIcon: { fontSize: 20 },
  featureTitle: { color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 2 },
  featureDesc: { color: "#888", fontSize: 12, lineHeight: 16 },
  roadmapCard: { backgroundColor: "#0d0d1a", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#1a1a3e" },
  roadmapTitle: { color: "#7b2fff", fontWeight: "bold", fontSize: 14, marginBottom: 12 },
  roadmapItem: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 12 },
  roadmapPhase: { color: "#7b2fff", fontSize: 12, fontWeight: "600", width: 70 },
  roadmapText: { color: "#aaa", fontSize: 12, flex: 1 },
});
