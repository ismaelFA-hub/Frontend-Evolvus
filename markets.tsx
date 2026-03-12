import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, Platform, RefreshControl, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { getMarketData, formatCurrency, formatPercent, formatNumber, CryptoAsset } from "@/lib/market-data";
import { useMarketPrices, mergeLivePrices } from "@/lib/use-market-prices";
import { addCryptoHistory } from "@/lib/cryptoHistory";
import { CryptoHistoryBar } from "@/components/CryptoHistoryBar";
import CoinIcon from "@/components/CoinIcon";
import { useAuth } from "@/lib/auth-context";
import LockedFeature from "@/components/LockedFeature";

const C = Colors.dark;
type SortKey = "marketCap" | "price" | "change" | "volume";

const CRYPTO_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  SOL: '#9945FF',
  BNB: '#F3BA2F',
  XRP: '#23292F',
  ADA: '#0033AD',
  AVAX: '#E84142',
  DOT: '#E6007A',
  LINK: '#2A5ADA',
  MATIC: '#8247E5',
  UNI: '#FF007A',
  ATOM: '#2E3148',
};

const CRYPTO_ICONS: Record<string, { name: string; bg: string }> = {
  BTC: { name: 'logo-bitcoin', bg: '#F7931A' },
  ETH: { name: 'diamond-outline', bg: '#627EEA' },
  SOL: { name: 'sunny-outline', bg: '#9945FF' },
  BNB: { name: 'cube-outline', bg: '#F3BA2F' },
  XRP: { name: 'water-outline', bg: '#23292F' },
  ADA: { name: 'layers-outline', bg: '#0033AD' },
  AVAX: { name: 'triangle-outline', bg: '#E84142' },
  DOT: { name: 'ellipse-outline', bg: '#E6007A' },
  LINK: { name: 'link-outline', bg: '#2A5ADA' },
  MATIC: { name: 'shapes-outline', bg: '#8247E5' },
  UNI: { name: 'color-filter-outline', bg: '#FF007A' },
  ATOM: { name: 'planet-outline', bg: '#2E3148' },
};

function generateSparkline(basePrice: number, changePercent: number, seed: number): number[] {
  const points: number[] = [];
  const numPoints = 24;
  const startPrice = basePrice / (1 + changePercent / 100);
  let price = startPrice;
  const stepTrend = (basePrice - startPrice) / numPoints;

  for (let i = 0; i < numPoints; i++) {
    const noise = Math.sin(seed * 3.7 + i * 1.2) * (basePrice * 0.005) +
                  Math.cos(seed * 2.1 + i * 0.8) * (basePrice * 0.003);
    price = startPrice + stepTrend * i + noise;
    points.push(price);
  }
  points.push(basePrice);
  return points;
}

function SparklineChart({ asset }: { asset: CryptoAsset }) {
  const data = useMemo(() =>
    generateSparkline(asset.price, asset.changePercent24h, parseFloat(asset.id) * 7.3),
    [asset.id, asset.price > 0 ? Math.floor(asset.price) : 0]
  );

  const isUp = asset.changePercent24h >= 0;
  const color = isUp ? C.success : C.danger;
  const maxY = Math.max(...data);
  const minY = Math.min(...data);
  const range = maxY - minY || 1;

  const width = 60;
  const height = 28;
  const stepX = width / (data.length - 1);

  const pathParts: string[] = [];
  data.forEach((val, i) => {
    const x = i * stepX;
    const y = height - ((val - minY) / range) * height;
    pathParts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  });

  return (
    <View style={styles.sparklineContainer}>
      <View style={{ width, height }}>
        {data.map((val, i) => {
          if (i === 0) return null;
          const x1 = (i - 1) * stepX;
          const y1 = height - ((data[i - 1] - minY) / range) * height;
          const x2 = i * stepX;
          const y2 = height - ((val - minY) / range) * height;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                left: x1,
                top: y1,
                width: len,
                height: 1.5,
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: "left center",
                opacity: 0.9,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const FAVORITES_KEY = "@evolvus_market_favorites";

const AssetRow = memo(function AssetRow({
  item, primary, isFavorited, onToggleFavorite,
}: { item: CryptoAsset; primary: string; isFavorited: boolean; onToggleFavorite: (id: string) => void }) {
  const isUp = item.changePercent24h >= 0;

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    addCryptoHistory({ symbol: item.symbol, name: item.name, id: item.id });
    router.push({ pathname: "/asset/[id]", params: { id: item.id } });
  }, [item.id, item.symbol, item.name]);

  return (
    <Pressable
      style={styles.assetRow}
      onPress={handlePress}
      testID={`asset-row-${item.symbol}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} ${formatCurrency(item.price)}`}
    >
      <View style={styles.assetLeft}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onToggleFavorite(item.id); }}
          hitSlop={8}
          style={styles.starBtn}
        >
          <Ionicons
            name={isFavorited ? "star" : "star-outline"}
            size={16}
            color={isFavorited ? "#F59E0B" : C.textTertiary}
          />
        </Pressable>
        <CoinIcon
          symbol={item.symbol}
          size={36}
          style={styles.assetIcon}
          testID={`coin-icon-${item.symbol}`}
        />
        <View>
          <Text style={styles.assetSymbol}>{item.symbol}</Text>
          <Text style={styles.assetName}>{item.name}</Text>
        </View>
      </View>
      <SparklineChart asset={item} />
      <View style={styles.assetMiddle}>
        <Text style={styles.assetPrice}>{formatCurrency(item.price)}</Text>
        <Text style={styles.assetVolume}>Vol: {formatNumber(item.volume24h)}</Text>
      </View>
      <View style={[styles.changePill, { backgroundColor: isUp ? C.successDim : C.dangerDim }]}>
        <Text style={[styles.changeText, { color: isUp ? C.success : C.danger }]}>
          {formatPercent(item.changePercent24h)}
        </Text>
      </View>
    </Pressable>
  );
});

type MarketTab = 'all' | 'favorites' | 'gainers' | 'losers';

const TABS: { key: MarketTab; label: string; icon: string }[] = [
  { key: 'all', label: 'Todos', icon: 'grid-outline' },
  { key: 'favorites', label: 'Favoritos', icon: 'star' },
  { key: 'gainers', label: 'Gainers', icon: 'trending-up' },
  { key: 'losers', label: 'Losers', icon: 'trending-down' },
];

export default function MarketsScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const [assets, setAssets] = useState<CryptoAsset[]>(() => getMarketData());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("marketCap");
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<MarketTab>('all');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Real-time prices from backend SSE (falls back to mock automatically)
  const { prices: livePrices, isLive } = useMarketPrices();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((raw) => {
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Merge live prices into the base asset list whenever prices update
  useEffect(() => {
    const base = getMarketData();
    setAssets(mergeLivePrices(base, livePrices));
  }, [livePrices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const base = getMarketData();
    setAssets(mergeLivePrices(base, livePrices));
    setTimeout(() => setRefreshing(false), 500);
  }, [livePrices]);

  const filtered = useMemo(() => {
    let list = assets
      .filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.symbol.toLowerCase().includes(search.toLowerCase()));

    if (activeTab === 'favorites') {
      list = list.filter(a => favorites.has(a.id));
    } else if (activeTab === 'gainers') {
      list = list.filter(a => a.changePercent24h > 0).sort((a, b) => b.changePercent24h - a.changePercent24h);
      return list;
    } else if (activeTab === 'losers') {
      list = list.filter(a => a.changePercent24h < 0).sort((a, b) => a.changePercent24h - b.changePercent24h);
      return list;
    }

    return list.sort((a, b) => {
      switch (sortBy) {
        case "price": return b.price - a.price;
        case "change": return b.changePercent24h - a.changePercent24h;
        case "volume": return b.volume24h - a.volume24h;
        default: return b.marketCap - a.marketCap;
      }
    });
  }, [assets, search, sortBy, activeTab, favorites]);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "marketCap", label: t('cap') },
    { key: "price", label: t('price') },
    { key: "change", label: t('change24h') },
    { key: "volume", label: t('volume') },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('markets')}</Text>
        <View style={[styles.liveIndicator, !isLive && styles.liveIndicatorMock]}>
          <View style={[styles.liveDot, !isLive && styles.liveDotMock]} />
          <Text style={[styles.liveText, !isLive && styles.liveTextMock]}>
            {isLive ? t('live') : 'Demo'}
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={C.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchAssets')}
          placeholderTextColor={C.textTertiary}
          value={search}
          onChangeText={setSearch}
          testID="markets-search-input"
          accessibilityLabel={t('searchAssets')}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} testID="markets-search-clear">
            <Ionicons name="close-circle" size={18} color={C.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* History bar — shown when search is empty */}
      {!search && (
        <CryptoHistoryBar
          onSelect={(symbol) => setSearch(symbol)}
        />
      )}

      {/* Market Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const tabColor = tab.key === 'gainers' ? C.success : tab.key === 'losers' ? C.danger : tab.key === 'favorites' ? '#F59E0B' : planTheme.primary;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tabChip, isActive && { backgroundColor: `${tabColor}18`, borderColor: `${tabColor}50` }]}
              onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={isActive ? tabColor : C.textTertiary}
              />
              <Text style={[styles.tabChipText, isActive && { color: tabColor }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sort bar — hidden for gainers/losers since they auto-sort */}
      {activeTab !== 'gainers' && activeTab !== 'losers' && (
        <View style={styles.sortBar}>
          {sortOptions.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.sortChip, sortBy === opt.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
              onPress={() => { setSortBy(opt.key); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.sortChipText, sortBy === opt.key && { color: planTheme.primary }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Market Analysis quick access */}
      <LockedFeature userPlan={(user?.plan ?? "free") as any} requiredPlan="pro">
        <Pressable
          style={[styles.analysisCard, { borderColor: `${planTheme.primary}30` }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/market-analysis'); }}
        >
          <Ionicons name="analytics-outline" size={20} color={planTheme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.analysisTitle, { color: planTheme.primary }]}>Análise Multi-TF IA</Text>
            <Text style={styles.analysisSub}>Tendência, RSI, MACD e sentimento por símbolo</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={planTheme.primary} />
        </Pressable>
      </LockedFeature>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AssetRow
            item={item}
            primary={planTheme.primary}
            isFavorited={favorites.has(item.id)}
            onToggleFavorite={toggleFavorite}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={planTheme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === 'favorites' ? "star-outline" : "search"}
              size={40}
              color={C.textTertiary}
            />
            <Text style={styles.emptyText}>
              {activeTab === 'favorites' ? "Sem favoritos ainda\nToque na ★ para favoritar" : t('noAssetsFound')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.successDim, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveIndicatorMock: { backgroundColor: 'rgba(138,148,166,0.15)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveDotMock: { backgroundColor: '#8A94A6' },
  liveText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.success },
  liveTextMock: { color: '#8A94A6' },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, marginHorizontal: 20, borderRadius: 14, paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: C.border },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: C.text, paddingVertical: 14 },
  sortBar: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  sortChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  analysisCard: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 8, backgroundColor: C.card, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  analysisTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  analysisSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  assetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sparklineContainer: { width: 60, height: 28, marginHorizontal: 6 },
  tabBar: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  tabChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  tabChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textTertiary },
  starBtn: { padding: 2 },
  assetLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  rankBadge: { width: 20, alignItems: "center" },
  rankText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  assetIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  assetSymbol: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  assetName: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  assetMiddle: { alignItems: "flex-end", marginRight: 12 },
  assetPrice: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  assetVolume: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  changePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, minWidth: 72, alignItems: "center" },
  changeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
});
