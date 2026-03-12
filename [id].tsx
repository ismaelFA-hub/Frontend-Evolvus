import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";
import { formatCurrency, formatPercent } from "@/lib/market-data";

const C = Colors.dark;

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  pnl: number;
  pnlPercent: number;
  outcome: 'win' | 'loss' | 'neutral';
  closedAt: string;
  status: 'open' | 'closed';
}

interface BotDetails {
  id: string;
  name: string;
  symbol: string;
  type: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  currentStreak: number;
  exchange: string;
}

export default function BotDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [bot, setBot] = useState<BotDetails | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [botRes, tradesRes] = await Promise.all([
        apiRequest("GET", `/api/bots/${id}`).then(r => r.json()),
        apiRequest("GET", `/api/trades?botId=${id}`).then(r => r.json())
      ]);

      setBot({
        id: String(botRes.id),
        name: botRes.name || 'Bot',
        symbol: botRes.symbol || botRes.pair || 'BTC/USDT',
        type: botRes.type || 'custom',
        status: (botRes.status === 'ACTIVE' || botRes.status === 'running') ? 'running' : 
                (botRes.status === 'PAUSED' || botRes.status === 'paused') ? 'paused' : 'stopped',
        totalTrades: botRes.trades || 0,
        winRate: botRes.winRate || 0,
        totalPnl: botRes.pnl || 0,
        currentStreak: botRes.currentStreak || 0,
        exchange: botRes.exchange || 'Binance'
      });

      setTrades(tradesRes.map((t: any) => ({
        id: String(t.id),
        symbol: t.symbol || t.pair || '',
        side: String(t.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
        entryPrice: Number(t.entryPrice || t.price) || 0,
        exitPrice: t.exitPrice ? Number(t.exitPrice) : undefined,
        pnl: Number(t.pnl) || 0,
        pnlPercent: Number(t.pnlPercent) || 0,
        outcome: t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : 'neutral',
        closedAt: t.closedAt ? new Date(t.closedAt).toLocaleString() : 'Open',
        status: t.status || 'closed'
      })));
    } catch (error) {
      console.error("Failed to fetch bot details:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderTradeItem = ({ item }: { item: Trade }) => {
    const isWin = item.outcome === 'win';
    const isLoss = item.outcome === 'loss';
    const pnlColor = isWin ? C.success : isLoss ? C.danger : C.textTertiary;

    return (
      <View style={s.tradeCard}>
        <View style={s.tradeHeader}>
          <View style={s.tradeHeaderLeft}>
            <Text style={s.tradeSymbol}>{item.symbol}</Text>
            <View style={[s.sideBadge, { backgroundColor: item.side === 'BUY' ? C.successDim : C.dangerDim }]}>
              <Text style={[s.sideText, { color: item.side === 'BUY' ? C.success : C.danger }]}>{item.side}</Text>
            </View>
          </View>
          <View style={[s.outcomeBadge, { backgroundColor: `${pnlColor}15` }]}>
            <Text style={[s.outcomeText, { color: pnlColor }]}>{item.outcome.toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.tradeBody}>
          <View style={s.tradeInfo}>
            <Text style={s.tradeInfoLabel}>"Entrada"</Text>
            <Text style={s.tradeInfoValue}>{formatCurrency(item.entryPrice)}</Text>
          </View>
          {item.exitPrice && (
            <View style={s.tradeInfo}>
              <Text style={s.tradeInfoLabel}>"Saída"</Text>
              <Text style={s.tradeInfoValue}>{formatCurrency(item.exitPrice)}</Text>
            </View>
          )}
          <View style={s.tradeInfo}>
            <Text style={s.tradeInfoLabel}>PnL</Text>
            <Text style={[s.tradeInfoValue, { color: pnlColor }]}>
              {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)} ({formatPercent(item.pnlPercent)})
            </Text>
          </View>
        </View>
        <Text style={s.tradeDate}>{item.closedAt}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[s.container, s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={planTheme.primary} />
      </View>
    );
  }

  if (!bot) {
    return (
      <View style={[s.container, s.centered, { paddingTop: insets.top }]}>
        <Text style={s.errorText}>Bot not found</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ color: planTheme.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backButton}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <View style={s.headerTitleContainer}>
          <Text style={s.headerTitle}>{bot.name}</Text>
          <Text style={s.headerSubtitle}>{bot.symbol} • {bot.exchange}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: `${bot.status === 'running' ? C.success : bot.status === 'paused' ? C.warning : C.textTertiary}15` }]}>
          <Text style={[s.statusText, { color: bot.status === 'running' ? C.success : bot.status === 'paused' ? C.warning : C.textTertiary }]}>
            {bot.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={s.tabBar}>
        <Pressable 
          style={[s.tabItem, activeTab === 'overview' && { borderBottomColor: planTheme.primary, borderBottomWidth: 2 }]}
          onPress={() => { setActiveTab('overview'); Haptics.selectionAsync(); }}
        >
          <Text style={[s.tabText, activeTab === 'overview' && { color: planTheme.primary }]}>"Visão Geral"</Text>
        </Pressable>
        <Pressable 
          style={[s.tabItem, activeTab === 'history' && { borderBottomColor: planTheme.primary, borderBottomWidth: 2 }]}
          onPress={() => { setActiveTab('history'); Haptics.selectionAsync(); }}
        >
          <Text style={[s.tabText, activeTab === 'history' && { color: planTheme.primary }]}>"Histórico"</Text>
        </Pressable>
      </View>

      {activeTab === 'overview' ? (
        <ScrollView 
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.statsGrid}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>"Total Trades"</Text>
              <Text style={s.statValue}>{bot.totalTrades}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>"Win Rate"</Text>
              <Text style={[s.statValue, { color: bot.winRate > 50 ? C.success : C.text }]}>{bot.winRate}%</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>"PnL Total"</Text>
              <Text style={[s.statValue, { color: bot.totalPnl >= 0 ? C.success : C.danger }]}>
                {bot.totalPnl >= 0 ? '+' : ''}{formatCurrency(bot.totalPnl)}
              </Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Streak</Text>
              <Text style={[s.statValue, { color: bot.currentStreak >= 0 ? C.success : C.danger }]}>
                {bot.currentStreak > 0 ? '+' : ''}{bot.currentStreak}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={trades}
          renderItem={renderTradeItem}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <Ionicons name="receipt-outline" size={48} color={C.textTertiary} />
              <Text style={s.emptyText}>"Nenhum trade ainda"</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.border },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: C.text },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textTertiary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 15 },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.textTertiary },
  scrollContent: { padding: 20 },
  listContent: { padding: 20, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  statCard: { width: '47%', backgroundColor: C.card, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: C.border },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textTertiary, marginBottom: 5 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 18, color: C.text },
  tradeCard: { backgroundColor: C.card, borderRadius: 16, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: C.border },
  tradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tradeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tradeSymbol: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.text },
  sideBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sideText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  outcomeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  outcomeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  tradeBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  tradeInfo: { gap: 2 },
  tradeInfoLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: C.textTertiary },
  tradeInfoValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.text },
  tradeDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: C.textTertiary, textAlign: 'right' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: C.textTertiary, marginTop: 15 },
  errorText: { color: C.danger, marginBottom: 20 },
  backBtn: { padding: 10 },
});
