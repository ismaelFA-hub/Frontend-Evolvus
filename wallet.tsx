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

const TOKEN_META: Record<string, { name: string; color: string; icon: string }> = {
  BTC:  { name: 'Bitcoin',   color: '#F7931A', icon: 'logo-bitcoin' },
  ETH:  { name: 'Ethereum',  color: '#627EEA', icon: 'diamond-outline' },
  SOL:  { name: 'Solana',    color: '#9945FF', icon: 'sunny-outline' },
  USDT: { name: 'Tether',    color: '#26A17B', icon: 'cash-outline' },
  USDC: { name: 'USD Coin',  color: '#2775CA', icon: 'cash-outline' },
  BNB:  { name: 'BNB',       color: '#F3BA2F', icon: 'cube-outline' },
  ADA:  { name: 'Cardano',   color: '#0033AD', icon: 'layers-outline' },
  DOT:  { name: 'Polkadot',  color: '#E6007A', icon: 'ellipse-outline' },
  LINK: { name: 'Chainlink', color: '#2A5ADA', icon: 'link-outline' },
};

interface TokenBalance {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
  color: string;
  icon: string;
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    async function fetchBalances() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<Record<string, { free: number; used: number; total: number }>>("GET", "/api/orders/balances");
        const mapped: TokenBalance[] = Object.entries(data || {})
          .filter(([, v]) => v.total > 0)
          .map(([symbol, v]) => {
            const meta = TOKEN_META[symbol.toUpperCase()] ?? { name: symbol, color: '#6B7280', icon: 'help-circle-outline' };
            const isStable = ['USDT', 'USDC', 'BUSD', 'DAI'].includes(symbol.toUpperCase());
            return {
              symbol: symbol.toUpperCase(),
              name: meta.name,
              amount: v.free,
              usdValue: isStable ? v.total : 0,
              color: meta.color,
              icon: meta.icon,
            };
          });
        setBalances(mapped);
      } catch (e: any) {
        setError(e.message || 'Failed to load balances');
      } finally {
        setLoading(false);
      }
    }
    fetchBalances();
  }, []);

  const totalBalance = balances.reduce((sum, t) => sum + t.usdValue, 0);
  const available = totalBalance * 0.72;
  const inOrders = totalBalance * 0.28;

  const actions = [
    { label: t('deposit'), icon: 'arrow-down-outline' as const, color: C.success },
    { label: t('withdraw'), icon: 'arrow-up-outline' as const, color: C.warning },
    { label: t('transfer'), icon: 'swap-horizontal-outline' as const, color: C.accent },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('wallet')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('totalBalance')}</Text>
          <Text style={styles.balanceValue}>${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <View style={styles.balanceBreakdown}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: C.success }]} />
              <Text style={styles.breakdownLabel}>{t('availableBalance')}</Text>
              <Text style={styles.breakdownValue}>${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: C.warning }]} />
              <Text style={styles.breakdownLabel}>{t('inOrders')}</Text>
              <Text style={styles.breakdownValue}>${inOrders.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={styles.actionBtn}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('assets')}</Text>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={planTheme.primary} />
          </View>
        ) : error ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
            <Ionicons name="alert-circle-outline" size={36} color={C.danger} />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: C.danger }}>{error}</Text>
          </View>
        ) : (
          balances.map((token) => (
            <Pressable key={token.symbol} style={styles.tokenRow} onPress={() => Haptics.selectionAsync()}>
              <View style={[styles.tokenIcon, { backgroundColor: `${token.color}20` }]}>
                <Ionicons name={token.icon as any} size={20} color={token.color} />
              </View>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                <Text style={styles.tokenName}>{token.name}</Text>
              </View>
              <View style={styles.tokenValues}>
                <Text style={styles.tokenAmount}>{token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</Text>
                {token.usdValue > 0 && (
                  <Text style={styles.tokenUsd}>${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                )}
              </View>
            </Pressable>
          ))
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
  balanceCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  balanceLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, marginBottom: 6 },
  balanceValue: { fontFamily: "Inter_700Bold", fontSize: 34, color: C.text, marginBottom: 18 },
  balanceBreakdown: { gap: 10 },
  breakdownItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1 },
  breakdownValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, gap: 10 },
  actionBtn: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  actionLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text, marginBottom: 14 },
  tokenRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  tokenIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tokenInfo: { flex: 1, marginLeft: 12 },
  tokenSymbol: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  tokenName: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  tokenValues: { alignItems: "flex-end" },
  tokenAmount: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  tokenUsd: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
});
