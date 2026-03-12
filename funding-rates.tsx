import { useState, useEffect, useMemo } from "react";
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
import { getFundingRates, type FundingRateData } from "@/lib/quantum-engine";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

const PLAN_ORDER = ["free", "pro", "premium", "enterprise"];
function planGte(user: string, required: string) {
  return PLAN_ORDER.indexOf(user) >= PLAN_ORDER.indexOf(required);
}

function PlanGate({ required }: { required: string }) {
  const { planTheme } = usePlanTheme();
  return (
    <View style={s.gateOverlay}>
      <Ionicons name="lock-closed" size={28} color={C.textTertiary} />
      <Text style={s.gateTitle}>Requer plano {required.charAt(0).toUpperCase() + required.slice(1)}+</Text>
      <Pressable
        style={[s.gateBtn, { backgroundColor: planTheme.primary }]}
        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <Text style={s.gateBtnText}>Fazer Upgrade</Text>
      </Pressable>
    </View>
  );
}

function formatRate(r: number): string {
  return `${(r * 100).toFixed(4)}%`;
}

function rateColor(r: number): string {
  if (r > 0.005) return "#FF7043";
  if (r > 0) return C.warning;
  return C.success;
}

function getNextFundingMs(): number {
  const now = new Date();
  const h = now.getUTCHours();
  const nextH = h < 8 ? 8 : h < 16 ? 16 : 24;
  const next = new Date(now);
  next.setUTCHours(nextH % 24, 0, 0, 0);
  if (nextH === 24) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function FundingRatesScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const { t } = useI18n();

  const [countdown, setCountdown] = useState(() => getNextFundingMs());
  const [rates, setRates] = useState<FundingRateData[]>(() => getFundingRates());

  // Augment BTC/ETH/SOL with real sentiment-based funding proxy
  useEffect(() => {
    const TOP = ["BTC", "ETH", "SOL"];
    let cancelled = false;
    async function fetchReal() {
      try {
        const results = await Promise.allSettled(
          TOP.map((sym) =>
            apiRequest("GET", `/api/market/sentiment/${sym}`)
              .then((r) => r.json() as Promise<{ fundingProxy: { fundingProxy: number }; sentimentScore: number }>)
              .then((d) => ({ sym, proxy: d.fundingProxy.fundingProxy }))
          )
        );
        if (cancelled) return;
        const proxies = Object.fromEntries(
          results
            .filter((r): r is PromiseFulfilledResult<{ sym: string; proxy: number }> => r.status === "fulfilled")
            .map((r) => [r.value.sym, r.value.proxy])
        );
        setRates((prev) =>
          prev.map((r) => {
            const proxy = proxies[r.symbol];
            if (proxy === undefined) return r;
            // proxy is -1..+1 → scale to realistic perpetual funding rate range (~0.001 = 0.1% per 8h)
            const FUNDING_SCALE = 0.001;
            const rate = parseFloat((proxy * FUNDING_SCALE).toFixed(6));
            return { ...r, binanceRate: rate, predictedNext: rate * 1.05 };
          })
        );
      } catch {
        // keep mock on failure
      }
    }
    fetchReal();
    const id = setInterval(fetchReal, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const allRates = useMemo(() => {
    return [...rates].sort(
      (a, b) => Math.abs(b.binanceRate) - Math.abs(a.binanceRate)
    );
  }, [rates]);

  useEffect(() => {
    const id = setInterval(() => setCountdown(getNextFundingMs()), 1000);
    return () => clearInterval(id);
  }, []);

  const visibleRates: FundingRateData[] = planGte(planType, "pro") ? allRates : allRates.slice(0, 5);

  const avgRate = useMemo(() => {
    const sum = allRates.reduce((s, r) => s + r.binanceRate, 0);
    return sum / allRates.length;
  }, [allRates]);

  const highestRate = useMemo(
    () => allRates.reduce((m, r) => (r.binanceRate > m.binanceRate ? r : m), allRates[0]),
    [allRates]
  );

  const lowestRate = useMemo(
    () => allRates.reduce((m, r) => (r.binanceRate < m.binanceRate ? r : m), allRates[0]),
    [allRates]
  );

  const arbitrageOps = useMemo(() => {
    return allRates
      .map((r) => {
        const rates = [r.binanceRate, r.bybitRate, r.okxRate];
        const diff = Math.max(...rates) - Math.min(...rates);
        return { ...r, diff };
      })
      .filter((r) => r.diff > 0.00002)
      .sort((a, b) => b.diff - a.diff);
  }, [allRates]);

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={s.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{t('fundingRates')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Countdown */}
        <View style={s.countdownCard}>
          <Text style={s.countdownLabel}>Próximo Funding em</Text>
          <Text style={s.countdownTimer}>{formatCountdown(countdown)}</Text>
          <Text style={s.countdownSub}>Intervalos de 8h: 00:00, 08:00, 16:00 UTC</Text>
        </View>

        {/* Summary stats */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Taxa Média</Text>
            <Text style={[s.summaryValue, { color: rateColor(avgRate) }]}>{formatRate(avgRate)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Maior Taxa</Text>
            <Text style={s.summarySub}>{highestRate?.symbol}</Text>
            <Text style={[s.summaryValue, { color: rateColor(highestRate?.binanceRate ?? 0) }]}>
              {formatRate(highestRate?.binanceRate ?? 0)}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Mais Negativo</Text>
            <Text style={s.summarySub}>{lowestRate?.symbol}</Text>
            <Text style={[s.summaryValue, { color: rateColor(lowestRate?.binanceRate ?? 0) }]}>
              {formatRate(lowestRate?.binanceRate ?? 0)}
            </Text>
          </View>
        </View>

        {/* Funding Rate Table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('fundingRates')}</Text>
          <View style={s.tableCard}>
            {/* Table header */}
            <View style={s.tableHeader}>
              <Text style={[s.thText, { flex: 2 }]}>Par</Text>
              <Text style={[s.thText, { flex: 1 }]}>Binance</Text>
              <Text style={[s.thText, { flex: 1 }]}>Bybit</Text>
              <Text style={[s.thText, { flex: 1 }]}>OKX</Text>
            </View>
            {visibleRates.map((r, i) => (
              <View key={r.symbol} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                <Text style={[s.tdText, { flex: 2, color: C.text }]}>{r.symbol}</Text>
                <Text style={[s.tdText, { flex: 1, color: rateColor(r.binanceRate) }]}>
                  {formatRate(r.binanceRate)}
                </Text>
                <Text style={[s.tdText, { flex: 1, color: rateColor(r.bybitRate) }]}>
                  {formatRate(r.bybitRate)}
                </Text>
                <Text style={[s.tdText, { flex: 1, color: rateColor(r.okxRate) }]}>
                  {formatRate(r.okxRate)}
                </Text>
              </View>
            ))}
            {/* Predicted + Annualized (premium) */}
            {planGte(planType, "premium") && (
              <>
                <View style={[s.tableHeader, { marginTop: 8 }]}>
                  <Text style={[s.thText, { flex: 2 }]}>Par</Text>
                  <Text style={[s.thText, { flex: 2 }]}>Previsto</Text>
                  <Text style={[s.thText, { flex: 2 }]}>Anualizado</Text>
                </View>
                {visibleRates.map((r, i) => (
                  <View key={`ext-${r.symbol}`} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                    <Text style={[s.tdText, { flex: 2, color: C.text }]}>{r.symbol}</Text>
                    <Text style={[s.tdText, { flex: 2, color: rateColor(r.predictedNext) }]}>
                      {formatRate(r.predictedNext)}
                    </Text>
                    <Text
                      style={[
                        s.tdText,
                        { flex: 2, color: r.annualizedYield >= 0 ? C.success : C.danger },
                      ]}
                    >
                      {r.annualizedYield >= 0 ? "+" : ""}
                      {r.annualizedYield.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {!planGte(planType, "pro") && (
          <View style={s.gateCard}>
            <PlanGate required="pro" />
          </View>
        )}

        {/* Arbitrage Opportunities */}
        {planGte(planType, "premium") ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('fundingArbitrage')}</Text>
            {arbitrageOps.length === 0 ? (
              <View style={s.card}>
                <Text style={s.emptyText}>Nenhuma oportunidade no momento</Text>
              </View>
            ) : (
              arbitrageOps.map((op) => (
                <View key={op.symbol} style={s.arbCard}>
                  <View style={s.arbHeader}>
                    <Text style={s.arbPair}>{op.symbol}</Text>
                    <View style={s.arbBadge}>
                      <Text style={s.arbBadgeText}>Δ {formatRate(op.diff)}</Text>
                    </View>
                  </View>
                  <Text style={s.arbDesc}>
                    Diferencial de funding entre exchanges. Potencial receita de arbitragem long/short.
                  </Text>
                  <View style={s.arbRates}>
                    {[
                      { label: "Binance", val: op.binanceRate },
                      { label: "Bybit", val: op.bybitRate },
                      { label: "OKX", val: op.okxRate },
                    ].map((ex) => (
                      <View key={ex.label} style={s.arbRateItem}>
                        <Text style={s.arbExLabel}>{ex.label}</Text>
                        <Text style={[s.arbRateVal, { color: rateColor(ex.val) }]}>
                          {formatRate(ex.val)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('fundingArbitrage')}</Text>
            <View style={s.gateCard}>
              <PlanGate required="premium" />
            </View>
          </View>
        )}

        {/* Legend */}
        <View style={s.legendCard}>
          <Text style={s.legendTitle}>Legenda</Text>
          <View style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: "#FF7043" }]} />
            <Text style={s.legendText}>Taxa positiva = longs pagam (sinal baixista)</Text>
          </View>
          <View style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: C.success }]} />
            <Text style={s.legendText}>Taxa negativa = shorts pagam (sinal altista)</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, flex: 1, textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 14 },
  // Countdown
  countdownCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  countdownLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, marginBottom: 6 },
  countdownTimer: { fontFamily: "Inter_700Bold", fontSize: 42, color: C.text, letterSpacing: 2 },
  countdownSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginTop: 6 },
  // Summary
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  summaryCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  summarySub: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginBottom: 2 },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
  section: { marginBottom: 18 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  // Table
  tableCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 4,
  },
  thText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textTertiary },
  tableRow: { flexDirection: "row", paddingVertical: 7 },
  tableRowAlt: { backgroundColor: C.surface, borderRadius: 4 },
  tdText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  // Gate
  gateCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    marginBottom: 18,
  },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, textAlign: "center" },
  // Arbitrage
  arbCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.warning,
    marginBottom: 10,
  },
  arbHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  arbPair: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  arbBadge: { backgroundColor: C.warningDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  arbBadgeText: { fontFamily: "Inter_700Bold", fontSize: 12, color: C.warning },
  arbDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginBottom: 10, lineHeight: 18 },
  arbRates: { flexDirection: "row", gap: 12 },
  arbRateItem: { alignItems: "center" },
  arbExLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, marginBottom: 2 },
  arbRateVal: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  // Legend
  legendCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  legendTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text, marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  // PlanGate
  gateOverlay: { alignItems: "center", paddingVertical: 16, gap: 10 },
  gateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gateBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  gateBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
});
