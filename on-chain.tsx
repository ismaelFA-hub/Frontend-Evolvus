import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";
import { getOnChainData, type OnChainData } from "@/lib/quantum-engine";

const C = Colors.dark;

const PLAN_ORDER = ["free", "pro", "premium", "enterprise"];
function planGte(user: string, required: string) {
  return PLAN_ORDER.indexOf(user) >= PLAN_ORDER.indexOf(required);
}

function PlanGate({ required }: { required: string }) {
  const { planTheme } = usePlanTheme();
  return (
    <View style={s.gateOverlay}>
      <Ionicons name="lock-closed" size={28} color={C.textTertiary} />
      <Text style={s.gateTitle}>Requer plano {required.charAt(0).toUpperCase() + required.slice(1)}+</Text>
      <Pressable
        style={[s.gateBtn, { backgroundColor: planTheme.primary }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Text style={s.gateBtnText}>Fazer Upgrade</Text>
      </Pressable>
    </View>
  );
}

export default function OnChainScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<OnChainData>(getOnChainData);

  useEffect(() => {
    const id = setInterval(() => setData(getOnChainData()), 30000);
    return () => clearInterval(id);
  }, []);

  const maxFlow = Math.max(...data.exchangeFlows.flatMap((f) => [f.inflow, f.outflow]));

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('onChainAnalytics')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Network Metrics Grid */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('networkMetrics')}</Text>
          <View style={s.metricsGrid}>
            {data.networkMetrics.map((m, i) => (
              <View key={i} style={s.metricCard}>
                <Text style={s.metricLabel}>{m.label}</Text>
                <Text style={s.metricValue}>{m.value}</Text>
                <View style={s.metricChangeRow}>
                  <Ionicons
                    name={m.change24h >= 0 ? "arrow-up" : "arrow-down"}
                    size={12}
                    color={m.change24h >= 0 ? C.success : C.danger}
                  />
                  <Text style={[s.metricChange, { color: m.change24h >= 0 ? C.success : C.danger }]}>
                    {Math.abs(m.change24h).toFixed(1)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Key Indicators */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Indicadores Chave</Text>
          <View style={s.card}>
            {[
              {
                label: "MVRV Ratio",
                value: data.indicators.mvrv.toFixed(2),
                desc: "< 1 subavaliado, > 3.5 sobrevalorizado",
                color: data.indicators.mvrv > 3.5 ? C.danger : data.indicators.mvrv < 1 ? C.success : C.warning,
              },
              {
                label: "NVT Signal",
                value: data.indicators.nvt.toFixed(1),
                desc: "Network Value to Transactions",
                color: C.accent,
              },
              {
                label: "Stablecoin Supply",
                value: `$${data.indicators.stablecoinSupply.toFixed(1)}B`,
                desc: "Total stablecoins em circulação",
                color: C.secondary,
              },
              {
                label: "ETH Gas",
                value: `${data.indicators.ethGasGwei.toFixed(1)} Gwei`,
                desc: "Custo médio de transação",
                color: C.warning,
              },
            ].map((ind, i) => (
              <View key={i} style={s.indicatorRow}>
                <View style={s.indicatorLeft}>
                  <Text style={s.indicatorLabel}>{ind.label}</Text>
                  <Text style={s.indicatorDesc}>{ind.desc}</Text>
                </View>
                <Text style={[s.indicatorValue, { color: ind.color }]}>{ind.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Exchange Flows Chart */}
        {planGte(planType, "premium") ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Exchange Flows (7 dias)</Text>
            <View style={s.card}>
              <View style={s.chartArea}>
                {data.exchangeFlows.map((f, i) => {
                  const inH = (f.inflow / maxFlow) * 80;
                  const outH = (f.outflow / maxFlow) * 80;
                  return (
                    <View key={i} style={s.chartColumn}>
                      <View style={{ height: 80, justifyContent: "flex-end", flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                        <View style={[s.chartBar, { height: inH, backgroundColor: C.success }]} />
                        <View style={[s.chartBar, { height: outH, backgroundColor: C.danger }]} />
                      </View>
                      <Text style={s.chartLabel}>{f.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.chartLegend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: C.success }]} />
                  <Text style={s.legendText}>Inflow</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: C.danger }]} />
                  <Text style={s.legendText}>Outflow</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Exchange Flows</Text>
            <View style={[s.card, s.gateCard]}>
              <PlanGate required="premium" />
            </View>
          </View>
        )}

        {/* Whale Tracker */}
        {planGte(planType, "pro") ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Whale Tracker</Text>
            <View style={s.card}>
              {data.whaleTransactions.map((wt) => (
                <View key={wt.id} style={s.whaleRow}>
                  <View
                    style={[
                      s.whaleIcon,
                      {
                        backgroundColor:
                          wt.type === "exchange_inflow"
                            ? C.dangerDim
                            : wt.type === "exchange_outflow"
                            ? C.successDim
                            : C.warningDim,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        wt.type === "exchange_inflow"
                          ? "arrow-up"
                          : wt.type === "exchange_outflow"
                          ? "arrow-down"
                          : "swap-horizontal"
                      }
                      size={13}
                      color={
                        wt.type === "exchange_inflow"
                          ? C.danger
                          : wt.type === "exchange_outflow"
                          ? C.success
                          : C.warning
                      }
                    />
                  </View>
                  <View style={s.whaleInfo}>
                    <View style={s.whaleTopRow}>
                      <View style={s.tokenBadge}>
                        <Text style={s.tokenText}>{wt.token}</Text>
                      </View>
                      <Text style={s.whaleAmount}>
                        {wt.amount >= 1000000
                          ? `${(wt.amount / 1000000).toFixed(2)}M`
                          : wt.amount >= 1000
                          ? `${(wt.amount / 1000).toFixed(1)}K`
                          : wt.amount.toFixed(0)}
                      </Text>
                      <Text style={s.whaleUsd}>${(wt.amountUsd / 1000000).toFixed(1)}M</Text>
                    </View>
                    <Text style={s.whaleRoute} numberOfLines={1}>
                      {wt.from} → {wt.to}
                    </Text>
                  </View>
                  <Text style={s.whaleTime}>{wt.timestamp.slice(11, 16)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Whale Tracker</Text>
            <View style={[s.card, s.gateCard]}>
              <PlanGate required="pro" />
            </View>
          </View>
        )}

        {/* DeFi Top Protocols */}
        {planGte(planType, "premium") ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Top DeFi Protocols</Text>
            <View style={s.card}>
              {data.defiProtocols.map((p, i) => (
                <View key={i} style={s.defiRow}>
                  <View style={s.defiLeft}>
                    <Text style={s.defiName}>{p.name}</Text>
                    <View style={s.categoryBadge}>
                      <Text style={s.categoryText}>{p.category}</Text>
                    </View>
                  </View>
                  <View style={s.defiRight}>
                    <Text style={s.defiTvl}>${p.tvl.toFixed(1)}B</Text>
                    <Text style={[s.defiChange, { color: p.change24h >= 0 ? C.success : C.danger }]}>
                      {p.change24h >= 0 ? "+" : ""}
                      {p.change24h.toFixed(1)}%
                    </Text>
                    <Text style={s.defiApy}>{p.apy.toFixed(1)}% APY</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, flex: 1, textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  gateCard: { minHeight: 120, justifyContent: "center", alignItems: "center" },
  // Grid
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginBottom: 4 },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginBottom: 4 },
  metricChangeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  metricChange: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  // Indicators
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  indicatorLeft: { flex: 1 },
  indicatorLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  indicatorDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  indicatorValue: { fontFamily: "Inter_700Bold", fontSize: 16 },
  // Chart
  chartArea: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  chartColumn: { flex: 1, alignItems: "center" },
  chartBar: { width: 8, borderRadius: 3 },
  chartLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary, marginTop: 4 },
  chartLegend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  // Whale
  whaleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  whaleIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", marginRight: 10 },
  whaleInfo: { flex: 1 },
  whaleTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  tokenBadge: { backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tokenText: { fontFamily: "Inter_700Bold", fontSize: 11, color: C.accent },
  whaleAmount: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  whaleUsd: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  whaleRoute: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  whaleTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  // DeFi
  defiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  defiLeft: { flex: 1, gap: 4 },
  defiName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  categoryBadge: { backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  categoryText: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
  defiRight: { alignItems: "flex-end", gap: 2 },
  defiTvl: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  defiChange: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  defiApy: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.success },
  // PlanGate
  gateOverlay: { alignItems: "center", paddingVertical: 16, gap: 10 },
  gateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gateBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  gateBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
});
