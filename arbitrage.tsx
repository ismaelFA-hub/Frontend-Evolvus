/**
 * Evolvus Core Quantum — Arbitrage Scanner
 *
 * Detecta oportunidades de arbitragem em tempo real:
 * - Cross-Exchange: mesmo par, preços diferentes entre exchanges
 * - Triangular: ciclo de 3 moedas dentro de uma única exchange
 *
 * Rotas: POST /api/arbitrage/scan/cross       — arbitragem cross-exchange
 *        POST /api/arbitrage/scan/triangular  — arbitragem triangular
 */

import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────

interface CrossOpportunity {
  type: "cross-exchange";
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyAskPrice: number;
  sellBidPrice: number;
  grossSpreadPct: number;
  estimatedNetPct: number;
  capitalRequired: number;
  estimatedProfit: number;
  quantity: number;
  viable: boolean;
  timestamp: number;
}

interface TriangularOpportunity {
  type: "triangular";
  exchange: string;
  path: string[];
  cyclePnlPct: number;
  estimatedNetPct: number;
  capitalRequired: number;
  estimatedProfit: number;
  viable: boolean;
  timestamp: number;
}

type AnyOpportunity = CrossOpportunity | TriangularOpportunity;

interface ArbitragePrice {
  exchange: string;
  symbol: string;
  bid: number;
  ask: number;
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number, decimals = 4) {
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function pnlColor(v: number) {
  if (v > 0.2) return C.success;
  if (v > 0) return "#8BC34A";
  return C.danger;
}

// ─── Opportunity Card ─────────────────────────────────────────────────

function CrossCard({ opp }: { opp: CrossOpportunity }) {
  const { primary } = usePlanTheme();
  return (
    <View style={[card.container, { borderColor: opp.viable ? `${C.success}40` : `${C.danger}30` }]}>
      <View style={card.header}>
        <Text style={card.symbol}>{opp.symbol}</Text>
        <View style={[card.badge, { backgroundColor: opp.viable ? `${C.success}22` : `${C.danger}22` }]}>
          <Text style={[card.badgeText, { color: opp.viable ? C.success : C.danger }]}>
            {opp.viable ? "VIÁVEL" : "NÃO VIÁVEL"}
          </Text>
        </View>
      </View>
      <View style={card.path}>
        <Text style={card.exchange}>{opp.buyExchange}</Text>
        <Ionicons name="arrow-forward" size={14} color={primary} />
        <Text style={card.exchange}>{opp.sellExchange}</Text>
      </View>
      <View style={card.row}>
        <View style={card.stat}>
          <Text style={[card.statVal, { color: pnlColor(opp.grossSpreadPct) }]}>{fmt(opp.grossSpreadPct, 3)}%</Text>
          <Text style={card.statLbl}>Spread Bruto</Text>
        </View>
        <View style={card.stat}>
          <Text style={[card.statVal, { color: pnlColor(opp.estimatedNetPct) }]}>{fmt(opp.estimatedNetPct, 3)}%</Text>
          <Text style={card.statLbl}>Líquido Est.</Text>
        </View>
        <View style={card.stat}>
          <Text style={[card.statVal, { color: C.success }]}>${fmt(opp.estimatedProfit)}</Text>
          <Text style={card.statLbl}>Lucro Est.</Text>
        </View>
        <View style={card.stat}>
          <Text style={card.statVal}>${fmt(opp.capitalRequired, 0)}</Text>
          <Text style={card.statLbl}>Capital</Text>
        </View>
      </View>
      <Text style={card.meta}>
        Compra a ${fmt(opp.buyAskPrice, 2)} · Venda a ${fmt(opp.sellBidPrice, 2)} · {fmt(opp.quantity, 6)} unid.
      </Text>
    </View>
  );
}

function TriangularCard({ opp }: { opp: TriangularOpportunity }) {
  return (
    <View style={[card.container, { borderColor: opp.viable ? `${C.success}40` : `${C.danger}30` }]}>
      <View style={card.header}>
        <Text style={card.symbol}>{opp.path.join(" → ")}</Text>
        <View style={[card.badge, { backgroundColor: opp.viable ? `${C.success}22` : `${C.danger}22` }]}>
          <Text style={[card.badgeText, { color: opp.viable ? C.success : C.danger }]}>
            {opp.viable ? "VIÁVEL" : "NÃO VIÁVEL"}
          </Text>
        </View>
      </View>
      <Text style={card.exchange}>{opp.exchange}</Text>
      <View style={card.row}>
        <View style={card.stat}>
          <Text style={[card.statVal, { color: pnlColor(opp.cyclePnlPct) }]}>{fmt(opp.cyclePnlPct, 3)}%</Text>
          <Text style={card.statLbl}>PnL Ciclo</Text>
        </View>
        <View style={card.stat}>
          <Text style={[card.statVal, { color: pnlColor(opp.estimatedNetPct) }]}>{fmt(opp.estimatedNetPct, 3)}%</Text>
          <Text style={card.statLbl}>Líquido Est.</Text>
        </View>
        <View style={card.stat}>
          <Text style={[card.statVal, { color: C.success }]}>${fmt(opp.estimatedProfit)}</Text>
          <Text style={card.statLbl}>Lucro Est.</Text>
        </View>
        <View style={card.stat}>
          <Text style={card.statVal}>${fmt(opp.capitalRequired, 0)}</Text>
          <Text style={card.statLbl}>Capital</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function ArbitrageScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary } = usePlanTheme();
  const [mode, setMode] = useState<"cross" | "triangular">("cross");
  const [opportunities, setOpportunities] = useState<AnyOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Cross-exchange fields
  const [crossSymbol, setCrossSymbol] = useState("BTCUSDT");
  const [crossCapital, setCrossCapital] = useState("5000");
  const [crossFee, setCrossFee] = useState("0.1");

  // Triangular fields
  const [triExchange, setTriExchange] = useState("binance");
  const [triCapital, setTriCapital] = useState("5000");
  const [triFee, setTriFee] = useState("0.1");

  const scan = useCallback(async () => {
    setLoading(true);
    setOpportunities([]);
    try {
      if (mode === "cross") {
        // Demo price snapshot — in production these are fetched from connected exchanges
        const prices: ArbitragePrice[] = [
          { exchange: "binance", symbol: crossSymbol, bid: 97000, ask: 97010, timestamp: Date.now() },
          { exchange: "bybit",   symbol: crossSymbol, bid: 97250, ask: 97260, timestamp: Date.now() },
          { exchange: "okx",     symbol: crossSymbol, bid: 97100, ask: 97115, timestamp: Date.now() },
        ];
        const data = await apiRequest<CrossOpportunity[]>("POST", "/api/arbitrage/scan/cross", {
          symbol: crossSymbol,
          prices,
          quantity: parseFloat(crossCapital) / 97000,
          takerFeePercent: parseFloat(crossFee) / 100,
          withdrawalFeePercent: 0.001,
        });
        setOpportunities(Array.isArray(data) ? data : []);
      } else {
        // Demo quotes snapshot — in production these are fetched from connected exchange order books
        const data = await apiRequest<TriangularOpportunity[]>("POST", "/api/arbitrage/scan/triangular", {
          exchange: triExchange,
          quotes: {
            BTCUSDT: { bid: 97000, ask: 97010 },
            ETHUSDT: { bid: 3300,  ask: 3302  },
            ETHBTC:  { bid: 0.034, ask: 0.03402 },
          },
          capitalUsdt: parseFloat(triCapital),
          takerFeePercent: parseFloat(triFee) / 100,
        });
        setOpportunities(Array.isArray(data) ? data : []);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setOpportunities([]);
    } finally {
      setLoading(false);
      setScanned(true);
    }
  }, [mode, crossSymbol, crossCapital, crossFee, triExchange, triCapital, triFee]);

  const viable = opportunities.filter(o => o.viable);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('arbitrage')}</Text>
          <Text style={s.sub}>Detecta spreads entre exchanges e ciclos triangulares</Text>
        </View>
        <Pressable
          style={[s.backBtn, { borderWidth: 1, borderColor: `${primary}30`, borderRadius: 8, padding: 6 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/arbitrage-predictive"); }}
        >
          <Ionicons name="flash-outline" size={18} color={primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Mode selector */}
        <View style={[s.tabRow, { borderColor: `${primary}30` }]}>
          {(["cross", "triangular"] as const).map(m => (
            <Pressable
              key={m}
              style={[s.tab, mode === m && { backgroundColor: primary }]}
              onPress={() => { setMode(m); setScanned(false); setOpportunities([]); }}
            >
              <Text style={[s.tabText, mode === m && { color: "#000" }]}>
                {m === "cross" ? "Cross-Exchange" : "Triangular"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Config */}
        <View style={[s.form, { borderColor: `${primary}30` }]}>
          {mode === "cross" ? (
            <>
              <Text style={s.formTitle}>Configuração Cross-Exchange</Text>
              <Text style={s.label}>Par (ex: BTCUSDT)</Text>
              <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={crossSymbol} onChangeText={t => setCrossSymbol(t.toUpperCase())} autoCapitalize="characters" placeholderTextColor={C.textSecondary} />
              <View style={s.row}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={s.label}>Capital (USDT)</Text>
                  <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={crossCapital} onChangeText={setCrossCapital} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={s.label}>Taxa Taker (%)</Text>
                  <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={crossFee} onChangeText={setCrossFee} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={s.formTitle}>Configuração Triangular</Text>
              <Text style={s.label}>Exchange</Text>
              <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={triExchange} onChangeText={setTriExchange} autoCapitalize="none" placeholderTextColor={C.textSecondary} />
              <View style={s.row}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={s.label}>Capital (USDT)</Text>
                  <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={triCapital} onChangeText={setTriCapital} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={s.label}>Taxa Taker (%)</Text>
                  <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={triFee} onChangeText={setTriFee} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
                </View>
              </View>
            </>
          )}
          <Pressable
            style={[s.scanBtn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
            onPress={scan}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" size="small" />
              : (
                <>
                  <Ionicons name="search" size={16} color="#000" />
                  <Text style={s.scanBtnText}>Escanear</Text>
                </>
              )}
          </Pressable>
        </View>

        {/* Results */}
        {scanned && !loading && (
          <View style={s.results}>
            <View style={s.resultsHeader}>
              <Text style={s.resultsTitle}>
                {opportunities.length} oportunidade(s) encontrada(s)
              </Text>
              {viable.length > 0 && (
                <Text style={[s.viableCount, { color: C.success }]}>
                  {viable.length} viável(is)
                </Text>
              )}
            </View>
            {opportunities.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="swap-horizontal-outline" size={40} color={C.textSecondary} />
                <Text style={s.emptyText}>Nenhuma oportunidade encontrada</Text>
                <Text style={[s.emptySub, { color: C.textSecondary }]}>
                  Os spreads são insuficientes para cobrir as taxas neste momento.
                </Text>
              </View>
            ) : (
              opportunities.map((opp, i) => (
                opp.type === "cross-exchange"
                  ? <CrossCard key={i} opp={opp as CrossOpportunity} />
                  : <TriangularCard key={i} opp={opp as TriangularOpportunity} />
              ))
            )}
          </View>
        )}

        {!scanned && !loading && (
          <View style={s.hint}>
            <Ionicons name="information-circle-outline" size={20} color={C.textSecondary} />
            <Text style={[s.hintText, { color: C.textSecondary }]}>
              Configure os parâmetros acima e clique em Escanear para detectar oportunidades de arbitragem em tempo real.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  content: { padding: 16, gap: 14 },
  tabRow: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  form: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  row: { flexDirection: "row" },
  scanBtn: { borderRadius: 10, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 4 },
  scanBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  results: { gap: 10 },
  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  viableCount: { fontFamily: "Inter_700Bold", fontSize: 13 },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 16 },
  hintText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
});

const card = StyleSheet.create({
  container: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symbol: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  path: { flexDirection: "row", alignItems: "center", gap: 6 },
  exchange: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  row: { flexDirection: "row", justifyContent: "space-between" },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
});
