/**
 * Evolvus Core Quantum — Módulo 14: Sistema Endócrino
 *
 * Visualiza o estado atual dos 4 hormônios artificiais:
 * Cortisol (stress), Dopamina (reward), Adrenalina (urgência), Serotonina (calma)
 *
 * Também mostra os efeitos nos trades: sizingMultiplier, thresholdBonus, narrative.
 *
 * Rotas: GET /api/hormones
 *        POST /api/hormones/update
 *        POST /api/hormones/reset
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator,
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
/** Minimum level delta to show a trend arrow (avoids flicker on tiny changes) */
const TREND_THRESHOLD = 1;

// ─── Types ────────────────────────────────────────────────────────────

interface HormoneLevel {
  level: number;
  baseline: number;
  decayRate: number;
  lastUpdated: string;
}

interface HormoneState {
  cortisol: HormoneLevel;
  dopamine: HormoneLevel;
  adrenaline: HormoneLevel;
  serotonin: HormoneLevel;
}

interface HormoneEffect {
  sizingMultiplier: number;
  thresholdBonus: number;
  riskWeightDampen: number;
  narrative: string;
}

interface HormonesResponse {
  userId: string;
  state: HormoneState;
  effects: HormoneEffect;
}

// ─── Hormone metadata ─────────────────────────────────────────────────

const HORMONE_META = {
  cortisol: {
    label: "Cortisol",
    icon: "warning-outline",
    description: "Hormônio do stress — elevado por drawdown e sequências de perdas",
    lowColor: "#8BC34A",
    highColor: C.danger,
    emoji: "😰",
  },
  dopamine: {
    label: "Dopamina",
    icon: "happy-outline",
    description: "Hormônio da recompensa — elevado por wins consecutivos e PnL positivo",
    lowColor: C.textSecondary,
    highColor: C.success,
    emoji: "😄",
  },
  adrenaline: {
    label: "Adrenalina",
    icon: "flash-outline",
    description: "Hormônio de urgência — dispara em alta volatilidade e movimentos extremos",
    lowColor: C.textSecondary,
    highColor: C.warning,
    emoji: "⚡",
  },
  serotonin: {
    label: "Serotonina",
    icon: "sunny-outline",
    description: "Hormônio da calma — alto em mercado lateral e baixa volatilidade",
    lowColor: C.textSecondary,
    highColor: "#00BCD4",
    emoji: "😌",
  },
} as const;

type HormoneKey = keyof typeof HORMONE_META;

// ─── Hormone bar ──────────────────────────────────────────────────────

function HormoneBar({ name, data, prev }: { name: HormoneKey; data: HormoneLevel; prev?: HormoneLevel }) {
  const meta = HORMONE_META[name];
  const pct = Math.min(100, Math.max(0, data.level));
  const baselinePct = Math.min(100, Math.max(0, data.baseline));
  const color = pct > 70 ? meta.highColor : pct > 30 ? C.warning : meta.lowColor;
  const trend = prev ? (data.level > prev.level + TREND_THRESHOLD ? "▲" : data.level < prev.level - TREND_THRESHOLD ? "▼" : "─") : null;
  const trendColor = trend === "▲" ? meta.highColor : trend === "▼" ? meta.lowColor : C.textTertiary;

  return (
    <View style={hb.container}>
      <View style={hb.labelRow}>
        <Text style={hb.emoji}>{meta.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={hb.name}>{meta.label}</Text>
          <Text style={hb.desc} numberOfLines={1}>{meta.description}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[hb.level, { color }]}>{pct.toFixed(1)}</Text>
          {trend && <Text style={{ fontSize: 12, color: trendColor, marginTop: -2 }}>{trend}</Text>}
        </View>
      </View>
      <View style={hb.barTrack}>
        {/* Baseline marker */}
        <View style={[hb.baselineMarker, { left: `${baselinePct}%` as `${number}%` }]} />
        {/* Fill */}
        <View style={[hb.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={hb.metaRow}>
        <Text style={hb.metaText}>Baseline: {data.baseline.toFixed(1)}</Text>
        <Text style={hb.metaText}>Decay: {(data.decayRate * 100).toFixed(0)}%/tick</Text>
        <Text style={[hb.metaText, { color }]}>Atual: {data.level.toFixed(2)}</Text>
      </View>
    </View>
  );
}

const hb = StyleSheet.create({
  container:       { marginBottom: 16 },
  labelRow:        { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  emoji:           { fontSize: 20 },
  name:            { fontSize: 13, fontWeight: "700", color: C.text },
  desc:            { fontSize: 11, color: C.textSecondary },
  level:           { fontSize: 24, fontWeight: "800", minWidth: 36, textAlign: "right" },
  barTrack:        { height: 12, backgroundColor: C.border, borderRadius: 6, overflow: "visible", position: "relative" },
  barFill:         { height: "100%", borderRadius: 6 },
  baselineMarker:  { position: "absolute", width: 2, height: 16, top: -2, backgroundColor: C.textTertiary, borderRadius: 1, zIndex: 1 },  metaRow:         { flexDirection: "row", justifyContent: "space-between", marginTop: 3 },
  metaText:        { fontSize: 10, color: C.textTertiary },
});

// ─── Effects panel ────────────────────────────────────────────────────

function EffectsPanel({ effects }: { effects: HormoneEffect }) {
  const sizingColor = effects.sizingMultiplier >= 1 ? C.success : C.danger;
  const thresholdColor = effects.thresholdBonus > 5 ? C.danger : effects.thresholdBonus > 0 ? C.warning : C.success;
  return (
    <View style={ep.container}>
      <Text style={ep.title}>🎯 Efeitos nos Trades</Text>
      <View style={ep.row}>
        <View style={ep.item}>
          <Text style={[ep.value, { color: sizingColor }]}>{effects.sizingMultiplier.toFixed(2)}×</Text>
          <Text style={ep.label}>Sizing Mult.</Text>
        </View>
        <View style={ep.divider} />
        <View style={ep.item}>
          <Text style={[ep.value, { color: thresholdColor }]}>+{effects.thresholdBonus.toFixed(1)}</Text>
          <Text style={ep.label}>Threshold Bonus</Text>
        </View>
        <View style={ep.divider} />
        <View style={ep.item}>
          <Text style={[ep.value, { color: C.textSecondary }]}>{effects.riskWeightDampen.toFixed(2)}</Text>
          <Text style={ep.label}>Risk Dampen</Text>
        </View>
      </View>
      <Text style={ep.narrative}>{effects.narrative}</Text>
    </View>
  );
}

const ep = StyleSheet.create({
  container: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  title:     { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 12 },
  row:       { flexDirection: "row", alignItems: "center" },
  item:      { flex: 1, alignItems: "center" },
  divider:   { width: 1, height: 40, backgroundColor: C.border },
  value:     { fontSize: 22, fontWeight: "800" },
  label:     { fontSize: 10, color: C.textSecondary, marginTop: 2, textAlign: "center" },
  narrative: { fontSize: 12, color: C.textSecondary, marginTop: 12, lineHeight: 18, fontStyle: "italic" },
});

// ─── Main screen ──────────────────────────────────────────────────────

export default function HormonesScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme } = usePlanTheme();

  const [data, setData] = useState<HormonesResponse | null>(null);
  const [prevData, setPrevData] = useState<HormonesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("GET", "/api/hormones");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
      }
      const fresh = await res.json() as HormonesResponse;
      setData((old) => { setPrevData(old); return fresh; });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  const handleReset = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setResetting(true);
    try {
      const res = await apiRequest("POST", "/api/hormones/reset");
      if (!res.ok) throw new Error("Falha ao resetar");
      const body = await res.json() as { state: HormoneState };
      // Reload effects
      await loadState();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const state = data?.state;
  const effects = data?.effects;

  // Compute overall stress level for visual indicator
  const overallStress = state
    ? Math.round((state.cortisol.level + state.adrenaline.level) / 2)
    : 0;
  const overallCalm = state
    ? Math.round((state.serotonin.level + state.dopamine.level) / 2)
    : 0;

  return (
    <View style={[s.root, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('hormones')}</Text>
          <Text style={s.subtitle}>Hormônios artificiais do ecossistema</Text>
        </View>
        <Pressable onPress={loadState} style={s.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={planTheme.primary} />
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={planTheme.primary} style={{ marginTop: 32 }} />}

      {!loading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={C.danger} />
              <Text style={s.errorText}>{error}</Text>
              <Pressable onPress={loadState}>
                <Text style={[s.errorText, { color: planTheme.primary }]}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}

          {/* Summary bar */}
          {state && (
            <View style={s.summaryCard}>
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>🔴 Stress</Text>
                <Text style={[s.summaryValue, { color: overallStress > 60 ? C.danger : C.warning }]}>{overallStress}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>🟢 Calma</Text>
                <Text style={[s.summaryValue, { color: overallCalm > 50 ? C.success : C.textSecondary }]}>{overallCalm}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryLabel}>Estado Geral</Text>
                <Text style={s.summaryValue}>
                  {overallStress > 70 ? "⚠️ Alerta" : overallCalm > 60 ? "✅ Calmo" : "🔄 Normal"}
                </Text>
              </View>
            </View>
          )}

          {/* Effects */}
          {effects && <EffectsPanel effects={effects} />}

          {/* Hormone bars */}
          {state && (
            <View style={s.hormonesCard}>
              <Text style={s.cardTitle}>🧬 Estado dos Hormônios</Text>
              {(["cortisol", "dopamine", "adrenaline", "serotonin"] as HormoneKey[]).map((key) => (
                <HormoneBar key={key} name={key} data={state[key]} prev={prevData?.state[key]} />
              ))}
            </View>
          )}

          {/* How it works */}
          <View style={s.infoCard}>
            <Text style={s.cardTitle}>ℹ️ Como Funciona</Text>
            <Text style={s.infoText}>
              O sistema endócrino modula o comportamento dos bots a cada tick:{"\n\n"}
              • <Text style={{ fontWeight: "700" }}>Cortisol alto</Text> → threshold de entrada sobe (mais seletivo){"\n"}
              • <Text style={{ fontWeight: "700" }}>Dopamina alta</Text> → sizing multiplier aumenta (more aggressive){"\n"}
              • <Text style={{ fontWeight: "700" }}>Adrenalina alta</Text> → risk weight dampen ativa (cérebros arriscados penalizados){"\n"}
              • <Text style={{ fontWeight: "700" }}>Serotonina alta</Text> → sistema relaxa, sizing normaliza{"\n\n"}
              Todos os hormônios decaem exponencialmente para o baseline após cada tick.
            </Text>
          </View>

          {/* Reset button */}
          <Pressable
            style={[s.resetBtn, { borderColor: C.danger }, resetting && { opacity: 0.6 }]}
            onPress={handleReset}
            disabled={resetting}
          >
            {resetting
              ? <ActivityIndicator color={C.danger} size="small" />
              : <><Ionicons name="refresh-circle-outline" size={18} color={C.danger} /><Text style={s.resetBtnText}>Resetar para Baseline</Text></>
            }
          </Pressable>

          {data && (
            <Text style={s.timestamp}>Usuário: {data.userId} · Atualizado: {new Date().toLocaleTimeString()}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.background },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  backBtn:        { padding: 4 },
  refreshBtn:     { padding: 4 },
  title:          { fontSize: 18, fontWeight: "700", color: C.text },
  subtitle:       { fontSize: 12, color: C.textSecondary },
  scroll:         { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  errorBox:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.danger + "22", borderRadius: 10, padding: 12 },
  errorText:      { color: C.danger, fontSize: 13 },
  summaryCard:    { backgroundColor: C.surface, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border },
  summaryItem:    { flex: 1, alignItems: "center" },
  summaryLabel:   { fontSize: 11, color: C.textSecondary, marginBottom: 4 },
  summaryValue:   { fontSize: 16, fontWeight: "800", color: C.text },
  summaryDivider: { width: 1, height: 36, backgroundColor: C.border },
  hormonesCard:   { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  cardTitle:      { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 14 },
  infoCard:       { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  infoText:       { fontSize: 12, color: C.textSecondary, lineHeight: 20 },
  resetBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  resetBtnText:   { fontSize: 14, fontWeight: "700", color: C.danger },
  timestamp:      { fontSize: 11, color: C.textTertiary, textAlign: "center" },
});
