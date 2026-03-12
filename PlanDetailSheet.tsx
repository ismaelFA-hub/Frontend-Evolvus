import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import QuantumLogo from "@/components/QuantumLogo";
import { PLAN_FEATURES } from "@/lib/market-data";
import { PlanType } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

interface PlanDetailSheetProps {
  plan: PlanType;
  onClose: () => void;
  onSelect: (plan: PlanType) => void;
  currentPlan?: PlanType;
}

const PLAN_QUANTUM_CONFIG: Record<PlanType, {
  intensity: "low" | "medium" | "high" | "ultra";
  nucleusColor: string;
  orbitColor: string;
  electronColor: string;
  descriptionKey: string;
  badgeEmoji?: string;
  badgeKey?: string;
  metrics?: {
    avgReturn: string;
    sharpe: string;
    maxDD: string;
    winRate: string;
  };
}> = {
  free: {
    intensity: "low",
    nucleusColor: "#6B7A99",
    orbitColor: "#4A5568",
    electronColor: "#718096",
    descriptionKey: "planDescFree",
    metrics: { avgReturn: "+10%", sharpe: "0.35", maxDD: "18%", winRate: "52%" },
  },
  pro: {
    intensity: "medium",
    nucleusColor: "#00D4AA",
    orbitColor: "#00B894",
    electronColor: "#00D4AA",
    descriptionKey: "planDescPro",
    badgeEmoji: "🏆",
    badgeKey: "planBadgePro",
    metrics: { avgReturn: "+102.5%", sharpe: "1.10", maxDD: "12%", winRate: "59%" },
  },
  premium: {
    intensity: "high",
    nucleusColor: "#7B61FF",
    orbitColor: "#9B59B6",
    electronColor: "#A78BFA",
    descriptionKey: "planDescPremium",
    badgeEmoji: "🤖",
    badgeKey: "planBadgePremium",
    metrics: { avgReturn: "+450%", sharpe: "2.20", maxDD: "7%", winRate: "65%" },
  },
  enterprise: {
    intensity: "ultra",
    nucleusColor: "#FFB74D",
    orbitColor: "#F59E0B",
    electronColor: "#FBBF24",
    descriptionKey: "planDescEnterprise",
    badgeEmoji: "🏛️",
    badgeKey: "planBadgeEnterprise",
    metrics: { avgReturn: "+605%", sharpe: "2.65", maxDD: "5%", winRate: "68%" },
  },
  admin: {
    intensity: "ultra",
    nucleusColor: "#00D4E8",
    orbitColor: "#00B8CC",
    electronColor: "#67E8F9",
    descriptionKey: "planDescEnterprise",
    badgeEmoji: "⚡",
    badgeKey: "planBadgeEnterprise",
    metrics: { avgReturn: "+999%", sharpe: "∞", maxDD: "0%", winRate: "100%" },
  },
};

export default function PlanDetailSheet({ plan, onClose, onSelect, currentPlan }: PlanDetailSheetProps) {
  const { t } = useI18n();
  const safePlan = plan === "admin" ? "enterprise" : plan;
  const info = PLAN_FEATURES[safePlan] ?? PLAN_FEATURES.enterprise;
  const quantum = PLAN_QUANTUM_CONFIG[plan] ?? PLAN_QUANTUM_CONFIG.enterprise;
  const isCurrentPlan = currentPlan === plan;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { borderTopColor: `${info.color}40` }]}>
        <View style={styles.grabber} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={C.textSecondary} />
          </Pressable>

          <View style={styles.logoSection}>
            <QuantumLogo
              size={140}
              intensity={quantum.intensity}
              nucleusColor={quantum.nucleusColor}
              orbitColor={quantum.orbitColor}
              electronColor={quantum.electronColor}
            />
          </View>

          <View style={styles.headerSection}>
            <Text style={[styles.planName, { color: info.color }]}>{t(plan as any)}</Text>
            {quantum.badgeEmoji && quantum.badgeKey && (
              <View style={[styles.badge, { backgroundColor: `${info.color}18`, borderColor: `${info.color}40` }]}>
                <Text style={styles.badgeEmoji}>{quantum.badgeEmoji}</Text>
                <Text style={[styles.badgeText, { color: info.color }]}>{t(quantum.badgeKey as any)}</Text>
              </View>
            )}
            <Text style={styles.planPrice}>{info.price}</Text>
            <Text style={styles.planDescription}>{t(quantum.descriptionKey as any)}</Text>
          </View>

          {quantum.metrics && (
            <View style={[styles.metricsSection, { borderColor: `${info.color}25` }]}>
              <Text style={styles.metricsTitle}>{t('planPerformance' as any)}</Text>
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: `${info.color}0D` }]}>
                  <Text style={[styles.metricValue, { color: info.color }]}>{quantum.metrics.avgReturn}</Text>
                  <Text style={styles.metricLabel}>{t('planAvgReturn' as any)}</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: `${info.color}0D` }]}>
                  <Text style={[styles.metricValue, { color: info.color }]}>{quantum.metrics.sharpe}</Text>
                  <Text style={styles.metricLabel}>{t('planSharpe' as any)}</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: `${info.color}0D` }]}>
                  <Text style={[styles.metricValue, { color: info.color }]}>{quantum.metrics.maxDD}</Text>
                  <Text style={styles.metricLabel}>{t('planMaxDD' as any)}</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: `${info.color}0D` }]}>
                  <Text style={[styles.metricValue, { color: info.color }]}>{quantum.metrics.winRate}</Text>
                  <Text style={styles.metricLabel}>{t('planWinRate' as any)}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>{t('planBenefits')}</Text>
            {info.featureKeys.map((key, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={[styles.benefitIcon, { backgroundColor: `${info.color}18` }]}>
                  <Ionicons name="checkmark" size={14} color={info.color} />
                </View>
                <Text style={styles.benefitText}>{t(key as any) || key}</Text>
              </View>
            ))}
          </View>

          {isCurrentPlan ? (
            <View style={[styles.currentPlanBadge, { borderColor: info.color }]}>
              <Ionicons name="checkmark-circle" size={18} color={info.color} />
              <Text style={[styles.currentPlanText, { color: info.color }]}>{t('currentPlanBadge')}</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.selectButton, { backgroundColor: info.color }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onSelect(plan); }}
            >
              <Text style={styles.selectButtonText}>
                {plan === "free" ? t('selectPlan') : plan === "enterprise" ? t('selectPlan') : `${t('upgradeToX')} ${t(plan as any)}`}
              </Text>
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  sheet: {
    backgroundColor: C.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    maxHeight: "88%",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 20,
  },
  closeBtn: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logoSection: {
    alignItems: "center",
    paddingVertical: 10,
  },
  headerSection: {
    alignItems: "center",
    gap: 6,
  },
  planName: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: 2,
  },
  planPrice: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: C.text,
  },
  planDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  benefitsSection: {
    gap: 10,
  },
  benefitsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.text,
    marginBottom: 4,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  benefitIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    flex: 1,
  },
  currentPlanBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  currentPlanText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  selectButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  selectButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0A0E17",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  metricsSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  metricsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  metricLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textTertiary,
    textAlign: "center",
  },
});
