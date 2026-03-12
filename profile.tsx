import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Switch, Modal, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { useAuth, PlanType } from "@/lib/auth-context";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n, LANGUAGES, LanguageCode } from "@/lib/i18n-context";
import { useUserLevel, UserLevel } from "@/lib/user-level-context";
import { PLAN_FEATURES, getPortfolioSummary, getPortfolioData, formatCurrency, formatPercent } from "@/lib/market-data";
import QuantumLogo from "@/components/QuantumLogo";
import PlanDetailSheet from "@/components/PlanDetailSheet";
import { ONBOARDING_KEY } from "@/app/onboarding";

const C = Colors.dark;

const PLAN_QUANTUM: Record<PlanType, {
  intensity: "low" | "medium" | "high" | "ultra";
  nucleusColor: string;
  orbitColor: string;
  electronColor: string;
}> = {
  free: { intensity: "low", nucleusColor: "#6B7A99", orbitColor: "#4A5568", electronColor: "#718096" },
  pro: { intensity: "medium", nucleusColor: "#00D4AA", orbitColor: "#00B894", electronColor: "#00D4AA" },
  premium: { intensity: "high", nucleusColor: "#7B61FF", orbitColor: "#9B59B6", electronColor: "#A78BFA" },
  enterprise: { intensity: "ultra", nucleusColor: "#FFB74D", orbitColor: "#F59E0B", electronColor: "#FBBF24" },
  admin: { intensity: "ultra", nucleusColor: "#00D4E8", orbitColor: "#00B8CC", electronColor: "#67E8F9" },
};

const PAYMENT_METHODS = [
  { id: "pix", icon: "qr-code" as const, labelKey: "pix" as const, color: "#32BCAD" },
  { id: "credit", icon: "card" as const, labelKey: "creditCard" as const, color: "#7B61FF" },
  { id: "debit", icon: "card-outline" as const, labelKey: "debitCard" as const, color: "#00B4D8" },
  { id: "crypto", icon: "logo-bitcoin" as const, labelKey: "crypto" as const, color: "#F7931A" },
];

function AllocationBar({ holdings }: { holdings: { symbol: string; allocation: number; color: string }[] }) {
  return (
    <View style={styles.allocationBar}>
      {holdings.map((h, i) => (
        <View
          key={h.symbol}
          style={[
            styles.allocationSegment,
            { flex: h.allocation, backgroundColor: h.color },
            i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
            i === holdings.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
          ]}
        />
      ))}
    </View>
  );
}

function LanguageSelector({ visible, onClose, currentLang, onSelect }: { visible: boolean; onClose: () => void; currentLang: LanguageCode; onSelect: (l: LanguageCode) => void }) {
  const { planTheme } = usePlanTheme();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Language</Text>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.langRow, currentLang === item.code && { backgroundColor: planTheme.primaryDim }]}
                onPress={() => { onSelect(item.code); onClose(); Haptics.selectionAsync(); }}
              >
                <View style={styles.langInfo}>
                  <Text style={styles.langNative}>{item.nativeName}</Text>
                  <Text style={styles.langName}>{item.name}</Text>
                </View>
                {currentLang === item.code && <Ionicons name="checkmark-circle" size={22} color={planTheme.primary} />}
              </Pressable>
            )}
            scrollEnabled={true}
            style={{ maxHeight: 400 }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile, setPlanPreview, planPreview, effectivePlan } = useAuth();
  const { planTheme } = usePlanTheme();
  const { t, language, setLanguage } = useI18n();
  const { level, setLevel } = useUserLevel();
  const plan = PLAN_FEATURES[(user?.plan === "admin" ? "enterprise" : user?.plan) || "free"];
  const summary = getPortfolioSummary();
  const holdings = getPortfolioData();
  const [notifications, setNotifications] = useState(user?.settings.notifications ?? true);
  const [biometric, setBiometric] = useState(user?.settings.biometricAuth ?? false);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const userPlan = (user?.plan || "free") as PlanType;
  const quantum = PLAN_QUANTUM[userPlan];

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const daysRemaining = useMemo(() => {
    if (!user?.createdAt || userPlan === "free") return null;
    const created = new Date(user.createdAt);
    const nextBilling = new Date(created);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    while (nextBilling < new Date()) {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }
    const diff = nextBilling.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [user?.createdAt, userPlan]);

  const allocationColors = [planTheme.primary, C.accent, C.secondary, C.warning, '#FF6B6B', '#A8E6CF'];
  const allocationData = holdings.map((h, i) => ({
    symbol: h.symbol,
    allocation: h.allocation,
    color: allocationColors[i % allocationColors.length],
    value: h.value,
    pnlPercent: h.pnlPercent,
  }));

  function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logout();
    router.replace("/(auth)/login");
  }

  function MenuItem({ icon, label, value, onPress, color, showArrow = true }: { icon: any; label: string; value?: string; onPress?: () => void; color?: string; showArrow?: boolean }) {
    return (
      <Pressable style={styles.menuItem} onPress={onPress}>
        <View style={styles.menuItemLeft}>
          <Ionicons name={icon} size={20} color={color || C.textSecondary} />
          <Text style={styles.menuItemLabel}>{label}</Text>
        </View>
        <View style={styles.menuItemRight}>
          {!!value && <Text style={styles.menuItemValue}>{value}</Text>}
          {showArrow && <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />}
        </View>
      </Pressable>
    );
  }

  const currentLangName = LANGUAGES.find(l => l.code === language)?.nativeName || 'English';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('profile')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { borderColor: planTheme.primary, backgroundColor: planTheme.primaryDim }]}>
              <Text style={[styles.avatarText, { color: planTheme.primary }]}>{(user?.username || "U").slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={[styles.planTag, { backgroundColor: `${planTheme.primary}20` }]}>
              <Text style={[styles.planTagText, { color: planTheme.primary }]}>{plan.name}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{user?.username || "Trader"}</Text>
          <View style={styles.emailContainer}>
            <Text style={styles.profileEmail}>{user?.email || ""}</Text>
            {user?.emailVerified === true && (
              <View style={[styles.verifiedBadge, { backgroundColor: `${C.primary}20` }]}>
                <Text style={[styles.verifiedText, { color: C.primary }]}>Verificado ✓</Text>
              </View>
            )}
            {user?.emailVerified === false && (
              <Pressable 
                style={[styles.verifiedBadge, { backgroundColor: `${C.warning}20` }]}
                onPress={() => router.push('/support-chat')}
              >
                <Text style={[styles.verifiedText, { color: C.warning }]}>Verificar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {daysRemaining !== null && (
          <View style={[styles.expirationCard, { borderColor: `${planTheme.primary}40` }]}>
            <View style={styles.expirationLeft}>
              <Ionicons name="time-outline" size={22} color={planTheme.primary} />
              <View>
                <Text style={styles.expirationLabel}>{t('planExpires')}</Text>
                <Text style={[styles.expirationValue, { color: planTheme.primary }]}>
                  {daysRemaining} {daysRemaining === 1 ? t('day') : t('days')}
                </Text>
              </View>
            </View>
            <View style={[styles.expirationBadge, { backgroundColor: planTheme.primaryDim }]}>
              <Text style={[styles.expirationBadgeText, { color: planTheme.primary }]}>{t('monthlyPlan')}</Text>
            </View>
          </View>
        )}

        {user?.plan === "admin" && (
          <View style={[styles.section, { borderWidth: 1, borderColor: "#00D4E840", borderRadius: 14, padding: 14, backgroundColor: "#00D4E808" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name="flask-outline" size={16} color="#00D4E8" />
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#00D4E8" }}>
                Modo Preview de Planos
              </Text>
              {planPreview && (
                <Pressable onPress={() => { setPlanPreview(null); Haptics.selectionAsync(); }} style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="close-circle-outline" size={16} color="#9CA3AF" />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#9CA3AF" }}>Resetar</Text>
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["free", "pro", "premium", "enterprise", "admin"] as PlanType[]).map((p) => {
                const pf = PLAN_FEATURES[p as keyof typeof PLAN_FEATURES] ?? { name: "Admin", color: "#00D4E8" };
                const isActive = (planPreview ?? "admin") === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => { setPlanPreview(p === "admin" ? null : p); Haptics.selectionAsync(); }}
                    style={[{
                      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: isActive ? pf.color : pf.color + "40",
                      backgroundColor: isActive ? pf.color + "20" : "transparent",
                    }]}
                  >
                    <Text style={{ fontFamily: isActive ? "Inter_700Bold" : "Inter_400Regular", fontSize: 12, color: isActive ? pf.color : "#6B7280" }}>
                      {p === "admin" ? "Admin (real)" : pf.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#6B7280", marginTop: 10 }}>
              Simula a interface de cada plano para verificar as funções bloqueadas. Apenas visual — sem efeito no servidor.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>{t('portfolioAllocation')}</Text>
          <AllocationBar holdings={allocationData} />
          <View style={styles.allocationLegend}>
            {allocationData.map((h) => (
              <View key={h.symbol} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: h.color }]} />
                <Text style={styles.legendSymbol}>{h.symbol}</Text>
                <Text style={styles.legendPercent}>{h.allocation.toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>{t('performance')}</Text>
          <View style={styles.perfGrid}>
            <View style={[styles.perfCard, { borderColor: `${planTheme.primary}20` }]}>
              <Text style={styles.perfLabel}>{t('totalValue')}</Text>
              <Text style={styles.perfValue}>{formatCurrency(summary.totalValue)}</Text>
            </View>
            <View style={[styles.perfCard, { borderColor: `${planTheme.primary}20` }]}>
              <Text style={styles.perfLabel}>{t('totalPnl')}</Text>
              <Text style={[styles.perfValue, { color: summary.totalPnl >= 0 ? C.success : C.danger }]}>
                {summary.totalPnl >= 0 ? "+" : ""}{formatCurrency(summary.totalPnl)}
              </Text>
            </View>
            <View style={[styles.perfCard, { borderColor: `${planTheme.primary}20` }]}>
              <Text style={styles.perfLabel}>{t('roi')}</Text>
              <Text style={[styles.perfValue, { color: summary.pnlPercent >= 0 ? C.success : C.danger }]}>
                {formatPercent(summary.pnlPercent)}
              </Text>
            </View>
            <View style={[styles.perfCard, { borderColor: `${planTheme.primary}20` }]}>
              <Text style={styles.perfLabel}>{t('assets')}</Text>
              <Text style={styles.perfValue}>{summary.holdingsCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>{t('currentPlan')}</Text>
          <Pressable style={[styles.planCard, { borderColor: `${planTheme.primary}50` }]} onPress={() => { setShowPlanDetail(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
            <View style={styles.planCardHeader}>
              <View style={{ alignItems: "center", gap: 4 }}>
                <QuantumLogo
                  size={80}
                  intensity={quantum.intensity}
                  nucleusColor={quantum.nucleusColor}
                  orbitColor={quantum.orbitColor}
                  electronColor={quantum.electronColor}
                />
                <Text style={[styles.planCardName, { color: planTheme.primary }]}>{plan.name}</Text>
                <Text style={styles.planCardPrice}>{plan.price}</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 16, gap: 6 }}>
                {plan.features.slice(0, 4).map((f, i) => (
                  <View key={i} style={styles.planFeatureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={planTheme.primary} />
                    <Text style={styles.planFeatureText}>{f}</Text>
                  </View>
                ))}
                <Text style={[styles.viewDetailsLink, { color: planTheme.primary }]}>{t('viewAllDetails')}</Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>{t('paymentMethods')}</Text>
          <View style={styles.menuCard}>
            <MenuItem 
              icon="receipt-outline" 
              label="Faturas" 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/billing'); }} 
            />
          </View>
          <View style={styles.paymentGrid}>
            {PAYMENT_METHODS.map((pm) => (
              <Pressable key={pm.id} style={styles.paymentCard} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                <View style={[styles.paymentIcon, { backgroundColor: `${pm.color}18` }]}>
                  <Ionicons name={pm.icon} size={24} color={pm.color} />
                </View>
                <Text style={styles.paymentLabel}>{t(pm.labelKey)}</Text>
                <Ionicons name="add-circle-outline" size={18} color={C.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>{t('customization')}</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="language-outline" label={t('language')} value={currentLangName} onPress={() => setShowLanguageSelector(true)} />
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="volume-high-outline" size={20} color={C.textSecondary} />
                <Text style={styles.menuItemLabel}>{t('soundEffects')}</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: C.surface, true: planTheme.primaryDim }}
                thumbColor={soundEnabled ? planTheme.primary : C.textTertiary}
              />
            </View>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="phone-portrait-outline" size={20} color={C.textSecondary} />
                <Text style={styles.menuItemLabel}>{t('hapticFeedback')}</Text>
              </View>
              <Switch
                value={hapticEnabled}
                onValueChange={setHapticEnabled}
                trackColor={{ false: C.surface, true: planTheme.primaryDim }}
                thumbColor={hapticEnabled ? planTheme.primary : C.textTertiary}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>{t('settings')}</Text>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={20} color={C.textSecondary} />
                <Text style={styles.menuItemLabel}>{t('notifications')}</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={(v) => { setNotifications(v); updateProfile({ settings: { ...user!.settings, notifications: v } }); }}
                trackColor={{ false: C.surface, true: planTheme.primaryDim }}
                thumbColor={notifications ? planTheme.primary : C.textTertiary}
              />
            </View>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="finger-print" size={20} color={C.textSecondary} />
                <Text style={styles.menuItemLabel}>{t('biometricAuth')}</Text>
              </View>
              <Switch
                value={biometric}
                onValueChange={(v) => { setBiometric(v); updateProfile({ settings: { ...user!.settings, biometricAuth: v } }); }}
                trackColor={{ false: C.surface, true: planTheme.primaryDim }}
                thumbColor={biometric ? planTheme.primary : C.textTertiary}
              />
            </View>
            <MenuItem icon="globe-outline" label={t('currency')} value={user?.settings.currency || "USD"} />
            <MenuItem icon="key-outline" label={t('apiKeys')} value={`${user?.connectedExchanges?.length || 0} ${t('connected')}`} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/api-key-manager'); }} />
            <MenuItem icon="shield-checkmark-outline" label={t('security')} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/security-center'); }} />
            <MenuItem icon="document-text-outline" label={t('termsOfService')} />
            <MenuItem icon="help-circle-outline" label={t('helpSupport')} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/support-chat'); }} />
            <MenuItem icon="school-outline" label={t('tutorial')} onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              try { await AsyncStorage.removeItem(ONBOARDING_KEY); } catch (_) {}
              router.push('/onboarding');
            }} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>Nível de Experiência</Text>
          <View style={styles.levelCard}>
            <Text style={styles.levelDesc}>Ajuste a interface ao seu nível. Ferramentas avançadas ficam disponíveis progressivamente.</Text>
            <View style={styles.levelSelector}>
              {([
                { key: "beginner",     label: "Iniciante",     icon: "leaf-outline"     },
                { key: "intermediate", label: "Intermediário",  icon: "trending-up"      },
                { key: "advanced",     label: "Avançado",      icon: "rocket-outline"   },
              ] as { key: UserLevel; label: string; icon: any }[]).map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.levelOption,
                    level === opt.key && { backgroundColor: planTheme.primaryDim, borderColor: planTheme.primary },
                  ]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setLevel(opt.key); }}
                >
                  <Ionicons name={opt.icon} size={18} color={level === opt.key ? planTheme.primary : C.textSecondary} />
                  <Text style={[styles.levelOptionText, level === opt.key && { color: planTheme.primary }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.levelHint}>
              {level === "beginner" ? "Mostrando: Funcionalidades essenciais para começar a investir." :
               level === "intermediate" ? "Mostrando: Bots, IA básica, copy trading e ferramentas de análise." :
               "Mostrando: Todas as 70+ ferramentas, incluindo Hive Mind, Lab Genético e Digital Twin."}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>Monitoramento</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="journal-outline" label="Trade Journal" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/trade-journal'); }} />
            <MenuItem icon="notifications-outline" label="Central de Notificações" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/notifications-center'); }} />
            <MenuItem icon="swap-horizontal-outline" label="Gerenciar Exchanges" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/exchange-center' as any); }} />
            <MenuItem icon="document-text-outline" label="Minha Atividade" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/user-audit' as any); }} />
          </View>
        </View>

        {user?.plan === 'enterprise' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#FFB74D' }]}>Ferramentas Enterprise</Text>
            <View style={styles.menuCard}>
              <MenuItem icon="document-text-outline" label="Relatórios Fiscais PDF" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} />
              <MenuItem icon="analytics-outline" label="Métricas Avançadas" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} />
              <MenuItem icon="people-outline" label="Gestão Multi-usuários" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} />
              <MenuItem icon="code-slash-outline" label="API Dedicada" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} />
              <MenuItem icon="shield-checkmark-outline" label="SLA 99,9% Monitor" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: planTheme.primary }]}>Tesouros Ativos</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="analytics-outline" label="Performance & Sharpe" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/performance' as any); }} />
            <MenuItem icon="git-network-outline" label="DNA de Trading" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/decision-dna' as any); }} />
            <MenuItem icon="shield-half-outline" label="Modo de Risco" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/risk-mode-selector' as any); }} />
            {(userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="sparkles-outline" label="Gerador de Estratégia IA" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/strategy-generator' as any); }} />
            )}
            {(userPlan === "pro" || userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="paper-plane-outline" label="Alertas Telegram" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/telegram-setup' as any); }} />
            )}
            {(userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="wallet-outline" label="Cofre / Profit Skim" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/profit-skim' as any); }} />
            )}
            {(userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="infinite-outline" label="Hydra Scanner" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/hydra-scanner' as any); }} />
            )}
            {(userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="time-outline" label="Motor de Análogos" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/analog-engine' as any); }} />
            )}
            {userPlan === "enterprise" && (
              <MenuItem icon="flask-outline" label="Laboratório Genético" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/genetic-lab' as any); }} />
            )}
            {(userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="people-circle-outline" label="DAO de Estratégias" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/dao' as any); }} />
            )}
            {(userPlan === "premium" || userPlan === "enterprise") && (
              <MenuItem icon="pulse-outline" label="Sistema Endócrino" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/endocrine' as any); }} />
            )}
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={C.danger} />
          <Text style={styles.logoutText}>{t('signOut')}</Text>
        </Pressable>

        <Text style={styles.version}>Evolvus Core Quantum v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>

      {showPlanDetail && (
        <PlanDetailSheet
          plan={userPlan}
          currentPlan={userPlan}
          onClose={() => setShowPlanDetail(false)}
          onSelect={() => setShowPlanDetail(false)}
        />
      )}

      <LanguageSelector
        visible={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
        currentLang={language}
        onSelect={setLanguage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text },
  scrollContent: { paddingHorizontal: 20, gap: 20, paddingTop: 4 },
  profileCard: { alignItems: "center", gap: 8, paddingVertical: 8 },
  avatarContainer: { position: "relative" },
  avatar: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 24 },
  planTag: { position: "absolute", bottom: -4, right: -8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  planTagText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  profileName: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  emailContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileEmail: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  verifiedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  verifiedText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  expirationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  expirationLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  expirationLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  expirationValue: { fontFamily: "Inter_700Bold", fontSize: 18 },
  expirationBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  expirationBadgeText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  section: { gap: 12 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  allocationBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 },
  allocationSegment: { minWidth: 4 },
  allocationLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendSymbol: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text },
  legendPercent: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  perfGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  perfCard: { width: "47%", flexGrow: 1, flexBasis: "45%", backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  goalBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  goalBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  perfLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  perfValue: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  planCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  planCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planCardName: { fontFamily: "Inter_700Bold", fontSize: 18 },
  planCardPrice: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planFeatureText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  viewDetailsLink: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 4 },
  paymentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  paymentCard: {
    width: "47%",
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  paymentIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  paymentLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  menuCard: { backgroundColor: C.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.border },
  levelCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border },
  levelDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  levelSelector: { flexDirection: "row", gap: 8 },
  levelOption: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  levelOptionText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  levelHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, fontStyle: "italic" },
  menuItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuItemLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.text },
  menuItemRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuItemValue: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, backgroundColor: C.dangerDim, borderRadius: 14 },
  logoutText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.danger },
  version: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: C.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.text,
    marginBottom: 16,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 4,
  },
  langInfo: { gap: 2 },
  langNative: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  langName: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
});
