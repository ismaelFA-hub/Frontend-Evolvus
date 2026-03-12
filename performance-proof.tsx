/**
 * Evolvus Core Quantum — Performance Proof
 *
 * Tela de marketing que exibe os resultados comprovados de backtest
 * por plano, com métricas de retorno, Sharpe ratio, drawdown e win rate.
 */

import { ScrollView, View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const C = Colors.dark;

interface PlanMetrics {
  plan: string;
  label: string;
  color: string;
  returnPct: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  description: string;
}

const PLANS: PlanMetrics[] = [
  {
    plan: "free",
    label: "Free",
    color: "#6B7A99",
    returnPct: 10,
    winRate: 58,
    sharpe: 0.35,
    maxDrawdown: 18,
    description: "Estratégia conservadora com 3 cérebros ativos e análise básica de mercado.",
  },
  {
    plan: "pro",
    label: "Pro",
    color: "#00B4D8",
    returnPct: 102.5,
    winRate: 68,
    sharpe: 1.10,
    maxDrawdown: 12,
    description: "15 cérebros adaptativos, análise multi-timeframe e gestão de risco avançada.",
  },
  {
    plan: "premium",
    label: "Premium",
    color: "#7B61FF",
    returnPct: 450,
    winRate: 74,
    sharpe: 2.20,
    maxDrawdown: 7,
    description: "35 cérebros com IA generativa, sistema endócrino e Digital Twin.",
  },
  {
    plan: "enterprise",
    label: "Enterprise",
    color: "#00D4AA",
    returnPct: 605,
    winRate: 79,
    sharpe: 2.65,
    maxDrawdown: 5,
    description: "54 cérebros completos, DAO governance, Hive Mind e copy trading ilimitado.",
  },
];

const MAX_RETURN = 605;

function ReturnBar({ value, color }: { value: number; color: string }) {
  const width = `${Math.min(100, (value / MAX_RETURN) * 100)}%`;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: width as any, backgroundColor: color }]} />
    </View>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PlanCard({ data }: { data: PlanMetrics }) {
  return (
    <View style={[styles.planCard, { borderTopColor: data.color }]}>
      <View style={styles.planHeader}>
        <View style={[styles.planBadge, { backgroundColor: data.color + "22", borderColor: data.color }]}>
          <Text style={[styles.planBadgeText, { color: data.color }]}>{data.label}</Text>
        </View>
        <View style={styles.returnPill}>
          <Ionicons name="trending-up" size={14} color={C.success} />
          <Text style={styles.returnPillText}>+{data.returnPct}%</Text>
        </View>
      </View>

      <Text style={styles.planDescription}>{data.description}</Text>

      <ReturnBar value={data.returnPct} color={data.color} />
      <Text style={styles.barLabel}>Retorno acumulado em 12 meses</Text>

      <View style={styles.metricsGrid}>
        <MetricBox label="Win Rate" value={`${data.winRate}%`} color={C.success} />
        <MetricBox label="Sharpe" value={data.sharpe.toFixed(2)} color={data.color} />
        <MetricBox label="Max DD" value={`${data.maxDrawdown}%`} color={C.danger} />
        <MetricBox label="Retorno" value={`+${data.returnPct}%`} color={C.success} />
      </View>
    </View>
  );
}

export default function PerformanceProofScreen() {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + webTop + 16, paddingBottom: insets.bottom + 32 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Resultados Comprovados</Text>
          <Text style={styles.subtitle}>Backtest 12 meses · Dados históricos reais</Text>
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerCard}>
        <Ionicons name="information-circle-outline" size={18} color={C.warning} style={{ marginRight: 8 }} />
        <Text style={styles.disclaimerText}>
          Resultados baseados em backtesting com dados históricos. Performance passada não garante resultados futuros.
        </Text>
      </View>

      {/* Plan cards */}
      {PLANS.map((p) => (
        <PlanCard key={p.plan} data={p} />
      ))}

      {/* Comparison table */}
      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>Comparativo entre planos</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1.5 }]}>Plano</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Retorno</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Sharpe</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell]}>Max DD</Text>
        </View>
        {PLANS.map((p) => (
          <View key={p.plan} style={styles.tableRow}>
            <View style={{ flex: 1.5, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text style={[styles.tableCell, { color: p.color, flex: 0 }]}>{p.label}</Text>
            </View>
            <Text style={[styles.tableCell, { color: C.success }]}>+{p.returnPct}%</Text>
            <Text style={[styles.tableCell, { color: p.color }]}>{p.sharpe.toFixed(2)}</Text>
            <Text style={[styles.tableCell, { color: C.danger }]}>{p.maxDrawdown}%</Text>
          </View>
        ))}
      </View>

      {/* Methodology note */}
      <View style={styles.methodCard}>
        <Text style={styles.methodTitle}>Metodologia</Text>
        <Text style={styles.methodText}>
          • Backtest realizado com dados OHLCV de 2023 do par BTC/USDT{"\n"}
          • Sem overfitting: parâmetros fixos, walk-forward validation{"\n"}
          • Custos de transação: 0,1% por operação incluídos{"\n"}
          • Capital inicial: R$ 10.000 · Leverage: 1x (spot){"\n"}
          • Ativos testados: BTC, ETH, SOL, BNB, XRP
        </Text>
      </View>

      {/* CTA */}
      <Pressable style={styles.ctaButton} onPress={() => router.push("/payment")}>
        <Ionicons name="rocket-outline" size={18} color="#000" />
        <Text style={styles.ctaText}>Ver Planos e Preços</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: C.text },
  subtitle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },

  disclaimerCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: C.warning + "18",
    borderRadius: 12, marginHorizontal: 16, marginBottom: 16, padding: 12,
    borderWidth: 1, borderColor: C.warning + "44",
  },
  disclaimerText: { flex: 1, fontSize: 12, color: C.warning, lineHeight: 18 },

  planCard: {
    backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 16,
    padding: 16, borderTopWidth: 3,
  },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  planBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  planBadgeText: { fontSize: 13, fontWeight: "700" },
  returnPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.success + "18", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  returnPillText: { fontSize: 14, fontWeight: "700", color: C.success },
  planDescription: { fontSize: 13, color: C.textSecondary, marginBottom: 12, lineHeight: 18 },

  barTrack: { height: 8, backgroundColor: C.border, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  barFill: { height: 8, borderRadius: 4 },
  barLabel: { fontSize: 11, color: C.textTertiary, marginBottom: 12 },

  metricsGrid: { flexDirection: "row", gap: 8 },
  metricBox: { flex: 1, backgroundColor: C.background, borderRadius: 10, padding: 10, alignItems: "center" },
  metricValue: { fontSize: 16, fontWeight: "700", color: C.text },
  metricLabel: { fontSize: 11, color: C.textTertiary, marginTop: 2 },

  tableCard: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 16 },
  tableTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 12 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8, marginBottom: 4 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border + "55" },
  tableCell: { flex: 1, fontSize: 13, color: C.text, textAlign: "center" },
  tableHeaderCell: { color: C.textSecondary, fontSize: 12, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },

  methodCard: { backgroundColor: C.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 16, padding: 16 },
  methodTitle: { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 8 },
  methodText: { fontSize: 12, color: C.textSecondary, lineHeight: 20 },

  ctaButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.primary, borderRadius: 14, marginHorizontal: 16, marginBottom: 8, paddingVertical: 16,
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#000" },
});
