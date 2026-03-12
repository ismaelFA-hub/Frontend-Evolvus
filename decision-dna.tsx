import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

const PROFILES = [
  { key: "conservative", label: "Conservador", icon: "shield-checkmark" as const, color: "#00E676", desc: "Risco baixo, proteção de capital" },
  { key: "moderate", label: "Moderado", icon: "trending-up" as const, color: "#00B4D8", desc: "Equilíbrio entre risco e retorno" },
  { key: "aggressive", label: "Agressivo", icon: "flame" as const, color: "#FFB74D", desc: "Alta exposição, maior potencial" },
  { key: "kamikaze", label: "Kamikaze", icon: "nuclear" as const, color: "#FF5252", desc: "Máximo risco, máximo retorno" },
];

interface DNA {
  profileType: string;
  maxLeverage: number;
  riskPerTradePct: number;
  maxDailyLossPct: number;
  positionSizingMethod: string;
  autoEvolve: boolean;
}

interface DnaResponse {
  dna: DNA;
  driftAlerts?: string[];
  recommendation?: string;
}

export default function DecisionDnaScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;

  const [data, setData] = useState<DnaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState("moderate");

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/dna");
      const d = res as DnaResponse;
      setData(d);
      setSelectedProfile(d.dna?.profileType ?? "moderate");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/dna", { profileType: selectedProfile });
      await load();
      Alert.alert("DNA Atualizado", "Seu perfil de trading foi salvo.");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o DNA.");
    } finally {
      setSaving(false);
    }
  }, [selectedProfile, load]);

  const reset = useCallback(async () => {
    Alert.alert("Resetar DNA", "Isso vai restaurar os padrões do seu plano.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Resetar", style: "destructive", onPress: async () => {
          try {
            await apiRequest("POST", "/api/dna/reset");
            await load();
          } catch {
            Alert.alert("Erro", "Falha ao resetar.");
          }
        },
      },
    ]);
  }, [load]);

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }

  const dna = data?.dna;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>DNA de Trading</Text>
          <Text style={s.sub}>Seu perfil de comportamento evolutivo</Text>
        </View>
        <Pressable onPress={reset}>
          <Text style={[s.resetText, { color: C.danger }]}>Resetar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Drift alerts */}
        {(data?.driftAlerts ?? []).length > 0 && (
          <View style={[s.alertBox, { borderColor: `${C.warning}50` }]}>
            <Ionicons name="alert-circle" size={18} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[s.alertTitle, { color: C.warning }]}>Alerta de Drift</Text>
              {(data?.driftAlerts ?? []).map((a, i) => (
                <Text key={i} style={s.alertText}>{a}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Profile selection */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <Text style={s.cardTitle}>Perfil de Risco</Text>
          {PROFILES.map((p) => (
            <Pressable
              key={p.key}
              style={[s.profileRow, selectedProfile === p.key && { backgroundColor: `${p.color}18`, borderColor: p.color }]}
              onPress={() => setSelectedProfile(p.key)}
            >
              <Ionicons name={p.icon} size={22} color={p.color} />
              <View style={{ flex: 1 }}>
                <Text style={[s.profileLabel, { color: p.color }]}>{p.label}</Text>
                <Text style={s.profileDesc}>{p.desc}</Text>
              </View>
              {selectedProfile === p.key && <Ionicons name="checkmark-circle" size={20} color={p.color} />}
            </Pressable>
          ))}
        </View>

        {/* Current metrics */}
        {dna && (
          <View style={[s.card, { borderColor: `${primary}30` }]}>
            <Text style={s.cardTitle}>Parâmetros Atuais</Text>
            {[
              { label: "Leverage Máximo", val: `${dna.maxLeverage}x` },
              { label: "Risco por Trade", val: `${dna.riskPerTradePct}%` },
              { label: "Perda Diária Máxima", val: `${dna.maxDailyLossPct}%` },
              { label: "Sizing de Posição", val: dna.positionSizingMethod },
              { label: "Auto-Evolução", val: dna.autoEvolve ? "Ativo" : "Inativo" },
            ].map(({ label, val }) => (
              <View key={label} style={s.metricRow}>
                <Text style={s.metricLabel}>{label}</Text>
                <Text style={[s.metricVal, { color: primary }]}>{val}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommendation */}
        {data?.recommendation && (
          <View style={[s.card, { borderColor: `${C.accent}30` }]}>
            <Text style={[s.cardTitle, { color: C.accent }]}>Recomendação</Text>
            <Text style={s.recText}>{data.recommendation}</Text>
          </View>
        )}

        <Pressable style={[s.saveBtn, { backgroundColor: primary, opacity: saving ? 0.6 : 1 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.saveBtnText}>Salvar DNA</Text>}
        </Pressable>
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
  resetText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  content: { padding: 16, gap: 14 },
  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 12, padding: 14 },
  alertTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  alertText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  profileLabel: { fontFamily: "Inter_700Bold", fontSize: 14 },
  profileDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  metricRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  metricVal: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  recText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#000" },
});
