/**
 * Evolvus Core Quantum — Payment / Upgrade Screen
 *
 * Displays the 3 paid plans (Pro, Premium, Enterprise) with pricing and
 * feature lists, then initiates a Stripe Checkout session via:
 *   GET  /api/payment/plans    → loads plan catalog
 *   POST /api/payment/checkout → gets Stripe Checkout URL
 *
 * The checkout URL is opened in the device browser (Linking.openURL).
 * On return, the user's plan is updated server-side via Stripe webhook.
 */

import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import PlanComparison from "@/components/PlanComparison";
import { detectRegionCurrency } from "@/lib/regional-pricing";
import { PLAN_FEATURES } from "@/lib/market-data";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────

type PlanId = "pro" | "premium" | "enterprise";
type Currency = "BRL" | "USD";

interface PlanInfo {
  id: PlanId;
  namePT: string;
  nameEN: string;
  priceBRL: number;
  priceUSD: number;
  yearlyBRL?: number;
  yearlyUSD?: number;
  features: string[];
}

// ─── Helpers ──────────────────────────────────────────────────

const PLAN_COLORS: Record<PlanId, string> = {
  pro:        "#00D4AA",
  premium:    "#7B61FF",
  enterprise: "#F7931A",
};

const PLAN_ICONS: Record<PlanId, string> = {
  pro:        "trending-up",
  premium:    "diamond",
  enterprise: "shield-checkmark",
};

function formatPrice(amount: number, currency: Currency): string {
  if (currency === "BRL") return `R$ ${amount.toLocaleString("pt-BR")}/mês`;
  return `$${amount}/mo`;
}

// ─── Screen ───────────────────────────────────────────────────

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [currency, setCurrency] = useState<Currency>(detectRegionCurrency() as Currency);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch plans from API ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiRequest("GET", "/api/payment/plans");
        const data = await res.json() as { plans: PlanInfo[] };
        if (!cancelled) setPlans(data.plans);
      } catch (err) {
        if (!cancelled) setError("Falha ao carregar planos. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Initiate checkout ─────────────────────────────────────────
  const handleCheckout = useCallback(async (planId: PlanId) => {
    if (!user) {
      Alert.alert("Login necessário", "Faça login para fazer upgrade.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingOut(planId);
    try {
      const res = await apiRequest("POST", "/api/payment/checkout", {
        plan: planId,
        currency,
        email: user.email,
      });
      const data = await res.json() as { url: string; mock: boolean };

      if (data.mock) {
        // Dev / mock mode — show informational message instead of opening URL
        Alert.alert(
          "Modo Desenvolvimento",
          `Checkout simulado para o plano ${planId.toUpperCase()}.\n\nConfigure STRIPE_SECRET_KEY em produção para pagamentos reais.\n\nURL: ${data.url}`,
          [{ text: "OK" }],
        );
      } else if (data.url) {
        await Linking.openURL(data.url);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      Alert.alert("Erro no checkout", msg);
    } finally {
      setCheckingOut(null);
    }
  }, [user, currency]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.title}>Upgrade de Plano</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Currency toggle */}
      <View style={styles.currencyRow}>
        {(["BRL", "USD"] as Currency[]).map((c) => (
          <Pressable
            key={c}
            style={[styles.currencyBtn, currency === c && { backgroundColor: planTheme.primary }]}
            onPress={() => { Haptics.selectionAsync(); setCurrency(c); }}
          >
            <Text style={[styles.currencyBtnText, currency === c && { color: "#000" }]}>
              {c === "BRL" ? "🇧🇷 BRL" : "🇺🇸 USD"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Current plan badge */}
      {user?.plan && (
        <View style={styles.currentBadge}>
          <Ionicons name="checkmark-circle" size={16} color={planTheme.primary} />
          <Text style={[styles.currentBadgeText, { color: planTheme.primary }]}>
            Plano atual: {user.plan.toUpperCase()}
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={planTheme.primary} />
          <Text style={styles.loadingText}>Carregando planos...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle" size={48} color={C.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={[styles.retryBtn, { borderColor: planTheme.primary }]} onPress={() => { setError(null); setLoading(true); }}>
            <Text style={[styles.retryBtnText, { color: planTheme.primary }]}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero */}
          <Text style={styles.heroTitle}>Desbloqueie o Poder Total</Text>
          <Text style={styles.heroSubtitle}>
            35 micro-cérebros de IA · 15 exchanges · Backtest histórico · Copy Trading · Genética de Estratégias
          </Text>

          {/* Plan cards */}
          {plans.map((plan) => {
            const color = PLAN_COLORS[plan.id];
            const isCurrentPlan = user?.plan === plan.id;
            const isLoading = checkingOut === plan.id;
            const price = currency === "BRL" ? plan.priceBRL : plan.priceUSD;
            const yearlyPrice = currency === "BRL" ? plan.yearlyBRL : plan.yearlyUSD;

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  { borderColor: isCurrentPlan ? color : C.border },
                  plan.id === "premium" && styles.planCardFeatured,
                ]}
              >
                {plan.id === "premium" && (
                  <View style={[styles.popularBadge, { backgroundColor: color }]}>
                    <Text style={styles.popularBadgeText}>⭐ MAIS POPULAR</Text>
                  </View>
                )}

                {/* Plan header */}
                <View style={styles.planHeader}>
                  <View style={[styles.planIconWrap, { backgroundColor: `${color}20` }]}>
                    <Ionicons name={PLAN_ICONS[plan.id] as "trending-up"} size={24} color={color} />
                  </View>
                  <View style={styles.planTitleWrap}>
                    <Text style={[styles.planName, { color }]}>{plan.namePT}</Text>
                    <Text style={styles.planPrice}>{formatPrice(price, currency)}</Text>
                    {yearlyPrice !== undefined && (
                      <Text style={styles.planYearlyHint}>
                        {currency === "BRL" ? `R$ ${yearlyPrice.toLocaleString("pt-BR")}/ano` : `$${yearlyPrice}/yr`}
                        {" "}
                        <Text style={{ color: C.success }}>(-{Math.round((1 - yearlyPrice / (price * 12)) * 100)}%)</Text>
                      </Text>
                    )}
                  </View>
                </View>

                {/* Features list */}
                <View style={styles.featuresList}>
                  {(PLAN_FEATURES[plan.id]?.featureKeys ?? plan.features).map((key, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={color} />
                      <Text style={styles.featureText}>{t(key as any) || key}</Text>
                    </View>
                  ))}
                </View>

                {/* CTA button */}
                <Pressable
                  style={[
                    styles.ctaBtn,
                    { backgroundColor: isCurrentPlan ? C.surface : color },
                    isCurrentPlan && { borderWidth: 1, borderColor: color },
                  ]}
                  onPress={() => !isCurrentPlan && handleCheckout(plan.id)}
                  disabled={isCurrentPlan || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={isCurrentPlan ? color : "#000"} />
                  ) : (
                    <Text style={[styles.ctaBtnText, isCurrentPlan && { color }]}>
                      {isCurrentPlan ? "✓ Plano Atual" : `Assinar ${plan.namePT}`}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}

          {/* Security note */}
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={16} color={C.textSecondary} />
            <Text style={styles.securityNoteText}>
              Pagamento seguro via Stripe · Cancele a qualquer momento · Dados de cartão nunca passam pelo Evolvus
            </Text>
          </View>

          {/* Plan upgrade comparison + enterprise multi-user quote */}
          <PlanComparison currentPlan={user?.plan as string | undefined} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  currencyRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currencyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  currencyBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
  },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  currentBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: C.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: C.error,
    fontSize: 14,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  planCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    overflow: "hidden",
  },
  planCardFeatured: {
    borderWidth: 2,
    paddingTop: 36,
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    alignItems: "center",
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#000",
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  planIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  planTitleWrap: {
    flex: 1,
  },
  planName: {
    fontSize: 20,
    fontWeight: "800",
  },
  planPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginTop: 2,
  },
  planYearlyHint: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  featuresList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
  },
  ctaBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 4,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
});
