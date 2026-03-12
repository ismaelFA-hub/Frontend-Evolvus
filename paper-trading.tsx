/**
 * Evolvus Core Quantum — Paper Trading
 *
 * Simulador de trades com backend real de paper trading.
 * - Abre posições LONG/SHORT simuladas
 * - Acompanha PnL em tempo real
 * - Fecha posições individualmente
 * - Reset da conta simulada
 *
 * Rotas: GET    /api/paper/positions  — listar posições
 *        POST   /api/paper/open       — abrir posição
 *        DELETE /api/paper/close/:id  — fechar posição
 *        POST   /api/paper/reset      — resetar conta
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";
import { useI18n } from "@/lib/i18n-context";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────

interface PaperPosition {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnl: number;
  openedAt: string;
}

interface PortfolioData {
  positions: PaperPosition[];
  balance: number;
  totalPnl: number;
}

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}

function pnlColor(v: number) {
  return v >= 0 ? C.success : C.danger;
}

// ─── Position Card ────────────────────────────────────────────

function PositionCard({ pos, onClose }: { pos: PaperPosition; onClose: (id: string) => void }) {
  const { primary } = usePlanTheme();
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    Alert.alert("Fechar Posição", `Fechar posição ${pos.symbol}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Fechar", style: "destructive",
        onPress: async () => {
          setClosing(true);
          try {
            await apiRequest("DELETE", `/api/paper/close/${pos.id}`);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose(pos.id);
          } catch (e: any) {
            Alert.alert("Erro", e.message ?? "Não foi possível fechar a posição.");
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  }

  const isLong = pos.side === "LONG";

  return (
    <View style={[pc.card, { borderColor: isLong ? `${C.success}30` : `${C.danger}30` }]}>
      <View style={pc.header}>
        <View style={pc.titleRow}>
          <Text style={pc.symbol}>{pos.symbol}</Text>
          <View style={[pc.badge, { backgroundColor: isLong ? `${C.success}22` : `${C.danger}22` }]}>
            <Text style={[pc.badgeText, { color: isLong ? C.success : C.danger }]}>{pos.side}</Text>
          </View>
        </View>
        <Pressable
          style={[pc.closeBtn, { borderColor: `${C.danger}50` }]}
          onPress={handleClose}
          disabled={closing}
        >
          {closing
            ? <ActivityIndicator size="small" color={C.danger} />
            : <Text style={pc.closeBtnText}>Fechar</Text>}
        </Pressable>
      </View>
      <View style={pc.stats}>
        <View style={pc.stat}>
          <Text style={pc.statVal}>${fmt(pos.entryPrice)}</Text>
          <Text style={pc.statLbl}>Entrada</Text>
        </View>
        <View style={pc.stat}>
          <Text style={pc.statVal}>${fmt(pos.currentPrice)}</Text>
          <Text style={pc.statLbl}>Atual</Text>
        </View>
        <View style={pc.stat}>
          <Text style={pc.statVal}>{fmt(pos.quantity, 4)}</Text>
          <Text style={pc.statLbl}>Qtd</Text>
        </View>
        <View style={pc.stat}>
          <Text style={[pc.statVal, { color: pnlColor(pos.pnl) }]}>
            {pos.pnl >= 0 ? "+" : ""}${fmt(pos.pnl)}
          </Text>
          <Text style={pc.statLbl}>PnL</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function PaperTradingScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary } = usePlanTheme();

  const [portfolio, setPortfolio] = useState<PortfolioData>({ positions: [], balance: 10000, totalPnl: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [quantity, setQuantity] = useState("0.01");
  const [opening, setOpening] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/paper/positions");
      const data = await res.json() as PortfolioData;
      setPortfolio({
        positions: data.positions ?? [],
        balance: data.balance ?? 10000,
        totalPnl: data.totalPnl ?? 0,
      });
    } catch {
      // keep default
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  async function openPosition() {
    const qty = parseFloat(quantity);
    if (!symbol.trim() || isNaN(qty) || qty <= 0) {
      Alert.alert("Dados inválidos", "Verifique o símbolo e a quantidade.");
      return;
    }
    setOpening(true);
    try {
      await apiRequest("POST", "/api/paper/open", { symbol: symbol.toUpperCase(), side, quantity: qty });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Não foi possível abrir a posição.");
    } finally {
      setOpening(false);
    }
  }

  async function resetAccount() {
    Alert.alert(
      "Resetar Conta Paper",
      "Todas as posições serão fechadas e o saldo voltará para $10.000. Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resetar", style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              await apiRequest("POST", "/api/paper/reset");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              load();
            } catch (e: any) {
              Alert.alert("Erro", e.message ?? "Não foi possível resetar.");
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  }

  function handleClose(id: string) {
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.id !== id),
    }));
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('paperTrading')}</Text>
          <Text style={s.sub}>Simulação de Trades</Text>
        </View>
        <Pressable
          style={[s.resetBtn, { borderColor: `${C.danger}40`, opacity: resetting ? 0.6 : 1 }]}
          onPress={resetAccount}
          disabled={resetting}
        >
          {resetting
            ? <ActivityIndicator size="small" color={C.danger} />
            : <Text style={[s.resetText, { color: C.danger }]}>Reset</Text>}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Portfolio card */}
        <View style={[s.portfolioCard, { borderColor: `${primary}30` }]}>
          <Text style={s.sectionTitle}>Portfolio Paper</Text>
          <View style={s.portfolioRow}>
            <View style={s.portfolioStat}>
              <Text style={s.portfolioVal}>${fmt(portfolio.balance)}</Text>
              <Text style={s.portfolioLbl}>Saldo Simulado</Text>
            </View>
            <View style={s.portfolioStat}>
              <Text style={[s.portfolioVal, { color: pnlColor(portfolio.totalPnl) }]}>
                {portfolio.totalPnl >= 0 ? "+" : ""}${fmt(portfolio.totalPnl)}
              </Text>
              <Text style={s.portfolioLbl}>PnL Total</Text>
            </View>
            <View style={s.portfolioStat}>
              <Text style={s.portfolioVal}>{portfolio.positions.length}</Text>
              <Text style={s.portfolioLbl}>Posições</Text>
            </View>
          </View>
        </View>

        {/* Open position form */}
        <View style={[s.formCard, { borderColor: `${primary}30` }]}>
          <Text style={s.sectionTitle}>Abrir Posição</Text>
          <Text style={s.label}>Par (ex: BTCUSDT)</Text>
          <TextInput
            style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
            value={symbol}
            onChangeText={t => setSymbol(t.toUpperCase())}
            placeholder="BTCUSDT"
            placeholderTextColor={C.textSecondary}
            autoCapitalize="characters"
          />
          <Text style={s.label}>Direção</Text>
          <View style={s.sideToggle}>
            <Pressable
              style={[s.sideBtn, side === "LONG" && { backgroundColor: `${C.success}22`, borderColor: C.success }]}
              onPress={() => setSide("LONG")}
            >
              <Text style={[s.sideBtnText, side === "LONG" && { color: C.success }]}>LONG</Text>
            </Pressable>
            <Pressable
              style={[s.sideBtn, side === "SHORT" && { backgroundColor: `${C.danger}22`, borderColor: C.danger }]}
              onPress={() => setSide("SHORT")}
            >
              <Text style={[s.sideBtnText, side === "SHORT" && { color: C.danger }]}>SHORT</Text>
            </Pressable>
          </View>
          <Text style={s.label}>Quantidade</Text>
          <TextInput
            style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="0.01"
            placeholderTextColor={C.textSecondary}
          />
          <Pressable
            style={[s.openBtn, { backgroundColor: primary, opacity: opening ? 0.6 : 1 }]}
            onPress={openPosition}
            disabled={opening}
          >
            {opening
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.openBtnText}>Abrir Trade</Text>}
          </Pressable>
        </View>

        {/* Positions list */}
        <Text style={s.sectionTitle}>Posições Abertas</Text>

        {loading ? (
          <ActivityIndicator color={primary} style={{ marginVertical: 24 }} />
        ) : portfolio.positions.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="bar-chart-outline" size={48} color={C.textSecondary} />
            <Text style={s.emptyText}>Nenhuma posição aberta.</Text>
            <Text style={s.emptySubText}>Inicie sua primeira simulação!</Text>
          </View>
        ) : (
          portfolio.positions.map(pos => (
            <PositionCard key={pos.id} pos={pos} onClose={handleClose} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ffffff10" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  resetBtn: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 8 },
  resetText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  content: { padding: 16, gap: 14 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, marginBottom: 2 },
  portfolioCard: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  portfolioRow: { flexDirection: "row", justifyContent: "space-between" },
  portfolioStat: { alignItems: "center", flex: 1 },
  portfolioVal: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  portfolioLbl: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  formCard: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  sideToggle: { flexDirection: "row", gap: 8 },
  sideBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#ffffff20", backgroundColor: "#1a1a1a" },
  sideBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  openBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  openBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  emptySubText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
});

const pc = StyleSheet.create({
  card: { backgroundColor: C.card, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  symbol: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderRadius: 8 },
  closeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.danger },
  stats: { flexDirection: "row", justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2 },
});
