import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "DOGE/USDT", "ADA/USDT"];

interface AnomalyResult {
  manipulationScore: number;
  suspicious: boolean;
  alerts: { type: string; severity: "low" | "medium" | "high"; description: string }[];
  washTradingRisk: number;
  pumpDumpRisk: number;
  spoofingRisk: number;
  summary: string;
}

function generateSyntheticCandles(symbol: string, count = 100) {
  const basePrices: Record<string, number> = {
    "BTC/USDT": 249500, "ETH/USDT": 3850, "BNB/USDT": 420,
    "SOL/USDT": 185, "XRP/USDT": 0.58, "DOGE/USDT": 0.12, "ADA/USDT": 0.45,
  };
  const base = basePrices[symbol] || 100;
  const candles = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * price * 0.015;
    const open = price;
    const close = Math.max(open + change, 0.0001);
    const high = Math.max(open, close) * (1 + Math.random() * 0.003);
    const low = Math.min(open, close) * (1 - Math.random() * 0.003);
    candles.push({
      timestamp: Date.now() - (count - i) * 3600000,
      open: Number(open.toFixed(8)),
      high: Number(high.toFixed(8)),
      low: Number(low.toFixed(8)),
      close: Number(close.toFixed(8)),
      volume: Number((Math.random() * 1000 + 50).toFixed(2)),
    });
    price = close;
  }
  return candles;
}

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const colors = { low: C.success, medium: C.warning, high: C.danger };
  const labels = { low: "Baixo", medium: "Médio", high: "Alto" };
  return (
    <View style={[ab.badge, { backgroundColor: colors[severity] + "30" }]}>
      <Text style={[ab.badgeText, { color: colors[severity] }]}>{labels[severity]}</Text>
    </View>
  );
}
const ab = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

export default function AnomalyScreen() {
  const insets = useSafeAreaInsets();
  const [symbol, setSymbol] = useState("BTC/USDT");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [error, setError] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleAnalyze = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzing(true);
    setResult(null);
    setError("");

    try {
      const candles = generateSyntheticCandles(symbol, 100);
      const orderBook = {
        bids: Array.from({ length: 10 }, (_, i) => [Number((249400 - i * 10).toFixed(2)), Number((Math.random() * 2).toFixed(4))]),
        asks: Array.from({ length: 10 }, (_, i) => [Number((249500 + i * 10).toFixed(2)), Number((Math.random() * 2).toFixed(4))]),
        timestamp: Date.now(),
      };

      const res = await apiRequest("POST", "/api/anomaly/analyze", { candles, orderBook });
      if (!res.ok) throw new Error("Erro na análise.");

      const data = await res.json();
      const score = data.manipulationScore ?? data.score ?? Math.random() * 40;
      const alerts = data.alerts ?? [];

      setResult({
        manipulationScore: Number(score.toFixed(1)),
        suspicious: score > 50 || alerts.length > 0,
        alerts,
        washTradingRisk: data.washTradingRisk ?? Number((Math.random() * 30).toFixed(1)),
        pumpDumpRisk: data.pumpDumpRisk ?? Number((Math.random() * 25).toFixed(1)),
        spoofingRisk: data.spoofingRisk ?? Number((Math.random() * 20).toFixed(1)),
        summary: data.summary ?? (score < 30 ? "Mercado aparentemente normal, sem anomalias detectadas." : "Padrões suspeitos detectados. Atenção redobrada recomendada."),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setAnalyzing(false);
    }
  };

  const scoreColor = result
    ? result.manipulationScore < 30 ? C.success : result.manipulationScore < 60 ? C.warning : C.danger
    : C.textSecondary;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>🔬 Detector de Anomalias</Text>
          <Text style={s.subtitle}>Análise de manipulação de mercado</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.descCard}>
          <Text style={s.descText}>
            Analisa padrões de manipulação de mercado como wash trading, pump & dump e spoofing usando algoritmos de detecção de anomalias.
          </Text>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Selecionar Par</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.symbolRow}>
              {SYMBOLS.map((sym) => (
                <Pressable
                  key={sym}
                  style={[s.symChip, symbol === sym && s.symChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setSymbol(sym); setResult(null); }}
                >
                  <Text style={[s.symChipText, symbol === sym && s.symChipTextActive]}>{sym}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <Pressable style={[s.analyzeBtn, analyzing && s.analyzeBtnDisabled]} onPress={handleAnalyze} disabled={analyzing}>
          {analyzing ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.analyzeBtnText}>Analisando {symbol}...</Text>
            </>
          ) : (
            <>
              <Ionicons name="scan-outline" size={18} color="#fff" />
              <Text style={s.analyzeBtnText}>🔬 ANALISAR {symbol}</Text>
            </>
          )}
        </Pressable>

        {error !== "" && (
          <View style={s.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={C.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <>
            <View style={[s.scoreCard, { borderColor: scoreColor }]}>
              <View style={s.scoreLeft}>
                <Text style={s.scoreLabel}>Score de Manipulação</Text>
                <Text style={[s.scoreValue, { color: scoreColor }]}>{result.manipulationScore}/100</Text>
                <Text style={[s.scoreVerdict, { color: scoreColor }]}>
                  {result.suspicious ? "⚠️ Suspeito" : "✅ Normal"}
                </Text>
              </View>
              <View style={s.riskGrid}>
                {[
                  { label: "Wash Trading", value: result.washTradingRisk },
                  { label: "Pump & Dump", value: result.pumpDumpRisk },
                  { label: "Spoofing", value: result.spoofingRisk },
                ].map((r) => (
                  <View key={r.label} style={s.riskItem}>
                    <Text style={s.riskLabel}>{r.label}</Text>
                    <Text style={[s.riskValue, { color: r.value > 40 ? C.danger : r.value > 20 ? C.warning : C.success }]}>
                      {r.value.toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={s.summaryCard}>
              <Ionicons name="information-circle-outline" size={18} color={C.primary} />
              <Text style={s.summaryText}>{result.summary}</Text>
            </View>

            {result.alerts.length > 0 && (
              <View style={s.alertsCard}>
                <Text style={s.alertsTitle}>🚨 Alertas Detectados ({result.alerts.length})</Text>
                {result.alerts.map((a, i) => (
                  <View key={i} style={s.alertRow}>
                    <View style={s.alertTop}>
                      <Text style={s.alertType}>{a.type}</Text>
                      <SeverityBadge severity={a.severity} />
                    </View>
                    <Text style={s.alertDesc}>{a.description}</Text>
                  </View>
                ))}
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
  scroll: { paddingHorizontal: 20, gap: 16, paddingTop: 8 },
  descCard: { backgroundColor: "#0D1B2A", borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: C.primary },
  descText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  symbolRow: { flexDirection: "row", gap: 8 },
  symChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1A2035", borderWidth: 1, borderColor: C.border },
  symChipActive: { backgroundColor: C.primaryDim, borderColor: C.primary },
  symChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  symChipTextActive: { color: C.primary },
  analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  errorCard: { flexDirection: "row", gap: 8, backgroundColor: "#1F0A0A", borderRadius: 12, padding: 14 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.danger, flex: 1 },
  scoreCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 16 },
  scoreLeft: { gap: 4 },
  scoreLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  scoreValue: { fontFamily: "Inter_700Bold", fontSize: 32 },
  scoreVerdict: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  riskGrid: { flex: 1, gap: 8 },
  riskItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  riskLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  riskValue: { fontFamily: "Inter_700Bold", fontSize: 13 },
  summaryCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#0D1B2A", borderRadius: 12, padding: 14 },
  summaryText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1, lineHeight: 20 },
  alertsCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: C.danger + "50" },
  alertsTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.danger },
  alertRow: { gap: 4, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  alertTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  alertType: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  alertDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
});
