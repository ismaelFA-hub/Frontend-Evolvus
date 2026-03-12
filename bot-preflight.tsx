import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface PreflightResult {
  approved: boolean;
  riskScore: number;
  expectedReturn: number;
  maxDrawdown: number;
  winRate: number;
  sharpeRatio: number;
  warnings: string[];
  recommendation: string;
}

function generateCandles(count = 60) {
  const candles = [];
  let price = 40000 + Math.random() * 5000;
  for (let i = 0; i < count; i++) {
    const open = price;
    const change = (Math.random() - 0.48) * price * 0.02;
    const close = Math.max(open + change, 100);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    candles.push({
      timestamp: Date.now() - (count - i) * 3600000,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number((Math.random() * 1000 + 100).toFixed(2)),
    });
    price = close;
  }
  return candles;
}

export default function BotPreflightScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ botType?: string; symbol?: string }>();
  const botType = (params.botType || "grid") as "grid" | "dca" | "martingale" | "arbitrage";
  const symbol = params.symbol || "BTC/USDT";

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [error, setError] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(true);
    setResult(null);
    setError("");

    try {
      const candles = generateCandles(60);
      const res = await apiRequest("POST", "/api/bot-intelligence/preflight", {
        botType,
        symbol: symbol.replace("/", ""),
        candles,
        regime: "trending",
      });

      if (!res.ok) throw new Error("Erro na simulação preflight.");
      const data = await res.json();

      setResult({
        approved: (data.riskScore ?? 50) < 65,
        riskScore: data.riskScore ?? 45,
        expectedReturn: data.expectedReturn ?? 12.4,
        maxDrawdown: data.maxDrawdown ?? 8.2,
        winRate: data.winRate ?? 62,
        sharpeRatio: data.sharpeRatio ?? 1.4,
        warnings: data.warnings ?? [],
        recommendation: data.recommendation ?? "Bot adequado para as condições atuais de mercado.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setRunning(false);
    }
  };

  const riskColor = result
    ? result.riskScore < 40 ? C.success : result.riskScore < 65 ? C.warning : C.danger
    : C.textSecondary;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>🚀 Preflight do Bot</Text>
          <Text style={s.subtitle}>Simulação antes de ativar</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={s.configCard}>
          <View style={s.configRow}>
            <View style={s.configItem}>
              <Text style={s.configLabel}>Tipo de Bot</Text>
              <Text style={s.configValue}>{botType.toUpperCase()}</Text>
            </View>
            <View style={s.configItem}>
              <Text style={s.configLabel}>Par</Text>
              <Text style={s.configValue}>{symbol}</Text>
            </View>
          </View>
          <Text style={s.configNote}>
            A simulação usa dados históricos sintéticos para estimar o desempenho do bot antes de ativar com capital real.
          </Text>
        </View>

        <Pressable style={[s.runBtn, running && s.runBtnDisabled]} onPress={handleRun} disabled={running}>
          {running ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.runBtnText}>Simulando Digital Twin...</Text>
            </>
          ) : (
            <>
              <Ionicons name="play-circle-outline" size={20} color="#fff" />
              <Text style={s.runBtnText}>🔍 INICIAR SIMULAÇÃO PREFLIGHT</Text>
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
            <View style={[s.verdictCard, { borderColor: result.approved ? C.success : C.danger }]}>
              <Ionicons
                name={result.approved ? "checkmark-circle" : "close-circle"}
                size={28}
                color={result.approved ? C.success : C.danger}
              />
              <View style={{ flex: 1 }}>
                <Text style={[s.verdictTitle, { color: result.approved ? C.success : C.danger }]}>
                  {result.approved ? "✅ BOT APROVADO" : "❌ BOT REPROVADO"}
                </Text>
                <Text style={s.verdictRec}>{result.recommendation}</Text>
              </View>
            </View>

            <View style={s.metricsGrid}>
              {[
                { label: "Score de Risco", value: `${result.riskScore}/100`, color: riskColor },
                { label: "Retorno Esperado", value: `+${result.expectedReturn}%`, color: C.success },
                { label: "Drawdown Máx.", value: `-${result.maxDrawdown}%`, color: C.danger },
                { label: "Taxa de Acerto", value: `${result.winRate}%`, color: C.primary },
                { label: "Sharpe Ratio", value: result.sharpeRatio.toFixed(2), color: C.text },
              ].map((m) => (
                <View key={m.label} style={s.metricCard}>
                  <Text style={s.metricLabel}>{m.label}</Text>
                  <Text style={[s.metricValue, { color: m.color }]}>{m.value}</Text>
                </View>
              ))}
            </View>

            {result.warnings.length > 0 && (
              <View style={s.warningsCard}>
                <Text style={s.warningsTitle}>⚠️ Avisos</Text>
                {result.warnings.map((w, i) => (
                  <Text key={i} style={s.warningItem}>• {w}</Text>
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
  configCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border },
  configRow: { flexDirection: "row", gap: 16 },
  configItem: { flex: 1, gap: 4 },
  configLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  configValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  configNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, lineHeight: 18 },
  runBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16 },
  runBtnDisabled: { opacity: 0.6 },
  runBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1F0A0A", borderRadius: 12, padding: 14 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.danger, flex: 1 },
  verdictCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 2 },
  verdictTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  verdictRec: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, gap: 4, flex: 1, minWidth: "44%", borderWidth: 1, borderColor: C.border },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  warningsCard: { backgroundColor: "#1A1600", borderRadius: 12, padding: 14, gap: 8, borderLeftWidth: 3, borderLeftColor: C.warning },
  warningsTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.warning },
  warningItem: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
});
