import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
  TextInput, Switch, ActivityIndicator,
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

type AlertTab = "price" | "technical" | "volume" | "whale" | "portfolio" | "custom";

interface AlertItem {
  id: string;
  type: AlertTab;
  label: string;
  condition: string;
  enabled: boolean;
  triggered?: boolean;
  time?: string;
}

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"];

const MOCK_ALERTS: AlertItem[] = [
  { id: "1", type: "price",     label: "BTC above $110,000",          condition: "BTC/USDT > 110,000",    enabled: true  },
  { id: "2", type: "price",     label: "ETH below $3,500",            condition: "ETH/USDT < 3,500",      enabled: true  },
  { id: "3", type: "technical", label: "BTC RSI overbought",          condition: "BTC RSI(14) > 70",      enabled: false },
  { id: "4", type: "volume",    label: "BTC volume spike",            condition: "BTC Vol > 3x 24h avg",  enabled: true  },
  { id: "5", type: "whale",     label: "Large BTC transfer detected", condition: "> 1,000 BTC on-chain",  enabled: true  },
];

const ALERT_HISTORY: (AlertItem & { time: string })[] = [
  { id: "h1", type: "price",     label: "BTC crossed $104,000",       condition: "BTC/USDT ≥ 104,000", enabled: true, triggered: true, time: "2h ago" },
  { id: "h2", type: "technical", label: "ETH MACD bullish cross",     condition: "ETH MACD cross",     enabled: true, triggered: true, time: "5h ago" },
  { id: "h3", type: "whale",     label: "500 BTC moved to exchange",  condition: "BTC exchange inflow", enabled: true, triggered: true, time: "8h ago" },
];

const WHALE_FEED = [
  { id: "w1", asset: "BTC", amount: "2,500 BTC", from: "Unknown Wallet", to: "Binance", usd: "$260.6M", time: "12 min ago", type: "exchange_inflow" },
  { id: "w2", asset: "ETH", amount: "18,200 ETH", from: "Ethereum Foundation", to: "Cold Wallet", usd: "$69.9M", time: "1h ago", type: "hodl" },
  { id: "w3", asset: "SOL", amount: "890,000 SOL", from: "Unknown", to: "OKX", usd: "$158.8M", time: "3h ago", type: "exchange_inflow" },
];

// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TAB_CONFIG: { key: AlertTab; label: string; icon: string; minPlan: PlanType; }[] = [
  { key: "price",     label: "Price",     icon: "pricetag-outline",     minPlan: "free"     },
  { key: "technical", label: "Technical", icon: "bar-chart-outline",    minPlan: "pro"      },
  { key: "volume",    label: "Volume",    icon: "pulse-outline",        minPlan: "pro"      },
  { key: "whale",     label: "Whale",     icon: "fish-outline",         minPlan: "pro"      },
  { key: "portfolio", label: "Portfolio", icon: "briefcase-outline",    minPlan: "pro"      },
  { key: "custom",    label: "Custom",    icon: "code-slash-outline",   minPlan: "premium"  },
];

// ─── Active alert row ─────────────────────────────────────────────────────────
function AlertRow({ alert, onToggle }: { alert: AlertItem; onToggle: (id: string) => void }) {
  const typeColor: Record<AlertTab, string> = {
    price: C.primary, technical: C.secondary, volume: C.warning, whale: "#00B4D8", portfolio: C.success, custom: "#E040FB",
  };
  const color = typeColor[alert.type];
  return (
    <View style={ar.row}>
      <View style={[ar.dot, { backgroundColor: alert.enabled ? color : C.textTertiary }]} />
      <View style={{ flex: 1 }}>
        <Text style={ar.label}>{alert.label}</Text>
        <Text style={ar.cond}>{alert.condition}</Text>
      </View>
      <Pressable onPress={() => { Haptics.selectionAsync(); onToggle(alert.id); }}>
        <View style={[ar.toggle, alert.enabled && { backgroundColor: C.primary }]}>
          <View style={[ar.toggleThumb, alert.enabled && { transform: [{ translateX: 18 }] }]} />
        </View>
      </Pressable>
    </View>
  );
}
const ar = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, marginBottom: 2 },
  cond: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  toggle: { width: 42, height: 24, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 2 },
  toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.textTertiary },
});

// ─── History row ──────────────────────────────────────────────────────────────
function HistoryRow({ item }: { item: typeof ALERT_HISTORY[0] }) {
  return (
    <View style={hr.row}>
      <View style={[hr.icon, { backgroundColor: C.successDim }]}>
        <Ionicons name="checkmark-circle" size={16} color={C.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={hr.label}>{item.label}</Text>
        <Text style={hr.cond}>{item.condition}</Text>
      </View>
      <Text style={hr.time}>{item.time}</Text>
    </View>
  );
}
const hr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, marginBottom: 2 },
  cond: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  time: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
});

// ─── Price alert form ─────────────────────────────────────────────────────────
function PriceAlertForm({ plan, alertCount, onAdd }: { plan: PlanType; alertCount: number; onAdd: () => void }) {
  const [pair, setPair] = useState("BTC/USDT");
  const [condition, setCondition] = useState<"above" | "below" | "cross">("above");
  const [price, setPrice] = useState("");
  const maxAlerts = plan === "free" ? 5 : plan === "pro" ? 50 : 999;
  const atLimit = alertCount >= maxAlerts;
  return (
    <View style={f.container}>
      <Text style={f.sectionLabel}>New Price Alert</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {PAIRS.map(p => (
            <Pressable key={p} style={[f.chip, pair === p && f.chipActive]} onPress={() => { Haptics.selectionAsync(); setPair(p); }}>
              <Text style={[f.chipText, pair === p && f.chipTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
        {(["above", "below", "cross"] as const).map(c => (
          <Pressable key={c} style={[f.chip, condition === c && f.chipActive]} onPress={() => { Haptics.selectionAsync(); setCondition(c); }}>
            <Text style={[f.chipText, condition === c && f.chipTextActive]}>
              {c === "above" ? "▲ Above" : c === "below" ? "▼ Below" : "⚡ Cross"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={f.inputRow}>
        <TextInput style={f.input} value={price} onChangeText={setPrice} placeholder="Enter price (USDT)" placeholderTextColor={C.textTertiary} keyboardType="decimal-pad" />
        <Pressable style={[f.addBtn, { backgroundColor: atLimit ? C.surface : C.primary }]} onPress={onAdd} disabled={atLimit}>
          <Text style={[f.addBtnText, { color: atLimit ? C.textTertiary : "#000" }]}>+ Add</Text>
        </Pressable>
      </View>
      <Text style={f.limitText}>{alertCount}/{maxAlerts === 999 ? "∞" : maxAlerts} alerts used</Text>
    </View>
  );
}
const f = StyleSheet.create({
  container: { marginBottom: 20 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  chipActive: { borderColor: C.primary, backgroundColor: C.primaryDim },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  chipTextActive: { color: C.primary },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 8, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text },
  addBtn: { paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  limitText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 8 },
});

// ─── Technical alert form ─────────────────────────────────────────────────────
function TechnicalAlertForm() {
  const [indicator, setIndicator] = useState<string>("RSI");
  const INDICATORS = ["RSI", "MACD", "EMA Cross", "Bollinger"];
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={f.sectionLabel}>Technical Alert</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {INDICATORS.map(ind => (
          <Pressable key={ind} style={[f.chip, indicator === ind && f.chipActive]} onPress={() => { Haptics.selectionAsync(); setIndicator(ind); }}>
            <Text style={[f.chipText, indicator === ind && f.chipTextActive]}>{ind}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary }}>
          {indicator === "RSI" && "Alert when RSI(14) crosses 70 (overbought) or 30 (oversold)"}
          {indicator === "MACD" && "Alert when MACD line crosses signal line (bullish/bearish)"}
          {indicator === "EMA Cross" && "Alert when price crosses above/below EMA(50) or EMA(200)"}
          {indicator === "Bollinger" && "Alert when price touches upper/lower Bollinger Band"}
        </Text>
      </View>
    </View>
  );
}

// ─── Volume alert form ─────────────────────────────────────────────────────────
function VolumeAlertForm() {
  const [multiplier, setMultiplier] = useState("3");
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={f.sectionLabel}>Volume Spike Alert</Text>
      <View style={f.inputRow}>
        <TextInput style={f.input} value={multiplier} onChangeText={setMultiplier} keyboardType="decimal-pad" placeholderTextColor={C.textTertiary} />
        <View style={{ justifyContent: "center", paddingHorizontal: 10 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary }}>× 24h avg volume</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Whale alert form ─────────────────────────────────────────────────────────
function WhaleAlertForm() {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={f.sectionLabel}>Whale Transactions</Text>
      <View style={{ gap: 8 }}>
        {WHALE_FEED.map(w => (
          <View key={w.id} style={{ backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ backgroundColor: w.type === "exchange_inflow" ? C.dangerDim : C.successDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: w.type === "exchange_inflow" ? C.danger : C.success }}>
                    {w.type === "exchange_inflow" ? "Exchange Inflow" : "HODLing"}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary }}>{w.time}</Text>
            </View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: C.text }}>{w.amount}</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary }}>{w.from} → {w.to}</Text>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.warning }}>≈ {w.usd}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Portfolio alert form ─────────────────────────────────────────────────────
function PortfolioAlertForm() {
  const [drawdown, setDrawdown] = useState("10");
  const [profitTarget, setProfitTarget] = useState("20");
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={f.sectionLabel}>Portfolio Alerts</Text>
      <View style={{ gap: 10 }}>
        <View style={f.inputRow}>
          <Text style={[f.chipText, { flex: 1, alignSelf: "center", color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Drawdown threshold</Text>
          <TextInput style={[f.input, { flex: 0, width: 80, textAlign: "center" }]} value={drawdown} onChangeText={setDrawdown} keyboardType="decimal-pad" placeholderTextColor={C.textTertiary} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, alignSelf: "center" }}>%</Text>
        </View>
        <View style={f.inputRow}>
          <Text style={[f.chipText, { flex: 1, alignSelf: "center", color: C.text, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Profit target</Text>
          <TextInput style={[f.input, { flex: 0, width: 80, textAlign: "center" }]} value={profitTarget} onChangeText={setProfitTarget} keyboardType="decimal-pad" placeholderTextColor={C.textTertiary} />
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, alignSelf: "center" }}>%</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Custom alert form ─────────────────────────────────────────────────────────
function CustomAlertForm({ plan }: { plan: PlanType }) {
  const [cond1, setCond1] = useState("BTC RSI > 70");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [cond2, setCond2] = useState("BTC Volume > 2x avg");
  if (!planGte(plan, "premium")) {
    return (
      <View style={{ alignItems: "center", padding: 24, gap: 12 }}>
        <Ionicons name="code-slash-outline" size={40} color={C.textTertiary} />
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary, textAlign: "center" }}>Custom Alerts require Premium plan</Text>
        <Pressable style={{ backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 }} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#000" }}>Upgrade to Premium</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={f.sectionLabel}>Custom Multi-Condition Alert</Text>
      <TextInput style={[f.input, { marginBottom: 10 }]} value={cond1} onChangeText={setCond1} placeholderTextColor={C.textTertiary} placeholder="Condition 1" />
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
        {(["AND", "OR"] as const).map(l => (
          <Pressable key={l} style={[f.chip, logic === l && f.chipActive]} onPress={() => { Haptics.selectionAsync(); setLogic(l); }}>
            <Text style={[f.chipText, logic === l && f.chipTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={f.input} value={cond2} onChangeText={setCond2} placeholderTextColor={C.textTertiary} placeholder="Condition 2" />
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

// ─── Main component ────────────────────────────────────────────────────────────
export default function SmartAlertsScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const plan = (user?.plan ?? "free") as PlanType;

  const [activeTab, setActiveTab]   = useState<AlertTab>("price");
  const [alerts, setAlerts]         = useState<AlertItem[]>(MOCK_ALERTS);
  const [pushEnabled, setPush]      = useState(true);
  const [soundEnabled, setSound]    = useState(false);
  const [vibEnabled, setVib]        = useState(true);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [anomalyResult, setAnomalyResult]   = useState<{ anomalies: string[]; score: number; recommendation: string } | null>(null);

  const priceAlerts = alerts.filter(a => a.type === "price");

  const scanAnomalies = async () => {
    try {
      setAnomalyLoading(true);
      const result = await apiRequest<{ anomalies: string[]; score: number; recommendation: string }>(
        "POST", "/api/anomaly/analyze",
        { symbol: "BTCUSDT", prices: [104000, 103800, 104200, 103500, 104800, 105000, 104200, 103800, 104500, 104000, 103600, 104100, 105200, 104800, 103900, 104300, 105100, 104600, 103700, 104900] }
      );
      setAnomalyResult(result);
    } catch {
      setAnomalyResult(null);
    } finally {
      setAnomalyLoading(false);
    }
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const addPriceAlert = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newAlert: AlertItem = {
      id: String(Date.now()),
      type: "price",
      label: "BTC above $105,000",
      condition: "BTC/USDT > 105,000",
      enabled: true,
    };
    setAlerts(prev => [newAlert, ...prev]);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('smartAlerts')}</Text>
        <View style={[s.planBadge, { backgroundColor: planTheme.primaryDim }]}>
          <Text style={[s.planBadgeText, { color: planTheme.primary }]}>{plan.toUpperCase()}</Text>
        </View>
      </View>

      {/* Alert type tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
        {TAB_CONFIG.map(tab => {
          const locked = !planGte(plan, tab.minPlan);
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[s.tab, active && { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }}
            >
              <Ionicons name={tab.icon as any} size={15} color={active ? planTheme.primary : locked ? C.textTertiary : C.textSecondary} />
              <Text style={[s.tabText, active && { color: planTheme.primary }, locked && { color: C.textTertiary }]}>{tab.label}</Text>
              {locked && <Ionicons name="lock-closed" size={10} color={C.textTertiary} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Anomaly Scanner */}
        <View style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: anomalyResult ? 12 : 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="scan-outline" size={18} color={planTheme.primary} />
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: C.text }}>Anomaly Detector</Text>
            </View>
            <Pressable
              style={{ backgroundColor: planTheme.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); scanAnomalies(); }}
              disabled={anomalyLoading}
            >
              {anomalyLoading
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="flash-outline" size={14} color="#000" />}
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#000" }}>
                {anomalyLoading ? "Scanning..." : "Scan Anomalias"}
              </Text>
            </Pressable>
          </View>
          {anomalyResult && (
            <View style={{ gap: 8, marginTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary }}>BTCUSDT · Score</Text>
                <View style={{ backgroundColor: anomalyResult.score > 0.6 ? C.dangerDim : C.successDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: anomalyResult.score > 0.6 ? C.danger : C.success }}>{(anomalyResult.score * 100).toFixed(0)}%</Text>
                </View>
              </View>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: planTheme.primary }}>{anomalyResult.recommendation}</Text>
              {anomalyResult.anomalies.length > 0 && anomalyResult.anomalies.map((a, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="warning-outline" size={13} color={C.warning} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 }}>{a}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Form card */}
        <View style={s.card}>
          {activeTab === "price"     && <PriceAlertForm plan={plan} alertCount={priceAlerts.length} onAdd={addPriceAlert} />}
          {activeTab === "technical" && (!planGte(plan, "pro") ? <GateBanner text="Technical alerts require Pro plan." /> : <TechnicalAlertForm />)}
          {activeTab === "volume"    && (!planGte(plan, "pro") ? <GateBanner text="Volume alerts require Pro plan." /> : <VolumeAlertForm />)}
          {activeTab === "whale"     && (!planGte(plan, "pro") ? <GateBanner text="Whale alerts require Pro plan." /> : <WhaleAlertForm />)}
          {activeTab === "portfolio" && (!planGte(plan, "pro") ? <GateBanner text="Portfolio alerts require Pro plan." /> : <PortfolioAlertForm />)}
          {activeTab === "custom"    && <CustomAlertForm plan={plan} />}
        </View>

        {/* Active alerts */}
        <SectionTitle title={`Active Alerts (${alerts.filter(a => a.enabled).length})`} icon="notifications-outline" />
        <View style={s.card}>
          {alerts.length === 0 ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, textAlign: "center", paddingVertical: 16 }}>No alerts configured</Text>
          ) : (
            alerts.map(a => <AlertRow key={a.id} alert={a} onToggle={toggleAlert} />)
          )}
        </View>

        {/* Notification channels */}
        <SectionTitle title="Notification Channels" icon="volume-high-outline" />
        <View style={s.card}>
          <View style={s.notifRow}>
            <Ionicons name="phone-portrait-outline" size={18} color={C.textSecondary} />
            <Text style={s.notifLabel}>Push Notifications</Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); setPush(v => !v); }}>
              <View style={[ar.toggle, pushEnabled && { backgroundColor: C.primary }]}>
                <View style={[ar.toggleThumb, pushEnabled && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          </View>
          <View style={s.notifRow}>
            <Ionicons name="musical-note-outline" size={18} color={C.textSecondary} />
            <Text style={s.notifLabel}>Sound Alert</Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); setSound(v => !v); }}>
              <View style={[ar.toggle, soundEnabled && { backgroundColor: C.primary }]}>
                <View style={[ar.toggleThumb, soundEnabled && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          </View>
          <View style={[s.notifRow, { borderBottomWidth: 0 }]}>
            <Ionicons name="phone-portrait-outline" size={18} color={C.textSecondary} />
            <Text style={s.notifLabel}>Vibration</Text>
            <Pressable onPress={() => { Haptics.selectionAsync(); setVib(v => !v); }}>
              <View style={[ar.toggle, vibEnabled && { backgroundColor: C.primary }]}>
                <View style={[ar.toggleThumb, vibEnabled && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          </View>
          {planGte(plan, "enterprise") && (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary }}>Webhook URL (Enterprise)</Text>
              <TextInput
                style={{ backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 13, color: C.text }}
                placeholder="https://your-webhook.com/alerts"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

        {/* Alert history */}
        <SectionTitle title="Alert History" icon="time-outline" />
        <View style={s.card}>
          {ALERT_HISTORY.map(h => <HistoryRow key={h.id} item={h} />)}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function GateBanner({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.warningDim, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.warning }}>
      <Ionicons name="lock-closed" size={16} color={C.warning} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.warning, flex: 1 }}>{text}</Text>
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
  tabsScroll: { borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 0 },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  notifLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1 },
});
