/**
 * Evolvus Core Quantum — Grid Trading Engine
 *
 * Cria e gerencia grades de negociação automáticas (arithmetic grid strategy).
 * - Define faixa de preço, número de níveis e capital total
 * - Modo Snowball: reinveste lucros nos próximos níveis
 * - Visualiza lucro realizado e status da grade em tempo real
 *
 * Rotas: POST /api/grid            — criar grade
 *        GET  /api/grid            — listar grades ativas
 *        GET  /api/grid/:gridId    — detalhe da grade
 *        PUT  /api/grid/:gridId/pause   — pausar
 *        PUT  /api/grid/:gridId/resume  — retomar
 *        DELETE /api/grid/:gridId  — encerrar
 */

import { useState, useCallback, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Alert, Switch,
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

// ─── Types ────────────────────────────────────────────────────────────

interface GridState {
  gridId: string;
  config: {
    symbol: string;
    lowerBound: number;
    upperBound: number;
    gridCount: number;
    totalCapital: number;
    feePercent: number;
    reinvestProfits: boolean;
  };
  currentPrice: number;
  status: "ACTIVE" | "PAUSED" | "STOPPED";
  realizedPnl: number;
  totalInvested: number;
  cyclesCompleted: number;
  levels: Array<{
    index: number;
    price: number;
    side: "BUY" | "SELL";
    status: "PENDING" | "FILLED" | "CANCELLED";
    profit?: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function pnlColor(v: number) {
  return v >= 0 ? C.success : C.danger;
}

function statusColor(s: GridState["status"]) {
  if (s === "ACTIVE") return C.success;
  if (s === "PAUSED") return C.warning;
  return C.textSecondary;
}

function statusIcon(s: GridState["status"]): "play-circle" | "pause-circle" | "stop-circle" {
  if (s === "ACTIVE") return "play-circle";
  if (s === "PAUSED") return "pause-circle";
  return "stop-circle";
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

// ─── Create Grid Form ─────────────────────────────────────────────────

function CreateGridForm({ onCreated }: { onCreated: () => void }) {
  const { primary } = usePlanTheme();
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [lower, setLower] = useState("80000");
  const [upper, setUpper] = useState("110000");
  const [gridCount, setGridCount] = useState("10");
  const [capital, setCapital] = useState("1000");
  const [snowball, setSnowball] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const cfg = {
      symbol,
      lowerBound: parseFloat(lower),
      upperBound: parseFloat(upper),
      gridCount: parseInt(gridCount, 10),
      totalCapital: parseFloat(capital),
      feePercent: 0.001,
      reinvestProfits: snowball,
    };
    if (
      isNaN(cfg.lowerBound) || isNaN(cfg.upperBound) ||
      isNaN(cfg.gridCount) || isNaN(cfg.totalCapital) ||
      cfg.lowerBound >= cfg.upperBound || cfg.gridCount < 2 || cfg.gridCount > 200
    ) {
      Alert.alert("Configuração inválida", "Verifique os valores inseridos.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/grid", cfg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated();
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Não foi possível criar a grade.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[f.card, { borderColor: `${primary}30` }]}>
      <Text style={f.title}>Nova Grade</Text>
      <Text style={f.label}>Par (ex: BTCUSDT)</Text>
      <TextInput
        style={[f.input, { borderColor: `${primary}40`, color: C.text }]}
        value={symbol}
        onChangeText={t => setSymbol(t.toUpperCase())}
        placeholder="BTCUSDT"
        placeholderTextColor={C.textSecondary}
        autoCapitalize="characters"
      />
      <View style={f.row}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Text style={f.label}>Piso (USD)</Text>
          <TextInput style={[f.input, { borderColor: `${primary}40`, color: C.text }]} value={lower} onChangeText={setLower} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
        </View>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={f.label}>Teto (USD)</Text>
          <TextInput style={[f.input, { borderColor: `${primary}40`, color: C.text }]} value={upper} onChangeText={setUpper} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
        </View>
      </View>
      <View style={f.row}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Text style={f.label}>Nº Níveis (2–200)</Text>
          <TextInput style={[f.input, { borderColor: `${primary}40`, color: C.text }]} value={gridCount} onChangeText={setGridCount} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
        </View>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Text style={f.label}>Capital (USDT)</Text>
          <TextInput style={[f.input, { borderColor: `${primary}40`, color: C.text }]} value={capital} onChangeText={setCapital} keyboardType="numeric" placeholderTextColor={C.textSecondary} />
        </View>
      </View>
      <View style={[f.row, { alignItems: "center", marginTop: 4 }]}>
        <Text style={[f.label, { flex: 1, marginBottom: 0 }]}>Modo Snowball (reinvestir lucros)</Text>
        <Switch value={snowball} onValueChange={setSnowball} trackColor={{ true: primary }} />
      </View>
      <Pressable
        style={[f.btn, { backgroundColor: primary, opacity: loading ? 0.6 : 1 }]}
        onPress={submit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#000" size="small" />
          : <Text style={f.btnText}>Criar Grade</Text>}
      </Pressable>
    </View>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────

function GridCard({ grid, onRefresh }: { grid: GridState; onRefresh: () => void }) {
  const { primary } = usePlanTheme();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const action = grid.status === "ACTIVE" ? "pause" : "resume";
      await apiRequest("PUT", `/api/grid/${grid.gridId}/${action}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRefresh();
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Operação falhou.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    Alert.alert("Encerrar Grade", `Encerrar grade ${grid.config.symbol}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Encerrar", style: "destructive",
        onPress: async () => {
          try {
            await apiRequest("DELETE", `/api/grid/${grid.gridId}`);
            onRefresh();
          } catch (e: any) {
            Alert.alert("Erro", e.message ?? "Operação falhou.");
          }
        },
      },
    ]);
  }

  const pct = grid.totalInvested > 0
    ? (grid.realizedPnl / grid.totalInvested) * 100
    : 0;

  return (
    <View style={[g.card, { borderColor: `${statusColor(grid.status)}30` }]}>
      <View style={g.header}>
        <View style={g.titleRow}>
          <Ionicons name={statusIcon(grid.status)} size={16} color={statusColor(grid.status)} />
          <Text style={g.symbol}>{grid.config.symbol}</Text>
          <Text style={[g.statusBadge, { backgroundColor: `${statusColor(grid.status)}22`, color: statusColor(grid.status) }]}>
            {grid.status}
          </Text>
          {grid.config.reinvestProfits && (
            <Text style={[g.badge, { backgroundColor: `${primary}22`, color: primary }]}>SNOWBALL</Text>
          )}
        </View>
        <View style={g.actions}>
          {grid.status !== "STOPPED" && (
            <Pressable style={g.iconBtn} onPress={toggle} disabled={loading}>
              <Ionicons name={grid.status === "ACTIVE" ? "pause" : "play"} size={16} color={primary} />
            </Pressable>
          )}
          <Pressable style={g.iconBtn} onPress={remove}>
            <Ionicons name="trash-outline" size={16} color={C.danger} />
          </Pressable>
        </View>
      </View>
      <View style={g.stats}>
        <View style={g.stat}>
          <Text style={g.statVal}>${fmt(grid.config.lowerBound, 0)}</Text>
          <Text style={g.statLbl}>Piso</Text>
        </View>
        <View style={g.stat}>
          <Text style={g.statVal}>${fmt(grid.currentPrice, 0)}</Text>
          <Text style={g.statLbl}>Preço Atual</Text>
        </View>
        <View style={g.stat}>
          <Text style={g.statVal}>${fmt(grid.config.upperBound, 0)}</Text>
          <Text style={g.statLbl}>Teto</Text>
        </View>
      </View>
      <View style={g.stats}>
        <View style={g.stat}>
          <Text style={[g.statVal, { color: pnlColor(grid.realizedPnl) }]}>
            {grid.realizedPnl >= 0 ? "+" : ""}${fmt(grid.realizedPnl)}
          </Text>
          <Text style={g.statLbl}>PnL Realizado</Text>
        </View>
        <View style={g.stat}>
          <Text style={[g.statVal, { color: pnlColor(pct) }]}>
            {pct >= 0 ? "+" : ""}{fmt(pct, 2)}%
          </Text>
          <Text style={g.statLbl}>Retorno</Text>
        </View>
        <View style={g.stat}>
          <Text style={g.statVal}>{grid.cyclesCompleted ?? 0}</Text>
          <Text style={g.statLbl}>Ciclos</Text>
        </View>
      </View>
      <Text style={g.meta}>
        {grid.config.gridCount} níveis · ${fmt(grid.config.totalCapital, 0)} USDT · Taxa {(grid.config.feePercent * 100).toFixed(2)}%
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function GridTradingScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { primary } = usePlanTheme();
  const [grids, setGrids] = useState<GridState[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<GridState[]>("GET", "/api/grid");
      setGrids(Array.isArray(data) ? data : []);
    } catch {
      setGrids([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('gridTrading')}</Text>
          <Text style={s.sub}>Estratégia de grade automática</Text>
        </View>
        <Pressable
          style={[s.addBtn, { borderColor: `${primary}30`, marginRight: 6 }]}
          onPress={() => router.push("/grid-evolutivo")}
        >
          <Ionicons name="flash-outline" size={18} color={primary} />
        </Pressable>
        <Pressable
          style={[s.addBtn, { borderColor: `${primary}50` }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreate(v => !v); }}
        >
          <Ionicons name={showCreate ? "close" : "add"} size={22} color={primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Info banner */}
        <View style={[s.info, { borderColor: `${primary}30` }]}>
          <Ionicons name="information-circle-outline" size={16} color={primary} />
          <Text style={[s.infoText, { color: C.textSecondary }]}>
            A grade divide a faixa de preço em níveis e executa compras/vendas automáticas à medida que o preço oscila, capturando lucro em cada ciclo.
          </Text>
        </View>

        {/* Create form */}
        {showCreate && (
          <CreateGridForm onCreated={() => { setShowCreate(false); load(); }} />
        )}

        {/* Grid list */}
        {loading ? (
          <ActivityIndicator color={primary} style={{ marginTop: 32 }} />
        ) : grids.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="grid-outline" size={48} color={C.textSecondary} />
            <Text style={s.emptyText}>Nenhuma grade ativa</Text>
            <Text style={[s.emptySubText, { color: C.textSecondary }]}>
              Toque no + para criar sua primeira grade
            </Text>
          </View>
        ) : (
          grids.map(grid => (
            <GridCard key={grid.gridId} grid={grid} onRefresh={load} />
          ))
        )}
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
  addBtn: { padding: 6, borderWidth: 1, borderRadius: 8 },
  content: { padding: 16, gap: 12 },
  info: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  infoText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  emptySubText: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
});

const f = StyleSheet.create({
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, marginBottom: 4 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  row: { flexDirection: "row" },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#000" },
});

const g = StyleSheet.create({
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  symbol: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text },
  statusBadge: { fontFamily: "Inter_600SemiBold", fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badge: { fontFamily: "Inter_600SemiBold", fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  actions: { flexDirection: "row", gap: 6 },
  iconBtn: { padding: 6, borderRadius: 6, backgroundColor: "#1a1a1a" },
  stats: { flexDirection: "row", justifyContent: "space-between" },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  statLbl: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary, marginTop: 2 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
});
