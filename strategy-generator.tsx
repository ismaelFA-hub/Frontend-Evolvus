/**
 * Evolvus Core Quantum — Gerador de Estratégia por IA (Sprint 12)
 *
 * Pipeline:
 *   1. Input em linguagem natural
 *   2. Groq gera configuração de estratégia
 *   3. Backtest obrigatório sobre dados reais
 *   4. Aprovação/reprovação com métricas
 *   5. Deploy só disponível após aprovação
 *
 * Rota: /strategy-generator
 */

import { useState, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratedStrategyConfig {
  strategyType: string;
  symbol: string;
  interval: string;
  stopLossPercent: number;
  takeProfitPercent: number;
  brainScoreThreshold: number;
  positionSizePct: number;
  brainsToActivate: string[];
  estimatedWinRate: number;
  riskRewardRatio: number;
  rationale: string;
}

interface BacktestMetrics {
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  profitFactor?: number;
  totalReturn?: number;
}

interface BacktestResult {
  config: GeneratedStrategyConfig;
  approved: boolean;
  approvalReason: string;
  score: number;
  backtestId?: string;
  metrics?: BacktestMetrics;
  error?: string;
}

type Step = "input" | "preview" | "backtesting" | "result";

const EXAMPLE_PROMPTS = [
  "Estratégia agressiva para BTC que aproveita breakouts com alta alavancagem",
  "DCA conservador em ETH com proteção de capital e skim automático",
  "Scalping de curto prazo em SOL com stops apertados e entradas rápidas",
  "Estratégia de range para mercados laterais com grid evolutivo",
];

const INTERVAL_OPTIONS = ["15m", "1h", "4h", "1d"];
const SYMBOL_SUGGESTIONS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({ label, value, pass, unit = "" }: { label: string; value: number | string; pass?: boolean; unit?: string }) {
  const color = pass === undefined ? C.text : pass ? C.success : C.danger;
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricRight}>
        {pass !== undefined && (
          <Ionicons
            name={pass ? "checkmark-circle" : "close-circle"}
            size={14}
            color={color}
            style={{ marginRight: 4 }}
          />
        )}
        <Text style={[styles.metricValue, { color }]}>
          {typeof value === "number" ? `${(value * (unit === "%" ? 100 : 1)).toFixed(1)}${unit}` : value}
        </Text>
      </View>
    </View>
  );
}

// ─── Strategy Preview Card ────────────────────────────────────────────────────

function StrategyPreview({ config }: { config: GeneratedStrategyConfig }) {
  return (
    <View style={styles.previewCard}>
      <Text style={styles.previewTitle}>Estratégia Gerada</Text>

      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Tipo</Text>
        <Text style={styles.previewValue}>{config.strategyType}</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Símbolo</Text>
        <Text style={styles.previewValue}>{config.symbol} / {config.interval}</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Stop Loss</Text>
        <Text style={[styles.previewValue, { color: C.danger }]}>{config.stopLossPercent}%</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Take Profit</Text>
        <Text style={[styles.previewValue, { color: C.success }]}>{config.takeProfitPercent}%</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Threshold IA</Text>
        <Text style={styles.previewValue}>{config.brainScoreThreshold}/100</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>Tamanho posição</Text>
        <Text style={styles.previewValue}>{config.positionSizePct}% do capital</Text>
      </View>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>RR Estimado</Text>
        <Text style={[styles.previewValue, { color: C.primary }]}>1:{config.riskRewardRatio.toFixed(1)}</Text>
      </View>

      <View style={styles.rationaleBox}>
        <Text style={styles.rationaleLabel}>Raciocínio da IA</Text>
        <Text style={styles.rationaleText}>{config.rationale}</Text>
      </View>

      {config.brainsToActivate?.length > 0 && (
        <View style={styles.brainsBox}>
          <Text style={styles.brainsLabel}>Brains ativados</Text>
          <Text style={styles.brainsValue}>{config.brainsToActivate.join(", ")}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StrategyGeneratorScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("input");
  const [prompt, setPrompt] = useState("");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1h");
  const [generating, setGenerating] = useState(false);
  const [config, setConfig] = useState<GeneratedStrategyConfig | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert("Descreva a estratégia", "Digite um prompt para a IA.");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/ai/strategy/nl-generate", {
        prompt: prompt.trim(),
        symbol: symbol.toUpperCase(),
        interval,
      });
      const data = await res.json() as { config: GeneratedStrategyConfig };
      setConfig(data.config);
      setStep("preview");
    } catch {
      Alert.alert("Erro", "Não foi possível gerar a estratégia. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleBacktest = async () => {
    if (!config) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStep("backtesting");
    try {
      const res = await apiRequest("POST", "/api/ai/strategy/nl-backtest", { config });
      const data = await res.json() as BacktestResult;
      setBacktestResult(data);
      setStep("result");
      if (data.approved) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      Alert.alert("Erro", "Falha ao executar backtest.");
      setStep("preview");
    }
  };

  const handleReset = () => {
    setStep("input");
    setConfig(null);
    setBacktestResult(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Gerador de Estratégia</Text>
          <Text style={styles.subtitle}>IA + Backtest obrigatório</Text>
        </View>
      </View>

      {/* Progress steps */}
      <View style={styles.progressBar}>
        {(["input", "preview", "backtesting", "result"] as Step[]).map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View style={[
              styles.progressDot,
              { backgroundColor: step === s || (["preview","backtesting","result"].includes(step) && i <= ["input","preview","backtesting","result"].indexOf(step)) ? C.primary : C.border }
            ]} />
            {i < 3 && <View style={[styles.progressLine, { backgroundColor: ["preview","backtesting","result"].includes(step) && i < ["input","preview","backtesting","result"].indexOf(step) ? C.primary : C.border }]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}>

        {/* Step 1: Input */}
        {step === "input" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descreva sua estratégia</Text>
            <Text style={styles.sectionSub}>A IA interpretará seu pedido e criará uma configuração de trading completa.</Text>

            <TextInput
              ref={inputRef}
              style={styles.promptInput}
              placeholder="Ex: Estratégia agressiva para BTC com breakouts..."
              placeholderTextColor={C.textSecondary}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <Text style={styles.suggLabel}>Exemplos:</Text>
            {EXAMPLE_PROMPTS.map((ex) => (
              <Pressable key={ex} style={styles.exampleChip} onPress={() => setPrompt(ex)}>
                <Text style={styles.exampleText}>{ex}</Text>
              </Pressable>
            ))}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Símbolo</Text>
                <View style={styles.chipRow}>
                  {SYMBOL_SUGGESTIONS.map((s) => (
                    <Pressable key={s} style={[styles.chip, symbol === s && styles.chipActive]} onPress={() => setSymbol(s)}>
                      <Text style={[styles.chipText, symbol === s && { color: C.primary }]}>{s.replace("USDT", "")}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Intervalo</Text>
              <View style={styles.chipRow}>
                {INTERVAL_OPTIONS.map((iv) => (
                  <Pressable key={iv} style={[styles.chip, interval === iv && styles.chipActive]} onPress={() => setInterval(iv)}>
                    <Text style={[styles.chipText, interval === iv && { color: C.primary }]}>{iv}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.primaryBtn, generating && styles.btnDisabled]}
              onPress={() => void handleGenerate()}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Gerar com IA</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && config && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estratégia gerada</Text>
            <Text style={styles.sectionSub}>Revise os parâmetros antes do backtest obrigatório.</Text>

            <StrategyPreview config={config} />

            <View style={styles.guardRailBox}>
              <Ionicons name="shield-checkmark" size={16} color={C.warning} />
              <Text style={styles.guardRailText}>
                Guardrail obrigatório: o backtest precisa passar nos critérios de aprovação antes do deploy.
              </Text>
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => void handleBacktest()}>
              <Ionicons name="analytics" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Executar Backtest (30 dias)</Text>
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={handleReset}>
              <Text style={styles.secondaryBtnText}>Refazer prompt</Text>
            </Pressable>
          </View>
        )}

        {/* Step 3: Backtesting */}
        {step === "backtesting" && (
          <View style={[styles.section, styles.centeredSection]}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={styles.loadingTitle}>Executando backtest...</Text>
            <Text style={styles.loadingSubtitle}>Analisando 30 dias de dados reais para {config?.symbol}</Text>
          </View>
        )}

        {/* Step 4: Result */}
        {step === "result" && backtestResult && (
          <View style={styles.section}>
            <View style={[styles.resultBanner, { backgroundColor: backtestResult.approved ? "#15803d22" : "#7f1d1d22", borderColor: backtestResult.approved ? C.success : C.danger }]}>
              <Ionicons
                name={backtestResult.approved ? "checkmark-circle" : "close-circle"}
                size={32}
                color={backtestResult.approved ? C.success : C.danger}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.resultTitle, { color: backtestResult.approved ? C.success : C.danger }]}>
                  {backtestResult.approved ? "Estratégia APROVADA" : "Estratégia REPROVADA"}
                </Text>
                <Text style={styles.resultReason}>{backtestResult.approvalReason}</Text>
              </View>
            </View>

            {backtestResult.metrics && (
              <View style={styles.metricsCard}>
                <Text style={styles.metricsTitle}>Métricas do Backtest</Text>
                <MetricRow
                  label="Win Rate"
                  value={backtestResult.metrics.winRate}
                  unit="%"
                  pass={backtestResult.metrics.winRate >= 0.42}
                />
                <MetricRow
                  label="Max Drawdown"
                  value={backtestResult.metrics.maxDrawdown}
                  unit="%"
                  pass={backtestResult.metrics.maxDrawdown <= 0.28}
                />
                {backtestResult.metrics.sharpeRatio !== undefined && (
                  <MetricRow
                    label="Sharpe Ratio"
                    value={backtestResult.metrics.sharpeRatio}
                    pass={backtestResult.metrics.sharpeRatio >= 0.4}
                  />
                )}
                <MetricRow label="Total de Trades" value={backtestResult.metrics.totalTrades} />
                {backtestResult.metrics.profitFactor !== undefined && (
                  <MetricRow label="Profit Factor" value={backtestResult.metrics.profitFactor} />
                )}

                <View style={styles.scoreBar}>
                  <Text style={styles.scoreLabel}>Score: {backtestResult.score}/100</Text>
                  <View style={styles.scoreTrack}>
                    <View style={[styles.scoreFill, { width: `${backtestResult.score}%`, backgroundColor: backtestResult.approved ? C.success : C.danger }]} />
                  </View>
                </View>
              </View>
            )}

            {backtestResult.approved ? (
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: C.success }]}
                onPress={() => {
                  Alert.alert("Deploy", "Integração com bots em desenvolvimento. Em breve disponível.");
                }}
              >
                <Ionicons name="rocket" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Fazer Deploy do Bot</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={handleReset}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Tentar novamente</Text>
              </Pressable>
            )}

            <Pressable style={styles.secondaryBtn} onPress={handleReset}>
              <Text style={styles.secondaryBtnText}>Nova estratégia</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "700", color: C.text },
  subtitle: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  progressItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  progressLine: { flex: 1, height: 2 },
  scroll: { padding: 16 },
  section: { gap: 12 },
  centeredSection: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  sectionSub: { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  promptInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    color: C.text,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  suggLabel: { fontSize: 12, color: C.textSecondary },
  exampleChip: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  exampleText: { fontSize: 12, color: C.textSecondary },
  row: { flexDirection: "row", gap: 12 },
  fieldLabel: { fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipActive: { borderColor: C.primary, backgroundColor: C.primary + "22" },
  chipText: { fontSize: 12, color: C.textSecondary },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryBtnText: { color: C.textSecondary, fontSize: 13 },
  previewCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  previewTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewLabel: { fontSize: 13, color: C.textSecondary },
  previewValue: { fontSize: 13, color: C.text, fontWeight: "600" },
  rationaleBox: { backgroundColor: "#ffffff08", borderRadius: 8, padding: 10, marginTop: 4 },
  rationaleLabel: { fontSize: 10, color: C.textSecondary, marginBottom: 4 },
  rationaleText: { fontSize: 12, color: C.text, lineHeight: 18 },
  brainsBox: { gap: 4 },
  brainsLabel: { fontSize: 10, color: C.textSecondary },
  brainsValue: { fontSize: 11, color: C.primary },
  guardRailBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#f59e0b11",
    borderRadius: 10,
    alignItems: "flex-start",
  },
  guardRailText: { flex: 1, fontSize: 12, color: C.warning, lineHeight: 17 },
  loadingTitle: { fontSize: 18, fontWeight: "700", color: C.text, marginTop: 20 },
  loadingSubtitle: { fontSize: 13, color: C.textSecondary, textAlign: "center" },
  resultBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  resultTitle: { fontSize: 17, fontWeight: "700" },
  resultReason: { fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 17 },
  metricsCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
  },
  metricsTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 4 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricLabel: { fontSize: 13, color: C.textSecondary },
  metricRight: { flexDirection: "row", alignItems: "center" },
  metricValue: { fontSize: 13, fontWeight: "700" },
  scoreBar: { marginTop: 8 },
  scoreLabel: { fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  scoreTrack: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 3 },
});
