/**
 * Martingale Probabilístico — IA de Reversão
 *
 * Analisa probabilidade de reversão, calcula multiplicadores seguros via VaR
 * e aplica lógica anti-martingale para sequências vencedoras.
 *
 * Rotas: GET  /api/martingale-prob/status               — status
 *        POST /api/martingale-prob/analyze               — análise geral
 *        POST /api/martingale-prob/reversion-probability — prob. reversão
 *        POST /api/martingale-prob/var-multiplier        — multiplicador VaR
 *        POST /api/martingale-prob/anti-martingale       — anti-martingale
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────

interface MartingaleStatus {
  status: string;
  activeStrategies: number;
  totalTrades: number;
  winRate: number;
}

interface MartingaleAnalysis {
  recommendation: string;
  probability: number;
  risk: string;
}

interface ReversionProb {
  probability: number;
  confidence: number;
  recommendation: string;
}

interface VaRMultiplier {
  safeMultiplier: number;
  maxSafeMultiplier: number;
  reasoning: string;
}

interface AntiMartingale {
  recommendedSize: number;
  scalingFactor: number;
  recommendation: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function probColor(p: number) {
  if (p >= 0.65) return C.success;
  if (p >= 0.45) return C.warning;
  return C.danger;
}

function riskColor(r: string) {
  if (r === "LOW" || r === "low") return C.success;
  if (r === "MEDIUM" || r === "medium") return C.warning;
  return C.danger;
}

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function SectionHeader({ icon, title, color }: { icon: any; title: string; color: string }) {
  return (
    <View style={sh.row}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={sh.title}>{title}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function MartingaleProbScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary, primaryDim } = usePlanTheme();

  const [status, setStatus] = useState<MartingaleStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [analysis, setAnalysis] = useState<MartingaleAnalysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [reversion, setReversion] = useState<ReversionProb | null>(null);
  const [loadingReversion, setLoadingReversion] = useState(false);

  const [varMult, setVarMult] = useState<VaRMultiplier | null>(null);
  const [loadingVar, setLoadingVar] = useState(false);

  const [antiMart, setAntiMart] = useState<AntiMartingale | null>(null);
  const [loadingAnti, setLoadingAnti] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/martingale-prob/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadStatus(); }, [loadStatus]);

  async function runAnalysis() {
    setLoadingAnalysis(true);
    try {
      const res = await apiRequest("POST", "/api/martingale-prob/analyze", {
        symbol: "BTCUSDT",
        candles: [],
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha na análise.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function calcReversion() {
    setLoadingReversion(true);
    try {
      const res = await apiRequest("POST", "/api/martingale-prob/reversion-probability", {
        symbol: "BTCUSDT",
        currentLoss: 5,
        candles: [],
      });
      const data = await res.json();
      setReversion(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao calcular reversão.");
    } finally {
      setLoadingReversion(false);
    }
  }

  async function calcVarMultiplier() {
    setLoadingVar(true);
    try {
      const res = await apiRequest("POST", "/api/martingale-prob/var-multiplier", {
        currentMultiplier: 2,
        varPercent: 3,
        candles: [],
      });
      const data = await res.json();
      setVarMult(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao calcular VaR.");
    } finally {
      setLoadingVar(false);
    }
  }

  async function calcAntiMartingale() {
    setLoadingAnti(true);
    try {
      const res = await apiRequest("POST", "/api/martingale-prob/anti-martingale", {
        consecutiveWins: 3,
        baseSize: 100,
        candles: [],
      });
      const data = await res.json();
      setAntiMart(data);
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha no anti-martingale.");
    } finally {
      setLoadingAnti(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('martingaleProb')}</Text>
          <Text style={s.sub}>IA de Reversão</Text>
        </View>
        <View style={[s.badge, { backgroundColor: primaryDim, borderColor: `${primary}40` }]}>
          <Ionicons name="dice" size={14} color={primary} />
          <Text style={[s.badgeText, { color: primary }]}>PROB</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* ── Status ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="pulse-outline" title="Status" color={primary} />
          {loadingStatus ? (
            <ActivityIndicator color={primary} />
          ) : status ? (
            <View style={s.statsGrid}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: status.status === "active" ? C.success : C.warning }]}>
                  {status.status?.toUpperCase() ?? "—"}
                </Text>
                <Text style={s.statLbl}>Status</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: primary }]}>{status.activeStrategies ?? 0}</Text>
                <Text style={s.statLbl}>Estratégias</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.success }]}>{fmt(status.winRate * 100)}%</Text>
                <Text style={s.statLbl}>Win Rate</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>Sem dados</Text>
          )}
        </View>

        {/* ── Análise ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="analytics-outline" title="Análise Martingale (BTCUSDT)" color={primary} />
          <Text style={s.cardDesc}>Avalia condições de mercado para aplicar Martingale probabilístico.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={runAnalysis} disabled={loadingAnalysis}>
            {loadingAnalysis ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Analisar</Text>}
          </Pressable>
          {analysis && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Probabilidade</Text>
                <Text style={[s.resultVal, { color: probColor(analysis.probability) }]}>
                  {(analysis.probability * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Risco</Text>
                <Text style={[s.resultVal, { color: riskColor(analysis.risk) }]}>
                  {analysis.risk?.toUpperCase()}
                </Text>
              </View>
              <Text style={s.xaiText}>{analysis.recommendation}</Text>
            </View>
          )}
        </View>

        {/* ── Prob. Reversão ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="refresh-circle-outline" title="Prob. Reversão (perda 5%)" color={primary} />
          <Text style={s.cardDesc}>Calcula probabilidade de reversão após 5% de perda acumulada.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={calcReversion} disabled={loadingReversion}>
            {loadingReversion ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Calcular Reversão</Text>}
          </Pressable>
          {reversion && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Probabilidade</Text>
                <Text style={[s.resultVal, { color: probColor(reversion.probability) }]}>
                  {(reversion.probability * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Confiança</Text>
                <Text style={[s.resultVal, { color: primary }]}>
                  {(reversion.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <Text style={s.xaiText}>{reversion.recommendation}</Text>
            </View>
          )}
        </View>

        {/* ── Multiplicador VaR ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="shield-half-outline" title="Multiplicador VaR (atual: 2x)" color={primary} />
          <Text style={s.cardDesc}>Determina o multiplicador seguro baseado no VaR de 3%.</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={calcVarMultiplier} disabled={loadingVar}>
            {loadingVar ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Calcular VaR</Text>}
          </Pressable>
          {varMult && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Multiplicador Seguro</Text>
                <Text style={[s.resultVal, { color: C.success }]}>{fmt(varMult.safeMultiplier)}x</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Máximo Seguro</Text>
                <Text style={[s.resultVal, { color: C.warning }]}>{fmt(varMult.maxSafeMultiplier)}x</Text>
              </View>
              <Text style={s.xaiText}>{varMult.reasoning}</Text>
            </View>
          )}
        </View>

        {/* ── Anti-Martingale ── */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <SectionHeader icon="trending-up-outline" title="Anti-Martingale (3 wins)" color={primary} />
          <Text style={s.cardDesc}>Calcula tamanho crescente após 3 vitórias consecutivas (base: $100).</Text>
          <Pressable style={[s.btn, { backgroundColor: primary }]} onPress={calcAntiMartingale} disabled={loadingAnti}>
            {loadingAnti ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.btnText}>Calcular Anti-Martingale</Text>}
          </Pressable>
          {antiMart && (
            <View style={[s.resultBox, { backgroundColor: primaryDim }]}>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Tamanho Recomendado</Text>
                <Text style={[s.resultVal, { color: primary }]}>${fmt(antiMart.recommendedSize)}</Text>
              </View>
              <View style={s.resultRow}>
                <Text style={s.resultLbl}>Fator de Escala</Text>
                <Text style={[s.resultVal, { color: C.success }]}>{fmt(antiMart.scalingFactor)}x</Text>
              </View>
              <Text style={s.xaiText}>{antiMart.recommendation}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  statsGrid: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statVal: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center", paddingVertical: 8 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18 },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  resultBox: { borderRadius: 10, padding: 12, gap: 6 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultLbl: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  resultVal: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  xaiText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 18, marginTop: 4 },
});

const sh = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
});
