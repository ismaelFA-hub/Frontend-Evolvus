import { useState, useCallback, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;
const HISTORY_KEY = "@evolvus_daily_goal_history";

interface GoalEvaluation {
  goal: number;
  result: string;
  level: "achievable" | "ambitious" | "unrealistic";
  date: string;
}

function levelColor(level: GoalEvaluation["level"]): string {
  if (level === "achievable") return "#00D4AA";
  if (level === "ambitious") return "#F59E0B";
  return "#FF4D4D";
}

function levelIcon(level: GoalEvaluation["level"]): any {
  if (level === "achievable") return "checkmark-circle";
  if (level === "ambitious") return "alert-circle";
  return "close-circle";
}

function levelLabel(level: GoalEvaluation["level"]): string {
  if (level === "achievable") return "Meta Realista";
  if (level === "ambitious") return "Meta Ambiciosa";
  return "Meta Muito Alta";
}

function classifyGoal(goalPct: number): GoalEvaluation["level"] {
  if (goalPct <= 1.5) return "achievable";
  if (goalPct <= 5) return "ambitious";
  return "unrealistic";
}

export default function DailyGoalScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [goalPct, setGoalPct] = useState("1.0");
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<GoalEvaluation | null>(null);
  const [history, setHistory] = useState<GoalEvaluation[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) {
        try { setHistory(JSON.parse(raw)); } catch (_) {}
      }
    });
  }, []);

  const saveHistory = useCallback(async (ev: GoalEvaluation) => {
    const updated = [ev, ...history].slice(0, 5);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const handleEvaluate = useCallback(async () => {
    const pct = parseFloat(goalPct.replace(",", "."));
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      Alert.alert("Valor inválido", "Insira uma porcentagem entre 0.1% e 100%.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setEvaluation(null);

    const systemPrompt = `Você é o Nexus, assistente de IA da Evolvus Core Quantum, especialista em trading de criptomoedas. O usuário quer atingir ${pct}% de ganho diário. Avalie com base em:
- Volatilidade típica do mercado cripto (Bitcoin: ~2-4%/dia, altcoins: até 10%/dia)
- Sustentabilidade: metas acima de 2-3%/dia diariamente são muito difíceis de manter por longos períodos
- Risco: metas altas exigem alavancagem ou altcoins muito voláteis, aumentando riscos de perda
Responda de forma direta e objetiva em português. Em 3-5 linhas: avalie se é realista, mencione a volatilidade média do mercado, diga se precisa de estratégias específicas e dê uma recomendação prática. NÃO use tópicos ou listas.`;

    try {
      const resp = await apiRequest("POST", "/api/assistant/message", {
        message: `Quero atingir ${pct}% de ganho diário. Avalie se essa meta é realista.`,
        context: {
          goal: pct,
          user_plan: user?.plan ?? "free",
          system_prompt_override: systemPrompt,
        },
      }) as any;

      const text = resp?.message ?? resp?.content ?? resp?.text ?? "Não foi possível obter uma avaliação. Tente novamente.";
      const level = classifyGoal(pct);
      const ev: GoalEvaluation = {
        goal: pct,
        result: text,
        level,
        date: new Date().toLocaleDateString("pt-BR"),
      };
      setEvaluation(ev);
      await saveHistory(ev);
    } catch (err: any) {
      const level = classifyGoal(pct);
      const fallbackTexts: Record<GoalEvaluation["level"], string> = {
        achievable: `Uma meta de ${pct}% ao dia é alcançável em condições favoráveis de mercado. O Bitcoin tem volatilidade média de 2-4% diários, o que permite esse resultado com boas estratégias de DCA e gestão de risco. Utilize ordens limit e stop-loss adequados. Meta consistente e sustentável a longo prazo.`,
        ambitious: `Uma meta de ${pct}% ao dia é ambiciosa. É possível em dias de alta volatilidade, mas não deve ser esperada todos os dias. Altcoins de média capitalização podem oferecer essa amplitude, mas com risco elevado. Use alavancagem moderada (máx 5x) e sempre com stop-loss. Revise suas expectativas semanalmente.`,
        unrealistic: `Uma meta de ${pct}% ao dia é extremamente difícil de manter de forma consistente. Isso representaria um retorno anual de milhares de porcento. Na prática, apenas dias excepcionais de mercado ou altcoins de baixa liquidez permitem esse ganho — com risco equivalente de perda total. Reduzir a meta para 0.5-2% ao dia é muito mais sustentável e recomendado.`,
      };
      const ev: GoalEvaluation = { goal: pct, result: fallbackTexts[level], level, date: new Date().toLocaleDateString("pt-BR") };
      setEvaluation(ev);
      await saveHistory(ev);
    } finally {
      setLoading(false);
    }
  }, [goalPct, user, saveHistory]);

  const adjustGoal = (delta: number) => {
    const current = parseFloat(goalPct.replace(",", ".")) || 0;
    const next = Math.max(0.1, Math.min(100, +(current + delta).toFixed(1)));
    setGoalPct(String(next));
  };

  const currentPct = parseFloat(goalPct.replace(",", ".")) || 0;
  const previewLevel = currentPct > 0 ? classifyGoal(currentPct) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Meta de Ganho Diário</Text>
          <Text style={styles.subtitle}>Avaliação por IA</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={planTheme.primary} />
          <Text style={styles.infoText}>
            Defina uma meta de % de ganho diário e a IA do Evolvus avaliará se é realista com base nas condições atuais de mercado.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Meta de Ganho Diário</Text>
          <View style={styles.inputRow}>
            <Pressable style={styles.stepBtn} onPress={() => adjustGoal(-0.5)}>
              <Ionicons name="remove" size={20} color={C.text} />
            </Pressable>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={goalPct}
                onChangeText={setGoalPct}
                keyboardType="decimal-pad"
                selectionColor={C.primary}
                underlineColorAndroid="transparent"
                textAlign="center"
              />
              <Text style={styles.inputSuffix}>% ao dia</Text>
            </View>
            <Pressable style={styles.stepBtn} onPress={() => adjustGoal(0.5)}>
              <Ionicons name="add" size={20} color={C.text} />
            </Pressable>
          </View>

          <View style={styles.presetsRow}>
            {[0.5, 1.0, 2.0, 5.0, 10.0].map((v) => (
              <Pressable
                key={v}
                style={[
                  styles.presetChip,
                  currentPct === v && { backgroundColor: planTheme.primary + '22', borderColor: planTheme.primary },
                ]}
                onPress={() => { setGoalPct(String(v)); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.presetChipText, currentPct === v && { color: planTheme.primary }]}>{v}%</Text>
              </Pressable>
            ))}
          </View>

          {previewLevel && (
            <View style={[styles.previewBadge, { backgroundColor: levelColor(previewLevel) + '15', borderColor: levelColor(previewLevel) + '40' }]}>
              <Ionicons name={levelIcon(previewLevel)} size={14} color={levelColor(previewLevel)} />
              <Text style={[styles.previewText, { color: levelColor(previewLevel) }]}>
                {levelLabel(previewLevel)}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          style={[styles.evalBtn, { backgroundColor: planTheme.primary }, loading && { opacity: 0.7 }]}
          onPress={handleEvaluate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="hardware-chip-outline" size={18} color="#000" />
              <Text style={styles.evalBtnText}>Avaliar com IA</Text>
            </>
          )}
        </Pressable>

        {evaluation && (
          <View style={[styles.resultCard, { borderColor: levelColor(evaluation.level) + '50', backgroundColor: levelColor(evaluation.level) + '0A' }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultBadge, { backgroundColor: levelColor(evaluation.level) + '20' }]}>
                <Ionicons name={levelIcon(evaluation.level)} size={16} color={levelColor(evaluation.level)} />
                <Text style={[styles.resultBadgeText, { color: levelColor(evaluation.level) }]}>
                  {levelLabel(evaluation.level)} — {evaluation.goal}% ao dia
                </Text>
              </View>
            </View>
            <Text style={styles.resultText}>{evaluation.result}</Text>
            <Text style={styles.resultDate}>{evaluation.date}</Text>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="warning-outline" size={14} color={C.textTertiary} />
          <Text style={styles.disclaimerText}>
            Resultados passados não garantem resultados futuros. Criptomoedas são ativos de alto risco.
          </Text>
        </View>

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Avaliações Anteriores</Text>
            {history.map((h, i) => (
              <View key={i} style={[styles.historyRow, { borderColor: levelColor(h.level) + '30' }]}>
                <View style={[styles.historyDot, { backgroundColor: levelColor(h.level) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyGoal, { color: levelColor(h.level) }]}>{h.goal}% ao dia</Text>
                  <Text style={styles.historyLevel}>{levelLabel(h.level)}</Text>
                </View>
                <Text style={styles.historyDate}>{h.date}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, textAlign: "center" },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "center" },
  content: { padding: 20, gap: 16 },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "flex-start",
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1, lineHeight: 20 },
  inputSection: { gap: 12 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 2,
  },
  input: {
    width: "100%",
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "center",
    color: C.text,
    paddingVertical: 0,
    margin: 0,
  },
  inputSuffix: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, textAlign: "center" },
  presetsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetChip: {
    borderWidth: 1, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.surface,
  },
  presetChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  previewBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  previewText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  evalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 15, borderRadius: 14,
  },
  evalBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#000" },
  resultCard: {
    borderWidth: 1, borderRadius: 16, padding: 16, gap: 12,
  },
  resultHeader: { gap: 6 },
  resultBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start",
  },
  resultBadgeText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  resultText: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, lineHeight: 22,
  },
  resultDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  disclaimer: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: C.surface, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  disclaimerText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, flex: 1, lineHeight: 18 },
  historySection: { gap: 10 },
  historyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  historyRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.card, borderRadius: 12, padding: 12,
    borderWidth: 1,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyGoal: { fontFamily: "Inter_700Bold", fontSize: 14 },
  historyLevel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  historyDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
});
