import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { getExchangeById } from "@/lib/exchanges";

const C = Colors.dark;

const POPULAR_PAIRS = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "DOGE/USDT"];

interface ApiKey {
  id: string;
  exchange: string;
  label: string;
}

interface RouteAllocation {
  exchange: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface SorResult {
  bestRoutes: RouteAllocation[];
  averagePrice: number;
  totalCost: number;
  estimatedFees: number;
  savings: number;
  savingsPercent: number;
}

function simulateQuotes(exchanges: string[], symbol: string, basePrice: number) {
  return exchanges.map((exchange) => {
    const spread = (Math.random() * 0.004 - 0.002);
    const latency = Math.floor(Math.random() * 80) + 10;
    const price = basePrice * (1 + spread);
    return {
      exchange,
      symbol: symbol.replace("/", ""),
      ask: Number((price * 1.0002).toFixed(2)),
      bid: Number((price * 0.9998).toFixed(2)),
      availableVolume: Number((Math.random() * 50 + 5).toFixed(4)),
      latencyMs: latency,
    };
  });
}

export default function SmartOrderScreen() {
  const insets = useSafeAreaInsets();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [pair, setPair] = useState("BTC/USDT");
  const [quantity, setQuantity] = useState("0.1");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<SorResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const loadKeys = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/security/api-keys");
      const data = await res.json();
      setApiKeys(data.apiKeys || []);
    } catch {
      setApiKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const connectedExchanges = [...new Set(apiKeys.map((k) => k.exchange))];

  const handleSimulate = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSimulating(true);
    setResult(null);
    setExecuted(false);

    try {
      const basePrices: Record<string, number> = {
        "BTC/USDT": 249500, "ETH/USDT": 3850, "BNB/USDT": 420,
        "SOL/USDT": 185, "XRP/USDT": 0.58, "DOGE/USDT": 0.12,
      };
      const basePrice = basePrices[pair] || 100;
      const quotes = simulateQuotes(connectedExchanges, pair, basePrice);

      const res = await apiRequest("POST", "/api/trading/smart-order", {
        symbol: pair.replace("/", ""),
        side,
        quantity: qty,
        quotes,
      });

      const data = await res.json();

      const routes: RouteAllocation[] = (data.allocations || []).map((a: { exchange: string; quantity: number; price: number }) => ({
        exchange: a.exchange,
        quantity: a.quantity,
        price: a.price,
        subtotal: a.quantity * a.price,
      }));

      const totalCost = routes.reduce((s, r) => s + r.subtotal, 0);
      const avgPrice = qty > 0 ? totalCost / qty : 0;
      const fees = totalCost * 0.001;
      const marketPrice = basePrice * qty;
      const savings = Math.abs(marketPrice - totalCost);
      const savingsPercent = marketPrice > 0 ? (savings / marketPrice) * 100 : 0;

      setResult({ bestRoutes: routes, averagePrice: avgPrice, totalCost, estimatedFees: fees, savings, savingsPercent });
    } catch {
      setResult(null);
    } finally {
      setSimulating(false);
    }
  };

  const handleExecute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setExecuting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setExecuting(false);
    setExecuted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (loadingKeys) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>🧠 Roteador Inteligente (SOR)</Text>
          <Text style={s.subtitle}>Smart Order Routing</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {connectedExchanges.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="warning-outline" size={40} color={C.warning} />
            <Text style={s.emptyTitle}>⚠️ Nenhuma exchange conectada</Text>
            <Text style={s.emptyText}>
              Conecte pelo menos uma exchange para usar o Roteador Inteligente.
            </Text>
            <Pressable
              style={s.goToExchangeBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/exchange-center" as any); }}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
              <Text style={s.goToExchangeBtnText}>🔌 IR PARA CENTRAL DE EXCHANGES</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.infoCard}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={s.infoText}>
                Exchanges ativas: <Text style={{ color: C.success, fontFamily: "Inter_700Bold" }}>{connectedExchanges.length}</Text>
                {" — "}{connectedExchanges.map((e) => getExchangeById(e)?.label || e).join(", ")}
              </Text>
            </View>

            <View style={s.formCard}>
              <Text style={s.formTitle}>Configurar Ordem</Text>

              <View style={s.field}>
                <Text style={s.fieldLabel}>Par</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.pairRow}>
                    {POPULAR_PAIRS.map((p) => (
                      <Pressable
                        key={p} style={[s.pairChip, pair === p && s.pairChipActive]}
                        onPress={() => { Haptics.selectionAsync(); setPair(p); setResult(null); }}
                      >
                        <Text style={[s.pairChipText, pair === p && s.pairChipTextActive]}>{p}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={s.field}>
                <Text style={s.fieldLabel}>Quantidade</Text>
                <TextInput
                  style={s.input}
                  value={quantity}
                  onChangeText={(v) => { setQuantity(v); setResult(null); }}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 0.5"
                  placeholderTextColor={C.textTertiary}
                />
              </View>

              <View style={s.field}>
                <Text style={s.fieldLabel}>Tipo</Text>
                <View style={s.sideRow}>
                  <Pressable style={[s.sideBtn, side === "BUY" && s.sideBtnBuy]} onPress={() => { setSide("BUY"); setResult(null); }}>
                    <Text style={[s.sideBtnText, side === "BUY" && { color: "#fff" }]}>COMPRAR</Text>
                  </Pressable>
                  <Pressable style={[s.sideBtn, side === "SELL" && s.sideBtnSell]} onPress={() => { setSide("SELL"); setResult(null); }}>
                    <Text style={[s.sideBtnText, side === "SELL" && { color: "#fff" }]}>VENDER</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable style={[s.simulateBtn, simulating && s.simulateBtnDisabled]} onPress={handleSimulate} disabled={simulating}>
                {simulating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="search" size={18} color="#fff" />
                    <Text style={s.simulateBtnText}>🔍 SIMULAR MELHOR ROTA</Text>
                  </>
                )}
              </Pressable>
            </View>

            {result && (
              <View style={s.resultCard}>
                <Text style={s.resultTitle}>📊 RESULTADO DA SIMULAÇÃO</Text>
                <Text style={s.resultSubtitle}>Melhor rota encontrada:</Text>

                {result.bestRoutes.map((r, i) => (
                  <View key={i} style={s.routeRow}>
                    <View style={s.routeDot} />
                    <Text style={s.routeText}>
                      <Text style={{ color: C.text, fontFamily: "Inter_600SemiBold" }}>
                        {r.quantity.toFixed(4)} {pair.split("/")[0]}
                      </Text>
                      {" na "}
                      <Text style={{ color: C.primary, fontFamily: "Inter_600SemiBold" }}>
                        {getExchangeById(r.exchange)?.label || r.exchange}
                      </Text>
                      {" a R$ "}
                      <Text style={{ color: C.text }}>{r.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                    </Text>
                  </View>
                ))}

                <View style={s.divider} />

                <View style={s.statRow}>
                  <Text style={s.statLabel}>Preço médio final</Text>
                  <Text style={s.statValue}>R$ {result.averagePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>Custo total estimado</Text>
                  <Text style={s.statValue}>R$ {result.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>Economia vs. mercado</Text>
                  <Text style={[s.statValue, { color: C.success }]}>
                    R$ {result.savings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({result.savingsPercent.toFixed(2)}%)
                  </Text>
                </View>
                <View style={s.statRow}>
                  <Text style={s.statLabel}>Taxas estimadas</Text>
                  <Text style={[s.statValue, { color: C.warning }]}>R$ {result.estimatedFees.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</Text>
                </View>

                {!executed ? (
                  <Pressable style={[s.executeBtn, executing && s.executeBtnDisabled]} onPress={handleExecute} disabled={executing}>
                    {executing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={s.executeBtnText}>✅ EXECUTAR ORDEM INTELIGENTE</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <View style={s.successBanner}>
                    <Ionicons name="checkmark-circle" size={20} color={C.success} />
                    <Text style={s.successText}>Ordem enviada com sucesso!</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  scroll: { paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  emptyCard: { alignItems: "center", gap: 16, backgroundColor: C.card, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.warning },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center" },
  goToExchangeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  goToExchangeBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  infoCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0A1F14", borderRadius: 12, padding: 12 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1 },
  formCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, gap: 16, borderWidth: 1, borderColor: C.border },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  field: { gap: 8 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  pairRow: { flexDirection: "row", gap: 8 },
  pairChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1A2035", borderWidth: 1, borderColor: C.border },
  pairChipActive: { backgroundColor: C.primaryDim, borderColor: C.primary },
  pairChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  pairChipTextActive: { color: C.primary },
  input: { backgroundColor: "#0D1120", borderRadius: 10, padding: 14, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border },
  sideRow: { flexDirection: "row", gap: 12 },
  sideBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#1A2035", borderWidth: 1, borderColor: C.border, alignItems: "center" },
  sideBtnBuy: { backgroundColor: C.success, borderColor: C.success },
  sideBtnSell: { backgroundColor: C.danger, borderColor: C.danger },
  sideBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.textSecondary },
  simulateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  simulateBtnDisabled: { opacity: 0.6 },
  simulateBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  resultCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, gap: 12, borderWidth: 1, borderColor: C.border },
  resultTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  resultSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  routeText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1 },
  divider: { height: 1, backgroundColor: C.border },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  statValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  executeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.success, borderRadius: 14, paddingVertical: 16 },
  executeBtnDisabled: { opacity: 0.6 },
  executeBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0A1F14", borderRadius: 12, padding: 14 },
  successText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.success },
});
