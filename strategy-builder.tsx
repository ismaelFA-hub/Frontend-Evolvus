import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
  TextInput, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import {
  BRAIN_CATALOG, STRATEGY_DNA_CATALOG,
  type BrainConfig, type StrategyDNA, type BrainCategory,
} from "@/lib/quantum-engine";
import {
  useBrainWeights,
  useShadowAnalysis,
  useStrategyGenerate,
} from "@/lib/use-ai";

const C = Colors.dark;

type TabKey = "catalog" | "builder" | "backtest";
type TradeCategory = "scalp" | "swing" | "position";

const CATEGORY_COLORS: Record<TradeCategory, string> = {
  scalp: "#00D4E8",
  swing: "#9945FF",
  position: "#F59E0B",
};

const QAM_COLORS: Record<string, string> = {
  historical_standard: "#6B7A99",
  predictive_synthetic: "#00D4E8",
  quantum_full_spectrum: "#9945FF",
};

const BRAIN_CATEGORY_COLORS: Record<BrainCategory, string> = {
  trend: "#00D4AA",
  momentum: "#7B61FF",
  volatility: "#FF5252",
  volume: "#F7931A",
  pattern: "#00D4E8",
  confluence: "#FFB74D",
  quantitative: "#E040FB",
};

const REGIME_DESCRIPTIONS: Record<string, string> = {
  TRENDING_BULL: "Performs best in strong uptrends",
  TRENDING_BEAR: "Effective in downtrending markets",
  RANGING: "Optimal in sideways/consolidating markets",
  HIGH_VOLATILITY: "Designed for high-volatility breakouts",
  LOW_VOLATILITY: "Works well in quiet, low-volatility sessions",
};

const QAM_DESCRIPTIONS: Record<string, string> = {
  historical_standard: "Standard backtesting on historical OHLCV data",
  predictive_synthetic: "Includes AI-generated synthetic market scenarios",
  quantum_full_spectrum: "Full quantum simulation across all market regimes",
};

// ─── Stepper component ──────────────────────────────────────────────────────
function Stepper({
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  decimals,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  decimals?: number;
}) {
  const dec = decimals ?? (step < 1 ? 1 : 0);
  const decrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.max(min, parseFloat((value - step).toFixed(dec))));
  };
  const increase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(Math.min(max, parseFloat((value + step).toFixed(dec))));
  };
  return (
    <View style={st.stepper}>
      <Pressable
        onPress={decrease}
        disabled={disabled || value <= min}
        style={[st.stepBtn, (disabled || value <= min) && st.stepBtnDisabled]}
      >
        <Ionicons name="remove" size={16} color={disabled || value <= min ? C.textTertiary : C.text} />
      </Pressable>
      <Text style={[st.stepValue, disabled && { color: C.textTertiary }]}>{value.toFixed(dec)}</Text>
      <Pressable
        onPress={increase}
        disabled={disabled || value >= max}
        style={[st.stepBtn, (disabled || value >= max) && st.stepBtnDisabled]}
      >
        <Ionicons name="add" size={16} color={disabled || value >= max ? C.textTertiary : C.text} />
      </Pressable>
    </View>
  );
}

// ─── Locked overlay ──────────────────────────────────────────────────────────
function LockedOverlay({ message }: { message: string }) {
  return (
    <View style={st.lockedOverlay}>
      <Ionicons name="lock-closed" size={28} color="#fff" />
      <Text style={st.lockedText}>{message}</Text>
    </View>
  );
}

// ============================================================================
// MAIN SCREEN
// ============================================================================
export default function StrategyBuilderScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const primary = planTheme.primary;
  const userPlan = user?.plan ?? "free";

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("catalog");

  // ── Selected strategy (shared across tabs) ───────────────────────────────
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyDNA | null>(null);

  // ── Builder state ─────────────────────────────────────────────────────────
  const [strategyName, setStrategyName] = useState("");
  const [category, setCategory] = useState<TradeCategory>("swing");
  const [selectedBrains, setSelectedBrains] = useState<string[]>([]);
  const [stopLoss, setStopLoss] = useState(2.5);
  const [takeProfit, setTakeProfit] = useState(5.0);
  const [maxPositionSize, setMaxPositionSize] = useState(15);
  const [maxDailyTrades, setMaxDailyTrades] = useState(8);
  const [convictionThreshold, setConvictionThreshold] = useState(50);
  const [savedCount] = useState(1); // mock saved strategies count for pro
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Backtest state ────────────────────────────────────────────────────────
  const [backtestJitter] = useState(0);

  // ── AI / Groq integration ─────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("BTC");
  const [shadowMode, setShadowMode] = useState(false);

  const { data: brainWeights } = useBrainWeights();
  const { data: shadowData, isFetching: shadowLoading } = useShadowAnalysis(shadowMode);
  const strategyGenerate = useStrategyGenerate();

  // Build a quick lookup: brainId → tier ("top" | "bottom" | "neutral")
  const brainWeightTier = useMemo<Record<string, "top" | "bottom" | "neutral">>(() => {
    const map: Record<string, "top" | "bottom" | "neutral"> = {};
    if (!brainWeights) return map;
    brainWeights.ranking.top.forEach((b) => { map[b.brainId] = "top"; });
    brainWeights.ranking.bottom.forEach((b) => { map[b.brainId] = "bottom"; });
    return map;
  }, [brainWeights]);

  // ── Plan helpers ──────────────────────────────────────────────────────────
  const canBrowseAll = userPlan !== "free";
  const canCreate = userPlan !== "free";
  const canBacktest = userPlan === "premium" || userPlan === "enterprise" || userPlan === "admin";
  const proSaveLimit = 3;

  // ── Brain catalog grouped ─────────────────────────────────────────────────
  const brainsByCategory = useMemo(() => {
    const grouped: Partial<Record<BrainCategory, BrainConfig[]>> = {};
    BRAIN_CATALOG.forEach((brain) => {
      if (!grouped[brain.category]) grouped[brain.category] = [];
      grouped[brain.category]!.push(brain);
    });
    return grouped;
  }, []);

  const getBrainSignal = (brainId: string) => {
    const tier = brainWeightTier[brainId] ?? "neutral";
    if (tier === "top") return "BUY";
    if (tier === "bottom") return "SELL";
    // Stable deterministic fallback (no random — same value across renders)
    const hash = brainId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const signals = ["BUY", "SELL", "NEUTRAL_SIGNAL"] as const;
    return signals[hash % 3];
  };

  // ── Select strategy from catalog → populate builder ───────────────────────
  const handleSelectStrategy = (strategy: StrategyDNA) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedStrategy(strategy);
    setStrategyName(strategy.name);
    setSelectedBrains(strategy.brains.slice(0, 6));
    setStopLoss(strategy.riskManagement.stopLoss);
    setTakeProfit(strategy.riskManagement.takeProfit);
    setMaxPositionSize(strategy.riskManagement.maxPositionSize);
    setMaxDailyTrades(strategy.riskManagement.maxDailyTrades);
    setActiveTab("builder");
  };

  // ── Toggle brain selection ─────────────────────────────────────────────────
  const toggleBrain = (brainId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBrains((prev) => {
      if (prev.includes(brainId)) return prev.filter((b) => b !== brainId);
      if (prev.length >= 6) {
        Alert.alert("Brain Limit", "You can select a maximum of 6 brains per strategy.");
        return prev;
      }
      return [...prev, brainId];
    });
  };

  // ── Save strategy ─────────────────────────────────────────────────────────
  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // ── Run backtest via AI Strategy Lab ─────────────────────────────────────
  const handleRunBacktest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sym = symbol.trim().toUpperCase() || "BTC";
    strategyGenerate.mutate(
      { symbol: sym, interval: "1h", count: 5, initialCapital: 10000 },
      {
        onError: (err) => Alert.alert("Strategy Lab", err.message),
      }
    );
  };

  // ── Active backtest data — real AI results take priority ─────────────────
  const backtestStrategy = selectedStrategy ?? STRATEGY_DNA_CATALOG[0];
  const bt = backtestStrategy.backtestResults;
  const aiChampion = strategyGenerate.data?.champion;
  const jitteredBt = aiChampion
    ? {
        winRate: aiChampion.winRate,
        totalReturn: aiChampion.totalReturn,
        maxDrawdown: aiChampion.maxDrawdown,
        sharpeRatio: aiChampion.sharpeRatio,
        profitFactor: aiChampion.sharpeRatio > 1 ? aiChampion.sharpeRatio : bt.profitFactor,
        trades: bt.trades,
      }
    : {
        winRate: Math.max(0, Math.min(100, bt.winRate * (1 + backtestJitter))),
        totalReturn: bt.totalReturn * (1 + backtestJitter),
        maxDrawdown: bt.maxDrawdown * (1 + backtestJitter),
        sharpeRatio: bt.sharpeRatio * (1 + backtestJitter),
        profitFactor: bt.profitFactor * (1 + backtestJitter),
        trades: Math.round(bt.trades * (1 + backtestJitter)),
      };

  // =========================================================================
  // RENDER
  // =========================================================================
  return (
    <View style={[st.container, { paddingTop: insets.top + webTopInset }]}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={st.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={st.headerTitle}>Strategy Builder</Text>
        <View style={[st.planBadge, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
          <Text style={[st.planBadgeText, { color: primary }]}>{userPlan.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={st.tabBar}>
        {([
          { key: "catalog" as TabKey, label: "Pre-Built", icon: "library-outline" },
          { key: "builder" as TabKey, label: "Builder", icon: "construct-outline" },
          { key: "backtest" as TabKey, label: "Backtest", icon: "analytics-outline" },
        ] as const).map((tab) => (
          <Pressable
            key={tab.key}
            testID={`tab-${tab.key}`}
            style={[st.tabItem, activeTab === tab.key && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? primary : C.textTertiary} />
            <Text style={[st.tabLabel, activeTab === tab.key && { color: primary }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.scrollContent}>

        {/* ================================================================ */}
        {/* TAB 1 — CATALOG                                                   */}
        {/* ================================================================ */}
        {activeTab === "catalog" && (
          <View style={st.tabContent}>
            {STRATEGY_DNA_CATALOG.map((strategy, index) => {
              const locked = !canBrowseAll && index >= 2;
              const desc = language === "pt" ? strategy.descriptionPt : strategy.description;
              const qamColor = QAM_COLORS[strategy.quantumAnalysisMode] ?? "#6B7A99";
              const catColor = CATEGORY_COLORS.swing; // pre-built default
              return (
                <View key={strategy.id} style={[st.stratCard, locked && st.stratCardLocked]}>
                  {/* Name row */}
                  <View style={st.stratCardHeader}>
                    <Text style={st.stratName}>{strategy.name}</Text>
                    <View style={[st.qamBadge, { backgroundColor: `${qamColor}20`, borderColor: `${qamColor}40` }]}>
                      <Text style={[st.qamBadgeText, { color: qamColor }]}>
                        {strategy.quantumAnalysisMode.replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>

                  {/* Category badge */}
                  <View style={[st.catBadge, { backgroundColor: `${catColor}20`, borderColor: `${catColor}40` }]}>
                    <Text style={[st.catBadgeText, { color: catColor }]}>SWING</Text>
                  </View>

                  {/* Description */}
                  <Text style={st.stratDesc} numberOfLines={3}>{desc}</Text>

                  {/* Brain count pill */}
                  <View style={st.brainCountPill}>
                    <Ionicons name="hardware-chip-outline" size={12} color={C.textSecondary} />
                    <Text style={st.brainCountText}>{strategy.brains.length} Brains</Text>
                  </View>

                  {/* Stats grid */}
                  <View style={st.statsGrid}>
                    {[
                      { label: "Win Rate", value: `${strategy.backtestResults.winRate.toFixed(1)}%`, positive: true },
                      { label: "Total Return", value: `+${strategy.backtestResults.totalReturn.toFixed(1)}%`, positive: true },
                      { label: "Max Drawdown", value: `${strategy.backtestResults.maxDrawdown.toFixed(1)}%`, positive: false },
                      { label: "Sharpe Ratio", value: strategy.backtestResults.sharpeRatio.toFixed(2), positive: true },
                    ].map((stat) => (
                      <View key={stat.label} style={st.statItem}>
                        <Text style={st.statLabel}>{stat.label}</Text>
                        <Text style={[st.statValue, { color: stat.positive ? C.success : C.danger }]}>{stat.value}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Best regimes */}
                  <View style={st.regimeChips}>
                    {strategy.marketConditions.bestRegimes.map((r) => (
                      <View key={r} style={[st.regimeChip, { backgroundColor: `${primary}15` }]}>
                        <Text style={[st.regimeChipText, { color: primary }]}>{r.replace(/_/g, " ")}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Select button */}
                  {!locked && (
                    <Pressable
                      style={[st.selectBtn, { backgroundColor: primary }]}
                      onPress={() => handleSelectStrategy(strategy)}
                    >
                      <Text style={st.selectBtnText}>Select Strategy</Text>
                    </Pressable>
                  )}

                  {/* Lock overlay */}
                  {locked && <LockedOverlay message="Pro required — Upgrade to unlock all strategies" />}
                </View>
              );
            })}
          </View>
        )}

        {/* ================================================================ */}
        {/* TAB 2 — BUILDER                                                   */}
        {/* ================================================================ */}
        {activeTab === "builder" && (
          <View style={st.tabContent}>
            {/* ── Section A: Identity ── */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>Strategy Identity</Text>

              <Text style={st.inputLabel}>Strategy Name</Text>
              <TextInput
                style={[st.textInput, !canCreate && st.inputDisabled]}
                placeholder="My Quantum Strategy"
                placeholderTextColor={C.textTertiary}
                value={strategyName}
                onChangeText={setStrategyName}
                editable={canCreate}
              />

              <Text style={st.inputLabel}>Category</Text>
              <View style={st.pillRow}>
                {(["scalp", "swing", "position"] as TradeCategory[]).map((cat) => {
                  const color = CATEGORY_COLORS[cat];
                  const selected = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      disabled={!canCreate}
                      style={[st.pill, { borderColor: color }, selected && { backgroundColor: `${color}25` }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCategory(cat); }}
                    >
                      <Text style={[st.pillText, { color: selected ? color : C.textTertiary }]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Shadow Mode — AI-powered paper portfolio coach */}
              <View style={st.shadowRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.shadowLabel}>Shadow Mode Coach</Text>
                  <Text style={[st.sectionSubtitle, { marginTop: 2 }]}>
                    {shadowMode ? "IA analisando seu portfólio paper…" : "Treina com dinheiro virtual antes do real"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShadowMode((v) => !v);
                  }}
                  style={[st.toggleTrack, shadowMode && { backgroundColor: `${primary}40`, borderColor: primary }]}
                >
                  <View style={[st.toggleThumb, shadowMode && { transform: [{ translateX: 18 }], backgroundColor: primary }]} />
                </Pressable>
              </View>
              {/* Shadow analysis panel */}
              {shadowMode && (
                <View style={[st.shadowPanel, { borderColor: `${primary}30` }]}>
                  {shadowLoading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color={primary} />
                      <Text style={{ color: C.textSecondary, fontSize: 13 }}>Analisando portfólio…</Text>
                    </View>
                  ) : shadowData ? (
                    <>
                      <View style={st.shadowStats}>
                        <View style={st.shadowStat}>
                          <Text style={[st.shadowStatVal, { color: shadowData.winRate >= 50 ? C.success : C.danger }]}>
                            {shadowData.winRate.toFixed(0)}%
                          </Text>
                          <Text style={st.shadowStatLabel}>Win Rate</Text>
                        </View>
                        <View style={st.shadowStat}>
                          <Text style={[st.shadowStatVal, { color: shadowData.avgReturn >= 0 ? C.success : C.danger }]}>
                            {shadowData.avgReturn >= 0 ? "+" : ""}{shadowData.avgReturn.toFixed(1)}%
                          </Text>
                          <Text style={st.shadowStatLabel}>Retorno Médio</Text>
                        </View>
                        <View style={st.shadowStat}>
                          <Text style={[st.shadowStatVal, { color: primary }]}>{shadowData.closedCount}</Text>
                          <Text style={st.shadowStatLabel}>Operações</Text>
                        </View>
                      </View>
                      <Text style={[st.shadowAdvice, { color: shadowData.source === "groq" ? primary : C.textSecondary }]}>
                        {shadowData.advice}
                      </Text>
                      {shadowData.riskWarnings.length > 0 && (
                        <View style={st.shadowWarning}>
                          <Ionicons name="warning-outline" size={14} color={C.warning} />
                          <Text style={{ color: C.warning, fontSize: 12, flex: 1 }}>
                            {shadowData.riskWarnings[0]}
                          </Text>
                        </View>
                      )}
                      <Text style={[st.shadowSource, { color: shadowData.source === "groq" ? primary : C.textTertiary }]}>
                        {shadowData.source === "groq" ? "⚡ Análise via Groq AI" : "📊 Análise estatística local"}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: C.textSecondary, fontSize: 13 }}>
                      Sem operações paper trading ainda. Abra o Paper Trading para começar.
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* ── Section B: Brain Selector ── */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>Brain Selector</Text>
              <Text style={st.sectionSubtitle}>Select up to 6 brains · {selectedBrains.length}/6 selected</Text>

              {(Object.entries(brainsByCategory) as [BrainCategory, BrainConfig[]][]).map(([cat, brains]) => {
                const catColor = BRAIN_CATEGORY_COLORS[cat];
                return (
                  <View key={cat} style={st.brainGroup}>
                    <View style={st.brainGroupHeader}>
                      <View style={[st.brainGroupDot, { backgroundColor: catColor }]} />
                      <Text style={[st.brainGroupTitle, { color: catColor }]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.brainScroll}>
                      {brains.map((brain) => {
                        const signal = getBrainSignal(brain.id);
                        const sigColor = signal === "BUY" ? C.success : signal === "SELL" ? C.danger : C.warning;
                        const selected = selectedBrains.includes(brain.id);
                        return (
                          <Pressable
                            key={brain.id}
                            testID={`brain-${brain.id}`}
                            disabled={!canCreate}
                            style={[
                              st.brainChip,
                              selected && { backgroundColor: `${primary}20`, borderColor: primary },
                              !canCreate && st.brainChipDisabled,
                            ]}
                            onPress={() => toggleBrain(brain.id)}
                          >
                            <Ionicons
                              name={(brain.icon as any) ?? "radio-button-on"}
                              size={14}
                              color={selected ? primary : catColor}
                            />
                            <Text style={[st.brainChipText, selected && { color: primary }]} numberOfLines={1}>
                              {brain.name}
                            </Text>
                            <View style={[st.signalDot, { backgroundColor: sigColor }]} />
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })}
            </View>

            {/* ── Section C: Risk Management ── */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>Risk Management</Text>

              {[
                { label: "Stop Loss %", value: stopLoss, min: 0.5, max: 10, step: 0.5, setter: setStopLoss },
                { label: "Take Profit %", value: takeProfit, min: 1.0, max: 20, step: 0.5, setter: setTakeProfit },
                { label: "Max Position Size %", value: maxPositionSize, min: 1, max: 50, step: 1, setter: setMaxPositionSize },
                { label: "Max Daily Trades", value: maxDailyTrades, min: 1, max: 30, step: 1, setter: setMaxDailyTrades },
              ].map((row) => (
                <View key={row.label} style={st.riskRow}>
                  <Text style={[st.riskLabel, !canCreate && { color: C.textTertiary }]}>{row.label}</Text>
                  <Stepper
                    value={row.value}
                    min={row.min}
                    max={row.max}
                    step={row.step}
                    onChange={row.setter}
                    disabled={!canCreate}
                    decimals={row.step < 1 ? 1 : 0}
                  />
                </View>
              ))}
            </View>

            {/* ── Section D: Conviction Threshold ── */}
            <View style={st.section}>
              <Text style={st.sectionTitle}>Conviction Threshold</Text>
              <View style={st.riskRow}>
                <Text style={[st.riskLabel, !canCreate && { color: C.textTertiary }]}>
                  Execute only when conviction ≥ {convictionThreshold}%
                </Text>
                <Stepper
                  value={convictionThreshold}
                  min={20}
                  max={90}
                  step={1}
                  onChange={setConvictionThreshold}
                  disabled={!canCreate}
                  decimals={0}
                />
              </View>
            </View>

            {/* ── Save Button ── */}
            <View style={st.saveSection}>
              {!canCreate ? (
                <>
                  <Pressable style={[st.saveBtn, st.saveBtnDisabled]} disabled>
                    <Ionicons name="lock-closed-outline" size={16} color={C.textTertiary} />
                    <Text style={[st.saveBtnText, { color: C.textTertiary }]}>
                      Upgrade to Pro to save strategies
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {userPlan === "pro" && (
                    <Text style={st.saveCountText}>{savedCount} / {proSaveLimit} used</Text>
                  )}
                  {saveSuccess ? (
                    <View style={[st.saveBtn, { backgroundColor: `${C.success}20`, borderColor: `${C.success}40` }]}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={C.success} />
                      <Text style={[st.saveBtnText, { color: C.success }]}>Strategy saved!</Text>
                    </View>
                  ) : (
                    <Pressable
                      testID="save-strategy-btn"
                      style={[st.saveBtn, { backgroundColor: primary }]}
                      disabled={userPlan === "pro" && savedCount >= proSaveLimit}
                      onPress={handleSave}
                    >
                      <Ionicons name="save-outline" size={16} color="#fff" />
                      <Text style={[st.saveBtnText, { color: "#fff" }]}>Save Strategy</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* ================================================================ */}
        {/* TAB 3 — BACKTEST                                                  */}
        {/* ================================================================ */}
        {activeTab === "backtest" && (
          <View style={st.tabContent}>
            {!canBacktest ? (
              <View style={st.upgradeCard}>
                <Ionicons name="lock-closed" size={36} color={primary} />
                <Text style={st.upgradeTitle}>Premium Required</Text>
                <Text style={st.upgradeDesc}>
                  Upgrade to Premium or Enterprise to access backtest results and run new simulations.
                </Text>
                <View style={[st.upgradeBadge, { borderColor: `${primary}40` }]}>
                  <Text style={[st.upgradeBadgeText, { color: primary }]}>
                    Available on Premium & Enterprise plans
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {/* Strategy name header */}
                <View style={st.btHeader}>
                  <Text style={st.btStratName}>
                    {strategyGenerate.data ? `Champion: ${strategyGenerate.data.champion.name}` : backtestStrategy.name}
                  </Text>
                  <View style={[st.qamBadge, { backgroundColor: `${QAM_COLORS[backtestStrategy.quantumAnalysisMode]}20`, borderColor: `${QAM_COLORS[backtestStrategy.quantumAnalysisMode]}40` }]}>
                    <Text style={[st.qamBadgeText, { color: QAM_COLORS[backtestStrategy.quantumAnalysisMode] }]}>
                      {strategyGenerate.data ? "ai_strategy_lab" : backtestStrategy.quantumAnalysisMode.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                {/* AI Symbol input */}
                <View style={[st.symbolRow]}>
                  <Text style={st.symbolLabel}>Símbolo para análise IA</Text>
                  <TextInput
                    style={[st.symbolInput, { borderColor: `${primary}40` }]}
                    value={symbol}
                    onChangeText={(t) => setSymbol(t.toUpperCase())}
                    placeholder="BTC"
                    placeholderTextColor={C.textTertiary}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>

                {/* AI results source badge */}
                {strategyGenerate.data && (
                  <View style={[st.aiBadge, { borderColor: `${primary}40` }]}>
                    <Ionicons name="flash-outline" size={13} color={primary} />
                    <Text style={[st.aiBadgeText, { color: primary }]}>
                      Strategy Lab · {strategyGenerate.data.strategies.length} estratégias · símbolo: {strategyGenerate.data.symbol}
                    </Text>
                  </View>
                )}

                {/* QAM explanation */}
                <Text style={st.qamDesc}>{QAM_DESCRIPTIONS[backtestStrategy.quantumAnalysisMode]}</Text>

                {/* Top metrics horizontal scroll */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.metricsScroll}>
                  {[
                    { label: "Win Rate", value: `${jitteredBt.winRate.toFixed(1)}%`, color: C.success },
                    { label: "Total Return", value: `+${jitteredBt.totalReturn.toFixed(1)}%`, color: C.success },
                    { label: "Max Drawdown", value: `${jitteredBt.maxDrawdown.toFixed(1)}%`, color: C.danger },
                    { label: "Sharpe Ratio", value: jitteredBt.sharpeRatio.toFixed(2), color: primary },
                    { label: "Profit Factor", value: jitteredBt.profitFactor.toFixed(2), color: primary },
                    { label: "# Trades", value: `${jitteredBt.trades}`, color: C.text },
                  ].map((m) => (
                    <View key={m.label} style={st.metricCard}>
                      <Text style={st.metricLabel}>{m.label}</Text>
                      <Text style={[st.metricValue, { color: m.color }]}>{m.value}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* PnL Curve */}
                <View style={st.section}>
                  <Text style={st.sectionTitle}>PnL Curve</Text>
                  <View style={st.pnlCurveContainer}>
                    {Array.from({ length: 30 }).map((_, i) => {
                      const trend = (i / 30) * jitteredBt.totalReturn;
                      const noise = Math.sin(i * 1.7) * 5 + Math.cos(i * 3.1) * 3;
                      const height = Math.max(4, 30 + trend * 0.6 + noise);
                      const color = i === 29 ? primary : i > 20 ? `${primary}CC` : `${primary}70`;
                      return (
                        <View
                          key={i}
                          style={[st.pnlBar, { height, backgroundColor: color }]}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Trade distribution */}
                <View style={st.section}>
                  <Text style={st.sectionTitle}>Per-Trade Distribution</Text>
                  {(() => {
                    const wins = jitteredBt.winRate;
                    const be = 5;
                    const losses = Math.max(0, 100 - wins - be);
                    return (
                      <View style={st.distContainer}>
                        {[
                          { label: "Wins", pct: wins, color: C.success },
                          { label: "Losses", pct: losses, color: C.danger },
                          { label: "Break-even", pct: be, color: C.textSecondary },
                        ].map((d) => (
                          <View key={d.label} style={st.distRow}>
                            <Text style={[st.distLabel, { color: d.color }]}>{d.label}</Text>
                            <View style={st.distTrack}>
                              <View style={[st.distFill, { width: `${d.pct}%`, backgroundColor: d.color }]} />
                            </View>
                            <Text style={[st.distPct, { color: d.color }]}>{d.pct.toFixed(1)}%</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </View>

                {/* Regime analysis */}
                <View style={st.section}>
                  <Text style={st.sectionTitle}>Regime Analysis</Text>
                  {backtestStrategy.marketConditions.bestRegimes.map((regime) => (
                    <View key={regime} style={[st.regimeRow, { borderLeftColor: primary }]}>
                      <Text style={[st.regimeName, { color: primary }]}>{regime.replace(/_/g, " ")}</Text>
                      <Text style={st.regimeDesc}>{REGIME_DESCRIPTIONS[regime] ?? regime}</Text>
                    </View>
                  ))}
                </View>

                {/* Run New Backtest button */}
                {strategyGenerate.isPending ? (
                  <View style={[st.runBtn, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
                    <ActivityIndicator size="small" color={primary} />
                    <Text style={[st.runBtnText, { color: primary }]}>Gerando estratégias com IA…</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[st.runBtn, { backgroundColor: primary }]}
                    onPress={strategyGenerate.data ? () => router.push('/genetic-lab' as any) : handleRunBacktest}
                  >
                    <Ionicons name={strategyGenerate.data ? "dna-outline" : "flash-outline"} size={18} color="#fff" />
                    <Text style={[st.runBtnText, { color: "#fff" }]}>
                      {strategyGenerate.data ? "Evoluir com Genetic Lab" : "Gerar Estratégias com IA"}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 18, color: C.text },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  planBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11 },

  // ── Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  tabLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textTertiary },

  scrollContent: { paddingBottom: 40 },
  tabContent: { padding: 16, gap: 16 },

  // ── Strategy cards
  stratCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
    overflow: "hidden",
  },
  stratCardLocked: { opacity: 0.6 },
  stratCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  stratName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, flex: 1 },
  qamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  qamBadgeText: { fontFamily: "Inter_500Medium", fontSize: 10 },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  catBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10 },
  stratDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 19 },
  brainCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: C.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  brainCountText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    width: "47%",
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
  regimeChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  regimeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  regimeChipText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  selectBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  selectBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },

  // ── Locked overlay
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,14,23,0.88)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
  },
  lockedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 16,
  },

  // ── Builder sections
  section: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  sectionSubtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: -6 },
  inputLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  textInput: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
  },
  inputDisabled: { opacity: 0.5 },
  pillRow: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  pillText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  shadowRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: 12,
  },
  shadowLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.border,
    borderWidth: 1,
    borderColor: "transparent",
    justifyContent: "center",
    paddingHorizontal: 2,
    marginTop: 2,
  },
  toggleDisabled: { opacity: 0.4 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.textTertiary },

  shadowPanel: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: `${C.card}80`,
    borderWidth: 1,
    gap: 8,
  },
  shadowStats: { flexDirection: "row", justifyContent: "space-around" },
  shadowStat: { alignItems: "center", gap: 2 },
  shadowStatVal: { fontFamily: "Inter_700Bold", fontSize: 18 },
  shadowStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  shadowAdvice: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  shadowWarning: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  shadowSource: { fontFamily: "Inter_400Regular", fontSize: 11 },

  symbolRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  symbolLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  symbolInput: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    textAlign: "center",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  aiBadgeText: { fontFamily: "Inter_400Regular", fontSize: 12 },

  // ── Brains
  brainGroup: { gap: 8 },
  brainGroupHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  brainGroupDot: { width: 8, height: 8, borderRadius: 4 },
  brainGroupTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  brainScroll: { gap: 8, paddingBottom: 4 },
  brainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  brainChipDisabled: { opacity: 0.5 },
  brainChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, maxWidth: 100 },
  signalDot: { width: 7, height: 7, borderRadius: 3.5 },

  // ── Risk rows
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  riskLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1 },

  // ── Stepper
  stepper: { flexDirection: "row", alignItems: "center", gap: 2 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.text,
    minWidth: 48,
    textAlign: "center",
  },

  // ── Save section
  saveSection: { gap: 8 },
  saveCountText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "center" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  saveBtnDisabled: { backgroundColor: C.surface, borderColor: C.border },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },

  // ── Backtest
  upgradeCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  upgradeTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "center" },
  upgradeDesc: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20 },
  upgradeBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  upgradeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: "center" },

  btHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  btStratName: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, flex: 1 },
  qamDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 19 },

  metricsScroll: { marginHorizontal: -4 },
  metricCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginHorizontal: 4,
    minWidth: 100,
    gap: 4,
  },
  metricLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  metricValue: { fontFamily: "Inter_700Bold", fontSize: 18 },

  // ── PnL curve
  pnlCurveContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 2,
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 8,
  },
  pnlBar: { flex: 1, borderRadius: 2, minHeight: 4 },

  // ── Distribution
  distContainer: { gap: 10 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  distLabel: { fontFamily: "Inter_500Medium", fontSize: 12, width: 80 },
  distTrack: { flex: 1, height: 10, backgroundColor: C.surface, borderRadius: 5, overflow: "hidden" },
  distFill: { height: "100%", borderRadius: 5 },
  distPct: { fontFamily: "Inter_600SemiBold", fontSize: 12, width: 44, textAlign: "right" },

  // ── Regime analysis
  regimeRow: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    gap: 4,
  },
  regimeName: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  regimeDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },

  // ── Run backtest button
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "transparent",
    marginTop: 8,
  },
  runBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
