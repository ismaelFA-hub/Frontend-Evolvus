import { useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { PLAN_FEATURES } from "@/lib/market-data";

const C = Colors.dark;

type PlanKey = "free" | "pro" | "premium" | "enterprise";
const PLAN_ORDER: PlanKey[] = ["free", "pro", "premium", "enterprise"];

interface Metric {
  icon: string;
  label: string;
  current: string;
  target: string;
  improvement: string | null;
  color: string;
}

function computeMetrics(currentKey: PlanKey, targetKey: PlanKey): Metric[] {
  const cur = PLAN_FEATURES[currentKey];
  const tgt = PLAN_FEATURES[targetKey];

  const botCounts: Record<PlanKey, number> = { free: 1, pro: 10, premium: 35, enterprise: 9999 };
  const aiCounts: Record<PlanKey, number> = { free: 5, pro: 29, premium: 40, enterprise: 54 };
  const backtestDays: Record<PlanKey, number> = { free: 30, pro: 365, premium: 1825, enterprise: 99999 };

  const curBots = botCounts[currentKey];
  const tgtBots = botCounts[targetKey];
  const curAI = aiCounts[currentKey];
  const tgtAI = aiCounts[targetKey];
  const curBack = backtestDays[currentKey];
  const tgtBack = backtestDays[targetKey];

  const botPct = curBots > 0 ? Math.round((tgtBots / curBots - 1) * 100) : null;
  const aiPct = curAI > 0 ? Math.round((tgtAI / curAI - 1) * 100) : null;
  const backPct = curBack > 0 ? Math.round((tgtBack / curBack - 1) * 100) : null;

  return [
    {
      icon: "hardware-chip-outline",
      label: "Robôs ativos",
      current: curBots >= 9999 ? "∞" : String(curBots),
      target: tgtBots >= 9999 ? "∞" : String(tgtBots),
      improvement: botPct !== null && botPct > 0 ? `+${botPct}%` : null,
      color: "#00D4AA",
    },
    {
      icon: "swap-horizontal-outline",
      label: "Exchanges",
      current: String(cur.maxExchanges),
      target: tgt.maxExchanges >= 999 ? "∞" : String(tgt.maxExchanges),
      improvement: tgt.maxExchanges > cur.maxExchanges ? `+${tgt.maxExchanges - cur.maxExchanges}` : null,
      color: "#3B82F6",
    },
    {
      icon: "sparkles-outline",
      label: "Microcérebros IA",
      current: String(curAI),
      target: String(tgtAI),
      improvement: aiPct !== null && aiPct > 0 ? `+${aiPct}%` : null,
      color: "#A855F7",
    },
    {
      icon: "time-outline",
      label: "Backtest",
      current: curBack >= 99999 ? "∞" : `${curBack}d`,
      target: tgtBack >= 99999 ? "∞" : `${tgtBack}d`,
      improvement: backPct !== null && backPct > 0 ? `+${backPct}%` : null,
      color: "#F59E0B",
    },
  ];
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <View style={[ms.metricCard, { borderColor: metric.color + "30" }]}>
      <View style={[ms.iconWrap, { backgroundColor: metric.color + "18" }]}>
        <Ionicons name={metric.icon as any} size={20} color={metric.color} />
      </View>
      <Text style={ms.metricLabel}>{metric.label}</Text>
      <View style={ms.metricValues}>
        <View style={ms.metricFrom}>
          <Text style={ms.metricFromVal}>{metric.current}</Text>
          <Text style={ms.metricFromLabel}>Atual</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={C.textTertiary} style={{ marginHorizontal: 8, marginTop: 2 }} />
        <View style={ms.metricTo}>
          <Text style={[ms.metricToVal, { color: metric.color }]}>{metric.target}</Text>
          <Text style={[ms.metricToLabel, { color: metric.color }]}>Novo</Text>
        </View>
      </View>
      {metric.improvement && (
        <View style={[ms.improvBadge, { backgroundColor: metric.color + "18" }]}>
          <Text style={[ms.improvText, { color: metric.color }]}>{metric.improvement}</Text>
        </View>
      )}
    </View>
  );
}

export default function PlanUpgradeScreen() {
  const insets = useSafeAreaInsets();
  const { required } = useLocalSearchParams<{ required?: string }>();
  const { effectivePlan } = useAuth();
  const webTop = Platform.OS === "web" ? 67 : 0;

  const currentKey = (PLAN_ORDER.includes(effectivePlan as PlanKey) ? effectivePlan : "free") as PlanKey;
  const targetKey = (PLAN_ORDER.includes(required as PlanKey) ? required : "pro") as PlanKey;

  const currentPlan = PLAN_FEATURES[currentKey];
  const targetPlan = PLAN_FEATURES[targetKey];

  const higherPlans = PLAN_ORDER.slice(PLAN_ORDER.indexOf(targetKey));

  const metrics = computeMetrics(currentKey, targetKey);

  const exclusiveFeatures = targetPlan.features.filter(
    (f) => !currentPlan.features.includes(f)
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Desbloqueie Mais</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.currentPlanBadge, { borderColor: currentPlan.color + "40" }]}>
          <Text style={[styles.currentPlanLabel, { color: currentPlan.color }]}>
            Seu plano atual: {currentPlan.name}
          </Text>
        </View>

        <View style={[styles.targetCard, { borderColor: targetPlan.color + "50" }]}>
          <View style={[styles.targetBadge, { backgroundColor: targetPlan.color + "20" }]}>
            <Ionicons name="rocket-outline" size={18} color={targetPlan.color} />
            <Text style={[styles.targetBadgeText, { color: targetPlan.color }]}>
              Plano {targetPlan.name}
            </Text>
          </View>
          <Text style={[styles.targetPrice, { color: targetPlan.color }]}>{targetPlan.price}</Text>
          <Text style={styles.targetDesc}>
            Acesse funcionalidades exclusivas que transformam sua performance
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Comparação de Recursos</Text>
        <View style={styles.metricsGrid}>
          {metrics.map((m) => <MetricCard key={m.label} metric={m} />)}
        </View>

        {exclusiveFeatures.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              O que você desbloqueia no {targetPlan.name}
            </Text>
            <View style={[styles.featuresCard, { borderColor: targetPlan.color + "30" }]}>
              {exclusiveFeatures.map((feat, i) => (
                <View key={i} style={styles.featRow}>
                  <View style={[styles.featDot, { backgroundColor: targetPlan.color }]} />
                  <Text style={styles.featText}>{feat}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {higherPlans.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Planos Disponíveis</Text>
            {higherPlans.map((planKey) => {
              const p = PLAN_FEATURES[planKey];
              const isTarget = planKey === targetKey;
              return (
                <Pressable
                  key={planKey}
                  style={[styles.planRow, { borderColor: p.color + (isTarget ? "80" : "30"), backgroundColor: isTarget ? p.color + "10" : "transparent" }]}
                  onPress={() => { Haptics.selectionAsync(); router.push(`/plan-upgrade?required=${planKey}`); }}
                >
                  <View style={[styles.planRowDot, { backgroundColor: p.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planRowName, { color: isTarget ? p.color : C.text }]}>{p.name}</Text>
                    <Text style={styles.planRowPrice}>{p.price}</Text>
                  </View>
                  {isTarget && <Ionicons name="checkmark-circle" size={20} color={p.color} />}
                  {!isTarget && <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />}
                </Pressable>
              );
            })}
          </>
        )}

        <Pressable
          style={[styles.ctaBtn, { backgroundColor: targetPlan.color }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); router.push("/payment"); }}
        >
          <Ionicons name="arrow-up-circle-outline" size={20} color="#0A0E17" />
          <Text style={styles.ctaBtnText}>Ver Planos e Assinar</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const ms = StyleSheet.create({
  metricCard: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    alignItems: "flex-start",
    gap: 6,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metricLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#9CA3AF" },
  metricValues: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  metricFrom: { alignItems: "center" },
  metricFromVal: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#6B7280" },
  metricFromLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: "#6B7280", marginTop: 2 },
  metricTo: { alignItems: "center" },
  metricToVal: { fontFamily: "Inter_700Bold", fontSize: 18 },
  metricToLabel: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 },
  improvBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start" },
  improvText: { fontFamily: "Inter_700Bold", fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  scroll: { padding: 20, gap: 4 },
  currentPlanBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  currentPlanLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  targetCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 24,
    gap: 8,
  },
  targetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  targetBadgeText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  targetPrice: { fontFamily: "Inter_700Bold", fontSize: 28 },
  targetDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: C.text,
    marginTop: 8,
    marginBottom: 12,
  },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  featuresCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  featRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  featText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1, lineHeight: 20 },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  planRowDot: { width: 10, height: 10, borderRadius: 5 },
  planRowName: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#E5E7EB" },
  planRowPrice: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#6B7280", marginTop: 2 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  ctaBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#0A0E17" },
});
