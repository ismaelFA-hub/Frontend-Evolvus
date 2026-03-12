import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Animated, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useUserLevel } from "@/lib/user-level-context";
import { getBotData } from "@/lib/market-data";
import { BRAIN_CATALOG, getConfluenceAnalysis } from "@/lib/quantum-engine";
import LockedFeature from "@/components/LockedFeature";

const C = Colors.dark;

function PulsingDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: anim }} />;
}

interface AITool {
  icon: any;
  label: string;
  subtitle: string;
  color: string;
  route: string;
  minLevel: "beginner" | "intermediate" | "advanced";
  badge?: string;
}

const AI_TOOLS: AITool[] = [
  { icon: "sparkles-outline",     label: "IA Explicável",       subtitle: "Analise sinais dos 54 cérebros",   color: "#00D4AA", route: "/ai-explain",          minLevel: "beginner"     },
  { icon: "people-outline",       label: "Copy Trading",         subtitle: "Copie traders de sucesso",         color: "#7B61FF", route: "/copy-trading",        minLevel: "beginner"     },
  { icon: "git-branch-outline",   label: "Hive Mind",            subtitle: "Consciência coletiva dos bots",    color: "#00D4E8", route: "/hive-mind",           minLevel: "intermediate", badge: "PRO" },
  { icon: "person-outline",       label: "Shadow Coach",         subtitle: "Análise comportamental da IA",     color: "#A78BFA", route: "/portfolio-analytics", minLevel: "intermediate", badge: "PRO" },
  { icon: "radio-outline",        label: "Detector de Regime",   subtitle: "Identifica ciclos de mercado",     color: "#F7931A", route: "/ai-regime",           minLevel: "intermediate", badge: "PRO" },
  { icon: "body-outline",         label: "Digital Twin",         subtitle: "Simulação paralela do portfólio",  color: "#FF5252", route: "/digital-twin",        minLevel: "advanced",    badge: "PREMIUM" },
  { icon: "scale-outline",        label: "Pesos dos Cérebros",   subtitle: "Calibre os 54 algoritmos",        color: "#FBBF24", route: "/brain-weights",        minLevel: "advanced",    badge: "PREMIUM" },
  { icon: "flask-outline",        label: "Lab Genético",         subtitle: "Evolução de estratégias por IA",  color: "#E040FB", route: "/genetic-lab",          minLevel: "advanced",    badge: "PREMIUM" },
  { icon: "dice-outline",         label: "Monte Carlo",          subtitle: "Simulação probabilística",         color: "#34D399", route: "/monte-carlo",          minLevel: "advanced",    badge: "PREMIUM" },
  { icon: "trending-up-outline",  label: "Grid Evolutivo",       subtitle: "Grid auto-adaptativo por IA",     color: "#60A5FA", route: "/grid-evolutivo",       minLevel: "intermediate", badge: "PRO" },
  { icon: "repeat-outline",       label: "DCA Inteligente",      subtitle: "Compra recorrente optimizada",    color: "#00B894", route: "/dca-inteligente",      minLevel: "beginner"     },
  { icon: "analytics-outline",    label: "Strategy Builder",     subtitle: "Construa estratégias visuais",    color: "#FCA5A5", route: "/strategy-builder",    minLevel: "intermediate", badge: "PRO" },
];

const TRADING_TOOLS = [
  { icon: "shield-outline",          label: "Risk Manager",       color: "#FF5252", route: "/risk-manager",      minLevel: "intermediate" as const },
  { icon: "git-network-outline",     label: "Multi-Exchange",     color: "#60A5FA", route: "/multi-exchange",    minLevel: "intermediate" as const },
  { icon: "bar-chart-outline",       label: "Portfolio Analytics",color: "#A78BFA", route: "/portfolio-analytics", minLevel: "beginner" as const },
  { icon: "grid-outline",            label: "Grid Trading",       color: "#00D4AA", route: "/grid-trading",      minLevel: "intermediate" as const },
  { icon: "swap-horizontal-outline", label: "Arbitragem",         color: "#F7931A", route: "/arbitrage",         minLevel: "advanced" as const },
  { icon: "pulse-outline",           label: "API Health",         color: "#34D399", route: "/api-health",        minLevel: "advanced" as const },
  { icon: "list-outline",            label: "Exec. Monitor",      color: "#FBBF24", route: "/execution-monitor", minLevel: "advanced" as const },
  { icon: "journal-outline",         label: "Trade Journal",      color: "#F87171", route: "/trade-journal",     minLevel: "intermediate" as const },
];

const TOTAL_BRAINS = 54;
const PLAN_BRAIN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 29,
  premium: 40,
  enterprise: 54,
  admin: 54,
};
const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  enterprise: "Enterprise",
  admin: "Admin",
};

export default function IAScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const { level, canAccess, setLevel } = useUserLevel();
  const bots = getBotData();
  const activeBots = bots.filter(b => b.status === "running");
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [showBrainModal, setShowBrainModal] = useState(false);

  const planBrains = PLAN_BRAIN_LIMITS[planType] ?? 5;
  const confluence = getConfluenceAnalysis("BTC");
  const overallConfidence = Math.round(confluence.consciousnessLevel * 100);

  const visibleAITools = AI_TOOLS.filter(t => canAccess(t.minLevel));
  const visibleTradingTools = TRADING_TOOLS.filter(t => canAccess(t.minLevel));

  function handleToolPress(route: string, minLevel: "beginner" | "intermediate" | "advanced") {
    if (!canAccess(minLevel)) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  }

  const LEVEL_LABELS: Record<string, string> = {
    beginner: "Iniciante",
    intermediate: "Intermediário",
    advanced: "Avançado",
  };

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>IA & Automação</Text>
          <Text style={s.headerSub}>Evolvus Quantum Engine</Text>
        </View>
        <Pressable
          style={[s.levelBadge, { borderColor: planTheme.primary + "40", backgroundColor: planTheme.primaryDim }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const next: Record<string, string> = { beginner: "intermediate", intermediate: "advanced", advanced: "beginner" };
            setLevel(next[level] as any);
          }}
        >
          <Ionicons name="layers-outline" size={13} color={planTheme.primary} />
          <Text style={[s.levelBadgeText, { color: planTheme.primary }]}>{LEVEL_LABELS[level]}</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}>

        <View style={[s.brainCard, { borderColor: planTheme.primary + "30", backgroundColor: planTheme.primaryDim }]}>
          <View style={s.brainRow}>
            <Pressable
              style={s.brainStat}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowBrainModal(true); }}
            >
              <View style={s.brainStatHeader}>
                <PulsingDot color={C.success} />
                <Text style={[s.brainStatValue, { color: C.success }]}>
                  {planBrains}<Text style={[s.brainStatValue, { color: C.textTertiary, fontSize: 13 }]}>/{TOTAL_BRAINS}</Text>
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Text style={s.brainStatLabel}>Cérebros Ativos</Text>
                <Ionicons name="information-circle-outline" size={11} color={C.textTertiary} />
              </View>
            </Pressable>
            <View style={s.brainDivider} />
            <View style={s.brainStat}>
              <Text style={[s.brainStatValue, { color: planTheme.primary }]}>{overallConfidence}%</Text>
              <Text style={s.brainStatLabel}>Confiança Geral</Text>
            </View>
            <View style={s.brainDivider} />
            <View style={s.brainStat}>
              <Text style={[s.brainStatValue, { color: C.warning }]}>{activeBots.length}</Text>
              <Text style={s.brainStatLabel}>Bots Rodando</Text>
            </View>
          </View>
          <View style={[s.confidenceBar, { backgroundColor: C.surface }]}>
            <View style={[s.confidenceFill, { width: `${overallConfidence}%` as any, backgroundColor: planTheme.primary }]} />
          </View>
          <Text style={s.regimeLabel}>Regime Detectado: <Text style={{ color: planTheme.primary }}>Tendência de Alta</Text></Text>
        </View>

        {level === "beginner" && (
          <Pressable
            style={[s.discoverBanner, { borderColor: "#7B61FF40", backgroundColor: "#7B61FF15" }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLevel("intermediate"); }}
          >
            <Ionicons name="rocket-outline" size={22} color="#7B61FF" />
            <View style={{ flex: 1 }}>
              <Text style={[s.discoverTitle, { color: "#7B61FF" }]}>Desbloqueie Ferramentas Avançadas</Text>
              <Text style={s.discoverSub}>Mude para Intermediário ou Avançado para acessar Hive Mind, Grid Evolutivo e mais 20 ferramentas.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#7B61FF" />
          </Pressable>
        )}

        <View style={s.sectionHeader}>
          <Ionicons name="sparkles" size={16} color={planTheme.primary} />
          <Text style={[s.sectionTitle, { color: planTheme.primary }]}>Ferramentas de IA</Text>
          <Text style={s.toolCount}>{visibleAITools.length} disponíveis</Text>
        </View>

        <View style={s.toolsGrid}>
          {visibleAITools.map((tool) => {
            const badgeToplan: Record<string, "pro" | "premium" | "enterprise"> = {
              PRO: "pro",
              PREMIUM: "premium",
              ENTERPRISE: "enterprise",
            };
            const requiredPlan = tool.badge ? badgeToplan[tool.badge] : undefined;
            const planOrder = ["free", "pro", "premium", "enterprise", "admin"];
            const userIdx = planType === "admin" ? 999 : planOrder.indexOf(planType);
            const reqIdx = requiredPlan ? planOrder.indexOf(requiredPlan) : -1;
            const isLocked = requiredPlan !== undefined && userIdx < reqIdx;

            const cardInner = (
              <>
                <View style={s.toolCardHeader}>
                  <View style={[s.toolIconWrap, { backgroundColor: tool.color + "20" }]}>
                    <Ionicons name={tool.icon} size={20} color={tool.color} />
                  </View>
                  {tool.badge && (
                    <View style={[s.toolBadge, { backgroundColor: tool.color + "20" }]}>
                      <Text style={[s.toolBadgeText, { color: tool.color }]}>{tool.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={s.toolLabel}>{tool.label}</Text>
                <Text style={s.toolSubtitle} numberOfLines={2}>{tool.subtitle}</Text>
              </>
            );

            if (isLocked) {
              return (
                <LockedFeature
                  key={tool.route}
                  userPlan={planType as any}
                  requiredPlan={requiredPlan!}
                  style={[s.toolCard, { borderColor: tool.color + "25", backgroundColor: tool.color + "0E" }]}
                >
                  {cardInner}
                </LockedFeature>
              );
            }

            return (
              <Pressable
                key={tool.route}
                style={[s.toolCard, { borderColor: tool.color + "25", backgroundColor: tool.color + "0E" }]}
                onPress={() => handleToolPress(tool.route, tool.minLevel)}
              >
                {cardInner}
              </Pressable>
            );
          })}
        </View>

        <View style={s.sectionHeader}>
          <Ionicons name="hardware-chip" size={16} color={C.warning} />
          <Text style={[s.sectionTitle, { color: C.warning }]}>Robôs Autônomos</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/bots" as any); }}>
            <Text style={[s.seeAll, { color: planTheme.primary }]}>Gerenciar →</Text>
          </Pressable>
        </View>

        {activeBots.length === 0 ? (
          <View style={[s.emptyState, { borderColor: C.border }]}>
            <Ionicons name="hardware-chip-outline" size={36} color={C.textTertiary} />
            <Text style={s.emptyTitle}>Nenhum bot ativo</Text>
            <Text style={s.emptySub}>Crie seu primeiro robô autônomo para operar 24/7 com IA.</Text>
            <Pressable
              style={[s.emptyBtn, { backgroundColor: planTheme.primary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)/bots" as any); }}
            >
              <Ionicons name="add" size={16} color="#000" />
              <Text style={s.emptyBtnText}>Criar Primeiro Bot</Text>
            </Pressable>
          </View>
        ) : (
          <View style={s.botsList}>
            {activeBots.slice(0, 4).map((bot) => (
              <Pressable
                key={bot.id}
                style={[s.botRow, { borderColor: C.border }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/bot/[id]", params: { id: bot.id } }); }}
              >
                <View style={s.botLeft}>
                  <View style={[s.botIcon, { backgroundColor: C.success + "15" }]}>
                    <PulsingDot color={C.success} />
                  </View>
                  <View>
                    <Text style={s.botName}>{bot.name}</Text>
                    <Text style={s.botSymbol}>{bot.pair} · {bot.type.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={s.botRight}>
                  <Text style={[s.botPnl, { color: bot.profit >= 0 ? C.success : C.danger }]}>
                    {bot.profit >= 0 ? "+" : ""}{bot.profitPercent.toFixed(1)}%
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
                </View>
              </Pressable>
            ))}
            {activeBots.length > 4 && (
              <Pressable style={s.moreBotsBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/bots" as any); }}>
                <Text style={[s.moreBotsText, { color: planTheme.primary }]}>Ver todos os {bots.length} robôs →</Text>
              </Pressable>
            )}
          </View>
        )}

        {canAccess("intermediate") && (
          <>
            <View style={s.sectionHeader}>
              <Ionicons name="construct-outline" size={16} color={C.secondary} />
              <Text style={[s.sectionTitle, { color: C.secondary }]}>Ferramentas de Trading</Text>
            </View>

            <View style={s.tradingGrid}>
              {visibleTradingTools.map((tool) => (
                <Pressable
                  key={tool.route}
                  style={[s.tradingCard, { borderColor: tool.color + "30" }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(tool.route as any); }}
                >
                  <View style={[s.tradingIconWrap, { backgroundColor: tool.color + "18" }]}>
                    <Ionicons name={tool.icon as any} size={18} color={tool.color} />
                  </View>
                  <Text style={s.tradingLabel} numberOfLines={2}>{tool.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showBrainModal} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setShowBrainModal(false)}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={[s.modalIconWrap, { backgroundColor: planTheme.primaryDim }]}>
                <Ionicons name="hardware-chip-outline" size={22} color={planTheme.primary} />
              </View>
              <Text style={s.modalTitle}>Cérebros de IA</Text>
              <Pressable onPress={() => setShowBrainModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={C.textSecondary} />
              </Pressable>
            </View>

            <Text style={s.modalDesc}>
              O Evolvus Quantum Engine possui <Text style={{ color: C.success, fontFamily: "Inter_700Bold" }}>{TOTAL_BRAINS} microcérebros de IA</Text> — algoritmos independentes que analisam o mercado 24/7.
            </Text>
            <Text style={[s.modalDesc, { marginTop: 8 }]}>
              Seu plano <Text style={{ color: planTheme.primary, fontFamily: "Inter_700Bold" }}>{PLAN_NAMES[planType] ?? planType}</Text> permite operar com <Text style={{ color: C.success, fontFamily: "Inter_700Bold" }}>{planBrains} cérebros ativos</Text>.
            </Text>

            <View style={s.modalGrid}>
              {Object.entries(PLAN_BRAIN_LIMITS).map(([plan, count]) => (
                <View key={plan} style={[s.modalPlanRow, planType === plan && { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]}>
                  <Text style={[s.modalPlanName, planType === plan && { color: planTheme.primary }]}>{PLAN_NAMES[plan]}</Text>
                  <Text style={[s.modalPlanCount, planType === plan && { color: planTheme.primary }]}>{count} cérebros</Text>
                </View>
              ))}
            </View>

            {planBrains < TOTAL_BRAINS && (
              <Pressable
                style={[s.modalUpgradeBtn, { backgroundColor: planTheme.primary }]}
                onPress={() => { setShowBrainModal(false); router.push("/billing"); }}
              >
                <Text style={s.modalUpgradeText}>Fazer Upgrade de Plano</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 1 },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  levelBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  scroll: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },
  brainCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  brainRow: { flexDirection: "row", alignItems: "center" },
  brainStat: { flex: 1, alignItems: "center", gap: 4 },
  brainStatHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  brainStatValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  brainStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  brainDivider: { width: 1, height: 40, backgroundColor: C.border },
  confidenceBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  confidenceFill: { height: "100%", borderRadius: 2 },
  regimeLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "center" },
  discoverBanner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  discoverTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  discoverSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  toolCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  seeAll: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: { width: "47%", flexGrow: 1, flexBasis: "45%", padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  toolCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toolIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toolBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  toolBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 9 },
  toolLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  toolSubtitle: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, lineHeight: 15 },
  botsList: { gap: 8 },
  botRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, padding: 14, borderRadius: 12, borderWidth: 1 },
  botLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  botIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  botName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  botSymbol: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  botRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  botPnl: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  moreBotsBtn: { alignItems: "center", paddingVertical: 10 },
  moreBotsText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  emptyState: { alignItems: "center", gap: 10, padding: 28, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#000" },
  tradingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tradingCard: { width: "22%", flexGrow: 1, flexBasis: "20%", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: C.card },
  tradingIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tradingLabel: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.text, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { backgroundColor: C.surface, borderRadius: 20, padding: 20, width: "100%", borderWidth: 1, borderColor: C.border, gap: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  modalIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalTitle: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 17, color: C.text },
  modalDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  modalGrid: { gap: 6 },
  modalPlanRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  modalPlanName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  modalPlanCount: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.textSecondary },
  modalUpgradeBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  modalUpgradeText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
});
