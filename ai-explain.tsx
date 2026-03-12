/**
 * Evolvus Core Quantum — AI Explainability (Layer 7)
 *
 * Executa o pipeline completo de análise de IA para qualquer par e
 * apresenta uma explicação em linguagem natural do sinal gerado:
 * - Sinal final (BUY/SELL/NEUTRAL) e pontuação de consciência
 * - Regime de mercado detectado pelo ML
 * - Resumo dos 35 cérebros (bullish/bearish/neutros)
 * - Top cérebros por peso adaptativo
 * - Explicação Layer 7 em linguagem natural (via LLM)
 *
 * Rota: GET /api/ai/explain/:symbol?interval=1h&limit=100
 */

import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, TextInput, Alert,
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

interface BrainSummary {
  total: number;
  bullish: number;
  bearish: number;
  neutral: number;
}

interface TopBrain {
  brainId: string;
  weight: number;
  signal: string;
  confidence: number;
}

interface ExplanationResult {
  symbol: string;
  interval: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  finalScore: number;
  regime: {
    regime: string;
    trend: string;
    volatility: string;
    strength: number;
    description: string;
  };
  brainSummary: BrainSummary;
  adaptiveWeightsUsed: boolean;
  explanation: {
    summary: string;
    rationale: string;
    risks: string;
    recommendation: string;
    generatedBy?: string;
  };
}

// ─── Feedback Section ────────────────────────────────────────────────

function FeedbackSection({ result }: { result: ExplanationResult }) {
  const { planTheme } = usePlanTheme();
  const { primary } = planTheme;
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const sendFeedback = async (type: "positive" | "negative") => {
    setLoading(true);
    try {
      await apiRequest("POST", "/api/ai/brain/weights/feedback", {
        symbol: result.symbol,
        interval: result.interval,
        feedback: type,
        signal: result.signal,
      });
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sucesso", "Feedback enviado! Os cérebros aprenderão com isso.");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao enviar feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[fb.container, { borderColor: `${primary}20` }]}>
      <Text style={fb.title}>Feedback para os Cérebros</Text>
      <Text style={fb.sub}>Sinal foi útil? Isso ajuda a calibrar os pesos adaptativos.</Text>
      
      <View style={fb.row}>
        <Pressable
          style={[
            fb.btn,
            { borderColor: C.successDim, backgroundColor: `${C.success}10` },
            (loading || submitted) && { opacity: 0.5 }
          ]}
          onPress={() => sendFeedback("positive")}
          disabled={loading || submitted}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.success} />
          ) : (
            <>
              <Ionicons name="thumbs-up" size={16} color={C.success} />
              <Text style={[fb.btnText, { color: C.success }]}>Bom sinal</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[
            fb.btn,
            { borderColor: C.dangerDim, backgroundColor: `${C.danger}10` },
            (loading || submitted) && { opacity: 0.5 }
          ]}
          onPress={() => sendFeedback("negative")}
          disabled={loading || submitted}
        >
          {loading ? (
            <ActivityIndicator size="small" color={C.danger} />
          ) : (
            <>
              <Ionicons name="thumbs-down" size={16} color={C.danger} />
              <Text style={[fb.btnText, { color: C.danger }]}>Sinal ruim</Text>
            </>
          )}
        </Pressable>
      </View>
      
      {submitted && (
        <Text style={fb.thanks}>Obrigado pelo feedback!</Text>
      )}
    </View>
  );
}

const fb = StyleSheet.create({
  container: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10, marginTop: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  row: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  thanks: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.success, textAlign: "center", marginTop: 4 },
});

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, d = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function signalColor(sig: string): string {
  if (sig === "BUY") return C.success;
  if (sig === "SELL") return C.danger;
  return C.textSecondary;
}

function signalIcon(sig: string): "trending-up-outline" | "trending-down-outline" | "remove-outline" {
  if (sig === "BUY") return "trending-up-outline";
  if (sig === "SELL") return "trending-down-outline";
  return "remove-outline";
}

function regimeColor(r: string): string {
  if (r === "BULLISH") return C.success;
  if (r === "BEARISH") return C.danger;
  if (r === "VOLATILE") return C.warning;
  return C.textSecondary;
}

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"];

// ─── Brain Breakdown ──────────────────────────────────────────────────

function BrainBreakdown({ summary }: { summary: BrainSummary }) {
  const { planTheme } = usePlanTheme();
  const { primary } = planTheme;
  const total = summary.total || 1;
  const bullPct = (summary.bullish / total) * 100;
  const bearPct = (summary.bearish / total) * 100;
  const neutPct = (summary.neutral / total) * 100;

  return (
    <View style={[bb.container, { borderColor: `${primary}20` }]}>
      <Text style={bb.title}>Consenso dos {summary.total} cérebros</Text>
      <View style={bb.barRow}>
        <View style={[bb.seg, { width: `${bullPct}%`, backgroundColor: C.success }]} />
        <View style={[bb.seg, { width: `${neutPct}%`, backgroundColor: C.textSecondary }]} />
        <View style={[bb.seg, { width: `${bearPct}%`, backgroundColor: C.danger }]} />
      </View>
      <View style={bb.legend}>
        <View style={bb.legendItem}>
          <View style={[bb.dot, { backgroundColor: C.success }]} />
          <Text style={bb.legendText}>Alta ({summary.bullish})</Text>
        </View>
        <View style={bb.legendItem}>
          <View style={[bb.dot, { backgroundColor: C.textSecondary }]} />
          <Text style={bb.legendText}>Neutro ({summary.neutral})</Text>
        </View>
        <View style={bb.legendItem}>
          <View style={[bb.dot, { backgroundColor: C.danger }]} />
          <Text style={bb.legendText}>Baixa ({summary.bearish})</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Explanation Section ──────────────────────────────────────────────

function ExplanationBlock({ result }: { result: ExplanationResult }) {
  const { planTheme } = usePlanTheme();
  const { primary } = planTheme;
  const { explanation } = result;
  const sColor = signalColor(result.signal);

  return (
    <View style={[exp.container, { borderColor: `${sColor}30` }]}>
      <View style={exp.header}>
        <Ionicons name="sparkles-outline" size={18} color={primary} />
        <Text style={[exp.headerText, { color: primary }]}>
          Explicação Layer 7 {explanation.generatedBy ? `· ${explanation.generatedBy}` : ""}
        </Text>
      </View>

      {explanation.summary && (
        <View style={exp.block}>
          <Text style={exp.blockTitle}>📋 Resumo</Text>
          <Text style={exp.blockBody}>{explanation.summary}</Text>
        </View>
      )}
      {explanation.rationale && (
        <View style={exp.block}>
          <Text style={exp.blockTitle}>🧠 Raciocínio</Text>
          <Text style={exp.blockBody}>{explanation.rationale}</Text>
        </View>
      )}
      {explanation.risks && (
        <View style={exp.block}>
          <Text style={exp.blockTitle}>⚠️ Riscos</Text>
          <Text style={exp.blockBody}>{explanation.risks}</Text>
        </View>
      )}
      {explanation.recommendation && (
        <View style={[exp.recBox, { borderColor: `${sColor}40` }]}>
          <Text style={[exp.recTitle, { color: sColor }]}>💡 Recomendação</Text>
          <Text style={exp.blockBody}>{explanation.recommendation}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function AIExplainScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { primary } = planTheme;
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeInterval, setTimeInterval] = useState("1h");
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      const res = await apiRequest(
        "GET",
        `/api/ai/explain/${symbol.toUpperCase()}?interval=${timeInterval}&limit=100`,
      );
      const data = await res.json() as ExplanationResult;
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message ?? "Falha na análise de IA.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }, [symbol, timeInterval]);

  const sColor = result ? signalColor(result.signal) : primary;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('aiExplain')}</Text>
          <Text style={s.sub}>Pipeline completo: 35 cérebros + regime + explicação LLM</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Config */}
        <View style={[s.form, { borderColor: `${primary}30` }]}>
          <Text style={s.formTitle}>Análise</Text>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={s.label}>Par</Text>
              <TextInput
                style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
                value={symbol}
                onChangeText={t => setSymbol(t.toUpperCase())}
                autoCapitalize="characters"
                placeholderTextColor={C.textSecondary}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={s.label}>Intervalo</Text>
              <View style={s.intervalRow}>
                {INTERVALS.map(iv => (
                  <Pressable
                    key={iv}
                    style={[s.ivBtn, timeInterval === iv && { backgroundColor: primary }]}
                    onPress={() => setTimeInterval(iv)}
                  >
                    <Text style={[s.ivText, timeInterval === iv && { color: "#000" }]}>{iv}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={[s.warnBox, { borderColor: `${C.warning}40` }]}>
            <Ionicons name="time-outline" size={13} color={C.warning} />
            <Text style={[s.warnText, { color: C.warning }]}>
              A análise completa inclui 35 cérebros + LLM e pode levar 15-30 segundos.
            </Text>
          </View>
          <Pressable
            style={[s.analyzeBtn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
            onPress={analyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#000" size="small" />
                <Text style={s.analyzeBtnText}>Analisando… {elapsed}s</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={16} color="#000" />
                <Text style={s.analyzeBtnText}>Analisar com IA</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Error */}
        {error && (
          <View style={[s.errorBox, { borderColor: `${C.danger}40` }]}>
            <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
            <Text style={[s.errorText, { color: C.danger }]}>{error}</Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <>
            {/* Signal card */}
            <View style={[s.signalCard, { borderColor: `${sColor}50` }]}>
              <Ionicons name={signalIcon(result.signal)} size={36} color={sColor} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.signalText, { color: sColor }]}>{result.signal}</Text>
                <Text style={s.signalSub}>
                  {result.symbol} · {result.interval} · Score {fmt(result.finalScore, 1)}
                </Text>
              </View>
              <View style={s.confBox}>
                <Text style={[s.confVal, { color: primary }]}>{fmt(result.confidence, 0)}%</Text>
                <Text style={s.confLbl}>Confiança</Text>
              </View>
            </View>

            {/* Regime + adaptive weights row */}
            <View style={s.infoRow}>
              <View style={[s.infoCard, { borderColor: `${regimeColor(result.regime.regime)}30` }]}>
                <Text style={[s.infoVal, { color: regimeColor(result.regime.regime) }]}>
                  {result.regime.regime}
                </Text>
                <Text style={s.infoLbl}>Regime</Text>
              </View>
              <View style={[s.infoCard, { borderColor: `${primary}20` }]}>
                <Text style={[s.infoVal, { color: primary }]}>
                  {result.regime.trend}
                </Text>
                <Text style={s.infoLbl}>Tendência</Text>
              </View>
              <View style={[s.infoCard, { borderColor: `${primary}20` }]}>
                <Ionicons
                  name={result.adaptiveWeightsUsed ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={result.adaptiveWeightsUsed ? C.success : C.textSecondary}
                />
                <Text style={s.infoLbl}>Pesos adapt.</Text>
              </View>
            </View>

            {/* Brain breakdown */}
            <BrainBreakdown summary={result.brainSummary} />

            {/* Explanation */}
            <ExplanationBlock result={result} />

            {/* Feedback */}
            <FeedbackSection result={result} />
          </>
        )}

        {!loading && !result && !error && (
          <View style={s.hint}>
            <Ionicons name="sparkles-outline" size={48} color={C.textSecondary} />
            <Text style={s.hintTitle}>Pronto para analisar</Text>
            <Text style={[s.hintSub, { color: C.textSecondary }]}>
              Selecione um par e clique em Analisar para obter uma explicação completa do sinal de IA em linguagem natural.
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
  form: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  row: { flexDirection: "row" },
  intervalRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  ivBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#1a1a1a" },
  ivText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary },
  warnBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderWidth: 1, borderRadius: 8, padding: 8 },
  warnText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  analyzeBtn: { borderRadius: 10, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 4 },
  analyzeBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  errorText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13 },
  signalCard: { backgroundColor: "#111", borderWidth: 2, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center" },
  signalText: { fontFamily: "Inter_700Bold", fontSize: 28 },
  signalSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  confBox: { alignItems: "center" },
  confVal: { fontFamily: "Inter_700Bold", fontSize: 22 },
  confLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2 },
  infoRow: { flexDirection: "row", gap: 8 },
  infoCard: { flex: 1, backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4 },
  infoVal: { fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "center" },
  infoLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, textAlign: "center" },
  hint: { alignItems: "center", paddingVertical: 48, gap: 8 },
  hintTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  hintSub: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
});

const bb = StyleSheet.create({
  container: { backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  barRow: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#222" },
  seg: { height: "100%" },
  legend: { flexDirection: "row", justifyContent: "space-around" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
});

const exp = StyleSheet.create({
  container: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  block: { gap: 4 },
  blockTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  blockBody: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  recBox: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  recTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
