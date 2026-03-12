import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

interface Metrics {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  expectancy: number;
}

interface Snapshot {
  snapshotDate: string;
  equityUsdt: number;
  dailyPnlPct: number;
  drawdownPct: number;
}

interface Strategy {
  botId: string;
  strategy: string;
  sharpe: number;
  winRate: number;
  trades: number;
  pnl: number;
}

const PERIODS = ["7d", "30d", "90d", "all"] as const;
type Period = typeof PERIODS[number];

export default function PerformanceScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s, strats] = await Promise.all([
        apiRequest("GET", "/api/analytics/metrics"),
        apiRequest("GET", "/api/analytics/performance/chart"),
        apiRequest("GET", "/api/analytics/strategies"),
      ]);
      setMetrics(m as Metrics);
      setSnapshots(((s as any)?.chart ?? []) as Snapshot[]);
      setStrategies(((strats as any)?.strategies ?? []) as Strategy[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxEquity = Math.max(...snapshots.map((s) => s.equityUsdt), 1);

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Performance</Text>
          <Text style={s.sub}>ReflexionEngine — Análise de risco/retorno</Text>
        </View>
        <Pressable onPress={load}>
          <Ionicons name="refresh" size={18} color={primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Period filter */}
        <View style={s.periodRow}>
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              style={[s.periodBtn, period === p && { backgroundColor: primary }]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[s.periodText, period === p && { color: "#000" }]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* KPI Cards */}
        <View style={s.kpiGrid}>
          {[
            { label: "Sharpe Ratio", val: fmt(metrics?.sharpeRatio), color: (metrics?.sharpeRatio ?? 0) >= 1 ? C.success : C.warning, icon: "analytics" as const },
            { label: "Win Rate", val: `${fmt(metrics?.winRate, 1)}%`, color: (metrics?.winRate ?? 0) >= 55 ? C.success : C.danger, icon: "trophy" as const },
            { label: "Max Drawdown", val: `${fmt(metrics?.maxDrawdown, 1)}%`, color: C.danger, icon: "trending-down" as const },
            { label: "Profit Factor", val: fmt(metrics?.profitFactor), color: (metrics?.profitFactor ?? 0) >= 1.5 ? C.success : C.warning, icon: "cash" as const },
          ].map(({ label, val, color, icon }) => (
            <View key={label} style={[s.kpiCard, { borderColor: `${color}30` }]}>
              <Ionicons name={icon} size={20} color={color} />
              <Text style={[s.kpiVal, { color }]}>{val}</Text>
              <Text style={s.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Secondary metrics */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <Text style={s.cardTitle}>Métricas Avançadas</Text>
          {[
            { label: "Sortino Ratio", val: fmt(metrics?.sortinoRatio) },
            { label: "Total de Trades", val: `${metrics?.totalTrades ?? 0}` },
            { label: "Expectancy", val: `$${fmt(metrics?.expectancy)}` },
          ].map(({ label, val }) => (
            <View key={label} style={s.metricRow}>
              <Text style={s.metricLabel}>{label}</Text>
              <Text style={[s.metricVal, { color: primary }]}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Equity curve */}
        {snapshots.length > 0 && (
          <View style={[s.card, { borderColor: `${primary}30` }]}>
            <Text style={s.cardTitle}>Equity Curve</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.chartRow}>
                {snapshots.slice(-30).map((snap, i) => {
                  const barH = Math.max((snap.equityUsdt / maxEquity) * 80, 4);
                  const isPos = snap.dailyPnlPct >= 0;
                  return (
                    <View key={i} style={s.barWrapper}>
                      <View style={[s.bar, { height: barH, backgroundColor: isPos ? C.success : C.danger }]} />
                      <Text style={s.barDate}>{new Date(snap.snapshotDate).getDate()}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Strategy ranking */}
        {strategies.length > 0 && (
          <View style={[s.card, { borderColor: `${primary}30` }]}>
            <Text style={s.cardTitle}>Ranking de Estratégias</Text>
            {strategies.slice(0, 10).map((strat, i) => (
              <View key={strat.botId} style={s.stratRow}>
                <Text style={[s.stratRank, { color: i === 0 ? "#FFD700" : C.textSecondary }]}>#{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.stratName}>{strat.strategy}</Text>
                  <Text style={s.stratSub}>{strat.trades} trades · WR: {fmt(strat.winRate, 1)}%</Text>
                </View>
                <Text style={[s.stratSharpe, { color: (strat.sharpe ?? 0) >= 1 ? C.success : C.warning }]}>S: {fmt(strat.sharpe)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  content: { padding: 16, gap: 14 },
  periodRow: { flexDirection: "row", gap: 8 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  periodText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "47%", backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, alignItems: "center" },
  kpiVal: { fontFamily: "Inter_700Bold", fontSize: 22 },
  kpiLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  metricRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  metricVal: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  chartRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 90, paddingVertical: 5 },
  barWrapper: { alignItems: "center", width: 16 },
  bar: { width: 10, borderRadius: 3, minHeight: 4 },
  barDate: { fontFamily: "Inter_400Regular", fontSize: 9, color: C.textTertiary, marginTop: 2 },
  stratRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  stratRank: { fontFamily: "Inter_700Bold", fontSize: 14, width: 28 },
  stratName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  stratSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  stratSharpe: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
