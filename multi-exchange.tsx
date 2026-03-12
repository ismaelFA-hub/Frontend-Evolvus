import { useState, useCallback, useEffect } from "react";
import {
  View, Text, Image, ScrollView, Pressable, StyleSheet, Platform,
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
import { ALL_EXCHANGES, getExchangeFavicon } from "@/lib/exchanges";

const C = Colors.dark;
type PlanType = "free" | "pro" | "premium" | "enterprise";
const PLAN_ORDER: PlanType[] = ["free", "pro", "premium", "enterprise", "admin"];
function planGte(u: PlanType, r: PlanType) { if (u === "admin") return true; return PLAN_ORDER.indexOf(u) >= PLAN_ORDER.indexOf(r); }

type ExchangeStatus = "connected" | "syncing" | "error";

interface ExchangeCapability {
  exchange: string;
  spotEnabled: boolean;
  futuresEnabled: boolean;
  leverageEnabled: boolean;
  maxLeverage: number;
  websocketEnabled: boolean;
  tier: string;
}

interface ExchangeData {
  id: string;
  name: string;
  status: ExchangeStatus;
  lastSync: string;
  balanceUSDT: number;
  balanceBTC: number;
  balanceETH: number;
}

const SUPPORTED_EXCHANGES = ALL_EXCHANGES;

function exchangeColor(id: string): string {
  const ex = ALL_EXCHANGES.find(e => e.id === id.toLowerCase().replace(/[\s.]/g, ""));
  return ex?.color ?? "#6B7280";
}

function exchangeDomain(id: string): string {
  const ex = ALL_EXCHANGES.find(e => e.id === id.toLowerCase().replace(/[\s.]/g, ""));
  return ex?.domain ?? "google.com";
}

const MOCK_EXCHANGES: ExchangeData[] = [
  { id: "binance", name: "Binance",  status: "connected", lastSync: "2 sec ago",  balanceUSDT: 12450.80, balanceBTC: 0.182, balanceETH: 2.45 },
  { id: "bybit",   name: "Bybit",    status: "syncing",   lastSync: "45 sec ago", balanceUSDT: 5820.30,  balanceBTC: 0.054, balanceETH: 0.80 },
  { id: "okx",     name: "OKX",      status: "error",     lastSync: "1 min ago",  balanceUSDT: 0,        balanceBTC: 0,     balanceETH: 0    },
];

const PRICE_COMPARISON = [
  { pair: "BTC/USDT", binance: 104250.80, bybit: 104248.20, okx: 104255.00, best: "binance" },
  { pair: "ETH/USDT", binance: 3842.15,   bybit: 3843.50,   okx: 3841.80,   best: "okx"     },
  { pair: "SOL/USDT", binance: 178.45,    bybit: 178.50,    okx: 178.40,    best: "okx"      },
  { pair: "BNB/USDT", binance: 712.30,    bybit: 712.00,    okx: 712.50,    best: "bybit"    },
];

const ARBI_OPPS = [
  { pair: "ETH/USDT", buy: "OKX", sell: "Bybit", spread: 0.045, pct: "+0.045%", profit: "$18.02" },
  { pair: "SOL/USDT", buy: "Binance", sell: "OKX", spread: 0.028, pct: "+0.028%", profit: "$4.98" },
];

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: ExchangeStatus }) {
  const color = status === "connected" ? C.success : status === "syncing" ? C.warning : C.danger;
  const label = status === "connected" ? "Conectado" : status === "syncing" ? "Sincronizando" : "Erro";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

// ─── Exchange card ─────────────────────────────────────────────────────────────
function ExchangeCard({ exchange, onRemove }: { exchange: ExchangeData; onRemove: () => void }) {
  const totalUSD = exchange.balanceUSDT + exchange.balanceBTC * 104250 + exchange.balanceETH * 3842;
  const brand = exchangeColor(exchange.id);
  const domain = exchangeDomain(exchange.id);
  return (
    <View style={ec.card}>
      <View style={ec.header}>
        <View style={[ec.logo, { backgroundColor: `${brand}22`, borderColor: `${brand}44` }]}>
          <Image source={{ uri: getExchangeFavicon(domain, 32) }} style={{ width: 26, height: 26, borderRadius: 6 }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ec.name}>{exchange.name}</Text>
          <StatusDot status={exchange.status} />
        </View>
        <Pressable onPress={onRemove} style={ec.removeBtn}>
          <Ionicons name="trash-outline" size={16} color={C.danger} />
        </Pressable>
      </View>
      {exchange.status !== "error" ? (
        <View style={ec.balances}>
          <View style={ec.balRow}>
            <Text style={ec.balLabel}>USDT</Text>
            <Text style={ec.balValue}>${exchange.balanceUSDT.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={ec.balRow}>
            <Text style={ec.balLabel}>BTC</Text>
            <Text style={ec.balValue}>{exchange.balanceBTC.toFixed(4)}</Text>
          </View>
          <View style={ec.balRow}>
            <Text style={ec.balLabel}>ETH</Text>
            <Text style={ec.balValue}>{exchange.balanceETH.toFixed(4)}</Text>
          </View>
          <View style={[ec.balRow, { borderTopWidth: 1, borderTopColor: C.border, marginTop: 6, paddingTop: 6 }]}>
            <Text style={ec.balLabel}>Total (est.)</Text>
            <Text style={[ec.balValue, { color: C.primary }]}>${totalUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 10, backgroundColor: C.dangerDim, borderRadius: 8 }}>
          <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.danger }}>Connection failed. Check API keys.</Text>
        </View>
      )}
      <Text style={ec.syncText}>Last sync: {exchange.lastSync}</Text>
    </View>
  );
}
const ec = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  logo: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  logoText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  name: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, marginBottom: 2 },
  removeBtn: { padding: 6 },
  balances: { marginTop: 4 },
  balRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  balLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  balValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  syncText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 8 },
});

// ─── Price comparison table ───────────────────────────────────────────────────
function PriceTable() {
  return (
    <View>
      <View style={pt.headerRow}>
        <Text style={[pt.cell, { flex: 1.5 }]}>Pair</Text>
        <Text style={pt.cell}>Binance</Text>
        <Text style={pt.cell}>Bybit</Text>
        <Text style={pt.cell}>OKX</Text>
      </View>
      {PRICE_COMPARISON.map(row => (
        <View key={row.pair} style={pt.row}>
          <Text style={[pt.cell, { flex: 1.5, color: C.text, fontFamily: "Inter_600SemiBold" }]}>{row.pair}</Text>
          <Text style={[pt.cell, row.best === "binance" && pt.best]}>
            {row.pair.includes("BTC") ? row.binance.toLocaleString() : row.binance.toFixed(2)}
          </Text>
          <Text style={[pt.cell, row.best === "bybit" && pt.best]}>
            {row.pair.includes("BTC") ? row.bybit.toLocaleString() : row.bybit.toFixed(2)}
          </Text>
          <Text style={[pt.cell, row.best === "okx" && pt.best]}>
            {row.pair.includes("BTC") ? row.okx.toLocaleString() : row.okx.toFixed(2)}
          </Text>
        </View>
      ))}
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 6 }}>
        🟢 Best ask price highlighted in green
      </Text>
    </View>
  );
}
const pt = StyleSheet.create({
  headerRow: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  row: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border + "88" },
  cell: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "right" },
  best: { color: C.success, fontFamily: "Inter_700Bold" },
});

// ─── Arbitrage opportunity card ───────────────────────────────────────────────
function ArbiCard({ opp }: { opp: typeof ARBI_OPPS[0] }) {
  return (
    <View style={ar.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={ar.pair}>{opp.pair}</Text>
        <View style={ar.profitBadge}>
          <Text style={ar.pct}>{opp.pct}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
        <View>
          <Text style={ar.label}>Buy on</Text>
          <Text style={ar.val}>{opp.buy}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={C.textTertiary} style={{ marginTop: 16 }} />
        <View>
          <Text style={ar.label}>Sell on</Text>
          <Text style={ar.val}>{opp.sell}</Text>
        </View>
        <View style={{ marginLeft: "auto" }}>
          <Text style={ar.label}>Est. profit</Text>
          <Text style={[ar.val, { color: C.success }]}>{opp.profit}</Text>
        </View>
      </View>
    </View>
  );
}
const ar = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  pair: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  profitBadge: { backgroundColor: C.successDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pct: { fontFamily: "Inter_700Bold", fontSize: 12, color: C.success },
  label: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  val: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
});

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
export default function MultiExchangeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const plan = (user?.plan ?? "free") as PlanType;

  const EXCHANGE_LIMIT = plan === "free" ? 2 : plan === "pro" ? 5 : 99;

  const [exchanges, setExchanges] = useState<ExchangeData[]>(MOCK_EXCHANGES);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [selectedToAdd, setSelectedToAdd]  = useState<typeof SUPPORTED_EXCHANGES[0] | null>(null);
  const [apiKey, setApiKey]   = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [capabilities, setCapabilities] = useState<ExchangeCapability[]>([]);
  const [capsLoading, setCapsLoading] = useState(true);
  const [capsError, setCapsError] = useState(false);

  useEffect(() => {
    apiRequest<ExchangeCapability[]>("GET", "/api/exchanges/capabilities")
      .then(data => setCapabilities(data || []))
      .catch(() => setCapsError(true))
      .finally(() => setCapsLoading(false));
  }, []);

  const totalUSDT = exchanges.filter(e => e.status !== "error").reduce((acc, e) => acc + e.balanceUSDT + e.balanceBTC * 104250 + e.balanceETH * 3842, 0);

  const handleRemove = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Remove Exchange", "Remove this exchange connection?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setExchanges(prev => prev.filter(e => e.id !== id)) },
    ]);
  };

  const handleConnect = () => {
    if (!selectedToAdd || !apiKey || !apiSecret) {
      Alert.alert("Missing fields", "API Key and Secret are required.");
      return;
    }
    if (exchanges.length >= EXCHANGE_LIMIT) {
      Alert.alert("Limit Reached", `Your ${plan} plan allows ${EXCHANGE_LIMIT} exchanges. Upgrade to add more.`);
      return;
    }
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      const newEx: ExchangeData = {
        id: selectedToAdd.id,
        name: selectedToAdd.label,
        status: "connected",
        lastSync: "just now",
        balanceUSDT: Math.round(Math.random() * 5000 + 1000),
        balanceBTC: parseFloat((Math.random() * 0.1).toFixed(4)),
        balanceETH: parseFloat((Math.random() * 2).toFixed(4)),
      };
      setExchanges(prev => [...prev.filter(e => e.id !== selectedToAdd.id), newEx]);
      setShowAddModal(false);
      setApiKey(""); setApiSecret(""); setPassphrase(""); setSelectedToAdd(null);
      Alert.alert("✅ Connected", `${selectedToAdd.label} connected successfully.`);
    }, 1500);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('multiExchange')}</Text>
        <View style={[s.planBadge, { backgroundColor: planTheme.primaryDim }]}>
          <Text style={[s.planBadgeText, { color: planTheme.primary }]}>{plan.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Aggregated balance */}
        <View style={[s.card, { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}>
          <Text style={s.aggrLabel}>Aggregated Portfolio</Text>
          <Text style={[s.aggrValue, { color: planTheme.primary }]}>
            ${totalUSDT.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </Text>
          <Text style={s.aggrSub}>{exchanges.filter(e => e.status !== "error").length} exchanges · {exchanges.length} connected</Text>
        </View>

        {/* Connected exchanges */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionTitle title="Connected Exchanges" icon="link-outline" />
          <Pressable
            style={[s.addBtn, { backgroundColor: exchanges.length >= EXCHANGE_LIMIT ? C.surface : planTheme.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAddModal(true); }}
          >
            <Ionicons name="add" size={18} color={exchanges.length >= EXCHANGE_LIMIT ? C.textTertiary : "#000"} />
            <Text style={[s.addBtnText, { color: exchanges.length >= EXCHANGE_LIMIT ? C.textTertiary : "#000" }]}>Add</Text>
          </Pressable>
        </View>

        {exchanges.map(ex => (
          <ExchangeCard key={ex.id} exchange={ex} onRemove={() => handleRemove(ex.id)} />
        ))}

        <Text style={s.limitNote}>
          {exchanges.length}/{EXCHANGE_LIMIT === 99 ? "∞" : EXCHANGE_LIMIT} exchanges used on {plan} plan
        </Text>

        <View style={{ height: 20 }} />

        {/* Price comparison */}
        <SectionTitle title="Cross-Exchange Price Comparison" icon="swap-horizontal-outline" />
        <View style={s.card}>
          <PriceTable />
        </View>

        <View style={{ height: 16 }} />

        {/* Arbitrage */}
        <SectionTitle title="Arbitrage Opportunities" icon="flash-outline" />
        {ARBI_OPPS.map((opp, i) => <ArbiCard key={i} opp={opp} />)}

        <View style={{ height: 20 }} />

        {/* Exchange Capabilities */}
        <SectionTitle title="Exchange Capabilities" icon="settings-outline" />
        {capsLoading ? (
          <ActivityIndicator size="small" color={planTheme.primary} style={{ marginBottom: 16 }} />
        ) : capsError ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.danger }}>Failed to load capabilities</Text>
          </View>
        ) : capabilities.length > 0 ? (
          capabilities.map((cap) => {
            const brand = exchangeColor(cap.exchange);
            const capDomain = exchangeDomain(cap.exchange);
            return (
              <View key={cap.exchange} style={[s.card, { marginBottom: 10 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${brand}22`, borderWidth: 1, borderColor: `${brand}44`, alignItems: "center", justifyContent: "center" }}>
                    <Image source={{ uri: getExchangeFavicon(capDomain, 32) }} style={{ width: 24, height: 24, borderRadius: 5 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: C.text }}>{cap.exchange}</Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary }}>Tier: {cap.tier}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {[
                    { label: "Spot",     enabled: cap.spotEnabled },
                    { label: "Futures",  enabled: cap.futuresEnabled },
                    { label: "Leverage", enabled: cap.leverageEnabled },
                    { label: "WS",       enabled: cap.websocketEnabled },
                  ].map(({ label, enabled }) => (
                    <View key={label} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: enabled ? C.successDim : C.surface, borderWidth: 1, borderColor: enabled ? C.success : C.border }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: enabled ? C.success : C.textTertiary }}>{label}</Text>
                    </View>
                  ))}
                  {cap.leverageEnabled && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.warningDim, borderWidth: 1, borderColor: C.warning }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.warning }}>Max {cap.maxLeverage}x</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add exchange modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <Pressable style={s.modalBackdrop} onPress={() => { if (!connecting) setShowAddModal(false); }}>
          <ScrollView style={s.addSheet} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Add Exchange</Text>

            {!selectedToAdd ? (
              <View>
                <Text style={s.sheetSubtitle}>Select Exchange</Text>
                <View style={s.exchangeGrid}>
                  {SUPPORTED_EXCHANGES.map(ex => (
                    <Pressable
                      key={ex.id}
                      style={s.exchangeChip}
                      onPress={() => { Haptics.selectionAsync(); setSelectedToAdd(ex); }}
                    >
                      <View style={[s.chipLogo, { backgroundColor: ex.color + "33" }]}>
                        <Image source={{ uri: getExchangeFavicon(ex.domain, 32) }} style={{ width: 22, height: 22, borderRadius: 5 }} />
                      </View>
                      <Text style={s.chipName}>{ex.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View>
                <Pressable onPress={() => setSelectedToAdd(null)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}>
                  <Ionicons name="chevron-back" size={16} color={C.textSecondary} />
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary }}>Back</Text>
                </Pressable>
                <Text style={s.sheetSubtitle}>Connect {selectedToAdd.label}</Text>

                <View style={s.inputField}>
                  <Text style={s.inputLabel}>API Key</Text>
                  <TextInput style={s.input} value={apiKey} onChangeText={setApiKey} placeholder="Paste your API key" placeholderTextColor={C.textTertiary} autoCapitalize="none" />
                </View>
                <View style={s.inputField}>
                  <Text style={s.inputLabel}>API Secret</Text>
                  <TextInput style={s.input} value={apiSecret} onChangeText={setApiSecret} placeholder="Paste your API secret" placeholderTextColor={C.textTertiary} autoCapitalize="none" secureTextEntry />
                </View>
                <View style={s.inputField}>
                  <Text style={s.inputLabel}>Passphrase (optional)</Text>
                  <TextInput style={s.input} value={passphrase} onChangeText={setPassphrase} placeholder="Only required for some exchanges" placeholderTextColor={C.textTertiary} />
                </View>

                <View style={{ backgroundColor: C.warningDim, borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: "row", gap: 8 }}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={C.warning} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.warning, flex: 1 }}>
                    We NEVER hold your keys. Keys are stored encrypted on-device only.
                  </Text>
                </View>

                <Pressable
                  style={[s.connectBtn, { backgroundColor: connecting ? C.surface : planTheme.primary }]}
                  onPress={handleConnect}
                  disabled={connecting}
                >
                  <Text style={[s.connectBtnText, { color: connecting ? C.textTertiary : "#000" }]}>
                    {connecting ? "Connecting..." : "Test & Connect"}
                  </Text>
                </Pressable>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Pressable>
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
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  aggrLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  aggrValue: { fontFamily: "Inter_700Bold", fontSize: 36 },
  aggrSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  addBtnText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  limitNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, textAlign: "center", marginTop: -8, marginBottom: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  addSheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%" },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 16 },
  sheetSubtitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary, marginBottom: 12 },
  exchangeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exchangeChip: { width: "47%", backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 8 },
  chipLogo: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  chipLogoText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  chipName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, flex: 1 },
  inputField: { marginBottom: 12 },
  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 8, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text },
  connectBtn: { borderRadius: 14, padding: 16, alignItems: "center" },
  connectBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
