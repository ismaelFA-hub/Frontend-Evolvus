/**
 * Arbitragem Preditiva — IA de Spread
 *
 * Prevê spreads entre exchanges, analisa funding rate arbitrage e detecta
 * manipulação de mercado. DIFERENTE de arbitrage.tsx que escaneia spreads.
 *
 * Rotas: GET  /api/arbitrage-predictive/status              — status
 *        POST /api/arbitrage-predictive/analyze             — analisar
 *        POST /api/arbitrage-predictive/predict-spread      — prever spread
 *        POST /api/arbitrage-predictive/funding-rate        — funding rate arb
 *        POST /api/arbitrage-predictive/manipulation-guard  — anti-manipulação
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────

interface ArbStatus {
  status: string;
  activePairs: number;
  totalOpportunities: number;
  avgSpread: number;
}

interface ArbAnalysis {
  opportunity: boolean;
  expectedSpread: number;
  confidence: number;
}

interface SpreadPrediction {
  predictedSpread: number;
  confidence: number;
  direction: "increasing" | "decreasing" | "stable";
}

interface FundingRateArb {
  arbitrageOpportunity: boolean;
  expectedReturn: number;
  risk: string;
}

interface ManipulationGuard {
  manipulationDetected: boolean;
  confidence: number;
  signals: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function confColor(c: number) {
  if (c >= 0.7) return C.success;
  if (c >= 0.4) return C.warning;
  return C.danger;
}

function dirIcon(d: string): any {
  if (d === "increasing") return "trending-up";
  if (d === "decreasing") return "trending-down";
  return "remove";
}

function fmt(n: number, d = 4) {
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function SectionHeader({ icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <View style={sh.row}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={sh.title}>{title}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function ArbitragePredictiveScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary, primaryDim } = usePlanTheme();

  const [status, setStatus] = useState<ArbStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analysis, setAnalysis] = useState<ArbAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [spreadPred, setSpreadPred] = useState<SpreadPrediction | null>(null);
  const [loadingSpread, setLoadingSpread] = useState(false);

  const [fundingArb, setFundingArb] = useState<FundingRateArb | null>(null);
  const [loadingFunding, setLoadingFunding] = useState(false);

  const [manipulation, setManipulation] = useState<ManipulationGuard | null>(null);
  const [loadingManip, setLoadingManip] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/arbitrage-predictive/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadStatus(); }, [loadStatus]);

  async function runAnalysis() {
    setLoadingAnalysis(true);
    try {
      const res = await apiRequest("POST", "/api/arbitrage-predictive/analyze", {
        symbol: "BTCUSDT",
        exchanges: ["binance", "bybit"],
        candles: [],
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na análise.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function predictSpread() {
    setLoadingSpread(true);
    try {
      const res = await apiRequest("POST", "/api/arbitrage-predictive/predict-spread", {
        symbol: "BTCUSDT",
        exchange1: "binance",
        exchange2: "bybit",
        historicalSpreads: [],
      });
      const data = await res.json();
      setSpreadPred(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na previsão de spread.");
    } finally {
      setLoadingSpread(false);
    }
  }

  async function analyzeFunding() {
    setLoadingFunding(true);
    try {
      const res = await apiRequest("POST", "/api/arbitrage-predictive/funding-rate", {
        symbol: "BTCUSDT",
        currentFundingRate: 0.01,
      });
      const data = await res.json();
      setFundingArb(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao analisar funding rate.");
    } finally {
      setLoadingFunding(false);
    }
  }

  async function checkManipulation() {
    setLoadingManip(true);
    try {
      const res = await apiRequest("POST", "/api/arbitrage-predictive/manipulation-guard", {
        symbol: "BTCUSDT",
        priceHistory: [],
        volumeHistory: [],
      });
      const data = await res.json();
      setManipulation(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na detecção de manipulação.");
    } finally {
      setLoadingManip(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('arbitragePredictive')}</Text>
          <Text style={s.sub}>IA de Spread</Text>
        </View>
        <View style={[s.badge, { backgroundColor: primaryDim, borderColor: `${primary}40` }]}>
          <Ionicons name="git-compare" size={14} color={primary} />
          <Text style={[s.badgeText, { color: primary }]}>PRED</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* ── Status ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="pulse-outline" title="Status" color={primary} />
          {loadingStatus ? (
            <ActivityIndicator color={primary} />
          ) : status ? (
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: status.status === "active" ? C.success : C.warning }]}>
                  {status.status?.toUpperCase() ?? "—"}
                </Text>
                <Text style={s.statLbl}>Status</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.activePairs ?? 0}</Text>
                <Text style={s.statLbl}>Pares</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.success }]}>{fmt(status.avgSpread ?? 0)}%</Text>
                <Text style={s.statLbl}>Spread Médio</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>Sem dados</Text>
          )}
        </View>

        {/* ── Analisar ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="search-outline" title="Analisar (BTC · Binance vs Bybit)" color={primary} />
          <Text style={s.cardDesc}>Detecta oportunidade de arbitragem preditiva entre exchanges.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={runAnalysis} disabled={loadingAnalysis}>
            {loadingAnalysis ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Analisar</Text>}
          </Pressable>
          {analysis && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Oportunidade</Text>
                <View style={[s.pill, { backgroundColor: analysis.opportunity ? `${C.success}25` : `${C.danger}25` }]}>
                  <Ionicons
                    name={analysis.opportunity ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={analysis.opportunity ? C.success : C.danger}
                  />
                  <Text style={[s.pillText, { color: analysis.opportunity ? C.success : C.danger }]}>
                    {analysis.opportunity ? "DETECTADA" : "NÃO DETECTADA"}
                  </Text>
                </View>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Spread Esperado</Text>
                <Text style={[s.resultVal, { color: primary }]}>{fmt(analysis.expectedSpread)}%</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: confColor(analysis.confidence) }]}>
                  {(analysis.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Prever Spread ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="telescope-outline" title="Prever Spread Futuro" color={primary} />
          <Text style={s.cardDesc}>Prevê o spread BTC entre Binance e Bybit com base em histórico.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={predictSpread} disabled={loadingSpread}>
            {loadingSpread ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Prever Spread</Text>}
          </Pressable>
          {spreadPred && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Spread Previsto</Text>
                <Text style={[s.resultVal, { color: primary }]}>{fmt(spreadPred.predictedSpread)}%</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Direção</Text>
                <View style={s.dirRow}>
                  <Ionicons
                    name={dirIcon(spreadPred.direction)}
                    size={14}
                    color={spreadPred.direction === "increasing" ? C.success : spreadPred.direction === "decreasing" ? C.danger : C.textSecondary}
                  />
                  <Text style={[s.resultVal, { color: spreadPred.direction === "increasing" ? C.success : spreadPred.direction === "decreasing" ? C.danger : C.textSecondary }]}>
                    {spreadPred.direction?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: confColor(spreadPred.confidence) }]}>
                  {(spreadPred.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Funding Rate Arb ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="cash-outline" title="Funding Rate Arbitrage" color={primary} />
          <Text style={s.cardDesc}>Analisa oportunidade de arbitragem via funding rate de 0.01%.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={analyzeFunding} disabled={loadingFunding}>
            {loadingFunding ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Analisar Funding</Text>}
          </Pressable>
          {fundingArb && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Oportunidade</Text>
                <View style={[s.pill, { backgroundColor: fundingArb.arbitrageOpportunity ? `${C.success}25` : `${C.danger}25` }]}>
                  <Ionicons
                    name={fundingArb.arbitrageOpportunity ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={fundingArb.arbitrageOpportunity ? C.success : C.danger}
                  />
                  <Text style={[s.pillText, { color: fundingArb.arbitrageOpportunity ? C.success : C.danger }]}>
                    {fundingArb.arbitrageOpportunity ? "SIM" : "NÃO"}
                  </Text>
                </View>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Retorno Esperado</Text>
                <Text style={[s.resultVal, { color: C.success }]}>{fmt(fundingArb.expectedReturn)}%</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Risco</Text>
                <Text style={[s.resultVal, { color: fundingArb.risk === "LOW" ? C.success : fundingArb.risk === "MEDIUM" ? C.warning : C.danger }]}>
                  {fundingArb.risk?.toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Anti-Manipulação ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="eye-outline" title="Anti-Manipulação" color={primary} />
          <Text style={s.cardDesc}>Detecta sinais de manipulação de preço no BTCUSDT.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={checkManipulation} disabled={loadingManip}>
            {loadingManip ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Verificar Manipulação</Text>}
          </Pressable>
          {manipulation && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Manipulação</Text>
                <View style={[s.pill, { backgroundColor: manipulation.manipulationDetected ? `${C.danger}25` : `${C.success}25` }]}>
                  <Ionicons
                    name={manipulation.manipulationDetected ? "warning" : "shield-checkmark"}
                    size={14}
                    color={manipulation.manipulationDetected ? C.danger : C.success}
                  />
                  <Text style={[s.pillText, { color: manipulation.manipulationDetected ? C.danger : C.success }]}>
                    {manipulation.manipulationDetected ? "DETECTADA" : "LIMPO"}
                  </Text>
                </View>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: confColor(manipulation.confidence) }]}>
                  {(manipulation.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              {manipulation.signals?.length > 0 && (
                <View style={{ gap: 4, marginTop: 4 }}>
                  <Text style={s.signalsLabel}>Sinais Detectados</Text>
                  {manipulation.signals.map((sig, i) => (
                    <View key={i} style={s.signalRow}>
                      <Ionicons name="alert-circle-outline" size={12} color={C.warning} />
                      <Text style={s.signalText}>{sig}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
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
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  statsGrid: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statVal: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center", paddingVertical: 8 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  resultBox: { borderRadius: 10, padding: 12, gap: 6 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultLbl: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  resultVal: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  dirRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  signalsLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  signalRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  signalText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.warning, flex: 1 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
});
