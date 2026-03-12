import { useState, useEffect, useMemo, useCallback } from "react";
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
import { getMarketData, type CryptoAsset } from "@/lib/market-data";
import { apiRequest } from "@/lib/query-client";

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

type ViewMode = "marketcap" | "volume";
type TimeRange = "1H" | "24H" | "7D" | "30D";

const TIME_RANGES: TimeRange[] = ["1H", "24H", "7D", "30D"];

function getHeatColor(pct: number): string {
  const clamped = Math.max(-10, Math.min(10, pct));
  if (clamped >= 0) {
    const opacity = 0.25 + (clamped / 10) * 0.75;
    return `rgba(0, 212, 170, ${opacity.toFixed(2)})`;
  } else {
    const opacity = 0.25 + (Math.abs(clamped) / 10) * 0.75;
    return `rgba(255, 82, 82, ${opacity.toFixed(2)})`;
  }
}

function formatPrice(p: number) {
  if (p >= 1000) return `$${(p / 1000).toFixed(1)}K`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

export default function HeatmapScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const { t } = useI18n();

  const [viewMode, setViewMode] = useState<ViewMode>("marketcap");
  const [timeRange, setTimeRange] = useState<TimeRange>("24H");
  const [assets, setAssets] = useState<CryptoAsset[]>(() => getMarketData());

  // Merge real prices from API into the asset list
  const refreshPrices = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/market/prices");
      const priceMap = await res.json() as Record<string, { symbol: string; price: number }>;
      setAssets(prev => prev.map(a => {
        const entry = priceMap[a.symbol];
        if (!entry) return a;
        const newPrice = entry.price;
        const change = ((newPrice - a.price) / a.price) * 100;
        // Apply 10% of the actual price change to smooth the 24h percentage (avoid sharp jumps)
        const SMOOTHING = 0.1;
        return {
          ...a,
          price: newPrice,
          changePercent24h: parseFloat((a.changePercent24h + change * SMOOTHING).toFixed(2)),
        };
      }));
    } catch {
      // fall back to mock rotation on API failure
      setAssets(getMarketData());
    }
  }, []);

  useEffect(() => {
    refreshPrices();
    const id = setInterval(refreshPrices, 10_000);
    return () => clearInterval(id);
  }, [refreshPrices]);

  const assetLimit = planGte(planType, "premium") ? Infinity : planGte(planType, "pro") ? 30 : 10;

  const sortedAssets = useMemo(() => {
    const sorted = [...assets].sort((a, b) =>
      viewMode === "marketcap" ? b.marketCap - a.marketCap : b.volume24h - a.volume24h
    );
    return sorted.slice(0, assetLimit);
  }, [assets, viewMode, assetLimit]);

  const totalMarketCap = useMemo(() => assets.reduce((s, a) => s + a.marketCap, 0), [assets]);
  const btcDom = useMemo(() => {
    const btc = assets.find((a) => a.symbol === "BTC");
    return btc ? ((btc.marketCap / totalMarketCap) * 100).toFixed(1) : "0";
  }, [assets, totalMarketCap]);
  const ethDom = useMemo(() => {
    const eth = assets.find((a) => a.symbol === "ETH");
    return eth ? ((eth.marketCap / totalMarketCap) * 100).toFixed(1) : "0";
  }, [assets, totalMarketCap]);

  const maxMarketCap = useMemo(() => Math.max(...sortedAssets.map((a) => a.marketCap)), [sortedAssets]);

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
        <Text style={s.headerTitle}>{t('marketHeatmap')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Stats bar */}
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statLabel}>Market Cap</Text>
            <Text style={s.statValue}>${(totalMarketCap / 1e12).toFixed(2)}T</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statLabel}>BTC Dom.</Text>
            <Text style={s.statValue}>{btcDom}%</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statLabel}>ETH Dom.</Text>
            <Text style={s.statValue}>{ethDom}%</Text>
          </View>
        </View>

        {/* View mode */}
        <View style={s.toggleRow}>
          {(["marketcap", "volume"] as ViewMode[]).map((m) => (
            <Pressable
              key={m}
              style={[s.toggleBtn, viewMode === m && s.toggleBtnActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setViewMode(m);
              }}
            >
              <Text style={[s.toggleBtnText, viewMode === m && { color: C.text }]}>
                {m === "marketcap" ? "Por Market Cap" : "Por Volume"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Time range */}
        <View style={s.timeRow}>
          {TIME_RANGES.map((r) => (
            <Pressable
              key={r}
              style={[s.timePill, timeRange === r && s.timePillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setTimeRange(r);
              }}
            >
              <Text style={[s.timePillText, timeRange === r && { color: C.text }]}>{r}</Text>
            </Pressable>
          ))}
        </View>

        {/* Heatmap grid */}
        <View style={s.heatGrid}>
          {sortedAssets.map((asset) => {
            const pct = asset.changePercent24h;
            const bgColor = getHeatColor(pct);
            const relSize = asset.marketCap / maxMarketCap;
            const isLarge = relSize > 0.2;
            const isMedium = relSize > 0.05;
            const minH = isLarge ? 100 : isMedium ? 70 : 50;
            const flex = isLarge ? 2 : 1;
            return (
              <Pressable
                key={asset.id}
                style={[s.heatCell, { backgroundColor: bgColor, minHeight: minH, flex }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: "/asset/[id]", params: { id: asset.id } });
                }}
              >
                <Text style={s.heatSymbol}>{asset.symbol}</Text>
                <Text style={[s.heatPct, { color: pct >= 0 ? C.success : C.danger }]}>
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </Text>
                {isLarge && <Text style={s.heatPrice}>{formatPrice(asset.price)}</Text>}
              </Pressable>
            );
          })}
        </View>

        {!planGte(planType, "pro") && (
          <View style={s.gateCard}>
            <PlanGate required="pro" />
          </View>
        )}

        {/* Legend */}
        <View style={s.legendContainer}>
          <Text style={s.legendMinus}>-10%</Text>
          <View style={s.legendBar}>
            {Array.from({ length: 20 }).map((_, i) => {
              const v = -10 + i * 1;
              return <View key={i} style={[s.legendSegment, { backgroundColor: getHeatColor(v) }]} />;
            })}
          </View>
          <Text style={s.legendPlus}>+10%</Text>
        </View>

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
  scroll: { paddingHorizontal: 16, paddingTop: 14 },
  // Stats bar
  statsBar: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 3 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 10 },
  // View mode
  toggleRow: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  toggleBtnActive: { backgroundColor: C.card },
  toggleBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textTertiary },
  // Time range
  timeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  timePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: C.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  timePillActive: { backgroundColor: C.card, borderColor: C.secondary },
  timePillText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textTertiary },
  // Heatmap
  heatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginBottom: 16 },
  heatCell: {
    minWidth: 60,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  heatSymbol: { fontFamily: "Inter_700Bold", fontSize: 12, color: C.text },
  heatPct: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 2 },
  heatPrice: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2 },
  // Gate
  gateCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    marginBottom: 16,
  },
  // Legend
  legendContainer: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  legendMinus: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.danger },
  legendBar: { flex: 1, flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" },
  legendSegment: { flex: 1, height: 10 },
  legendPlus: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.success },
  // PlanGate
  gateOverlay: { alignItems: "center", paddingVertical: 16, gap: 10 },
  gateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gateBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  gateBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
});
