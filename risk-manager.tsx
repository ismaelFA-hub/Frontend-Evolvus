import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;
type PlanType = "free" | "pro" | "premium" | "enterprise";
const PLAN_ORDER: PlanType[] = ["free", "pro", "premium", "enterprise"];
function planGte(u: PlanType, r: PlanType) { return PLAN_ORDER.indexOf(u) >= PLAN_ORDER.indexOf(r); }

// ─── Mock data ─────────────────────────────────────────────────────────────────
const RISK_SCORE = 58;

const METRICS = [
  { label: "Total Exposure", value: "$24,850", sub: "of $40,000 limit", color: C.warning },
  { label: "Leverage Used",  value: "3.2x",    sub: "4x max",          color: C.success },
  { label: "Margin Available", value: "$15,150", sub: "37.9%",         color: C.success },
  { label: "Liquidation Distance", value: "18.4%", sub: "~$84,850",   color: C.success },
  { label: "Max Drawdown",   value: "12.3%",   sub: "30D rolling",     color: C.warning },
  { label: "Correlation Risk", value: "HIGH",  sub: "BTC+ETH >80%",    color: C.danger  },
];

const ALERTS = [
  { id: "1", level: "warning", msg: "BTC position exceeds 40% of portfolio (currently 44.2%)" },
  { id: "2", level: "warning", msg: "ETH leverage above safe threshold (3.8x vs 3x limit)" },
  { id: "3", level: "danger",  msg: "BTC/ETH correlation 0.91 — high concentration risk" },
  { id: "4", level: "info",    msg: "DOGE position approaching 5% allocation limit (4.7%)" },
];

const PNL_AT_RISK = [
  { label: "90%", loss: 4.2 },
  { label: "95%", loss: 7.8 },
  { label: "99%", loss: 14.1 },
  { label: "99.9%", loss: 22.5 },
];

// ─── Circular risk gauge ──────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const color = score < 40 ? C.success : score < 70 ? C.warning : C.danger;
  const label = score < 40 ? "Safe Zone" : score < 70 ? "Caution Zone" : "Danger Zone";
  const bars = 20;
  const filled = Math.round((score / 100) * bars);
  return (
    <View style={g.container}>
      <View style={g.ring}>
        {Array.from({ length: bars }).map((_, i) => {
          const angle = (i / bars) * 360;
          const rad = (angle * Math.PI) / 180;
          const r = 68;
          const x = 90 + r * Math.sin(rad);
          const y = 90 - r * Math.cos(rad);
          return (
            <View
              key={i}
              style={[g.dot, {
                left: x - 5,
                top:  y - 5,
                backgroundColor: i < filled ? color : C.border,
              }]}
            />
          );
        })}
        <View style={g.center}>
          <Text style={[g.score, { color }]}>{score}</Text>
          <Text style={g.scoreLabel}>Risk Score</Text>
        </View>
      </View>
      <View style={[g.badge, { backgroundColor: color + "22" }]}>
        <View style={[g.badgeDot, { backgroundColor: color }]} />
        <Text style={[g.badgeText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}
const g = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 16 },
  ring: { width: 180, height: 180, position: "relative", justifyContent: "center", alignItems: "center" },
  dot: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  center: { alignItems: "center" },
  score: { fontFamily: "Inter_700Bold", fontSize: 44 },
  scoreLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 8 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
});

// ─── Metrics grid ─────────────────────────────────────────────────────────────
function MetricsGrid() {
  return (
    <View style={mg.grid}>
      {METRICS.map((m, i) => (
        <View key={i} style={mg.cell}>
          <Text style={[mg.value, { color: m.color }]}>{m.value}</Text>
          <Text style={mg.label}>{m.label}</Text>
          <Text style={mg.sub}>{m.sub}</Text>
        </View>
      ))}
    </View>
  );
}
const mg = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  cell: { width: "47.5%", backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  value: { fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 2 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
});

// ─── Alert item ───────────────────────────────────────────────────────────────
function AlertItem({ alert }: { alert: typeof ALERTS[0] }) {
  const color = alert.level === "danger" ? C.danger : alert.level === "warning" ? C.warning : C.accent;
  const bg = alert.level === "danger" ? C.dangerDim : alert.level === "warning" ? C.warningDim : "rgba(0,180,216,0.12)";
  const icon = alert.level === "danger" ? "alert-circle" : alert.level === "warning" ? "warning" : "information-circle";
  return (
    <View style={[al.row, { backgroundColor: bg, borderColor: color }]}>
      <Ionicons name={icon as any} size={18} color={color} style={{ marginTop: 1 }} />
      <Text style={al.msg}>{alert.msg}</Text>
    </View>
  );
}
const al = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8, alignItems: "flex-start" },
  msg: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.text, flex: 1, lineHeight: 18 },
});

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ label, value, min, max, step, unit, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <View style={sp.row}>
      <Text style={sp.label}>{label}</Text>
      <View style={sp.controls}>
        <Pressable disabled={disabled || value <= min} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(Math.max(min, value - step)); }}
          style={[sp.btn, (disabled || value <= min) && sp.btnDis]}>
          <Ionicons name="remove" size={16} color={disabled || value <= min ? C.textTertiary : C.text} />
        </Pressable>
        <Text style={[sp.val, disabled && { color: C.textTertiary }]}>{value}{unit}</Text>
        <Pressable disabled={disabled || value >= max} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(Math.min(max, value + step)); }}
          style={[sp.btn, (disabled || value >= max) && sp.btnDis]}>
          <Ionicons name="add" size={16} color={disabled || value >= max ? C.textTertiary : C.text} />
        </Pressable>
      </View>
    </View>
  );
}
const sp = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1 },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  btn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  btnDis: { opacity: 0.4 },
  val: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, minWidth: 52, textAlign: "center" },
});

// ─── Toggle item ──────────────────────────────────────────────────────────────
function ToggleRow({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable style={tr.row} onPress={() => { Haptics.selectionAsync(); if (!disabled) onChange(!value); }} disabled={disabled}>
      <Text style={[tr.label, disabled && { color: C.textTertiary }]}>{label}</Text>
      <View style={[tr.track, value && !disabled && { backgroundColor: C.primary }]}>
        <View style={[tr.thumb, value && { transform: [{ translateX: 18 }] }]} />
      </View>
    </Pressable>
  );
}
const tr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1, marginRight: 12 },
  track: { width: 42, height: 24, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 2 },
  thumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.textTertiary },
});

// ─── PnL at Risk bars ─────────────────────────────────────────────────────────
function PnLAtRisk() {
  const max = 25;
  return (
    <View>
      <Text style={par.title}>Potential Loss by Confidence Level</Text>
      {PNL_AT_RISK.map(p => {
        const pct = (p.loss / max) * 100;
        return (
          <View key={p.label} style={par.row}>
            <Text style={par.label}>{p.label}</Text>
            <View style={par.track}>
              <View style={[par.fill, { width: `${pct}%` as any, backgroundColor: pct > 70 ? C.danger : pct > 45 ? C.warning : C.success }]} />
            </View>
            <Text style={par.value}>-{p.loss}%</Text>
          </View>
        );
      })}
    </View>
  );
}
const par = StyleSheet.create({
  title: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, width: 38 },
  track: { flex: 1, height: 10, backgroundColor: C.surface, borderRadius: 5, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5 },
  value: { fontFamily: "Inter_700Bold", fontSize: 12, color: C.danger, width: 44, textAlign: "right" },
});

// ─── Section header ───────────────────────────────────────────────────────────
function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4 }}>
      <Ionicons name={icon as any} size={18} color={C.textSecondary} />
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: C.text }}>{title}</Text>
    </View>
  );
}

// ─── Plan gate banner ─────────────────────────────────────────────────────────
function GateBanner({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.warningDim, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.warning }}>
      <Ionicons name="lock-closed" size={16} color={C.warning} />
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.warning, flex: 1 }}>{text}</Text>
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function RiskManagerScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const plan = (user?.plan ?? "free") as PlanType;

  const [maxPortfolioRisk, setMaxPortfolioRisk] = useState(15);
  const [maxSingleTrade, setMaxSingleTrade]     = useState(5);
  const [maxLeverage, setMaxLeverage]           = useState(5);
  const [maxCorrelated, setMaxCorrelated]       = useState(3);
  const [autoReduceLev, setAutoReduceLev]       = useState(false);
  const [autoClose, setAutoClose]               = useState(false);
  const [diversEnforcer, setDiversEnforcer]     = useState(true);

  const canConfig  = planGte(plan, "premium");
  const canAlerts  = planGte(plan, "premium");
  const canDashboard = planGte(plan, "pro");

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('riskManager')}</Text>
        <View style={[s.planBadge, { backgroundColor: planTheme.primaryDim }]}>
          <Text style={[s.planBadgeText, { color: planTheme.primary }]}>{plan.toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Risk Gauge */}
        <View style={s.card}>
          <RiskGauge score={RISK_SCORE} />
        </View>

        {/* Metrics */}
        {!canDashboard && <GateBanner text="Full risk dashboard requires Pro plan or higher." />}
        <View style={[{ opacity: canDashboard ? 1 : 0.4 }]}>
          <SectionTitle title="Portfolio Risk Metrics" icon="analytics-outline" />
          <MetricsGrid />
        </View>

        <View style={{ height: 20 }} />

        {/* Alerts */}
        {!canAlerts && <GateBanner text="Risk alerts require Premium plan." />}
        <View style={{ opacity: canAlerts ? 1 : 0.4 }}>
          <SectionTitle title="Active Risk Alerts" icon="notifications-outline" />
          {ALERTS.map(a => <AlertItem key={a.id} alert={a} />)}
        </View>

        <View style={{ height: 20 }} />

        {/* PnL at Risk */}
        <View style={s.card}>
          <SectionTitle title="Portfolio PnL at Risk" icon="bar-chart-outline" />
          <PnLAtRisk />
        </View>

        <View style={{ height: 20 }} />

        {/* Risk limits config */}
        {!canConfig && <GateBanner text="Risk limit configuration requires Premium plan." />}
        <View style={[s.card, { opacity: canConfig ? 1 : 0.5 }]}>
          <SectionTitle title="Risk Limits" icon="shield-outline" />
          <Stepper label="Max Portfolio Risk %" value={maxPortfolioRisk} min={1} max={50} step={1} unit="%" onChange={setMaxPortfolioRisk} disabled={!canConfig} />
          <Stepper label="Max Single Trade %" value={maxSingleTrade} min={1} max={25} step={1} unit="%" onChange={setMaxSingleTrade} disabled={!canConfig} />
          <Stepper label="Max Leverage" value={maxLeverage} min={1} max={20} step={1} unit="x" onChange={setMaxLeverage} disabled={!canConfig} />
          <Stepper label="Max Correlated Positions" value={maxCorrelated} min={1} max={10} step={1} unit="" onChange={setMaxCorrelated} disabled={!canConfig} />
        </View>

        <View style={{ height: 20 }} />

        {/* Auto risk actions */}
        <View style={s.card}>
          <SectionTitle title="Auto Risk Actions" icon="flash-outline" />
          <ToggleRow label="Auto-reduce leverage when above limit" value={autoReduceLev} onChange={setAutoReduceLev} disabled={!canConfig} />
          <ToggleRow label="Auto-close losing positions at drawdown limit" value={autoClose} onChange={setAutoClose} disabled={!canConfig} />
          <ToggleRow label="Diversification enforcer (block concentrated trades)" value={diversEnforcer} onChange={setDiversEnforcer} disabled={!canConfig} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, flex: 1 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  planBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
});
