import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { apiRequest } from "@/lib/query-client";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

type FilterKey = 'gainers' | 'losers' | 'volume' | 'newListings';
type SortKey = 'price' | 'change' | 'volume' | 'marketCap';

const SCANNER_FALLBACK = [
  { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 105420.50, change: 3.42, volume: 48200000000, marketCap: 2050000000000, color: '#F7931A' },
  { id: '2', symbol: 'ETH', name: 'Ethereum', price: 3845.20, change: 5.18, volume: 22100000000, marketCap: 462000000000, color: '#627EEA' },
  { id: '3', symbol: 'SOL', name: 'Solana', price: 248.75, change: 8.92, volume: 8400000000, marketCap: 108000000000, color: '#9945FF' },
  { id: '4', symbol: 'BNB', name: 'BNB', price: 712.30, change: -1.24, volume: 3200000000, marketCap: 106000000000, color: '#F3BA2F' },
  { id: '5', symbol: 'XRP', name: 'Ripple', price: 2.85, change: -2.67, volume: 5600000000, marketCap: 148000000000, color: '#23292F' },
  { id: '6', symbol: 'ADA', name: 'Cardano', price: 1.42, change: 4.35, volume: 2800000000, marketCap: 50200000000, color: '#0033AD' },
  { id: '7', symbol: 'AVAX', name: 'Avalanche', price: 62.80, change: -3.15, volume: 1900000000, marketCap: 23400000000, color: '#E84142' },
  { id: '8', symbol: 'LINK', name: 'Chainlink', price: 28.45, change: 6.73, volume: 1400000000, marketCap: 17200000000, color: '#2A5ADA' },
];

const SYMBOL_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', BNB: '#F3BA2F',
  XRP: '#23292F', ADA: '#0033AD', AVAX: '#E84142', LINK: '#2A5ADA',
};

function formatCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('gainers');
  const [sortBy, setSortBy] = useState<SortKey>('change');
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [scanData, setScanData] = useState(SCANNER_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await apiRequest("GET", "/api/market/scan");
        const res = await response.json();
        const raw = Array.isArray(res) ? res : (res?.symbols ?? []);
        if (mounted && raw.length > 0) {
          setScanData(raw.map((item: any, idx: number) => {
            const sym = (item.symbol ?? "").replace("USDT", "").replace("/USDT", "");
            return {
              id: item.id ?? String(idx + 1),
              symbol: sym,
              name: item.name ?? sym,
              price: Number(item.price ?? item.lastPrice ?? 0),
              change: Number(item.change24h ?? item.changePercent ?? item.priceChangePercent ?? 0),
              volume: Number(item.volume24h ?? item.volume ?? 0),
              marketCap: Number(item.marketCap ?? item.quoteVolume ?? 0),
              color: SYMBOL_COLORS[sym] ?? '#6B7A99',
            };
          }));
        }
      } catch {
        // keep fallback data
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filters: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'gainers', label: 'Gainers', icon: 'trending-up' },
    { key: 'losers', label: 'Losers', icon: 'trending-down' },
    { key: 'volume', label: 'Volume', icon: 'bar-chart-outline' },
    { key: 'newListings', label: 'New Listings', icon: 'sparkles-outline' },
  ];

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'price', label: 'Price' },
    { key: 'change', label: 'Change %' },
    { key: 'volume', label: 'Volume' },
    { key: 'marketCap', label: 'Market Cap' },
  ];

  const filtered = [...scanData]
    .filter(item => {
      if (activeFilter === 'gainers') return item.change > 0;
      if (activeFilter === 'losers') return item.change < 0;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price': return b.price - a.price;
        case 'change': return activeFilter === 'losers' ? a.change - b.change : b.change - a.change;
        case 'volume': return b.volume - a.volume;
        case 'marketCap': return b.marketCap - a.marketCap;
        default: return 0;
      }
    });

  const gainersCount = scanData.filter(i => i.change > 0).length;
  const losersCount = scanData.filter(i => i.change < 0).length;

  const maxVolume = scanData.length > 0 ? Math.max(...scanData.map(i => i.volume)) : 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('scanner')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{loading ? '—' : scanData.length}</Text>
          <Text style={styles.summaryLabel}>Assets Found</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: C.success }]}>{gainersCount}</Text>
          <Text style={styles.summaryLabel}>Gainers</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: C.danger }]}>{losersCount}</Text>
          <Text style={styles.summaryLabel}>Losers</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
            onPress={() => { setActiveFilter(f.key); Haptics.selectionAsync(); }}
          >
            <Ionicons name={f.icon as any} size={16} color={activeFilter === f.key ? planTheme.primary : C.textSecondary} />
            <Text style={[styles.filterChipText, activeFilter === f.key && { color: planTheme.primary }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sortBar}>
        {sortOptions.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.sortChip, sortBy === opt.key && { backgroundColor: C.surface, borderColor: planTheme.primary }]}
            onPress={() => { setSortBy(opt.key); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.sortChipText, sortBy === opt.key && { color: planTheme.primary }]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={planTheme.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="filter-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          </View>
        ) : filtered.map((item, idx) => {
          const isUp = item.change >= 0;
          const volumeWidth = (item.volume / maxVolume) * 100;
          return (
            <Pressable
              key={item.id}
              style={styles.resultCard}
              onPress={() => { Haptics.selectionAsync(); router.push({ pathname: "/asset/[id]", params: { id: item.id } }); }}
            >
              <View style={styles.resultLeft}>
                <Text style={styles.resultRank}>{idx + 1}</Text>
                <View style={[styles.resultIcon, { backgroundColor: `${item.color}20` }]}>
                  <Text style={[styles.resultIconText, { color: item.color }]}>{item.symbol[0]}</Text>
                </View>
                <View>
                  <Text style={styles.resultSymbol}>{item.symbol}</Text>
                  <Text style={styles.resultName}>{item.name}</Text>
                </View>
              </View>
              <View style={styles.resultRight}>
                <Text style={styles.resultPrice}>{formatPrice(item.price)}</Text>
                <View style={[styles.changePill, { backgroundColor: isUp ? C.successDim : C.dangerDim }]}>
                  <Ionicons name={isUp ? "caret-up" : "caret-down"} size={10} color={isUp ? C.success : C.danger} />
                  <Text style={[styles.changeText, { color: isUp ? C.success : C.danger }]}>
                    {Math.abs(item.change).toFixed(2)}%
                  </Text>
                </View>
              </View>
              <View style={styles.volumeSection}>
                <Text style={styles.volumeLabel}>{formatCompact(item.volume)}</Text>
                <View style={styles.volumeBarBg}>
                  <View style={[styles.volumeBarFill, { width: `${volumeWidth}%`, backgroundColor: planTheme.primary }]} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.card, marginHorizontal: 20, borderRadius: 14, paddingVertical: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: C.border },
  filterRow: { paddingHorizontal: 20, paddingBottom: 10, gap: 8 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  sortBar: { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 10, gap: 6 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  sortChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textTertiary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  resultCard: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  resultLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  resultRank: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, width: 20, textAlign: "center" },
  resultIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  resultIconText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  resultSymbol: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  resultName: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  resultRight: { alignItems: "flex-end", marginRight: 12 },
  resultPrice: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  changePill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 3 },
  changeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  volumeSection: { width: 70, alignItems: "flex-end" },
  volumeLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary, marginBottom: 4 },
  volumeBarBg: { width: "100%", height: 4, backgroundColor: C.surface, borderRadius: 2, overflow: "hidden" },
  volumeBarFill: { height: 4, borderRadius: 2 },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
});
