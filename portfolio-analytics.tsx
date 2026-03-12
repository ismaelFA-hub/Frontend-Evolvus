import { useState, useMemo, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;
type PlanType = "free" | "pro" | "premium" | "enterprise";
const PLAN_ORDER: PlanType[] = ["free", "pro", "premium", "enterprise", "admin"];
function planGte(u: PlanType, r: PlanType) { if (u === "admin") return true; return PLAN_ORDER.indexOf(u) >= PLAN_ORDER.indexOf(r); }

type TimeRange = "7D" | "30D" | "90D" | "1Y" | "All";
type AllocMode = "asset" | "exchange" | "sector";

// ─── Mock data ─────────────────────────────────────────────────────────────────
const ALLOCATION_BY_ASSET = [
  { label: "BTC",   pct: 44.2, color: "#F7931A", value: 18920 },
  { label: "ETH",   pct: 18.6, color: "#627EEA", value: 7960  },
  { label: "SOL",   pct: 12.4, color: "#9945FF", value: 5308  },
  { label: "BNB",   pct: 8.8,  color: "#F0B90B", value: 3764  },
  { label: "Others",pct: 16.0, color: "#6B7A99", value: 6848  },
];

const ALLOCATION_BY_EXCHANGE = [
  { label: "Binance", pct: 59.3, color: "#F0B90B", value: 25373 },
  { label: "Bybit",   pct: 27.8, color: "#F7931A", value: 11893 },
  { label: "OKX",     pct: 12.9, color: "#007AFF", value: 5521  },
];

const ALLOCATION_BY_SECTOR = [
  { label: "L1",         pct: 63.0, color: "#00D4AA", value: 26956 },
  { label: "DeFi",       pct: 12.4, color: "#7B61FF", value: 5305  },
  { label: "L2",         pct: 8.8,  color: "#00B4D8", value: 3765  },
  { label: "Memecoins",  pct: 6.2,  color: "#FF5252", value: 2652  },
  { label: "Stablecoins",pct: 9.6,  color: "#6B7A99", value: 4107  },
];

const PERF_DATA: Record<TimeRange, { return: string; color: string; bars: number[] }> = {
  "7D":  { return: "+4.2%",  color: C.success, bars: [40, 55, 50, 65, 70, 62, 80] },
  "30D": { return: "+18.7%", color: C.success, bars: [30, 45, 38, 60, 55, 70, 65, 80, 75, 88, 82, 90, 85, 92, 88] },
  "90D": { return: "+31.2%", color: C.success, bars: [20, 35, 28, 45, 50, 40, 58, 52, 65, 60, 72, 68, 75, 70, 80] },
  "1Y":  { return: "+142.8%",color: C.success, bars: [10, 22, 18, 35, 30, 48, 42, 58, 52, 65, 60, 75] },
  "All": { return: "+520.1%",color: C.success, bars: [5, 12, 10, 20, 18, 35, 30, 48, 45, 60, 55, 72, 68, 80, 78, 90] },
};

const CORR_ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP"];
const CORR_MATRIX = [
  [1.00, 0.91, 0.78, 0.82, 0.65],
  [0.91, 1.00, 0.83, 0.75, 0.58],
  [0.78, 0.83, 1.00, 0.69, 0.52],
  [0.82, 0.75, 0.69, 1.00, 0.61],
  [0.65, 0.58, 0.52, 0.61, 1.00],
];

const TOP_PERFORMERS = [
  { symbol: "SOL",  return: "+5.14%", value: "$5,308", color: C.success },
  { symbol: "BNB",  return: "+2.21%", value: "$3,764", color: C.success },
  { symbol: "BTC",  return: "+2.11%", value: "$18,920",color: C.success },
];
const BOT_PERFORMERS = [
  { symbol: "ETH",  return: "-1.24%", value: "$7,960", color: C.danger },
  { symbol: "XRP",  return: "+0.08%", value: "$2,120", color: C.warning },
];

// ─── Donut chart (view-based) ─────────────────────────────────────────────────
function DonutChart({ slices }: { slices: typeof ALLOCATION_BY_ASSET }) {
  const total = slices.reduce((a, s) => a + s.pct, 0);
  let cumulativeAngle = -90; // start from top
  return (
    <View style={dc.container}>
      <View style={dc.donut}>
        {slices.map((slice, i) => {
          const angle = (slice.pct / total) * 360;
          const mid = cumulativeAngle + angle / 2;
          cumulativeAngle += angle;
          const r = 60;
          const rad = (mid * Math.PI) / 180;
          const x = 75 + r * Math.cos(rad);
          const y = 75 + r * Math.sin(rad);
          return (
            <View
              key={i}
              style={[dc.segment, {
                left: x - 20,
                top:  y - 12,
                backgroundColor: slice.color + "33",
                borderWidth: 2,
                borderColor: slice.color,
                borderRadius: 20,
                paddingHorizontal: 6,
                paddingVertical: 3,
              }]}
            >
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: slice.color }}>
                {slice.pct.toFixed(0)}%
              </Text>
            </View>
          );
        })}
        <View style={dc.centerCircle}>
          <Text style={dc.centerText}>$</Text>
          <Text style={dc.centerValue}>
            {(slices.reduce((a, s) => a + s.value, 0) / 1000).toFixed(1)}k
          </Text>
        </View>
      </View>
      {/* Legend */}
      <View style={dc.legend}>
        {slices.map((s, i) => (
          <View key={i} style={dc.legendRow}>
            <View style={[dc.legendDot, { backgroundColor: s.color }]} />
            <Text style={dc.legendLabel}>{s.label}</Text>
            <Text style={dc.legendPct}>{s.pct.toFixed(1)}%</Text>
            <Text style={dc.legendValue}>${s.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const dc = StyleSheet.create({
  container: { },
  donut: { width: 150, height: 150, alignSelf: "center", position: "relative", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  segment: { position: "absolute" },
  centerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.background, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.border },
  centerText: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
  centerValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  legend: { gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1 },
  legendPct: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, width: 42, textAlign: "right" },
  legendValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, width: 70, textAlign: "right" },
});

// ─── Performance chart ────────────────────────────────────────────────────────
function PerfChart({ data, range }: { data: typeof PERF_DATA["7D"]; range: TimeRange }) {
  const max = Math.max(...data.bars);
  const height = 80;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height, marginBottom: 4 }}>
        {data.bars.map((h, i) => (
          <View key={i} style={{ flex: 1, height: (h / max) * height, backgroundColor: data.color + "66", borderRadius: 3, borderTopWidth: 2, borderTopColor: data.color }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary }}>Start of {range}</Text>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: data.color }}>{data.return}</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary }}>Now</Text>
      </View>
    </View>
  );
}

// ─── Correlation heatmap ──────────────────────────────────────────────────────
function CorrHeatmap() {
  function corrColor(v: number) {
    if (v >= 0.8) return "#FF5252";
    if (v >= 0.6) return "#FFB74D";
    if (v >= 0.4) return "#FFD700";
    if (v >= 0.2) return "#00D4AA";
    return "#6B7A99";
  }
  return (
    <View>
      {/* Header row */}
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        <View style={{ width: 36 }} />
        {CORR_ASSETS.map(a => (
          <Text key={a} style={{ flex: 1, fontFamily: "Inter_700Bold", fontSize: 10, color: C.textSecondary, textAlign: "center" }}>{a}</Text>
        ))}
      </View>
      {CORR_MATRIX.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
          <Text style={{ width: 36, fontFamily: "Inter_700Bold", fontSize: 10, color: C.textSecondary, alignSelf: "center" }}>{CORR_ASSETS[i]}</Text>
          {row.map((val, j) => (
            <View key={j} style={{ flex: 1, aspectRatio: 1, backgroundColor: corrColor(val), borderRadius: 4, margin: 1, alignItems: "center", justifyContent: "center", maxHeight: 36 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: "#000" }}>{val.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        {[["≥0.8", "#FF5252", "Very High"], ["0.6", "#FFB74D", "High"], ["0.4", "#FFD700", "Medium"], ["<0.4", "#00D4AA", "Low"]].map(([l, c, t]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c as string }} />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary }}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Diversification score ────────────────────────────────────────────────────
function DiversificationScore({ score }: { score: number }) {
  const color = score >= 70 ? C.success : score >= 40 ? C.warning : C.danger;
  const label = score >= 70 ? "Well Diversified" : score >= 40 ? "Moderately Concentrated" : "Highly Concentrated";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color }}>{score}</Text>
      </View>
      <View>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: C.text }}>{label}</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
          BTC dominance is high — consider diversifying
        </Text>
      </View>
    </View>
  );
}

// ─── Performer card ───────────────────────────────────────────────────────────
function PerformerCard({ item, isTop }: { item: typeof TOP_PERFORMERS[0]; isTop: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: (isTop ? C.successDim : C.dangerDim), alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: item.color }}>{item.symbol}</Text>
        </View>
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text }}>{item.symbol}/USDT</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: item.color }}>{item.return}</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary }}>{item.value}</Text>
      </View>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4 }}>
      <Ionicons name={icon as any} size={18} color={C.textSecondary} />
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: C.text }}>{title}</Text>
    </View>
  );
}

// ─── Gate banner ──────────────────────────────────────────────────────────────
function GateBanner({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.warningDim, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.warning }}>
      <Ionicons name="lock-closed" size={16} color={C.warning} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.warning, flex: 1 }}>{text}</Text>
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function PortfolioAnalyticsScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const plan = (user?.plan ?? "free") as PlanType;

  const [allocMode, setAllocMode] = useState<AllocMode>("asset");
  const [timeRange, setTimeRange] = useState<TimeRange>("30D");

  const canFullCharts = planGte(plan, "pro");
  const canCorr       = planGte(plan, "premium");
  const canTax        = planGte(plan, "premium");
  const canShadow     = planGte(plan, "pro");

  const [shadowExpanded, setShadowExpanded] = useState(false);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowData, setShadowData] = useState<any>(null);

  const fetchShadowAnalysis = async () => {
    if (!canShadow || shadowData) return;
    setShadowLoading(true);
    try {
      const res = await apiRequest("GET", "/api/ai/shadow/analyze");
      const data = await res.json();
      setShadowData(data);
    } catch (err) {
      console.error("Shadow Coach Error:", err);
    } finally {
      setShadowLoading(false);
    }
  };

  const toggleShadow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newExpanded = !shadowExpanded;
    setShadowExpanded(newExpanded);
    if (newExpanded && !shadowData) {
      fetchShadowAnalysis();
    }
  };

  const allocSlices = allocMode === "asset" ? ALLOCATION_BY_ASSET : allocMode === "exchange" ? ALLOCATION_BY_EXCHANGE : ALLOCATION_BY_SECTOR;

  const [realPnlData, setRealPnlData] = useState({ totalPnl: 0, winRate: 0, count: 0, loaded: false });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await apiRequest("GET", "/api/trades");
        const trades = await response.json();
        const tradeList = Array.isArray(trades) ? trades : [];
        const totalPnl = tradeList.reduce((s: number, t: any) => s + Number(t.pnl ?? 0), 0);
        const wins = tradeList.filter((t: any) => Number(t.pnl ?? 0) > 0);
        const winRate = tradeList.length > 0 ? (wins.length / tradeList.length) * 100 : 0;
        if (mounted) setRealPnlData({ totalPnl, winRate, count: tradeList.length, loaded: true });
      } catch {
        // keep defaults
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const realizedPnl   = realPnlData.loaded ? realPnlData.totalPnl : 8420.50;
  const unrealizedPnl = realPnlData.loaded ? 0 : 12845.30;
  const totalPnl      = realizedPnl + unrealizedPnl;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('portfolioAnalytics')}</Text>
        <View style={[s.planBadge, { backgroundColor: planTheme.primaryDim }]}>
          <Text style={[s.planBadgeText, { color: planTheme.primary }]}>{plan.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Allocation donut */}
        <SectionTitle title="Allocation" icon="pie-chart-outline" />
        <View style={s.card}>
          {/* Alloc mode selector */}
          <View style={s.tabRow}>
            {(["asset", "exchange", "sector"] as AllocMode[]).map(m => (
              <Pressable key={m} style={[s.tab, allocMode === m && { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]} onPress={() => { Haptics.selectionAsync(); setAllocMode(m); }}>
                <Text style={[s.tabText, allocMode === m && { color: planTheme.primary }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <DonutChart slices={allocSlices} />
        </View>

        {/* Performance timeline */}
        {!canFullCharts && <GateBanner text="Full performance charts require Pro plan or higher." />}
        <View style={{ opacity: canFullCharts ? 1 : 0.4 }}>
          <SectionTitle title="Performance Timeline" icon="trending-up-outline" />
          <View style={s.card}>
            <View style={s.tabRow}>
              {(["7D", "30D", "90D", "1Y", "All"] as TimeRange[]).map(r => (
                <Pressable key={r} style={[s.tab, timeRange === r && { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]} onPress={() => { Haptics.selectionAsync(); setTimeRange(r); }}>
                  <Text style={[s.tabText, timeRange === r && { color: planTheme.primary }]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <PerfChart data={PERF_DATA[timeRange]} range={timeRange} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <View style={[s.benchmarkPill, { borderColor: C.primary }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.primary }}>Portfolio {PERF_DATA[timeRange].return}</Text>
              </View>
              <View style={[s.benchmarkPill, { borderColor: C.textTertiary }]}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: C.textTertiary }}>BTC {timeRange === "7D" ? "+2.1%" : timeRange === "30D" ? "+14.3%" : "+28.5%"}</Text>
              </View>
              <View style={[s.benchmarkPill, { borderColor: C.textTertiary }]}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: C.textTertiary }}>ETH {timeRange === "7D" ? "+3.2%" : timeRange === "30D" ? "+18.7%" : timeRange === "90D" ? "+34.5%" : "+61.2%"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Diversification */}
        <SectionTitle title="Diversification Score" icon="shield-checkmark-outline" />
        <View style={s.card}>
          <DiversificationScore score={42} />
        </View>

        {/* Shadow Coach */}
        <SectionTitle title="Shadow Coach" icon="eye-outline" />
        <View style={s.card}>
          <Pressable 
            onPress={toggleShadow}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: planTheme.primaryDim, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="bulb-outline" size={20} color={planTheme.primary} />
              </View>
              <View>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: C.text }}>AI Analysis</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary }}>Personalized portfolio coaching</Text>
              </View>
            </View>
            <Ionicons name={shadowExpanded ? "chevron-up" : "chevron-down"} size={20} color={C.textTertiary} />
          </Pressable>

          {shadowExpanded && (
            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 }}>
              {!canShadow ? (
                <View style={{ alignItems: "center", paddingVertical: 10 }}>
                  <Ionicons name="lock-closed" size={32} color={C.warning} style={{ marginBottom: 8 }} />
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, textAlign: "center" }}>Upgrade to Pro</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "center", marginTop: 4 }}>
                    Shadow Coach is available for Pro plans and above.
                  </Text>
                  <Pressable 
                    onPress={() => router.push("/payment")}
                    style={{ backgroundColor: planTheme.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginTop: 12 }}
                  >
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#000" }}>Upgrade Now</Text>
                  </Pressable>
                </View>
              ) : shadowLoading ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <ActivityIndicator color={planTheme.primary} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 10 }}>Analyzing your portfolio...</Text>
                </View>
              ) : shadowData ? (
                <View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary }}>Overall Score</Text>
                    <View style={{ backgroundColor: shadowData.overallScore >= 70 ? C.successDim : C.warningDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: shadowData.overallScore >= 70 ? C.success : C.warning }}>{shadowData.overallScore}/100</Text>
                    </View>
                  </View>

                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 20, marginBottom: 20 }}>
                    {shadowData.analysis}
                  </Text>

                  {shadowData.recommendations?.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: planTheme.primary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Recommendations</Text>
                      {shadowData.recommendations.map((rec: string, i: number) => (
                        <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 8, backgroundColor: C.surface, padding: 10, borderRadius: 8 }}>
                          <Ionicons name="checkmark-circle-outline" size={16} color={planTheme.primary} style={{ marginTop: 2 }} />
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.text, flex: 1 }}>{rec}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: C.danger, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Risks</Text>
                      {shadowData.risks?.map((risk: string, i: number) => (
                        <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                          <Ionicons name="alert-circle" size={14} color={C.danger} style={{ marginTop: 2 }} />
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 }}>{risk}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: C.success, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Opportunities</Text>
                      {shadowData.opportunities?.map((opp: string, i: number) => (
                        <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                          <Ionicons name="trending-up" size={14} color={C.success} style={{ marginTop: 2 }} />
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 }}>{opp}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center" }}>Failed to load analysis. Please try again.</Text>
              )}
            </View>
          )}
        </View>

        {/* Correlation matrix */}
        {!canCorr && <GateBanner text="Correlation matrix requires Premium plan." />}
        <View style={{ opacity: canCorr ? 1 : 0.4 }}>
          <SectionTitle title="Correlation Matrix" icon="grid-outline" />
          <View style={s.card}>
            <CorrHeatmap />
          </View>
        </View>

        {/* Performers */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <SectionTitle title="Top Performers" icon="arrow-up-outline" />
            <View style={s.card}>
              {TOP_PERFORMERS.map((p, i) => <PerformerCard key={i} item={p} isTop />)}
            </View>
          </View>
        </View>

        <SectionTitle title="Bottom Performers" icon="arrow-down-outline" />
        <View style={s.card}>
          {BOT_PERFORMERS.map((p, i) => <PerformerCard key={i} item={p} isTop={false} />)}
        </View>

        {/* Realized / Unrealized PnL */}
        <SectionTitle title="PnL Breakdown" icon="cash-outline" />
        <View style={s.card}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[s.pnlCell, { borderColor: C.success }]}>
              <Text style={s.pnlLabel}>Realized PnL</Text>
              <Text style={[s.pnlValue, { color: C.success }]}>
                {realizedPnl >= 0 ? "+" : ""}${Math.abs(realizedPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={[s.pnlCell, { borderColor: C.primary }]}>
              <Text style={s.pnlLabel}>Win Rate</Text>
              <Text style={[s.pnlValue, { color: C.primary }]}>
                {realPnlData.loaded ? `${realPnlData.winRate.toFixed(1)}%` : `+$${unrealizedPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </Text>
            </View>
          </View>
          <View style={[s.pnlTotal, { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]}>
            <Text style={s.pnlLabel}>Total PnL {realPnlData.loaded ? `· ${realPnlData.count} trades` : ''}</Text>
            <Text style={[s.pnlValue, { color: planTheme.primary, fontSize: 22 }]}>
              {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Tax estimation */}
        {!canTax && <GateBanner text="Tax estimation requires Premium plan." />}
        <View style={{ opacity: canTax ? 1 : 0.4 }}>
          <SectionTitle title="Tax Estimation" icon="document-text-outline" />
          <View style={s.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary }}>Realized Capital Gains (2024)</Text>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: C.success }}>+$8,420.50</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary }}>Short-term gains ({'<'}1yr)</Text>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text }}>$5,240.20</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary }}>Long-term gains (≥1yr)</Text>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text }}>$3,180.30</Text>
            </View>
            <View style={{ backgroundColor: C.warningDim, borderRadius: 8, padding: 10, marginTop: 4 }}>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.warning }}>
                ⚠️ This is an estimate only. Consult a tax professional for accurate reporting.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, flex: 1 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  planBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  tabRow: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  benchmarkPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pnlCell: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  pnlLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginBottom: 4 },
  pnlValue: { fontFamily: "Inter_700Bold", fontSize: 16 },
  pnlTotal: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 10, alignItems: "center" },
});
