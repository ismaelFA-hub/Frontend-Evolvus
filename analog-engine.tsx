import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

function fmt(n: number | null | undefined, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

interface Analog {
  timestamp: number;
  similarity: number;
  outcome24h: number;
  outcome72h: number;
  regime: string;
}

interface AnalogForecast {
  expectedReturn24h: number;
  expectedReturn72h: number;
  confidence: number;
  bullishProb: number;
  bearishProb: number;
}

interface AnalogResponse {
  symbol: string;
  analogs: Analog[];
  forecast: AnalogForecast;
}

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

export default function AnalogEngineScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const primary = planTheme.primary;

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [data, setData] = useState<AnalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", `/api/ai/analogs/${sym}`);
      setData(res as AnalogResponse);
      setSearched(true);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load("BTCUSDT"); }, [load]);

  const forecast = data?.forecast;
  const forecastSignal = !forecast ? "NEUTRAL"
    : (forecast.expectedReturn24h > 2) ? "BUY"
    : (forecast.expectedReturn24h < -2) ? "SELL"
    : "NEUTRAL";

  const signalColor = forecastSignal === "BUY" ? C.success : forecastSignal === "SELL" ? C.danger : C.warning;

  if (planType !== "premium" && planType !== "enterprise" && (planType as string) !== "admin") {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Ionicons name="lock-closed" size={56} color={C.textSecondary} />
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 16, marginBottom: 8 }}>
          Motor de Análogos
        </Text>
        <Text style={{ color: C.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Disponível a partir do plano Premium. Compare padrões históricos e projete retornos futuros.
        </Text>
        <Pressable
          onPress={() => router.push("/payment")}
          style={{ backgroundColor: planTheme.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Fazer Upgrade</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Analog Engine</Text>
          <Text style={s.sub}>Pattern matching histórico (LSH)</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Symbol selector */}
        <View style={s.symbolRow}>
          {SYMBOLS.map((sym) => (
            <Pressable
              key={sym}
              style={[s.symBtn, symbol === sym && { backgroundColor: primary }]}
              onPress={() => { setSymbol(sym); load(sym); }}
            >
              <Text style={[s.symText, symbol === sym && { color: "#000" }]}>{sym.replace("USDT", "")}</Text>
            </Pressable>
          ))}
        </View>

        {loading && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={primary} size="large" />
            <Text style={[s.emptyText, { marginTop: 12 }]}>Buscando padrões históricos...</Text>
          </View>
        )}

        {!loading && forecast && (
          <>
            {/* Forecast card */}
            <View style={[s.forecastCard, { borderColor: `${signalColor}50` }]}>
              <View style={s.forecastHeader}>
                <Text style={s.forecastTitle}>Previsão por Analogia</Text>
                <View style={[s.signalBadge, { backgroundColor: `${signalColor}20` }]}>
                  <Text style={[s.signalText, { color: signalColor }]}>{forecastSignal}</Text>
                </View>
              </View>
              <View style={s.forecastGrid}>
                {[
                  { label: "Retorno 24h", val: fmtPct(forecast.expectedReturn24h), color: forecast.expectedReturn24h >= 0 ? C.success : C.danger },
                  { label: "Retorno 72h", val: fmtPct(forecast.expectedReturn72h), color: forecast.expectedReturn72h >= 0 ? C.success : C.danger },
                  { label: "Bull Prob", val: `${fmt(forecast.bullishProb * 100, 0)}%`, color: C.success },
                  { label: "Bear Prob", val: `${fmt(forecast.bearishProb * 100, 0)}%`, color: C.danger },
                ].map(({ label, val, color }) => (
                  <View key={label} style={s.forecastItem}>
                    <Text style={[s.forecastVal, { color }]}>{val}</Text>
                    <Text style={s.forecastLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={s.confidenceRow}>
                <Text style={s.confLabel}>Confiança</Text>
                <View style={s.confTrack}>
                  <View style={[s.confBar, { width: `${forecast.confidence}%`, backgroundColor: primary }]} />
                </View>
                <Text style={[s.confPct, { color: primary }]}>{fmt(forecast.confidence, 0)}%</Text>
              </View>
            </View>

            {/* Analogs list */}
            {(data?.analogs ?? []).length > 0 && (
              <View style={[s.card, { borderColor: `${primary}30` }]}>
                <Text style={s.cardTitle}>Top Análogos Históricos</Text>
                {(data?.analogs ?? []).map((a, i) => (
                  <View key={i} style={s.analogRow}>
                    <View style={[s.simBadge, { backgroundColor: `${primary}20` }]}>
                      <Text style={[s.simPct, { color: primary }]}>{fmt(a.similarity * 100, 0)}%</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.analogDate}>{new Date(a.timestamp).toLocaleDateString("pt-BR")}</Text>
                      <Text style={s.analogRegime}>{a.regime ?? "Desconhecido"}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.analogOut, { color: a.outcome24h >= 0 ? C.success : C.danger }]}>{fmtPct(a.outcome24h)} 24h</Text>
                      <Text style={[s.analogOut, { color: a.outcome72h >= 0 ? C.success : C.danger }]}>{fmtPct(a.outcome72h)} 72h</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {(data?.analogs ?? []).length === 0 && (
              <View style={[s.card, { borderColor: `${primary}30`, alignItems: "center", paddingVertical: 24 }]}>
                <Ionicons name="time-outline" size={32} color={C.textSecondary} />
                <Text style={[s.emptyText, { marginTop: 8 }]}>Índice histórico ainda sendo construído</Text>
                <Text style={s.emptySub}>Dados de padrões serão populados com o tempo</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  content: { padding: 16, gap: 14 },
  symbolRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  symBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  symText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  forecastCard: { backgroundColor: "#111", borderWidth: 1, borderRadius: 16, padding: 16, gap: 14 },
  forecastHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  forecastTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  signalBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  signalText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  forecastGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  forecastItem: { width: "47%", alignItems: "center" },
  forecastVal: { fontFamily: "Inter_700Bold", fontSize: 20 },
  forecastLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  confidenceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  confLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, width: 60 },
  confTrack: { flex: 1, height: 6, backgroundColor: "#222", borderRadius: 3, overflow: "hidden" },
  confBar: { height: "100%", borderRadius: 3 },
  confPct: { fontFamily: "Inter_600SemiBold", fontSize: 12, width: 36, textAlign: "right" },
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  analogRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  simBadge: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  simPct: { fontFamily: "Inter_700Bold", fontSize: 14 },
  analogDate: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  analogRegime: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  analogOut: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
});
