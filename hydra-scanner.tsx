import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

type Philosophy = "MOMENTUM" | "REVERSAL" | "BREAKOUT" | "MACRO_DRIVEN" | "STATISTICAL";
type SignalType = "BUY" | "SELL" | "NEUTRAL";

const PHIL_COLORS: Record<Philosophy, string> = {
  MOMENTUM: "#00E676",
  REVERSAL: "#FF5252",
  BREAKOUT: "#FFB74D",
  MACRO_DRIVEN: "#7B61FF",
  STATISTICAL: "#00B4D8",
};

interface Opportunity {
  symbol: string;
  consensusSignal: SignalType;
  consensusCount: number;
  topScore: number;
  topPhilosophy: Philosophy;
  confidence: number;
}

interface PhilosophyResult {
  philosophy: Philosophy;
  signal: SignalType;
  confidence: number;
}

interface HydraResult {
  symbol: string;
  consensusSignal: SignalType;
  consensusCount: number;
  totalPhilosophies: number;
  topScore: number;
  philosophyResults: PhilosophyResult[];
}

function SignalBadge({ signal }: { signal: SignalType }) {
  const color = signal === "BUY" ? C.success : signal === "SELL" ? C.danger : C.warning;
  return (
    <View style={[badge.root, { backgroundColor: `${color}20`, borderColor: `${color}50` }]}>
      <Text style={[badge.text, { color }]}>{signal}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  root: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  text: { fontFamily: "Inter_700Bold", fontSize: 11 },
});

export default function HydraScannerScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const primary = planTheme.primary;

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [fullScan, setFullScan] = useState<HydraResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"opportunities" | "scan">("opportunities");

  const loadOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/market/hydra/opportunities");
      setOpportunities((res as any)?.opportunities ?? []);
    } catch {
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/market/hydra/scan?limit=20");
      setFullScan((res as any)?.results ?? []);
    } catch {
      setFullScan([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOpportunities(); }, [loadOpportunities]);

  const onTabChange = (t: typeof tab) => {
    setTab(t);
    if (t === "opportunities") loadOpportunities();
    else loadScan();
  };

  if (planType !== "premium" && planType !== "enterprise" && (planType as string) !== "admin") {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Ionicons name="lock-closed" size={56} color={C.textSecondary} />
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 16, marginBottom: 8 }}>
          Hydra Multi-Philosophy Scanner
        </Text>
        <Text style={{ color: C.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Disponível a partir do plano Premium. Analise mercados com 5 filosofias simultâneas de trading.
        </Text>
        <Pressable
          onPress={() => router.push("/payment")}
          style={{ backgroundColor: primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Fazer Upgrade</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Hydra Scanner</Text>
          <Text style={s.sub}>Multi-filosofia — Consenso de 5 perspectivas</Text>
        </View>
        <Pressable onPress={() => onTabChange(tab)}>
          <Ionicons name="refresh" size={18} color={primary} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["opportunities", "scan"] as const).map((t) => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => onTabChange(t)}
          >
            <Text style={[s.tabText, tab === t && { color: primary }]}>
              {t === "opportunities" ? "Oportunidades" : "Scan Completo"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {loading && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={primary} size="large" />
            <Text style={[s.emptyText, { marginTop: 12 }]}>Hydra analisando mercado...</Text>
          </View>
        )}

        {!loading && tab === "opportunities" && (
          <>
            {opportunities.length === 0 ? (
              <View style={[s.card, { alignItems: "center", paddingVertical: 32 }]}>
                <Ionicons name="search" size={36} color={C.textSecondary} />
                <Text style={[s.emptyText, { marginTop: 8 }]}>Nenhuma oportunidade no momento</Text>
                <Text style={s.emptySub}>Consenso mínimo de 3/5 filosofias não atingido</Text>
              </View>
            ) : (
              opportunities.map((opp) => (
                <View key={opp.symbol} style={[s.oppCard, { borderColor: opp.consensusSignal === "BUY" ? `${C.success}40` : opp.consensusSignal === "SELL" ? `${C.danger}40` : `${C.warning}40` }]}>
                  <View style={s.oppHeader}>
                    <Text style={s.oppSymbol}>{opp.symbol.replace("USDT", "")}</Text>
                    <SignalBadge signal={opp.consensusSignal} />
                  </View>
                  <View style={s.oppMeta}>
                    <View style={s.consensusBadge}>
                      <Text style={[s.consensusCount, { color: primary }]}>{opp.consensusCount}/5</Text>
                      <Text style={s.consensusLabel}>Filosofias</Text>
                    </View>
                    <View>
                      <Text style={s.oppScore}>Score: {opp.topScore.toFixed(1)}</Text>
                      <Text style={s.oppPhil}>{opp.topPhilosophy}</Text>
                    </View>
                    <View>
                      <Text style={s.confPct}>{(opp.confidence * 100).toFixed(0)}%</Text>
                      <Text style={s.confLabel}>Confiança</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {!loading && tab === "scan" && (
          fullScan.map((r) => (
            <View key={r.symbol} style={[s.card, { borderColor: `${primary}20` }]}>
              <View style={s.scanHeader}>
                <Text style={s.scanSymbol}>{r.symbol.replace("USDT", "")}</Text>
                <SignalBadge signal={r.consensusSignal} />
                <Text style={s.scanConsensus}>{r.consensusCount}/{r.totalPhilosophies}</Text>
              </View>
              <View style={s.philRow}>
                {r.philosophyResults.map((p) => (
                  <View
                    key={p.philosophy}
                    style={[s.philChip, { backgroundColor: `${PHIL_COLORS[p.philosophy]}20`, borderColor: `${PHIL_COLORS[p.philosophy]}40` }]}
                  >
                    <Text style={[s.philName, { color: PHIL_COLORS[p.philosophy] }]}>{p.philosophy.slice(0, 4)}</Text>
                    <Text style={[s.philSig, { color: PHIL_COLORS[p.philosophy] }]}>{p.signal === "BUY" ? "↑" : p.signal === "SELL" ? "↓" : "→"}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  content: { padding: 16, gap: 12 },
  oppCard: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  oppHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  oppSymbol: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  oppMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  consensusBadge: { alignItems: "center" },
  consensusCount: { fontFamily: "Inter_700Bold", fontSize: 22 },
  consensusLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
  oppScore: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  oppPhil: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  confPct: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  confLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  scanHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  scanSymbol: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, flex: 1 },
  scanConsensus: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  philRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  philChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  philName: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  philSig: { fontFamily: "Inter_700Bold", fontSize: 12 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
});
