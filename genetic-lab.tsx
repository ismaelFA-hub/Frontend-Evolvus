/**
 * Evolvus Core Quantum — Laboratório Genético de Estratégias
 *
 * Aplica algoritmo genético para evoluir estratégias de trading ao longo
 * de múltiplas gerações, retornando o campeão com maior score backtestado.
 *
 * Rotas: POST /api/ai/strategy/evolve  — iniciar evolução genética
 *        GET  /api/ai/brain/weights    — pesos atuais dos 35 cérebros
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

interface GeneParams {
  brainScoreThreshold: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  positionSizePercent: number;
}

interface BacktestMetrics {
  totalTrades: number;
  winRate: number;
  netPnlPercent: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  profitFactor: number;
}

interface Champion extends GeneParams {
  id: string;
  generation: number;
  origin: "seed" | "crossover" | "mutation";
  backtestId: string;
  score: number;
  metrics: BacktestMetrics;
}

interface GenerationSummary {
  generation: number;
  best: number;
  avg: number;
  worst: number;
  champion: string;
}

interface GeneticResult {
  symbol: string;
  generations: number;
  populationSize: number;
  champion: Champion;
  history: GenerationSummary[];
  totalBacktests: number;
  elapsedMs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function scoreColor(s: number) {
  if (s >= 70) return C.success;
  if (s >= 50) return C.warning;
  return C.danger;
}

function originIcon(o: string): "leaf" | "git-merge" | "shuffle" {
  if (o === "seed") return "leaf";
  if (o === "crossover") return "git-merge";
  return "shuffle";
}

// ─── Champion Card ────────────────────────────────────────────────────

function ChampionCard({ champion, symbol }: { champion: Champion; symbol: string }) {
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;
  const m = champion.metrics;
  return (
    <View style={[ch.container, { borderColor: `${primary}40` }]}>
      <View style={ch.crown}>
        <Ionicons name="trophy" size={20} color="#FFD700" />
        <Text style={ch.title}>Campeão — Geração {champion.generation}</Text>
        <View style={[ch.originBadge, { backgroundColor: `${primary}22` }]}>
          <Ionicons name={originIcon(champion.origin)} size={12} color={primary} />
          <Text style={[ch.originText, { color: primary }]}>{champion.origin}</Text>
        </View>
      </View>

      {/* Score */}
      <View style={ch.scoreRow}>
        <Text style={[ch.score, { color: scoreColor(champion.score) }]}>
          {fmt(champion.score, 1)}
        </Text>
        <Text style={ch.scoreLabel}>Score</Text>
      </View>

      {/* Genes */}
      <Text style={ch.sectionTitle}>Genes Otimizados</Text>
      <View style={ch.grid}>
        {[
          { label: "Brain Threshold", val: `${fmt(champion.brainScoreThreshold, 0)}` },
          { label: "Stop Loss", val: `${fmt(champion.stopLossPercent, 1)}%` },
          { label: "Take Profit", val: `${fmt(champion.takeProfitPercent, 1)}%` },
          { label: "Tamanho Posição", val: `${fmt(champion.positionSizePercent, 0)}%` },
        ].map(({ label, val }) => (
          <View key={label} style={ch.gene}>
            <Text style={[ch.geneVal, { color: primary }]}>{val}</Text>
            <Text style={ch.geneLbl}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Backtest metrics */}
      <Text style={ch.sectionTitle}>Métricas de Backtest</Text>
      <View style={ch.grid}>
        {[
          { label: "Trades", val: `${m?.totalTrades ?? "—"}` },
          { label: "Win Rate", val: m?.winRate != null ? `${fmt(m.winRate, 1)}%` : "—", color: m?.winRate >= 55 ? C.success : C.danger },
          { label: "PnL Líquido", val: m?.netPnlPercent != null ? `${m.netPnlPercent >= 0 ? "+" : ""}${fmt(m.netPnlPercent, 1)}%` : "—", color: m?.netPnlPercent >= 0 ? C.success : C.danger },
          { label: "Max Drawdown", val: m?.maxDrawdownPercent != null ? `${fmt(m.maxDrawdownPercent, 1)}%` : "—", color: C.danger },
          { label: "Sharpe", val: m?.sharpeRatio != null ? fmt(m.sharpeRatio, 2) : "—", color: m?.sharpeRatio >= 1 ? C.success : C.warning },
          { label: "Profit Factor", val: m?.profitFactor != null ? fmt(m.profitFactor, 2) : "—", color: m?.profitFactor >= 1.5 ? C.success : C.warning },
        ].map(({ label, val, color }) => (
          <View key={label} style={ch.gene}>
            <Text style={[ch.geneVal, color ? { color } : {}]}>{val}</Text>
            <Text style={ch.geneLbl}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Evolution Chart ──────────────────────────────────────────────────

function EvolutionChart({ history }: { history: GenerationSummary[] }) {
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;
  if (!history?.length) return null;
  const maxScore = Math.max(...history.map(h => h.best), 1);

  return (
    <View style={[evo.container, { borderColor: `${primary}30` }]}>
      <Text style={evo.title}>Evolução por Geração</Text>
      {history.map((gen, i) => {
        const bestPct = (gen.best / maxScore) * 100;
        const avgPct = (gen.avg / maxScore) * 100;
        return (
          <View key={i} style={evo.row}>
            <Text style={evo.gen}>G{gen.generation}</Text>
            <View style={evo.bars}>
              <View style={evo.barTrack}>
                <View style={[evo.bar, { width: `${bestPct}%`, backgroundColor: C.success }]} />
              </View>
              <View style={evo.barTrack}>
                <View style={[evo.bar, { width: `${avgPct}%`, backgroundColor: primary }]} />
              </View>
            </View>
            <View style={evo.vals}>
              <Text style={[evo.val, { color: C.success }]}>{fmt(gen.best, 1)}</Text>
              <Text style={[evo.val, { color: primary }]}>{fmt(gen.avg, 1)}</Text>
            </View>
          </View>
        );
      })}
      <View style={evo.legend}>
        <View style={[evo.dot, { backgroundColor: C.success }]} />
        <Text style={evo.legendText}>Best</Text>
        <View style={[evo.dot, { backgroundColor: primary }]} />
        <Text style={evo.legendText}>Avg</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function GeneticLabScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const primary = planTheme.primary;
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [tfInterval, setTfInterval] = useState("1h");
  const [popSize, setPopSize] = useState("6");
  const [generations, setGenerations] = useState("3");
  const [result, setResult] = useState<GeneticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const evolve = useCallback(async () => {
    setLoading(true);
    setResult(null);
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    try {
      const data = await apiRequest("POST", "/api/ai/genetic/evolve", {
        symbol,
        interval: tfInterval,
        populationSize: Math.min(parseInt(popSize, 10) || 6, 10),
        generations: Math.min(parseInt(generations, 10) || 3, 5),
      });
      setResult(data as GeneticResult);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setResult(null);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }, [symbol, tfInterval, popSize, generations]);

  if (planType !== "enterprise" && (planType as string) !== "admin") {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Ionicons name="lock-closed" size={56} color={C.textSecondary} />
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 16, marginBottom: 8 }}>
          Laboratório Genético
        </Text>
        <Text style={{ color: C.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Evolua estratégias com algoritmos genéticos de múltiplas gerações.{"\n"}Disponível exclusivamente no plano Enterprise.
        </Text>
        <Pressable
          onPress={() => router.push("/payment")}
          style={{ backgroundColor: primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Fazer Upgrade</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('geneticLab')}</Text>
          <Text style={s.sub}>Evolução autônoma de estratégias via algoritmo genético</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Info */}
        <View style={[s.info, { borderColor: `${primary}30` }]}>
          <Ionicons name="git-network-outline" size={16} color={primary} />
          <Text style={[s.infoText, { color: C.textSecondary }]}>
            O algoritmo genético cria uma população de estratégias, avalia cada uma com um backtest real, mantém as melhores e cria novas gerações por cruzamento e mutação até encontrar o campeão ótimo.
          </Text>
        </View>

        {/* Config form */}
        <View style={[s.form, { borderColor: `${primary}30` }]}>
          <Text style={s.formTitle}>Configuração da Evolução</Text>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={s.label}>Par</Text>
              <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={symbol} onChangeText={t => setSymbol(t.toUpperCase())} autoCapitalize="characters" placeholderTextColor={C.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={s.label}>Intervalo</Text>
              <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={interval} onChangeText={setInterval} autoCapitalize="none" placeholderTextColor={C.textSecondary} />
            </View>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={s.label}>Pop. Inicial (máx 10)</Text>
              <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={popSize} onChangeText={setPopSize} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={s.label}>Gerações (máx 5)</Text>
              <TextInput style={[s.input, { borderColor: `${primary}40`, color: C.text }]} value={generations} onChangeText={setGenerations} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
            </View>
          </View>
          <View style={[s.warnBox, { borderColor: `${C.warning}40` }]}>
            <Ionicons name="time-outline" size={14} color={C.warning} />
            <Text style={[s.warnText, { color: C.warning }]}>
              Cada geração executa {popSize || 6} backtests completos. Tempo estimado: {Math.ceil((parseInt(popSize || "6") * parseInt(generations || "3") * 2) / 60)} min.
            </Text>
          </View>
          <Pressable
            style={[s.evolveBtn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
            onPress={evolve}
            disabled={loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#000" size="small" />
                <Text style={s.evolveBtnText}>Evoluindo… {elapsed}s</Text>
              </>
            ) : (
              <>
                <Ionicons name="rocket-outline" size={16} color="#000" />
                <Text style={s.evolveBtnText}>Iniciar Evolução</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Results */}
        {result && (
          <>
            <View style={[s.summary, { borderColor: `${primary}30` }]}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: primary }]}>{result.totalBacktests}</Text>
                <Text style={s.summaryLbl}>Backtests</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: primary }]}>{result.generations}</Text>
                <Text style={s.summaryLbl}>Gerações</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: primary }]}>{Math.round(result.elapsedMs / 1000)}s</Text>
                <Text style={s.summaryLbl}>Tempo</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: C.success }]}>{fmt(result.champion.score, 1)}</Text>
                <Text style={s.summaryLbl}>Melhor Score</Text>
              </View>
            </View>
            <ChampionCard champion={result.champion} symbol={result.symbol} />
            {result.history?.length > 0 && <EvolutionChart history={result.history} />}
          </>
        )}

        {!loading && !result && (
          <View style={s.empty}>
            <Ionicons name="flask-outline" size={48} color={C.textSecondary} />
            <Text style={s.emptyText}>Pronto para evoluir</Text>
            <Text style={[s.emptySub, { color: C.textSecondary }]}>
              Configure os parâmetros e inicie a evolução genética
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
  info: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  infoText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  form: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  formTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  row: { flexDirection: "row" },
  warnBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderWidth: 1, borderRadius: 8, padding: 10 },
  warnText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  evolveBtn: { borderRadius: 10, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 4 },
  evolveBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  summary: { flexDirection: "row", justifyContent: "space-around", borderWidth: 1, borderRadius: 14, padding: 16, backgroundColor: "#111" },
  summaryItem: { alignItems: "center" },
  summaryVal: { fontFamily: "Inter_700Bold", fontSize: 20 },
  summaryLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
});

const ch = StyleSheet.create({
  container: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  crown: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, flex: 1 },
  originBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  originText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  scoreRow: { alignItems: "center" },
  score: { fontFamily: "Inter_700Bold", fontSize: 48 },
  scoreLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: -4 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gene: { width: "47%", backgroundColor: "#1a1a1a", borderRadius: 8, padding: 10, alignItems: "center" },
  geneVal: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  geneLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2, textAlign: "center" },
});

const evo = StyleSheet.create({
  container: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  gen: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, width: 24 },
  bars: { flex: 1, gap: 3 },
  barTrack: { height: 6, backgroundColor: "#222", borderRadius: 3, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 3 },
  vals: { width: 60, alignItems: "flex-end" },
  val: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginRight: 8 },
});
