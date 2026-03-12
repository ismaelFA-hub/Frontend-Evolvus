import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface HormoneLevel {
  value: number;
  baseline: number;
  peak: number;
}

interface HormoneState {
  cortisol: HormoneLevel;
  dopamine: HormoneLevel;
  adrenaline: HormoneLevel;
  serotonin: HormoneLevel;
  updatedAt: string;
}

interface HormoneEffect {
  sizingMultiplier: number;
  riskThresholdMultiplier: number;
  brainWeightBonus: number;
  executionUrgency: "low" | "normal" | "high" | "extreme";
  narrative: string;
}

const HORMONE_CONFIG = {
  cortisol: { label: "Cortisol", icon: "alert-circle", color: "#FF4D4D", desc: "Estresse / Risco" },
  dopamine: { label: "Dopamina", icon: "star", color: "#F7931A", desc: "Recompensa / Confiança" },
  adrenaline: { label: "Adrenalina", icon: "flash", color: "#FFD700", desc: "Urgência / Volatilidade" },
  serotonin: { label: "Serotonina", icon: "leaf", color: "#00D4AA", desc: "Calma / Estabilidade" },
} as const;

const URGENCY_COLOR = {
  low: "#00D4AA",
  normal: "#6B7A99",
  high: "#F7931A",
  extreme: "#FF4D4D",
};

function HormoneBar({ name, level, primary }: { name: keyof typeof HORMONE_CONFIG; level: HormoneLevel; primary: string }) {
  const cfg = HORMONE_CONFIG[name];
  const pct = Math.min(100, Math.max(0, (level.value / level.peak) * 100));
  const basePct = Math.min(100, Math.max(0, (level.baseline / level.peak) * 100));

  return (
    <View style={styles.hormoneCard}>
      <View style={styles.hormoneHeader}>
        <View style={styles.hormoneLeft}>
          <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
          <View>
            <Text style={[styles.hormoneName, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={styles.hormoneDesc}>{cfg.desc}</Text>
          </View>
        </View>
        <Text style={[styles.hormoneValue, { color: cfg.color }]}>{level.value.toFixed(2)}</Text>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]} />
        <View style={[styles.baselineMark, { left: `${basePct}%` as any }]} />
      </View>

      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>0</Text>
        <Text style={[styles.barLabel, { color: C.textTertiary }]}>Base: {level.baseline.toFixed(2)}</Text>
        <Text style={styles.barLabel}>{level.peak.toFixed(2)}</Text>
      </View>
    </View>
  );
}

export default function EndocrineScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;
  const webTopInset = typeof window !== "undefined" ? 67 : 0;

  const [state, setState] = useState<HormoneState | null>(null);
  const [effects, setEffects] = useState<HormoneEffect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("GET", "/api/endocrine/state") as { state: HormoneState; effects: HormoneEffect };
      setState(data.state ?? null);
      setEffects(data.effects ?? null);
    } catch (e: any) {
      setError("Não foi possível carregar o estado endócrino.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={[styles.title, { color: primary }]}>Sistema Endócrino</Text>
          <Text style={styles.subtitle}>Hormônios artificiais do ecossistema de trading</Text>
        </View>
        <Pressable onPress={load} style={styles.refreshBtn} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={C.textTertiary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={primary} size="large" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color="#FF4D4D" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={[styles.retryBtn, { borderColor: primary }]}>
            <Text style={[styles.retryText, { color: primary }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {state && (
            <>
              {(["cortisol", "dopamine", "adrenaline", "serotonin"] as const).map((h) => (
                <HormoneBar key={h} name={h} level={state[h]} primary={primary} />
              ))}

              <Text style={styles.updatedAt}>
                Atualizado: {new Date(state.updatedAt).toLocaleTimeString()}
              </Text>
            </>
          )}

          {effects && (
            <View style={[styles.effectsCard, { borderColor: primary + "33" }]}>
              <Text style={[styles.effectsTitle, { color: primary }]}>Efeitos Atuais</Text>

              <View style={styles.effectRow}>
                <Text style={styles.effectLabel}>Urgência de Execução</Text>
                <Text style={[styles.effectValue, { color: URGENCY_COLOR[effects.executionUrgency] }]}>
                  {effects.executionUrgency.toUpperCase()}
                </Text>
              </View>

              <View style={styles.effectRow}>
                <Text style={styles.effectLabel}>Multiplicador de Tamanho</Text>
                <Text style={styles.effectValue}>{effects.sizingMultiplier.toFixed(2)}×</Text>
              </View>

              <View style={styles.effectRow}>
                <Text style={styles.effectLabel}>Multiplicador de Risco</Text>
                <Text style={styles.effectValue}>{effects.riskThresholdMultiplier.toFixed(2)}×</Text>
              </View>

              <View style={styles.effectRow}>
                <Text style={styles.effectLabel}>Bônus de Peso dos Cérebros</Text>
                <Text style={[styles.effectValue, { color: effects.brainWeightBonus >= 0 ? "#00D4AA" : "#FF4D4D" }]}>
                  {effects.brainWeightBonus >= 0 ? "+" : ""}{effects.brainWeightBonus.toFixed(3)}
                </Text>
              </View>

              {!!effects.narrative && (
                <View style={[styles.narrativeBox, { borderColor: primary + "33" }]}>
                  <Ionicons name="information-circle" size={14} color={primary} />
                  <Text style={styles.narrativeText}>{effects.narrative}</Text>
                </View>
              )}
            </View>
          )}

          <View style={[styles.infoCard, { borderColor: C.border }]}>
            <Text style={[styles.infoTitle, { color: primary }]}>Como funciona?</Text>
            <Text style={styles.infoText}>
              O sistema endócrino artificial modula o comportamento dos bots e cérebros IA
              em tempo real. Cada "hormônio" reage a eventos de mercado e portfólio,
              decaindo exponencialmente em direção à linha base quando o estímulo cessa.
            </Text>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  refreshBtn: { marginLeft: "auto" as any, padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textTertiary, textAlign: "center" },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  hormoneCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  hormoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hormoneLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  hormoneName: { fontFamily: "Inter_700Bold", fontSize: 14 },
  hormoneDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  hormoneValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  barBg: {
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
    position: "relative",
  },
  barFill: { height: 8, borderRadius: 4 },
  baselineMark: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  barLabels: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary },
  updatedAt: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textTertiary,
    textAlign: "center",
  },
  effectsCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  effectsTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 },
  effectRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  effectLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  effectValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  narrativeBox: {
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    alignItems: "flex-start",
  },
  narrativeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  infoTitle: { fontFamily: "Inter_700Bold", fontSize: 14 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
});
