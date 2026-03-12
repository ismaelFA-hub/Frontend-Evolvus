import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

type StakeTab = 'flexible' | 'locked';

const STAKING_OPTIONS = [
  { token: 'ETH', name: 'Ethereum', apy: 4.2, lockDays: 0, minStake: 0.1, color: '#627EEA', icon: 'diamond-outline', type: 'flexible' as const },
  { token: 'SOL', name: 'Solana', apy: 6.8, lockDays: 30, minStake: 5, color: '#9945FF', icon: 'sunny-outline', type: 'locked' as const },
  { token: 'ADA', name: 'Cardano', apy: 3.5, lockDays: 0, minStake: 100, color: '#0033AD', icon: 'layers-outline', type: 'flexible' as const },
  { token: 'DOT', name: 'Polkadot', apy: 12.1, lockDays: 60, minStake: 10, color: '#E6007A', icon: 'ellipse-outline', type: 'locked' as const },
  { token: 'ATOM', name: 'Cosmos', apy: 15.4, lockDays: 90, minStake: 5, color: '#2E3148', icon: 'planet-outline', type: 'locked' as const },
  { token: 'BNB', name: 'BNB', apy: 2.8, lockDays: 0, minStake: 0.5, color: '#F3BA2F', icon: 'cube-outline', type: 'flexible' as const },
];

const ACTIVE_STAKES = [
  { token: 'ETH', amount: 3.5, apy: 4.2, earned: 0.0147, startDate: '2026-01-15', color: '#627EEA' },
  { token: 'SOL', amount: 85, apy: 6.8, earned: 4.82, startDate: '2026-02-01', color: '#9945FF' },
  { token: 'ATOM', amount: 120, apy: 15.4, earned: 15.4, startDate: '2026-01-20', color: '#2E3148' },
];

const TOTAL_STAKED = 18450.80;
const TOTAL_REWARDS = 842.35;

export default function StakingScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<StakeTab>('flexible');
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const filteredOptions = STAKING_OPTIONS.filter(opt =>
    activeTab === 'flexible' ? opt.type === 'flexible' : opt.type === 'locked'
  );

  const tabs: { key: StakeTab; label: string }[] = [
    { key: 'flexible', label: t('flexible') },
    { key: 'locked', label: t('locked') },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('stakingEarn')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.totalCard}>
          <View style={styles.totalCardRow}>
            <View>
              <Text style={styles.totalLabel}>{t('stakedAmount')}</Text>
              <Text style={styles.totalValue}>${TOTAL_STAKED.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.rewardsBox}>
              <Text style={styles.rewardsLabel}>{t('rewards')}</Text>
              <Text style={[styles.rewardsValue, { color: C.success }]}>+${TOTAL_REWARDS.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
              onPress={() => { setActiveTab(tab.key); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.tabText, activeTab === tab.key && { color: planTheme.primary }]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {filteredOptions.map((opt) => (
            <View key={opt.token} style={styles.stakeCard}>
              <View style={styles.stakeCardHeader}>
                <View style={[styles.tokenIcon, { backgroundColor: `${opt.color}20` }]}>
                  <Ionicons name={opt.icon as any} size={20} color={opt.color} />
                </View>
                <View>
                  <Text style={styles.stakeToken}>{opt.token}</Text>
                  <Text style={styles.stakeName}>{opt.name}</Text>
                </View>
              </View>

              <View style={styles.apyRow}>
                <Text style={[styles.apyValue, { color: C.success }]}>{opt.apy}%</Text>
                <Text style={styles.apyLabel}>{t('apy')}</Text>
              </View>

              <View style={styles.stakeDetails}>
                <View style={styles.stakeDetailRow}>
                  <Text style={styles.stakeDetailLabel}>{t('lockPeriod')}</Text>
                  <Text style={styles.stakeDetailValue}>{opt.lockDays === 0 ? t('flexible') : `${opt.lockDays}d`}</Text>
                </View>
                <View style={styles.stakeDetailRow}>
                  <Text style={styles.stakeDetailLabel}>Min</Text>
                  <Text style={styles.stakeDetailValue}>{opt.minStake} {opt.token}</Text>
                </View>
              </View>

              <Pressable
                style={[styles.stakeBtn, { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary }]}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Text style={[styles.stakeBtnText, { color: planTheme.primary }]}>{t('stake')}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('staking')}</Text>

        {ACTIVE_STAKES.map((stake) => (
          <View key={stake.token} style={styles.activeStakeRow}>
            <View style={[styles.activeStakeDot, { backgroundColor: stake.color }]} />
            <View style={styles.activeStakeInfo}>
              <Text style={styles.activeStakeToken}>{stake.token}</Text>
              <Text style={styles.activeStakeDate}>{stake.startDate}</Text>
            </View>
            <View style={styles.activeStakeValues}>
              <Text style={styles.activeStakeAmount}>{stake.amount} {stake.token}</Text>
              <Text style={[styles.activeStakeEarned, { color: C.success }]}>+{stake.earned} {stake.token}</Text>
            </View>
            <View style={styles.activeStakeApy}>
              <Text style={[styles.activeStakeApyValue, { color: C.success }]}>{stake.apy}%</Text>
              <Text style={styles.activeStakeApyLabel}>{t('apy')}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  totalCard: { backgroundColor: C.card, borderRadius: 20, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  totalCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, marginBottom: 6 },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text },
  rewardsBox: { alignItems: "flex-end" },
  rewardsLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  rewardsValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  tabBar: { flexDirection: "row", gap: 8, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  stakeCard: { width: "48%" as any, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  stakeCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  tokenIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stakeToken: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  stakeName: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  apyRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 12 },
  apyValue: { fontFamily: "Inter_700Bold", fontSize: 24 },
  apyLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  stakeDetails: { gap: 6, marginBottom: 14 },
  stakeDetailRow: { flexDirection: "row", justifyContent: "space-between" },
  stakeDetailLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  stakeDetailValue: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  stakeBtn: { paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  stakeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text, marginBottom: 14 },
  activeStakeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  activeStakeDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  activeStakeInfo: { flex: 1 },
  activeStakeToken: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  activeStakeDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  activeStakeValues: { alignItems: "flex-end", marginRight: 14 },
  activeStakeAmount: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  activeStakeEarned: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  activeStakeApy: { alignItems: "center", minWidth: 50 },
  activeStakeApyValue: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  activeStakeApyLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary },
});
