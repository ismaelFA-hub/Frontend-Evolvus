import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

type TabKey = 'all' | 'open' | 'closed';

interface Trade {
  id: string;
  pair: string;
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  date: string;
  pnl: number;
  status: 'open' | 'closed';
}

export default function TradeHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    async function fetchTrades() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<any[]>("GET", "/api/trades");
        const mapped: Trade[] = (data || []).map((t: any) => ({
          id: String(t.id),
          pair: t.symbol || t.pair || '',
          side: (String(t.side || 'BUY').toUpperCase()) as 'BUY' | 'SELL',
          price: Number(t.price) || 0,
          amount: Number(t.quantity ?? t.amount) || 0,
          date: t.closedAt
            ? new Date(t.closedAt).toLocaleString()
            : t.openedAt ? new Date(t.openedAt).toLocaleString() : 'N/A',
          pnl: Number(t.pnl) || 0,
          status: t.status === 'open' ? 'open' : 'closed',
        }));
        setTrades(mapped);
      } catch (e: any) {
        setError(e.message || 'Failed to load trades');
      } finally {
        setLoading(false);
      }
    }
    fetchTrades();
  }, []);

  const filtered = trades.filter(trade => {
    if (activeTab === 'open') return trade.status === 'open';
    if (activeTab === 'closed') return trade.status === 'closed';
    return true;
  });

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length > 0 ? ((winCount / trades.length) * 100).toFixed(1) : '0.0';

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: t('allTrades') },
    { key: 'open', label: t('openOrders') },
    { key: 'closed', label: t('closedTrades') },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('tradeHistory')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{trades.length}</Text>
              <Text style={styles.summaryLabel}>{t('total')} {t('trades')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: totalPnl >= 0 ? C.success : C.danger }]}>
                {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>{t('totalPnl')}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{winRate}%</Text>
              <Text style={styles.summaryLabel}>{t('traderWinRate')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
              onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.tabText, activeTab === tab.key && { color: planTheme.primary }]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={planTheme.primary} />
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={40} color={C.danger} />
            <Text style={[styles.emptyText, { color: C.danger }]}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>{t('noTradesYet')}</Text>
          </View>
        ) : (
          filtered.map((trade) => {
            const isBuy = trade.side === 'BUY';
            const isPnlPositive = trade.pnl >= 0;
            return (
              <View key={trade.id} style={styles.tradeCard}>
                <View style={styles.tradeTop}>
                  <View style={styles.tradeLeft}>
                    <Text style={styles.tradePair}>{trade.pair}</Text>
                    <View style={[styles.sideBadge, { backgroundColor: isBuy ? C.successDim : C.dangerDim }]}>
                      <Text style={[styles.sideText, { color: isBuy ? C.success : C.danger }]}>{trade.side}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: trade.status === 'open' ? C.success : C.textTertiary }]} />
                </View>
                <View style={styles.tradeDetails}>
                  <View style={styles.tradeDetailItem}>
                    <Text style={styles.tradeDetailLabel}>{t('price')}</Text>
                    <Text style={styles.tradeDetailValue}>${trade.price.toLocaleString()}</Text>
                  </View>
                  <View style={styles.tradeDetailItem}>
                    <Text style={styles.tradeDetailLabel}>{t('amount')}</Text>
                    <Text style={styles.tradeDetailValue}>{trade.amount}</Text>
                  </View>
                  <View style={styles.tradeDetailItem}>
                    <Text style={styles.tradeDetailLabel}>P&L</Text>
                    <Text style={[styles.tradeDetailValue, { color: isPnlPositive ? C.success : C.danger }]}>
                      {isPnlPositive ? '+' : ''}${Math.abs(trade.pnl).toFixed(2)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.tradeDate}>{trade.date}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  summaryCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: C.border },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 4 },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  tabBar: { flexDirection: "row", gap: 8, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
  tradeCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  tradeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  tradeLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  tradePair: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  sideBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sideText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tradeDetails: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  tradeDetailItem: { alignItems: "center" },
  tradeDetailLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  tradeDetailValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  tradeDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
});
