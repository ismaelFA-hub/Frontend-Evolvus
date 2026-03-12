import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TradingDashboard from "@/components/trading/TradingDashboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useLitePro } from "@/lib/lite-pro-context";
import { getMarketData, getOrderBook, formatCurrency, CryptoAsset } from "@/lib/market-data";
import TradeCard, { TradeCardData } from "@/components/TradeCard";
import { computeTpSlPrice, TpSlMethod } from "@shared/tpslUtils";
import TooltipBadge from "@/components/TooltipBadge";
import { useAuth } from "@/lib/auth-context";
import LockedFeature from "@/components/LockedFeature";

const C = Colors.dark;
type OrderType = "market" | "limit" | "stop";
type Side = "buy" | "sell";

function PairSelector({ assets, selected, onSelect, primary, primaryDim }: { assets: CryptoAsset[]; selected: string; onSelect: (s: string) => void; primary: string; primaryDim: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pairSelector}>
      {assets.slice(0, 8).map((a) => (
        <Pressable
          key={a.symbol}
          style={[styles.pairChip, selected === a.symbol && { backgroundColor: primaryDim, borderColor: primary }]}
          onPress={() => { onSelect(a.symbol); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.pairChipText, selected === a.symbol && { color: primary }]}>
            {a.symbol}/USDT
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function OrderBookView() {
  const book = getOrderBook();
  const { t } = useI18n();
  const maxBidTotal = Math.max(...book.bids.map(b => b.amount));
  const maxAskTotal = Math.max(...book.asks.map(a => a.amount));

  return (
    <View style={styles.orderBook}>
      <Text style={styles.obTitle}>{t('orderBook')}</Text>
      <View style={styles.obHeader}>
        <Text style={styles.obHeaderText}>{t('priceUsdt')}</Text>
        <Text style={styles.obHeaderText}>{t('amount')}</Text>
      </View>
      {book.asks.slice(0, 6).map((entry, i) => (
        <View key={`ask-${i}`} style={styles.obRow}>
          <View style={[styles.obDepthBar, styles.obAskBar, { width: `${(entry.amount / maxAskTotal) * 100}%` }]} />
          <Text style={[styles.obPrice, { color: C.danger }]}>{entry.price.toFixed(2)}</Text>
          <Text style={styles.obAmount}>{entry.amount.toFixed(4)}</Text>
        </View>
      ))}
      <View style={styles.obSpread}>
        <Text style={styles.obSpreadText}>{formatCurrency(book.bids[0]?.price || 0)}</Text>
        <Ionicons name="swap-vertical" size={14} color={C.textTertiary} />
      </View>
      {book.bids.slice(0, 6).map((entry, i) => (
        <View key={`bid-${i}`} style={styles.obRow}>
          <View style={[styles.obDepthBar, styles.obBidBar, { width: `${(entry.amount / maxBidTotal) * 100}%` }]} />
          <Text style={[styles.obPrice, { color: C.success }]}>{entry.price.toFixed(2)}</Text>
          <Text style={styles.obAmount}>{entry.amount.toFixed(4)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TradingScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const { isLite, toggle: toggleMode, mode } = useLitePro();
  const { user } = useAuth();
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [selectedPair, setSelectedPair] = useState("BTC");
  const [side, setSide] = useState<Side>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [sliderValue, setSliderValue] = useState(0);
  const [activeView, setActiveView] = useState<"order" | "live">("live");

  // TP/SL state
  const [tpslEnabled, setTpslEnabled] = useState(false);
  const [tpslMethod, setTpslMethod] = useState<TpSlMethod>("price");
  const [tpValue, setTpValue] = useState("");
  const [slValue, setSlValue] = useState("");

  // Trade card state
  const [tradeCardData, setTradeCardData] = useState<TradeCardData | null>(null);
  const [tradeCardVisible, setTradeCardVisible] = useState(false);

  // Meta do Dia state
  const [goalPct, setGoalPct] = useState(2);
  const [todayPnlPct, setTodayPnlPct] = useState(1.3);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    AsyncStorage.getItem("@evolvus_daily_goal_pct").then((val) => {
      if (val) setGoalPct(parseFloat(val));
    });
    AsyncStorage.getItem("@evolvus_today_pnl_pct").then((val) => {
      if (val) setTodayPnlPct(parseFloat(val));
    });
  }, []);

  useEffect(() => {
    const data = getMarketData();
    setAssets(data);
    const selected = data.find(a => a.symbol === selectedPair);
    if (selected && !price) setPrice(selected.price.toFixed(2));
  }, [selectedPair]);

  const selectedAsset = assets.find(a => a.symbol === selectedPair);
  const isUp = (selectedAsset?.changePercent24h || 0) >= 0;
  const total = (parseFloat(price) || 0) * (parseFloat(amount) || 0);
  const percentages = [25, 50, 75, 100];

  const orderTypes: { key: OrderType; label: string }[] = [
    { key: "limit", label: t('limit') },
    { key: "market", label: t('market') },
    { key: "stop", label: t('stop') },
  ];

  function handlePlaceOrder() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const tp = tpslEnabled ? computeTpSlPrice(tpValue, true, tpslMethod, price, amount, side) : undefined;
    const sl = tpslEnabled ? computeTpSlPrice(slValue, false, tpslMethod, price, amount, side) : undefined;
    const p = parseFloat(price) || 0;
    const qty = parseFloat(amount) || 0;
    const card: TradeCardData = {
      pair: `${selectedPair}/USDT`,
      side,
      price: p,
      amount: qty,
      total,
      takeProfit: tp,
      stopLoss: sl,
      timestamp: Date.now(),
      estimatedRoi: tp && p ? ((tp - p) / p) * 100 * (side === 'buy' ? 1 : -1) : undefined,
    };
    setTradeCardData(card);
    setTradeCardVisible(true);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('trade')}</Text>
        <View style={styles.headerRight}>
          {selectedAsset && activeView === "order" && (
            <View style={styles.priceDisplay}>
              <Text style={styles.currentPrice}>{formatCurrency(selectedAsset.price)}</Text>
              <View style={[styles.changeMini, { backgroundColor: isUp ? C.successDim : C.dangerDim }]}>
                <Ionicons name={isUp ? "caret-up" : "caret-down"} size={10} color={isUp ? C.success : C.danger} />
                <Text style={[styles.changeMiniText, { color: isUp ? C.success : C.danger }]}>
                  {Math.abs(selectedAsset.changePercent24h).toFixed(2)}%
                </Text>
              </View>
            </View>
          )}
          {/* Lite/Pro toggle */}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); toggleMode(); }}
            style={[styles.modeToggle, { borderColor: planTheme.primary + '60', backgroundColor: planTheme.primaryDim }]}
          >
            <Text style={[styles.modeToggleText, { color: planTheme.primary }]}>
              {isLite ? t('liteMode') : t('proMode')}
            </Text>
            <Ionicons name={isLite ? "leaf-outline" : "rocket-outline"} size={14} color={planTheme.primary} />
          </Pressable>
          {!isLite && (
            <LockedFeature userPlan={(user?.plan ?? "free") as any} requiredPlan="pro">
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/paper-trading'); }} style={[styles.advBtn, { borderColor: `${planTheme.primary}40` }]}>
                <Ionicons name="flask-outline" size={18} color={planTheme.primary} />
              </Pressable>
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/advanced-orders'); }} style={[styles.advBtn, { borderColor: `${planTheme.primary}40` }]}>
                <Ionicons name="options-outline" size={18} color={planTheme.primary} />
              </Pressable>
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/risk-manager'); }} style={[styles.advBtn, { borderColor: `${planTheme.primary}40` }]}>
                <Ionicons name="shield-outline" size={18} color={planTheme.primary} />
              </Pressable>
            </LockedFeature>
          )}
        </View>
      </View>

      {/* Meta do Dia */}
      {(() => {
        const goalReached = todayPnlPct >= goalPct;
        const progress = Math.min(todayPnlPct / goalPct, 1);
        const statusColor = goalReached ? C.success : todayPnlPct >= goalPct * 0.5 ? '#F59E0B' : planTheme.primary;
        return (
          <View style={[styles.goalCard, { borderColor: `${statusColor}30` }]}>
            <View style={styles.goalCardTop}>
              <View style={styles.goalCardLeft}>
                <View style={styles.goalLabelRow}>
                  <Ionicons name="trophy-outline" size={14} color={statusColor} />
                  <Text style={[styles.goalLabel, { color: statusColor }]}>Meta do Dia</Text>
                  {goalReached && <View style={[styles.goalBadge, { backgroundColor: C.successDim }]}><Text style={[styles.goalBadgeText, { color: C.success }]}>✓ Atingida!</Text></View>}
                </View>
                <Text style={styles.goalTarget}>Objetivo: <Text style={[styles.goalTargetBold, { color: statusColor }]}>{goalPct.toFixed(1)}%</Text></Text>
              </View>
              <View style={styles.goalRight}>
                <Text style={[styles.goalCurrentPct, { color: goalReached ? C.success : C.text }]}>{todayPnlPct >= 0 ? "+" : ""}{todayPnlPct.toFixed(2)}%</Text>
                <Text style={styles.goalCurrentLabel}>hoje</Text>
              </View>
            </View>
            <View style={styles.goalBarBg}>
              <View style={[styles.goalBarFill, { width: `${progress * 100}%`, backgroundColor: statusColor }]} />
            </View>
            <View style={styles.goalCardBottom}>
              <Text style={styles.goalProgressText}>{(progress * 100).toFixed(0)}% do objetivo</Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/daily-goal"); }}
                style={[styles.goalEditBtn, { borderColor: `${planTheme.primary}40` }]}
              >
                <Ionicons name="create-outline" size={13} color={planTheme.primary} />
                <Text style={[styles.goalEditText, { color: planTheme.primary }]}>Editar Meta</Text>
              </Pressable>
            </View>
          </View>
        );
      })()}

      <View style={styles.viewToggle}>
        <Pressable
          style={[styles.viewToggleBtn, activeView === "live" && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
          onPress={() => { setActiveView("live"); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.viewToggleText, activeView === "live" && { color: planTheme.primary }]}>📊 Dados ao Vivo</Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleBtn, activeView === "order" && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
          onPress={() => { setActiveView("order"); Haptics.selectionAsync(); }}
        >
          <Text style={[styles.viewToggleText, activeView === "order" && { color: planTheme.primary }]}>📋 Ordens</Text>
        </Pressable>
      </View>

      {activeView === "live" ? (
        <TradingDashboard />
      ) : (
        <>
        <TooltipBadge screenKey="trading" message={t('tooltipTrading')} />
      <PairSelector assets={assets} selected={selectedPair} onSelect={(s) => { setSelectedPair(s); setPrice(""); }} primary={planTheme.primary} primaryDim={planTheme.primaryDim} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sideToggle}>
          <Pressable
            style={[styles.sideButton, side === "buy" && { backgroundColor: C.success }]}
            onPress={() => { setSide("buy"); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.sideText, side === "buy" && { color: "#000" }]}>{t('buy')}</Text>
          </Pressable>
          <Pressable
            style={[styles.sideButton, side === "sell" && { backgroundColor: C.danger }]}
            onPress={() => { setSide("sell"); Haptics.selectionAsync(); }}
          >
            <Text style={[styles.sideText, side === "sell" && { color: "#fff" }]}>{t('sell')}</Text>
          </Pressable>
        </View>

        <View style={styles.orderTypeRow}>
          {(isLite ? orderTypes.slice(0, 2) : orderTypes).map((ot) => (
            <Pressable
              key={ot.key}
              style={[styles.orderTypeChip, orderType === ot.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
              onPress={() => { setOrderType(ot.key); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.orderTypeText, orderType === ot.key && { color: planTheme.primary }]}>{ot.label}</Text>
            </Pressable>
          ))}
        </View>

        {orderType !== "market" && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{orderType === "stop" ? t('stopPrice') : t('price')} (USDT)</Text>
            <View style={styles.inputRow}>
              <Pressable style={styles.inputBtn} onPress={() => setPrice(p => (parseFloat(p) - 10).toFixed(2))}>
                <Ionicons name="remove" size={18} color={C.text} />
              </Pressable>
              <TextInput
                style={styles.numInput}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholderTextColor={C.textTertiary}
              />
              <Pressable style={styles.inputBtn} onPress={() => setPrice(p => (parseFloat(p) + 10).toFixed(2))}>
                <Ionicons name="add" size={18} color={C.text} />
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('amount')} ({selectedPair})</Text>
          <View style={styles.inputRow}>
            <Pressable style={styles.inputBtn} onPress={() => setAmount(a => Math.max(0, parseFloat(a || "0") - 0.01).toFixed(4))}>
              <Ionicons name="remove" size={18} color={C.text} />
            </Pressable>
            <TextInput
              style={styles.numInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.0000"
              placeholderTextColor={C.textTertiary}
            />
            <Pressable style={styles.inputBtn} onPress={() => setAmount(a => (parseFloat(a || "0") + 0.01).toFixed(4))}>
              <Ionicons name="add" size={18} color={C.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.percentRow}>
          {percentages.map((pct) => (
            <Pressable
              key={pct}
              style={[styles.pctChip, sliderValue === pct && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
              onPress={() => { setSliderValue(pct); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.pctText, sliderValue === pct && { color: planTheme.primary }]}>{pct}%</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('total')}</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)} USDT</Text>
        </View>

        {/* TP/SL Panel */}
        <View style={[styles.tpslContainer, { borderColor: tpslEnabled ? planTheme.primary + '60' : C.border }]}>
          <Pressable
            style={styles.tpslHeader}
            onPress={() => { setTpslEnabled(e => !e); Haptics.selectionAsync(); }}
          >
            <Ionicons name={tpslEnabled ? "checkmark-circle" : "ellipse-outline"} size={18} color={tpslEnabled ? planTheme.primary : C.textTertiary} />
            <Text style={[styles.tpslTitle, { color: tpslEnabled ? planTheme.primary : C.textSecondary }]}>{t('tpslLabel')}</Text>
            <Ionicons name={tpslEnabled ? "chevron-up" : "chevron-down"} size={16} color={C.textTertiary} />
          </Pressable>
          {tpslEnabled && (
            <>
              {/* Method selector */}
              <View style={styles.tpslMethodRow}>
                {([["price", t('tpslByPrice')], ["roi", t('tpslByRoi')], ["earning", t('tpslByEarning')]] as [string, string][]).map(([k, label]) => (
                  <Pressable
                    key={k}
                    style={[styles.tpslMethodChip, tpslMethod === k && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
                    onPress={() => { setTpslMethod(k as any); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.tpslMethodText, tpslMethod === k && { color: planTheme.primary }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {/* TP input */}
              <View style={styles.tpslInputRow}>
                <View style={[styles.tpslInputBadge, { backgroundColor: C.success + '18' }]}>
                  <Ionicons name="trending-up" size={13} color={C.success} />
                  <Text style={[styles.tpslInputLabel, { color: C.success }]}>{t('takeProfit')}</Text>
                </View>
                <TextInput
                  style={styles.tpslInput}
                  value={tpValue}
                  onChangeText={setTpValue}
                  keyboardType="numeric"
                  placeholder={tpslMethod === "price" ? "0.00" : tpslMethod === "roi" ? "5%" : "$100"}
                  placeholderTextColor={C.textTertiary}
                />
              </View>
              {/* SL input */}
              <View style={styles.tpslInputRow}>
                <View style={[styles.tpslInputBadge, { backgroundColor: C.danger + '18' }]}>
                  <Ionicons name="trending-down" size={13} color={C.danger} />
                  <Text style={[styles.tpslInputLabel, { color: C.danger }]}>{t('stopLoss')}</Text>
                </View>
                <TextInput
                  style={styles.tpslInput}
                  value={slValue}
                  onChangeText={setSlValue}
                  keyboardType="numeric"
                  placeholder={tpslMethod === "price" ? "0.00" : tpslMethod === "roi" ? "2%" : "$50"}
                  placeholderTextColor={C.textTertiary}
                />
              </View>
            </>
          )}
        </View>

        <Pressable
          style={[styles.placeOrderButton, { backgroundColor: side === "buy" ? C.success : C.danger }]}
          onPress={handlePlaceOrder}
        >
          <Text style={styles.placeOrderText}>
            {side === "buy" ? t('buy') : t('sell')} {selectedPair}
          </Text>
        </Pressable>

        {!isLite && <OrderBookView />}
        <View style={{ height: 100 }} />
      </ScrollView>
        </>
      )}

      {/* Trade Card modal */}
      {tradeCardData && (
        <TradeCard
          visible={tradeCardVisible}
          data={tradeCardData}
          onClose={() => setTradeCardVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  advBtn: { padding: 7, borderRadius: 10, borderWidth: 1 },
  modeToggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  modeToggleText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text },
  priceDisplay: { alignItems: "flex-end" },
  currentPrice: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  changeMini: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  changeMiniText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  goalCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  goalCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  goalCardLeft: { gap: 3 },
  goalLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  goalBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  goalBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  goalTarget: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  goalTargetBold: { fontFamily: "Inter_700Bold", fontSize: 13 },
  goalRight: { alignItems: "flex-end" },
  goalCurrentPct: { fontFamily: "Inter_700Bold", fontSize: 22 },
  goalCurrentLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  goalBarBg: { height: 6, backgroundColor: C.surface, borderRadius: 4, overflow: "hidden" },
  goalBarFill: { height: 6, borderRadius: 4 },
  goalCardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goalProgressText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  goalEditBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  goalEditText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  viewToggle: { flexDirection: "row", marginHorizontal: 20, marginBottom: 8, gap: 8 },
  viewToggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.surface, alignItems: "center", borderWidth: 1, borderColor: C.border },
  viewToggleText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  pairSelector: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 },
  pairChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  pairChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  scrollContent: { paddingHorizontal: 20, gap: 14, paddingTop: 8 },
  sideToggle: { flexDirection: "row", backgroundColor: C.surface, borderRadius: 14, padding: 3, gap: 3 },
  sideButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  sideText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.textSecondary },
  orderTypeRow: { flexDirection: "row", gap: 8 },
  orderTypeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: C.surface, alignItems: "center", borderWidth: 1, borderColor: C.border },
  orderTypeText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  inputBtn: { width: 44, height: 48, alignItems: "center", justifyContent: "center" },
  numInput: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text, textAlign: "center", paddingVertical: 12 },
  percentRow: { flexDirection: "row", gap: 8 },
  pctChip: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", borderWidth: 1, borderColor: C.border },
  pctText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  totalLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  totalValue: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  placeOrderButton: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  placeOrderText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#000" },
  orderBook: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: C.border },
  obTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, marginBottom: 4 },
  obHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  obHeaderText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  obRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3, position: "relative" },
  obDepthBar: { position: "absolute", top: 0, bottom: 0, right: 0, borderRadius: 2 },
  obAskBar: { backgroundColor: "rgba(255, 82, 82, 0.08)" },
  obBidBar: { backgroundColor: "rgba(0, 230, 118, 0.08)" },
  obPrice: { fontFamily: "Inter_500Medium", fontSize: 13, zIndex: 1 },
  obAmount: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, zIndex: 1 },
  obSpread: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  obSpreadText: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  // TP/SL styles
  tpslContainer: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  tpslHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  tpslTitle: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  tpslMethodRow: { flexDirection: "row", gap: 6 },
  tpslMethodChip: { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: C.surface, alignItems: "center", borderWidth: 1, borderColor: C.border },
  tpslMethodText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  tpslInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tpslInputBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, minWidth: 110 },
  tpslInputLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  tpslInput: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10 },
});
