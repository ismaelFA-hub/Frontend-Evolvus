import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";

const RANK_LABELS = ["🥇", "🥈", "🥉", "4º", "5º", "6º", "7º", "8º", "9º", "10º"];
const EVOLVUS_CORE_ID = "evolvus-core";

const C = Colors.dark;

// ─── Types (mirror server/copytrading/copyTradingService.ts) ──

interface LeaderProfile {
  userId: string;
  username: string;
  bio: string;
  return30d: number;
  winRate: number;       // 0–1
  totalTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  followerCount: number;
  virtualAUM: number;
}

// ─── Colour helpers ───────────────────────────────────────────

const AVATAR_COLORS = [
  "#00D4AA", "#7B61FF", "#F7931A", "#E84142", "#627EEA", "#9945FF",
];
function avatarColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}
function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

// ─── Extra Types ──────────────────────────────────────────────

interface CopyHistoryEntry {
  id: string;
  leaderId: string;
  symbol: string;
  side: string;
  pnl: number;
  copiedAt: string;
  closedAt: string;
}

interface FeedEntry {
  leaderId: string;
  symbol: string;
  side: string;
  timestamp: string;
  description: string;
}

// ─── Screen ───────────────────────────────────────────────────

export default function CopyTradingScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const { user, effectivePlan } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const isPremiumOrAbove = effectivePlan === "premium" || effectivePlan === "enterprise" || effectivePlan === "admin";

  const [activeTab, setActiveTab] = useState<"leaders" | "history">("leaders");

  const [leaders, setLeaders] = useState<LeaderProfile[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // History tab
  const [history, setHistory] = useState<CopyHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Feed
  const [feed, setFeed] = useState<FeedEntry[]>([]);

  // Register as leader
  const [registerLoading, setRegisterLoading] = useState(false);

  // ── Fetch leaders from API ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [leadersRes, followingRes] = await Promise.all([
          apiRequest("GET", "/api/copy/leaders"),
          user ? apiRequest("GET", "/api/copy/following").catch(() => null) : Promise.resolve(null),
        ]);
        const leadersData = await leadersRes.json() as { leaders: LeaderProfile[] };
        if (!cancelled) setLeaders(leadersData.leaders ?? []);

        if (followingRes) {
          const followData = await followingRes.json() as { following: Array<{ leaderId: string }> };
          const map: Record<string, boolean> = {};
          for (const f of followData.following ?? []) map[f.leaderId] = true;
          if (!cancelled) setFollowing(map);
        }
      } catch {
        // Silently fall through — show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  // ── Toggle follow / unfollow ──────────────────────────────────
  const toggleFollow = useCallback(async (leaderId: string) => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTogglingId(leaderId);
    const isFollowing = following[leaderId];
    try {
      if (isFollowing) {
        await apiRequest("POST", "/api/copy/unfollow", { leaderId });
      } else {
        await apiRequest("POST", "/api/copy/follow", { leaderId, copyPercent: 100, maxPerTrade: 100 });
      }
      setFollowing(prev => ({ ...prev, [leaderId]: !isFollowing }));
      // Optimistically update followerCount
      setLeaders(prev => prev.map(l =>
        l.userId === leaderId
          ? { ...l, followerCount: l.followerCount + (isFollowing ? -1 : 1) }
          : l
      ));
    } catch {
      // Ignore — keep previous state
    } finally {
      setTogglingId(null);
    }
  }, [user, following]);

  // ── Load history ──────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const res = await apiRequest("GET", "/api/copy/history");
      const data = await res.json() as CopyHistoryEntry[];
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);

  // ── Load feed ─────────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/copy/feed");
      const data = await res.json() as FeedEntry[];
      setFeed(Array.isArray(data) ? data : []);
    } catch {
      setFeed([]);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadHistory]);

  // ── Register as leader ────────────────────────────────────────
  const registerAsLeader = useCallback(async () => {
    if (!user) return;
    setRegisterLoading(true);
    try {
      await apiRequest("POST", "/api/copy/leaders/register", {
        displayName: user.username ?? "Meu Nome",
        description: "Meu estilo de trading",
        riskLevel: "medium",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sucesso!", "Você foi registrado como líder de copy trading.");
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Não foi possível registrar como líder.");
    } finally {
      setRegisterLoading(false);
    }
  }, [user]);

  // ── Derived stats ─────────────────────────────────────────────
  const avgReturn = leaders.length
    ? leaders.reduce((s, l) => s + l.return30d, 0) / leaders.length
    : 0;
  const totalTrades = leaders.reduce((s, l) => s + l.totalTrades, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>{t('copyTrading')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Plan gate — Free / Pro cannot use copy trading */}
      {!isPremiumOrAbove && (
        <View style={styles.planGate}>
          <View style={[styles.planGateBadge, { backgroundColor: `${planTheme.primary}15`, borderColor: `${planTheme.primary}40` }]}>
            <Ionicons name="lock-closed" size={36} color={planTheme.primary} />
          </View>
          <Text style={styles.planGateTitle}>Exclusivo Premium & Enterprise</Text>
          <Text style={styles.planGateSubtitle}>
            O Copy Trading — incluindo o ranking de líderes e o espelhamento automático de trades — está disponível apenas nos planos Premium e Enterprise.
          </Text>
          <Text style={styles.planGatePreview}>Você pode visualizar o ranking, mas precisa de Premium para copiar traders.</Text>
          <Pressable
            style={[styles.planGateBtn, { backgroundColor: planTheme.primary }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/payment"); }}
          >
            <Ionicons name="rocket-outline" size={16} color="#000" />
            <Text style={styles.planGateBtnText}>Fazer upgrade agora</Text>
          </Pressable>
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === "leaders" && { borderBottomColor: planTheme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("leaders")}
        >
          <Text style={[styles.tabText, activeTab === "leaders" && { color: planTheme.primary }]}>Líderes</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "history" && { borderBottomColor: planTheme.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, activeTab === "history" && { color: planTheme.primary }]}>Histórico</Text>
        </Pressable>
      </View>

      {loading && activeTab === "leaders" ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={planTheme.primary} />
        </View>
      ) : activeTab === "history" ? (
        /* ── History tab ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {historyLoading ? (
            <ActivityIndicator color={planTheme.primary} style={{ marginTop: 32 }} />
          ) : history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color={C.textSecondary} />
              <Text style={styles.emptyText}>Nenhum histórico de cópias ainda.</Text>
            </View>
          ) : (
            history.map(entry => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Text style={styles.historySymbol}>{entry.symbol}</Text>
                  <View style={[styles.sideBadge, { backgroundColor: entry.side === "BUY" ? `${C.success}20` : `${C.danger}20` }]}>
                    <Text style={[styles.sideBadgeText, { color: entry.side === "BUY" ? C.success : C.danger }]}>{entry.side}</Text>
                  </View>
                  <Text style={[styles.historyPnl, { color: entry.pnl >= 0 ? C.success : C.danger }]}>
                    {entry.pnl >= 0 ? "+" : ""}${entry.pnl.toFixed(2)}
                  </Text>
                </View>
                <Text style={styles.historyMeta}>
                  Líder: {entry.leaderId} · {new Date(entry.copiedAt).toLocaleDateString("pt-BR")}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        /* ── Leaders tab ── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Stats header */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{leaders.length}</Text>
              <Text style={styles.statLabel}>{t('topTraders')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatNumber(totalTrades)}</Text>
              <Text style={styles.statLabel}>{t('copiedTrades')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: avgReturn >= 0 ? C.success : C.error }]}>
                {avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(1)}%
              </Text>
              <Text style={styles.statLabel}>Avg {t('traderProfit')}</Text>
            </View>
          </View>

          {/* Register as leader */}
          <Pressable
            style={[styles.registerBtn, { borderColor: `${planTheme.primary}50`, opacity: (registerLoading || !isPremiumOrAbove) ? 0.5 : 1 }]}
            onPress={() => {
              if (!isPremiumOrAbove) {
                Alert.alert("Plano necessário", "Registrar-se como líder requer plano Premium ou Enterprise.", [
                  { text: "Upgrade", onPress: () => router.push("/payment") },
                  { text: "Cancelar", style: "cancel" },
                ]);
                return;
              }
              registerAsLeader();
            }}
            disabled={registerLoading || !user}
          >
            {registerLoading
              ? <ActivityIndicator size="small" color={planTheme.primary} />
              : <><Ionicons name="star-outline" size={16} color={planTheme.primary} /><Text style={[styles.registerBtnText, { color: planTheme.primary }]}>Registrar como Líder</Text></>}
          </Pressable>

          <Text style={styles.sectionTitle}>{t('topTraders')}</Text>

          {leaders.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={C.textSecondary} />
              <Text style={styles.emptyText}>Nenhum líder disponível ainda.</Text>
            </View>
          )}

          {leaders.map((trader, idx) => {
            const traderId = trader.userId;
            const isEvolvus = traderId === EVOLVUS_CORE_ID;
            const color = isEvolvus ? "#F7931A" : avatarColor(traderId);
            const isFollowing = following[traderId];
            const isToggling = togglingId === traderId;
            const rankLabel = RANK_LABELS[idx] ?? `${idx + 1}º`;

            return (
              <View key={traderId} style={[styles.traderCard, isEvolvus && { borderColor: "#F7931A55", borderWidth: 1.5 }]}>
                {/* Rank badge */}
                <View style={styles.rankRow}>
                  <Text style={styles.rankLabel}>{rankLabel}</Text>
                  {isEvolvus && (
                    <View style={styles.evolvusBadge}>
                      <Ionicons name="shield-checkmark" size={11} color="#F7931A" />
                      <Text style={styles.evolvusBadgeText}>Sistema Oficial</Text>
                    </View>
                  )}
                  {trader.virtualAUM > 0 && (
                    <Text style={styles.aumText}>AUM ${formatNumber(trader.virtualAUM)}</Text>
                  )}
                </View>
                <View style={styles.traderHeader}>
                  <View style={[styles.avatar, { backgroundColor: `${color}20` }]}>
                    <Text style={[styles.avatarText, { color }]}>{initials(trader.username)}</Text>
                  </View>
                  <View style={styles.traderInfo}>
                    <Text style={[styles.traderName, isEvolvus && { color: "#F7931A" }]}>{trader.username}</Text>
                    <Text style={styles.traderStrategy} numberOfLines={1}>{trader.bio}</Text>
                  </View>
                  <Pressable
                    style={[
                      styles.followBtn,
                      isFollowing && { backgroundColor: C.surface, borderColor: C.border },
                      !isPremiumOrAbove && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      if (!isPremiumOrAbove) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert("Plano necessário", "Copy Trading requer plano Premium ou Enterprise.", [
                          { text: "Upgrade", onPress: () => router.push("/payment") },
                          { text: "Cancelar", style: "cancel" },
                        ]);
                        return;
                      }
                      toggleFollow(traderId);
                    }}
                    disabled={isToggling || !user}
                  >
                    {isToggling ? (
                      <ActivityIndicator size="small" color={isFollowing ? C.textSecondary : C.success} />
                    ) : (
                      <Text style={[styles.followBtnText, isFollowing && { color: C.textSecondary }]}>
                        {isFollowing ? 'Following' : t('followTrader')}
                      </Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.traderStats}>
                  <View style={styles.traderStatItem}>
                    <Text style={[styles.traderStatValue, { color: trader.return30d >= 0 ? C.success : C.error }]}>
                      {trader.return30d >= 0 ? "+" : ""}{trader.return30d.toFixed(1)}%
                    </Text>
                    <Text style={styles.traderStatLabel}>30d {t('traderProfit')}</Text>
                  </View>
                  <View style={styles.traderStatItem}>
                    <Text style={styles.traderStatValue}>{(trader.winRate * 100).toFixed(1)}%</Text>
                    <Text style={styles.traderStatLabel}>{t('traderWinRate')}</Text>
                  </View>
                  <View style={styles.traderStatItem}>
                    <Text style={styles.traderStatValue}>
                      {formatNumber(trader.followerCount)}
                    </Text>
                    <Text style={styles.traderStatLabel}>{t('followers')}</Text>
                  </View>
                  <View style={styles.traderStatItem}>
                    <Text style={styles.traderStatValue}>{trader.sharpeRatio.toFixed(2)}</Text>
                    <Text style={styles.traderStatLabel}>Sharpe</Text>
                  </View>
                </View>

                <View style={styles.traderFooter}>
                  <Text style={styles.traderTrades}>{trader.totalTrades} {t('trades')}</Text>
                  {trader.maxDrawdown > 0 && (
                    <Text style={[styles.traderTrades, { color: C.error }]}>
                      DD: -{trader.maxDrawdown.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Feed ao Vivo */}
          {feed.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Feed ao Vivo</Text>
              {feed.map((entry, idx) => (
                <View key={`${entry.leaderId}-${idx}`} style={styles.feedCard}>
                  <View style={styles.feedRow}>
                    <View style={[styles.sideBadge, { backgroundColor: entry.side === "BUY" ? `${C.success}20` : `${C.danger}20` }]}>
                      <Text style={[styles.sideBadgeText, { color: entry.side === "BUY" ? C.success : C.danger }]}>{entry.side}</Text>
                    </View>
                    <Text style={styles.feedSymbol}>{entry.symbol}</Text>
                    <Text style={styles.feedTime}>{new Date(entry.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  {entry.description ? <Text style={styles.feedDesc}>{entry.description}</Text> : null}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, marginHorizontal: 20 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 4 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text, marginBottom: 14 },
  registerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginBottom: 20 },
  registerBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  traderCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  traderHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  traderInfo: { flex: 1, marginLeft: 12 },
  traderName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  traderStrategy: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: C.success + '20', borderWidth: 1, borderColor: C.success },
  followBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.success },
  traderStats: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  traderStatItem: { alignItems: "center" },
  traderStatValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  traderStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 2 },
  traderFooter: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
  traderTrades: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", gap: 12, padding: 32 },
  emptyText: { fontSize: 14, color: C.textSecondary, textAlign: "center" },
  historyCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  historySymbol: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, flex: 1 },
  historyPnl: { fontFamily: "Inter_700Bold", fontSize: 14 },
  historyMeta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  sideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sideBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  feedCard: { backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  feedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedSymbol: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, flex: 1 },
  feedTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  feedDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 4 },
  planGate: { margin: 20, padding: 24, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", gap: 12 },
  planGateBadge: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  planGateTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, textAlign: "center" },
  planGateSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 20 },
  planGatePreview: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, textAlign: "center", fontStyle: "italic" },
  planGateBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  planGateBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  rankLabel: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, minWidth: 28 },
  evolvusBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F7931A18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#F7931A44" },
  evolvusBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#F7931A" },
  aumText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginLeft: "auto" as any },
});
