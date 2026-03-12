import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

type P2PTab = 'buy' | 'sell';
type PaymentFilter = 'all' | 'pix' | 'card' | 'crypto';

const PAYMENT_ICONS: Record<string, { name: string; color: string }> = {
  Pix: { name: 'flash-outline', color: '#32BCAD' },
  Card: { name: 'card-outline', color: '#627EEA' },
  Transfer: { name: 'swap-horizontal-outline', color: '#F3BA2F' },
  Crypto: { name: 'logo-bitcoin', color: '#F7931A' },
};

const BUY_OFFERS = [
  {
    id: 'b1',
    seller: 'CryptoMaster_BR',
    verified: true,
    asset: 'USDT',
    price: 5.18,
    currency: 'BRL',
    minLimit: 100,
    maxLimit: 50000,
    available: 42850.00,
    methods: ['Pix', 'Transfer'],
    completionRate: 99.2,
    orders: 1847,
    online: true,
  },
  {
    id: 'b2',
    seller: 'TraderPro22',
    verified: true,
    asset: 'BTC',
    price: 545780.50,
    currency: 'BRL',
    minLimit: 500,
    maxLimit: 100000,
    available: 0.85,
    methods: ['Pix', 'Card'],
    completionRate: 98.7,
    orders: 3215,
    online: true,
  },
  {
    id: 'b3',
    seller: 'SafeTrade_SP',
    verified: true,
    asset: 'USDT',
    price: 5.21,
    currency: 'BRL',
    minLimit: 50,
    maxLimit: 25000,
    available: 18500.00,
    methods: ['Pix'],
    completionRate: 97.5,
    orders: 892,
    online: false,
  },
  {
    id: 'b4',
    seller: 'BlockDeal',
    verified: false,
    asset: 'BTC',
    price: 544200.00,
    currency: 'BRL',
    minLimit: 1000,
    maxLimit: 200000,
    available: 1.2,
    methods: ['Pix', 'Card', 'Transfer'],
    completionRate: 96.8,
    orders: 564,
    online: true,
  },
  {
    id: 'b5',
    seller: 'CoinBR_Official',
    verified: true,
    asset: 'USDT',
    price: 5.19,
    currency: 'BRL',
    minLimit: 200,
    maxLimit: 80000,
    available: 95000.00,
    methods: ['Pix', 'Crypto'],
    completionRate: 99.8,
    orders: 5420,
    online: true,
  },
];

const SELL_OFFERS = [
  {
    id: 's1',
    seller: 'QuickBuy_RJ',
    verified: true,
    asset: 'USDT',
    price: 5.12,
    currency: 'BRL',
    minLimit: 100,
    maxLimit: 30000,
    available: 28000.00,
    methods: ['Pix'],
    completionRate: 98.9,
    orders: 2130,
    online: true,
  },
  {
    id: 's2',
    seller: 'BTCWhale',
    verified: true,
    asset: 'BTC',
    price: 547100.00,
    currency: 'BRL',
    minLimit: 2000,
    maxLimit: 500000,
    available: 3.5,
    methods: ['Pix', 'Transfer'],
    completionRate: 99.5,
    orders: 4780,
    online: true,
  },
  {
    id: 's3',
    seller: 'FastCrypto_MG',
    verified: false,
    asset: 'USDT',
    price: 5.14,
    currency: 'BRL',
    minLimit: 50,
    maxLimit: 15000,
    available: 12400.00,
    methods: ['Pix', 'Card'],
    completionRate: 95.2,
    orders: 341,
    online: false,
  },
  {
    id: 's4',
    seller: 'DigitalAssets',
    verified: true,
    asset: 'BTC',
    price: 546500.00,
    currency: 'BRL',
    minLimit: 500,
    maxLimit: 150000,
    available: 2.1,
    methods: ['Pix', 'Transfer', 'Crypto'],
    completionRate: 99.1,
    orders: 3890,
    online: true,
  },
  {
    id: 's5',
    seller: 'P2P_Express',
    verified: true,
    asset: 'USDT',
    price: 5.15,
    currency: 'BRL',
    minLimit: 100,
    maxLimit: 60000,
    available: 55000.00,
    methods: ['Pix'],
    completionRate: 98.3,
    orders: 1650,
    online: true,
  },
];

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function P2PScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<P2PTab>('buy');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const tabs: { key: P2PTab; label: string }[] = [
    { key: 'buy', label: 'Buy' },
    { key: 'sell', label: 'Sell' },
  ];

  const paymentFilters: { key: PaymentFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pix', label: 'Pix' },
    { key: 'card', label: 'Card' },
    { key: 'crypto', label: 'Crypto' },
  ];

  const offers = activeTab === 'buy' ? BUY_OFFERS : SELL_OFFERS;
  const filteredOffers = offers.filter(o => {
    if (paymentFilter === 'all') return true;
    const methodMap: Record<string, string> = { pix: 'Pix', card: 'Card', crypto: 'Crypto' };
    return o.methods.includes(methodMap[paymentFilter]);
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('p2pTrading')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && {
                backgroundColor: tab.key === 'buy' ? C.successDim : C.dangerDim,
                borderColor: tab.key === 'buy' ? C.success : C.danger,
              },
            ]}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab.key && { color: tab.key === 'buy' ? C.success : C.danger },
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterLabelRow}>
          <Ionicons name="flag-outline" size={14} color={C.textTertiary} />
          <Text style={styles.filterLabel}>BRL</Text>
          <View style={styles.filterDivider} />
          <Ionicons name="wallet-outline" size={14} color={C.textTertiary} />
          <Text style={styles.filterLabel}>Payment</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paymentFilterRow}>
          {paymentFilters.map((pf) => (
            <Pressable
              key={pf.key}
              style={[styles.paymentChip, paymentFilter === pf.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
              onPress={() => { setPaymentFilter(pf.key); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.paymentChipText, paymentFilter === pf.key && { color: planTheme.primary }]}>{pf.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {filteredOffers.map((offer) => (
          <View key={offer.id} style={styles.offerCard}>
            <View style={styles.offerHeader}>
              <View style={styles.sellerInfo}>
                <View style={[styles.avatarCircle, { backgroundColor: `${planTheme.primary}20` }]}>
                  <Text style={[styles.avatarText, { color: planTheme.primary }]}>{offer.seller[0]}</Text>
                </View>
                <View>
                  <View style={styles.sellerNameRow}>
                    <Text style={styles.sellerName}>{offer.seller}</Text>
                    {offer.verified && (
                      <Ionicons name="checkmark-circle" size={14} color={planTheme.primary} />
                    )}
                    {offer.online && <View style={styles.onlineDot} />}
                  </View>
                  <Text style={styles.sellerStats}>{offer.orders} orders | {offer.completionRate}% completion</Text>
                </View>
              </View>
              <View style={[styles.assetBadge, { backgroundColor: offer.asset === 'BTC' ? '#F7931A20' : '#26A17B20' }]}>
                <Text style={[styles.assetBadgeText, { color: offer.asset === 'BTC' ? '#F7931A' : '#26A17B' }]}>{offer.asset}</Text>
              </View>
            </View>

            <View style={styles.offerBody}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.priceValue}>R$ {formatBRL(offer.price)}</Text>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Available</Text>
                  <Text style={styles.detailValue}>
                    {offer.asset === 'BTC' ? `${offer.available} BTC` : `${formatBRL(offer.available)} USDT`}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Limits</Text>
                  <Text style={styles.detailValue}>R$ {formatBRL(offer.minLimit)} - R$ {formatBRL(offer.maxLimit)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.offerFooter}>
              <View style={styles.methodsRow}>
                {offer.methods.map((method) => {
                  const icon = PAYMENT_ICONS[method];
                  return (
                    <View key={method} style={[styles.methodBadge, { backgroundColor: `${icon.color}15` }]}>
                      <Ionicons name={icon.name as any} size={12} color={icon.color} />
                      <Text style={[styles.methodText, { color: icon.color }]}>{method}</Text>
                    </View>
                  );
                })}
              </View>
              <Pressable
                style={[
                  styles.actionBtn,
                  { backgroundColor: activeTab === 'buy' ? C.success : C.danger },
                ]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
              >
                <Text style={styles.actionBtnText}>{activeTab === 'buy' ? 'Buy' : 'Sell'}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {filteredOffers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color={C.textTertiary} />
            <Text style={styles.emptyText}>No offers available for this filter</Text>
          </View>
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
  tabBar: { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  filterSection: { paddingHorizontal: 20, paddingBottom: 10 },
  filterLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  filterLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textTertiary },
  filterDivider: { width: 1, height: 14, backgroundColor: C.border, marginHorizontal: 6 },
  paymentFilterRow: { gap: 8 },
  paymentChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  paymentChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  offerCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  offerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sellerInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sellerNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  sellerName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  sellerStats: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  assetBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  assetBadgeText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  offerBody: { marginBottom: 14 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  priceLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  priceValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  detailsRow: { flexDirection: "row", gap: 20 },
  detailItem: {},
  detailLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  detailValue: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  offerFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  methodsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", flex: 1 },
  methodBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  methodText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  actionBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  actionBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: '#FFFFFF' },
  emptyState: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textTertiary },
});
