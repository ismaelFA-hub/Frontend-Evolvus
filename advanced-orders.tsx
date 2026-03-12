import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
  TextInput, Modal, Alert, ActivityIndicator,
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

type OrderType = "oco" | "trailing" | "iceberg" | "twap" | "scaled";
type PlanType = "free" | "pro" | "premium" | "enterprise";

const EXCHANGES = ["Binance", "Bybit", "OKX", "Coinbase Pro", "Kraken", "KuCoin", "Gate.io", "MEXC"];
const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "DOGE/USDT", "ADA/USDT"];

const ORDER_TYPES: { key: OrderType; label: string; icon: string; minPlan: PlanType }[] = [
  { key: "oco",      label: "OCO",      icon: "git-branch-outline",    minPlan: "pro" },
  { key: "trailing", label: "Trailing", icon: "trending-down-outline",  minPlan: "pro" },
  { key: "iceberg",  label: "Iceberg",  icon: "layers-outline",         minPlan: "premium" },
  { key: "twap",     label: "TWAP",     icon: "time-outline",           minPlan: "premium" },
  { key: "scaled",   label: "Scaled",   icon: "bar-chart-outline",      minPlan: "premium" },
];

const PLAN_ORDER: PlanType[] = ["free", "pro", "premium", "enterprise"];
function planGte(user: PlanType, required: PlanType) {
  return PLAN_ORDER.indexOf(user) >= PLAN_ORDER.indexOf(required);
}

// ─── Visual diagrams ─────────────────────────────────────────────────────────
function OCODiagram() {
  return (
    <View style={s.diagramBox}>
      <View style={s.diagramRow}>
        <View style={[s.diagramNode, { backgroundColor: C.successDim, borderColor: C.success }]}>
          <Text style={[s.diagramNodeText, { color: C.success }]}>Take Profit</Text>
        </View>
      </View>
      <View style={[s.diagramLine, { borderColor: C.textTertiary }]} />
      <View style={s.diagramRow}>
        <View style={[s.diagramNode, { backgroundColor: C.primaryDim, borderColor: C.primary }]}>
          <Text style={[s.diagramNodeText, { color: C.primary }]}>Entry Price</Text>
        </View>
      </View>
      <View style={[s.diagramLine, { borderColor: C.textTertiary }]} />
      <View style={s.diagramRow}>
        <View style={[s.diagramNode, { backgroundColor: C.dangerDim, borderColor: C.danger }]}>
          <Text style={[s.diagramNodeText, { color: C.danger }]}>Stop Loss</Text>
        </View>
      </View>
      <Text style={s.diagramCaption}>When one order fills, the other is automatically cancelled.</Text>
    </View>
  );
}

function TrailingDiagram() {
  const pts = [30, 50, 65, 55, 70, 85, 75, 90];
  const trail = pts.map(p => p - 18);
  return (
    <View style={s.diagramBox}>
      <Text style={s.diagramLabel}>Price vs Trailing Stop</Text>
      <View style={{ height: 60, flexDirection: "row", alignItems: "flex-end", gap: 4, marginBottom: 4 }}>
        {pts.map((h, i) => (
          <View key={i} style={{ alignItems: "center", flex: 1 }}>
            <View style={{ height: h * 0.5, width: 8, backgroundColor: C.primary, borderRadius: 2 }} />
            <View style={{ height: trail[i] * 0.5, width: 8, backgroundColor: C.danger, borderRadius: 2, marginTop: 2 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 10, height: 4, backgroundColor: C.primary, borderRadius: 2 }} />
          <Text style={s.diagramCaption}>Price</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 10, height: 4, backgroundColor: C.danger, borderRadius: 2 }} />
          <Text style={s.diagramCaption}>Trail</Text>
        </View>
      </View>
    </View>
  );
}

function IcebergDiagram() {
  return (
    <View style={s.diagramBox}>
      <View style={{ alignItems: "center" }}>
        <View style={[s.icebergVisible, { backgroundColor: C.primaryDim }]}>
          <Text style={[s.diagramNodeText, { color: C.accent }]}>Visible Portion</Text>
        </View>
        <View style={{ width: 2, height: 8, backgroundColor: C.textTertiary }} />
        <View style={[s.icebergHidden, { backgroundColor: C.surfaceLight }]}>
          <Text style={[s.diagramNodeText, { color: C.textSecondary }]}>Hidden Quantity</Text>
          <Text style={[s.diagramCaption, { marginTop: 2 }]}>Refills automatically</Text>
        </View>
      </View>
    </View>
  );
}

function TWAPDiagram() {
  const slices = [1, 2, 3, 4, 5, 6];
  return (
    <View style={s.diagramBox}>
      <Text style={s.diagramLabel}>Orders Distributed Over Time</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 8 }}>
        {slices.map(i => (
          <View key={i} style={{ flex: 1, alignItems: "center" }}>
            <View style={{ height: 36, width: "80%", backgroundColor: C.primaryDim, borderRadius: 4, borderWidth: 1, borderColor: C.primary, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: C.primary, fontSize: 9, fontFamily: "Inter_600SemiBold" }}>T{i}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={[s.diagramCaption, { marginTop: 6 }]}>Equal slices at regular intervals to minimize market impact.</Text>
    </View>
  );
}

function ScaledDiagram() {
  const bars = [20, 35, 55, 80, 55, 35, 20];
  return (
    <View style={s.diagramBox}>
      <Text style={s.diagramLabel}>Price Range Distribution</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 8, height: 50 }}>
        {bars.map((h, i) => (
          <View key={i} style={{ flex: 1, height: h * 0.55, backgroundColor: C.secondary, borderRadius: 3, opacity: 0.7 + i * 0.02 }} />
        ))}
      </View>
      <Text style={[s.diagramCaption, { marginTop: 6 }]}>Multiple orders spread across a price range.</Text>
    </View>
  );
}

// ─── Form fields ─────────────────────────────────────────────────────────────
function LabelInput({
  label, value, onChangeText, placeholder, keyboardType = "decimal-pad", suffix,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "decimal-pad"; suffix?: string;
}) {
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldInputWrap}>
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? "0.00"}
          placeholderTextColor={C.textTertiary}
          keyboardType={keyboardType}
        />
        {suffix ? <Text style={s.fieldSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

// ─── Lock overlay ─────────────────────────────────────────────────────────────
function PlanGate({ required }: { required: string }) {
  return (
    <View style={s.gateOverlay}>
      <Ionicons name="lock-closed" size={28} color={C.textTertiary} />
      <Text style={s.gateTitle}>Requer plano {required.charAt(0).toUpperCase() + required.slice(1)}+</Text>
      <Pressable
        style={s.gateBtn}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Text style={s.gateBtnText}>Fazer Upgrade</Text>
      </Pressable>
    </View>
  );
}

// ─── OCO form ─────────────────────────────────────────────────────────────────
function OCOForm() {
  const [entryPrice, setEntry] = useState("104250");
  const [takeProfitPct, setTp] = useState("5");
  const [stopLossPct, setSl] = useState("2");
  const [qty, setQty] = useState("0.01");
  const tp = ((parseFloat(entryPrice) || 0) * (1 + (parseFloat(takeProfitPct) || 0) / 100)).toFixed(2);
  const sl = ((parseFloat(entryPrice) || 0) * (1 - (parseFloat(stopLossPct) || 0) / 100)).toFixed(2);
  return (
    <View>
      <OCODiagram />
      <LabelInput label="Entry Price (USDT)" value={entryPrice} onChangeText={setEntry} suffix="USDT" />
      <LabelInput label="Take Profit %" value={takeProfitPct} onChangeText={setTp} suffix="%" />
      <LabelInput label="Stop Loss %" value={stopLossPct} onChangeText={setSl} suffix="%" />
      <LabelInput label="Quantity" value={qty} onChangeText={setQty} />
      <View style={s.previewRow}>
        <View style={[s.previewPill, { borderColor: C.success }]}>
          <Text style={[s.previewLabel, { color: C.success }]}>TP: ${tp}</Text>
        </View>
        <View style={[s.previewPill, { borderColor: C.danger }]}>
          <Text style={[s.previewLabel, { color: C.danger }]}>SL: ${sl}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Trailing Stop form ───────────────────────────────────────────────────────
function TrailingForm() {
  const [distance, setDistance] = useState("2.5");
  const [unit, setUnit] = useState<"%" | "$">("%");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [activation, setActivation] = useState("");
  return (
    <View>
      <TrailingDiagram />
      <View style={s.pillRow}>
        {(["long", "short"] as const).map(d => (
          <Pressable
            key={d}
            style={[s.pill, direction === d && s.pillActive]}
            onPress={() => { Haptics.selectionAsync(); setDirection(d); }}
          >
            <Text style={[s.pillText, direction === d && s.pillTextActive]}>
              {d === "long" ? "Long ↑" : "Short ↓"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>Trail Distance</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {(["%", "$"] as const).map(u => (
            <Pressable key={u} onPress={() => { Haptics.selectionAsync(); setUnit(u); }} style={[s.unitBtn, unit === u && s.unitBtnActive]}>
              <Text style={[s.unitBtnText, unit === u && { color: C.text }]}>{u}</Text>
            </Pressable>
          ))}
          <TextInput
            style={[s.fieldInput, { flex: 1, marginLeft: 6 }]}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholderTextColor={C.textTertiary}
          />
        </View>
      </View>
      <LabelInput label="Activation Price (optional)" value={activation} onChangeText={setActivation} placeholder="Leave empty to activate immediately" keyboardType="decimal-pad" suffix="USDT" />
    </View>
  );
}

// ─── Iceberg form ─────────────────────────────────────────────────────────────
function IcebergForm() {
  const [total, setTotal] = useState("1.0");
  const [visible, setVisible] = useState("0.1");
  const [interval, setInterval] = useState("5");
  return (
    <View>
      <IcebergDiagram />
      <LabelInput label="Total Size" value={total} onChangeText={setTotal} suffix="BTC" />
      <LabelInput label="Visible Portion" value={visible} onChangeText={setVisible} suffix="BTC" />
      <LabelInput label="Refill Interval (s)" value={interval} onChangeText={setInterval} suffix="sec" />
      <View style={s.infoBox}>
        <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
        <Text style={s.infoText}>
          {Math.floor((parseFloat(total) || 0) / (parseFloat(visible) || 1))} slices will be placed automatically.
        </Text>
      </View>
    </View>
  );
}

// ─── TWAP form ────────────────────────────────────────────────────────────────
function TWAPForm() {
  const [amount, setAmount] = useState("10000");
  const [duration, setDuration] = useState("60");
  const [slices, setSlices] = useState("12");
  const [randomize, setRandomize] = useState(false);
  const perSlice = ((parseFloat(amount) || 0) / (parseInt(slices) || 1)).toFixed(2);
  const interval = ((parseInt(duration) || 0) / (parseInt(slices) || 1)).toFixed(1);
  return (
    <View>
      <TWAPDiagram />
      <LabelInput label="Total Amount (USDT)" value={amount} onChangeText={setAmount} suffix="USDT" />
      <LabelInput label="Duration (min)" value={duration} onChangeText={setDuration} suffix="min" />
      <LabelInput label="Number of Slices" value={slices} onChangeText={setSlices} keyboardType="default" />
      <Pressable style={s.toggleRow} onPress={() => { Haptics.selectionAsync(); setRandomize(v => !v); }}>
        <Text style={s.fieldLabel}>Randomize interval ±20%</Text>
        <View style={[s.toggleTrack, randomize && { backgroundColor: C.primary }]}>
          <View style={[s.toggleThumb, randomize && { transform: [{ translateX: 18 }] }]} />
        </View>
      </Pressable>
      <View style={s.infoBox}>
        <Ionicons name="information-circle-outline" size={14} color={C.textSecondary} />
        <Text style={s.infoText}>${perSlice} / slice every {interval} min</Text>
      </View>
    </View>
  );
}

// ─── Scaled Orders form ────────────────────────────────────────────────────────
function ScaledForm() {
  const [min, setMin] = useState("100000");
  const [max, setMax] = useState("110000");
  const [count, setCount] = useState("10");
  const [dist, setDist] = useState<"linear" | "exponential">("linear");
  return (
    <View>
      <ScaledDiagram />
      <LabelInput label="Min Price (USDT)" value={min} onChangeText={setMin} suffix="USDT" />
      <LabelInput label="Max Price (USDT)" value={max} onChangeText={setMax} suffix="USDT" />
      <LabelInput label="Number of Orders" value={count} onChangeText={setCount} keyboardType="default" />
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>Distribution</Text>
        <View style={s.pillRow}>
          {(["linear", "exponential"] as const).map(d => (
            <Pressable key={d} style={[s.pill, dist === d && s.pillActive]} onPress={() => { Haptics.selectionAsync(); setDist(d); }}>
              <Text style={[s.pillText, dist === d && s.pillTextActive]}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AdvancedOrdersScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const plan = (user?.plan ?? "free") as PlanType;

  const [selectedType, setSelectedType] = useState<OrderType>("oco");
  const [selectedPair, setSelectedPair] = useState("BTC/USDT");
  const [selectedExchange, setSelectedExchange] = useState("Binance");
  const [showPairModal, setShowPairModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadOrders() {
      try {
        const response = await apiRequest("GET", "/api/orders/open");
        const res = await response.json();
        if (mounted) setOpenOrders(Array.isArray(res) ? res : []);
      } catch {
        if (mounted) setOpenOrders([]);
      } finally {
        if (mounted) setOrdersLoading(false);
      }
    }
    loadOrders();
    return () => { mounted = false; };
  }, []);

  const cancelOrder = useCallback(async (orderId: string, exchange: string) => {
    try {
      await apiRequest("DELETE", "/api/orders/cancel", { orderId, exchange });
      setOpenOrders(prev => prev.filter(o => o.id !== orderId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Não foi possível cancelar a ordem.");
    }
  }, []);

  const selectedOrderType = ORDER_TYPES.find(o => o.key === selectedType)!;
  const isLocked = !planGte(plan, selectedOrderType.minPlan);

  const handleSubmit = useCallback(() => {
    if (isLocked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowConfirmModal(true);
  }, [isLocked]);

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfirmModal(false);
    Alert.alert("✅ Order Submitted", `${selectedOrderType.label} order placed on ${selectedExchange} for ${selectedPair}.`);
  }, [selectedOrderType, selectedExchange, selectedPair]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('advancedOrders')}</Text>
        <View style={[s.planBadge, { backgroundColor: planTheme.primaryDim }]}>
          <Text style={[s.planBadgeText, { color: planTheme.primary }]}>{plan.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Selectors */}
        <View style={s.selectorRow}>
          <Pressable style={s.selectorBtn} onPress={() => { Haptics.selectionAsync(); setShowPairModal(true); }}>
            <Text style={s.selectorLabel}>Pair</Text>
            <View style={s.selectorValue}>
              <Text style={s.selectorValueText}>{selectedPair}</Text>
              <Ionicons name="chevron-down" size={14} color={C.textSecondary} />
            </View>
          </Pressable>
          <Pressable style={s.selectorBtn} onPress={() => { Haptics.selectionAsync(); setShowExchangeModal(true); }}>
            <Text style={s.selectorLabel}>Exchange</Text>
            <View style={s.selectorValue}>
              <Text style={s.selectorValueText}>{selectedExchange}</Text>
              <Ionicons name="chevron-down" size={14} color={C.textSecondary} />
            </View>
          </Pressable>
        </View>

        {/* Order type tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
          {ORDER_TYPES.map(ot => {
            const locked = !planGte(plan, ot.minPlan);
            const active = selectedType === ot.key;
            return (
              <Pressable
                key={ot.key}
                style={[s.orderTab, active && { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]}
                onPress={() => { Haptics.selectionAsync(); setSelectedType(ot.key); }}
              >
                <Ionicons name={ot.icon as any} size={16} color={active ? planTheme.primary : locked ? C.textTertiary : C.textSecondary} />
                <Text style={[s.orderTabText, active && { color: planTheme.primary }, locked && { color: C.textTertiary }]}>{ot.label}</Text>
                {locked && <Ionicons name="lock-closed" size={10} color={C.textTertiary} style={{ marginLeft: 2 }} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Order type description */}
        <View style={s.descBox}>
          <Text style={s.descText}>
            {selectedType === "oco"      && "One Cancels Other — place a take-profit and stop-loss simultaneously. When one triggers, the other is cancelled."}
            {selectedType === "trailing" && "Trailing Stop — the stop price follows the market at a set distance. Locks in profit while letting winners run."}
            {selectedType === "iceberg"  && "Iceberg — show only a small portion of the full order. Minimizes market impact for large trades."}
            {selectedType === "twap"     && "Time-Weighted Average Price — splits your order into equal slices over time to reduce slippage."}
            {selectedType === "scaled"   && "Scaled Orders — distribute buy/sell orders across a price range with configurable curve distribution."}
          </Text>
        </View>

        {/* Form or gate */}
        <View style={s.formCard}>
          {isLocked && <PlanGate required={selectedOrderType.minPlan} />}
          {!isLocked && selectedType === "oco"      && <OCOForm />}
          {!isLocked && selectedType === "trailing" && <TrailingForm />}
          {!isLocked && selectedType === "iceberg"  && <IcebergForm />}
          {!isLocked && selectedType === "twap"     && <TWAPForm />}
          {!isLocked && selectedType === "scaled"   && <ScaledForm />}
        </View>

        {/* Submit button */}
        <Pressable
          style={[s.submitBtn, { backgroundColor: isLocked ? C.surface : planTheme.primary }]}
          onPress={handleSubmit}
          disabled={isLocked}
        >
          <Ionicons name="checkmark-circle" size={20} color={isLocked ? C.textTertiary : "#000"} />
          <Text style={[s.submitBtnText, { color: isLocked ? C.textTertiary : "#000" }]}>
            {isLocked ? `Unlock ${selectedOrderType.label}` : `Submit ${selectedOrderType.label} Order`}
          </Text>
        </Pressable>

        {/* Open Orders */}
        <View style={s.formCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Ionicons name="list-outline" size={16} color={planTheme.primary} />
            <Text style={[s.headerTitle, { fontSize: 14, flex: 1 }]}>Ordens Abertas</Text>
            {ordersLoading && <ActivityIndicator size="small" color={planTheme.primary} />}
          </View>
          {!ordersLoading && openOrders.length === 0 ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, textAlign: "center", paddingVertical: 12 }}>
              Nenhum dado disponível
            </Text>
          ) : (
            openOrders.map(order => {
              const isBuy = (order.side ?? "").toUpperCase() === "BUY";
              return (
                <View key={order.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text }}>{order.symbol ?? order.pair}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
                      {order.exchange} · {order.type ?? order.orderType} · ${Number(order.price ?? 0).toFixed(2)}
                    </Text>
                  </View>
                  <View style={[s.planBadge, { backgroundColor: isBuy ? C.successDim : C.dangerDim }]}>
                    <Text style={[s.planBadgeText, { color: isBuy ? C.success : C.danger }]}>{order.side?.toUpperCase()}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Alert.alert("Cancelar Ordem", `Cancelar ordem ${order.symbol ?? order.pair}?`, [
                        { text: "Não", style: "cancel" },
                        { text: "Cancelar", style: "destructive", onPress: () => cancelOrder(order.id, order.exchange ?? "") },
                      ]);
                    }}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={C.danger} />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Pair picker modal */}
      <Modal visible={showPairModal} transparent animationType="slide">
        <Pressable style={s.modalBackdrop} onPress={() => setShowPairModal(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select Pair</Text>
            {PAIRS.map(p => (
              <Pressable key={p} style={s.pickerItem} onPress={() => { Haptics.selectionAsync(); setSelectedPair(p); setShowPairModal(false); }}>
                <Text style={[s.pickerItemText, selectedPair === p && { color: planTheme.primary }]}>{p}</Text>
                {selectedPair === p && <Ionicons name="checkmark" size={18} color={planTheme.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Exchange picker modal */}
      <Modal visible={showExchangeModal} transparent animationType="slide">
        <Pressable style={s.modalBackdrop} onPress={() => setShowExchangeModal(false)}>
          <View style={s.pickerSheet}>
            <Text style={s.pickerTitle}>Select Exchange</Text>
            {EXCHANGES.map(e => (
              <Pressable key={e} style={s.pickerItem} onPress={() => { Haptics.selectionAsync(); setSelectedExchange(e); setShowExchangeModal(false); }}>
                <Text style={[s.pickerItemText, selectedExchange === e && { color: planTheme.primary }]}>{e}</Text>
                {selectedExchange === e && <Ionicons name="checkmark" size={18} color={planTheme.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Confirm modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.confirmSheet}>
            <Text style={s.confirmTitle}>Confirm Order</Text>
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Type</Text>
              <Text style={s.confirmValue}>{selectedOrderType.label}</Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Pair</Text>
              <Text style={s.confirmValue}>{selectedPair}</Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.confirmLabel}>Exchange</Text>
              <Text style={s.confirmValue}>{selectedExchange}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Pressable style={[s.confirmBtn, { backgroundColor: C.surface }]} onPress={() => setShowConfirmModal(false)}>
                <Text style={s.confirmBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.confirmBtn, { backgroundColor: planTheme.primary, flex: 1 }]} onPress={handleConfirm}>
                <Text style={[s.confirmBtnText, { color: "#000" }]}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  selectorRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  selectorBtn: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  selectorLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 4 },
  selectorValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  selectorValueText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, flex: 1 },
  tabsScroll: { marginBottom: 12 },
  tabsContent: { paddingRight: 8, gap: 8 },
  orderTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  orderTabText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  descBox: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  descText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  formCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  diagramBox: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  diagramRow: { alignItems: "center", marginVertical: 2 },
  diagramNode: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  diagramNodeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  diagramLine: { width: 2, height: 16, borderLeftWidth: 1, borderStyle: "dashed" },
  diagramLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, alignSelf: "flex-start", marginBottom: 2 },
  diagramCaption: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, textAlign: "center", marginTop: 4 },
  icebergVisible: { paddingHorizontal: 40, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: C.accent },
  icebergHidden: { paddingHorizontal: 60, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  fieldInputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8 },
  fieldInput: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, color: C.text },
  fieldSuffix: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textTertiary, marginLeft: 8 },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  pillActive: { borderColor: C.primary, backgroundColor: C.primaryDim },
  pillText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  pillTextActive: { color: C.primary },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  unitBtnActive: { borderColor: C.primary, backgroundColor: C.primaryDim },
  unitBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  toggleTrack: { width: 42, height: 24, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.textTertiary },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface, borderRadius: 8, padding: 10, marginTop: 4 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 },
  previewRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  previewPill: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, alignItems: "center" },
  previewLabel: { fontFamily: "Inter_700Bold", fontSize: 14 },
  gateOverlay: { alignItems: "center", paddingVertical: 24, gap: 10 },
  gateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gateBtn: { marginTop: 4, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  gateBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#000" },
  submitBtn: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%" },
  pickerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginBottom: 16 },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerItemText: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.text },
  confirmSheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  confirmTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginBottom: 20 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  confirmLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  confirmValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  confirmBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  confirmBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
});
