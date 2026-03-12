import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import {
  getOrderExecutions,
  type OrderExecution,
} from "@/lib/quantum-engine";

const C = Colors.dark;

// ─── Type Extensions ──────────────────────────────────────────────────
interface OrderExecutionWithId extends OrderExecution {
  _stableId: string;
  orderId?: string;
  symbol?: string;
  quantity?: number;
  executedPrice?: number;
  price?: number;
  latency?: number;
  feeUsd?: number;
  createdAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  executedAt?: string;
  updatedAt?: string;
  orderType?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(val: number) {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatPercent(val: number) {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(3)}%`;
}

function buildStableId(order: OrderExecution, idx: number): string {
  return order.id ?? `order-${idx}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    filled:       { color: C.success,   bg: C.successDim,            label: "Executado" },
    partial_fill: { color: C.warning,   bg: C.warningDim,            label: "Parcial"   },
    partial:      { color: C.warning,   bg: C.warningDim,            label: "Parcial"   },
    pending:      { color: C.warning,   bg: C.warningDim,            label: "Pendente"  },
    acknowledged: { color: C.warning,   bg: C.warningDim,            label: "Aceito"    },
    cancelled:    { color: C.danger,    bg: C.dangerDim,             label: "Cancelado" },
    rejected:     { color: C.danger,    bg: C.dangerDim,             label: "Rejeitado" },
    open:         { color: "#00B4D8",   bg: "rgba(0,180,216,0.15)",  label: "Aberto"    },
  };
  const cfg = map[status] ?? { color: C.textSecondary, bg: C.border, label: status };
  return (
    <View style={[sb.badge, { backgroundColor: cfg.bg }]}>
      <View style={[sb.dot, { backgroundColor: cfg.color }]} />
      <Text style={[sb.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:   { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});

// ─── Side Badge ───────────────────────────────────────────────────────

function SideBadge({ side }: { side: string }) {
  const isBuy = side === "buy" || side === "BUY";
  return (
    <View style={[sd.badge, { backgroundColor: isBuy ? C.successDim : C.dangerDim }]}>
      <Ionicons
        name={isBuy ? "arrow-up" : "arrow-down"}
        size={11}
        color={isBuy ? C.success : C.danger}
      />
      <Text style={[sd.label, { color: isBuy ? C.success : C.danger }]}>
        {isBuy ? "COMPRA" : "VENDA"}
      </Text>
    </View>
  );
}
const sd = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label: { fontFamily: "Inter_700Bold", fontSize: 10 },
});

// ─── Metric Chip ──────────────────────────────────────────────────────

function MetricChip({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[mch.wrap, { backgroundColor: bg, borderColor: `${color}30` }]}>
      <Text style={[mch.val, { color }]}>{value}</Text>
      <Text style={mch.lbl}>{label}</Text>
    </View>
  );
}
const mch = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, gap: 3 },
  val:  { fontFamily: "Inter_700Bold", fontSize: 14 },
  lbl:  { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textSecondary },
});

// ─── Slippage Bar ─────────────────────────────────────────────────────

function SlippageBar({ slippage }: { slippage: number }) {
  const abs   = Math.abs(slippage);
  const pct   = Math.min((abs / 0.5) * 100, 100);
  const color = abs < 0.05 ? C.success : abs < 0.15 ? C.warning : C.danger;
  return (
    <View style={slb.row}>
      <Text style={slb.label}>Slippage</Text>
      <View style={slb.track}>
        <View style={[slb.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[slb.value, { color }]}>{formatPercent(slippage)}</Text>
    </View>
  );
}
const slb = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, width: 56 },
  track: { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  fill:  { height: "100%", borderRadius: 2 },
  value: { fontFamily: "Inter_600SemiBold", fontSize: 11, width: 56, textAlign: "right" },
});

// ─── Timeline Step ────────────────────────────────────────────────────

function TimelineStep({
  label,
  time,
  done,
  last,
  color,
}: {
  label: string;
  time?: string;
  done: boolean;
  last: boolean;
  color: string;
}) {
  return (
    <View style={tl.row}>
      <View style={tl.trackCol}>
        <View style={[tl.dot, { backgroundColor: done ? color : C.border }]} />
        {!last && (
          <View style={[tl.line, { backgroundColor: done ? color : C.border }]} />
        )}
      </View>
      <View style={tl.content}>
        <Text style={[tl.stepLabel, { color: done ? C.text : C.textTertiary }]}>
          {label}
        </Text>
        {time ? <Text style={tl.stepTime}>{time}</Text> : null}
      </View>
    </View>
  );
}
const tl = StyleSheet.create({
  row:       { flexDirection: "row", gap: 10 },
  trackCol:  { alignItems: "center", width: 14 },
  dot:       { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  line:      { width: 2, flex: 1, minHeight: 20, marginTop: 3 },
  content:   { flex: 1, paddingBottom: 14 },
  stepLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  stepTime:  { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary, marginTop: 2 },
});

// ─── Fee Row ──────────────────────────────────────────────────────────

function FeeRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={fr.row}>
      <Text style={fr.label}>{label}</Text>
      <Text style={[fr.value, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}
const fr = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  value: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text },
});

// ─── Execution Card ───────────────────────────────────────────────────

function ExecutionCard({
  order,
  primary,
  expanded,
  onPress,
}: {
  order: OrderExecutionWithId;
  primary: string;
  expanded: boolean;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [expanded]);

  const rotate = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const ts = order.timestamp ?? order.createdAt ?? null;
  const steps = [
    {
      label: "Ordem criada",
      time:  order.createdAt ?? ts ?? undefined,
      done:  true,
    },
    {
      label: "Enviada à exchange",
      time:  order.sentAt ?? undefined,
      done:  !!(order.sentAt ?? ts),
    },
    {
      label: "Aceita",
      time:  order.acceptedAt ?? undefined,
      done:  !!order.acceptedAt,
    },
    {
      label: "Executada",
      time:  order.executedAt ?? order.updatedAt ?? undefined,
      done:  order.status === "filled" || order.status === "partial_fill",
    },
  ];

  const slippageVal = order.slippage ?? 0;
  const latencyVal  = order.latency ?? order.latencyMs ?? 0;
  const feeVal      = order.fee ?? 0;
  const feeUsd      = order.feeUsd != null
    ? order.feeUsd
    : feeVal < 1
    ? feeVal * (order.executedPrice ?? order.actualPrice ?? order.expectedPrice ?? 0) * (order.quantity ?? order.size ?? 1)
    : feeVal;

  const pairStr = order.symbol ?? order.pair ?? "—";
  const symbolShort = pairStr
    .replace("USDT", "")
    .replace("/USDT", "");

  return (
    <View style={[exc.card, expanded && { borderColor: `${primary}40` }]}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        style={exc.header}
      >
        <View style={exc.headerLeft}>
          <View style={[exc.symbolWrap, { backgroundColor: `${primary}15` }]}>
            <Text style={[exc.symbol, { color: primary }]}>{symbolShort}</Text>
          </View>
          <View style={exc.headerInfo}>
            <View style={exc.headerRow}>
              <Text style={exc.pair}>{pairStr}</Text>
              <SideBadge side={order.side ?? "BUY"} />
            </View>
            <Text style={exc.exchange}>
              {order.exchange ?? "—"} · {order.orderType ?? order.type ?? "market"}
            </Text>
          </View>
        </View>
        <View style={exc.headerRight}>
          <StatusBadge status={order.status ?? "pending"} />
          <Animated.View style={{ transform: [{ rotate }], marginTop: 6 }}>
            <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
          </Animated.View>
        </View>
      </Pressable>

      {!expanded && (
        <View style={exc.summary}>
          <Text style={exc.summaryText}>
            {order.quantity ?? order.size ?? 0} @{" "}
            {formatCurrency(order.executedPrice ?? order.actualPrice ?? order.expectedPrice ?? 0)}
          </Text>
          <Text style={exc.summaryText}>
            Latência:{" "}
            <Text style={{ color: latencyVal < 100 ? C.success : C.warning }}>
              {latencyVal}ms
            </Text>
          </Text>
        </View>
      )}

      {expanded && (
        <View style={exc.body}>
          <View style={exc.chipsRow}>
            <MetricChip
              label="Preço Exec."
              value={formatCurrency(order.executedPrice ?? order.actualPrice ?? order.expectedPrice ?? 0)}
              color={primary}
              bg={`${primary}15`}
            />
            <MetricChip
              label="Quantidade"
              value={String(order.quantity ?? order.size ?? 0)}
              color={C.text}
              bg={C.surface}
            />
            <MetricChip
              label="Latência"
              value={`${latencyVal}ms`}
              color={latencyVal < 100 ? C.success : latencyVal < 250 ? C.warning : C.danger}
              bg={latencyVal < 100 ? C.successDim : latencyVal < 250 ? C.warningDim : C.dangerDim}
            />
          </View>

          <View style={exc.section}>
            <SlippageBar slippage={slippageVal} />
          </View>

          <View style={exc.divider} />
          <Text style={exc.sectionTitle}>Breakdown de Taxas</Text>
          <FeeRow
            label="Taxa da Exchange"
            value={feeVal < 1 ? `${(feeVal * 100).toFixed(4)}%` : `$${feeVal.toFixed(4)}`}
          />
          <FeeRow
            label="Taxa em USD"
            value={formatCurrency(feeUsd)}
            color={C.warning}
          />
          <FeeRow
            label="Preço Requisitado"
            value={formatCurrency(order.price ?? order.expectedPrice ?? 0)}
          />
          <FeeRow
            label="Preço Executado"
            value={formatCurrency(order.executedPrice ?? order.actualPrice ?? order.expectedPrice ?? 0)}
            color={primary}
          />

          <View style={exc.divider} />
          <Text style={exc.sectionTitle}>Timeline de Execução</Text>
          <View style={exc.timeline}>
            {steps.map((step, i) => (
              <TimelineStep
                key={step.label}
                label={step.label}
                time={step.time}
                done={step.done}
                last={i === steps.length - 1}
                color={primary}
              />
            ))}
          </View>

          <View style={[exc.idRow, { backgroundColor: C.surface }]}>
            <Ionicons name="receipt-outline" size={13} color={C.textTertiary} />
            <Text style={exc.idText} numberOfLines={1}>
              ID: {order.orderId ?? order.id ?? order._stableId}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
const exc = StyleSheet.create({
  card:        { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: "hidden" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  symbolWrap:  { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  symbol:      { fontFamily: "Inter_700Bold", fontSize: 12 },
  headerInfo:  { flex: 1, gap: 3 },
  headerRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  pair:        { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  exchange:    { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, textTransform: "capitalize" },
  headerRight: { alignItems: "flex-end", gap: 4 },
  summary:     { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingBottom: 12 },
  summaryText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  body:        { paddingHorizontal: 14, paddingBottom: 14 },
  chipsRow:    { flexDirection: "row", gap: 8, marginBottom: 12 },
  section:     { marginBottom: 12 },
  divider:     { height: 1, backgroundColor: C.border, marginVertical: 10 },
  sectionTitle:{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, marginBottom: 8 },
  timeline:    { paddingLeft: 4 },
  idRow:       { flexDirection: "row", alignItems: "center", gap: 6, padding: 8, borderRadius: 8, marginTop: 4 },
  idText:      { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, flex: 1 },
});

// ─── Summary Top Card ─────────────────────────────────────────────────

function SummaryTopCard({
  orders,
  primary,
}: {
  orders: OrderExecutionWithId[];
  primary: string;
}) {
  const filled  = orders.filter((o) => o.status === "filled").length;
  const pending = orders.filter((o) => o.status === "pending" || o.status === "acknowledged").length;
  const errors  = orders.filter((o) => o.status === "cancelled" || o.status === "rejected").length;

  const avgSlip = orders.length > 0
    ? orders.reduce((s, o) => s + Math.abs(o.slippage ?? 0), 0) / orders.length
    : 0;
  const avgLat = orders.length > 0
    ? Math.round(orders.reduce((s, o) => s + (o.latency ?? o.latencyMs ?? 0), 0) / orders.length)
    : 0;
  const totalFees = orders.reduce((s, o) => {
    const fee    = o.fee ?? 0;
    const feeUsd = o.feeUsd != null
      ? o.feeUsd
      : fee < 1
      ? fee * (o.executedPrice ?? o.actualPrice ?? o.expectedPrice ?? 0) * (o.quantity ?? o.size ?? 1)
      : fee;
    return s + feeUsd;
  }, 0);

  return (
    <View style={[stc.card, { borderColor: `${primary}30` }]}>
      <View style={stc.row}>
        <View style={stc.item}>
          <Text style={[stc.val, { color: C.success }]}>{filled}</Text>
          <Text style={stc.lbl}>Executados</Text>
        </View>
        <View style={[stc.sep, { backgroundColor: C.border }]} />
        <View style={stc.item}>
          <Text style={[stc.val, { color: C.warning }]}>{pending}</Text>
          <Text style={stc.lbl}>Pendentes</Text>
        </View>
        <View style={[stc.sep, { backgroundColor: C.border }]} />
        <View style={stc.item}>
          <Text style={[stc.val, { color: C.danger }]}>{errors}</Text>
          <Text style={stc.lbl}>Erros</Text>
        </View>
      </View>
      <View style={[stc.divider, { backgroundColor: C.border }]} />
      <View style={stc.row}>
        <View style={stc.item}>
          <Text style={[stc.val, { color: primary }]}>{avgLat}ms</Text>
          <Text style={stc.lbl}>Latência Média</Text>
        </View>
        <View style={[stc.sep, { backgroundColor: C.border }]} />
        <View style={stc.item}>
          <Text style={[stc.val, { color: avgSlip < 0.05 ? C.success : C.warning }]}>
            {formatPercent(avgSlip)}
          </Text>
          <Text style={stc.lbl}>Slippage Médio</Text>
        </View>
        <View style={[stc.sep, { backgroundColor: C.border }]} />
        <View style={stc.item}>
          <Text style={[stc.val, { color: C.warning }]}>{formatCurrency(totalFees)}</Text>
          <Text style={stc.lbl}>Total de Taxas</Text>
        </View>
      </View>
    </View>
  );
}
const stc = StyleSheet.create({
  card:    { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  row:     { flexDirection: "row" },
  item:    { flex: 1, alignItems: "center", paddingVertical: 14, gap: 4 },
  val:     { fontFamily: "Inter_700Bold", fontSize: 18 },
  lbl:     { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  sep:     { width: 1 },
  divider: { height: 1 },
});

// ─── Filter Pill ──────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onPress,
  primary,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  primary: string;
  count?: number;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={[
        fpStyle.pill,
        active && { backgroundColor: `${primary}20`, borderColor: `${primary}60` },
      ]}
    >
      <Text style={[fpStyle.label, { color: active ? primary : C.textSecondary }]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[fpStyle.count, { backgroundColor: active ? `${primary}30` : C.surface }]}>
          <Text style={[fpStyle.countText, { color: active ? primary : C.textTertiary }]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
const fpStyle = StyleSheet.create({
  pill:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  label:     { fontFamily: "Inter_500Medium", fontSize: 12 },
  count:     { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 },
  countText: { fontFamily: "Inter_700Bold", fontSize: 10 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────

const STATUS_FILTERS = ["todos", "filled", "pending", "cancelled"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function ExecutionMonitorScreen() {
  const insets        = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t }         = useI18n();
  const { user }      = useAuth();
  const primary       = planTheme.primary;
  const webTopInset   = Platform.OS === "web" ? 67 : 0;

  const [filter, setFilter]         = useState<StatusFilter>("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy]         = useState<"time" | "slippage" | "latency">("time");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [ordersWithIds, setOrdersWithIds] = useState<OrderExecutionWithId[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await apiRequest("GET", "/api/orders/open");
        const data = await response.json();
        const raw = Array.isArray(data) ? data : [];
        if (mounted) {
          if (raw.length > 0) {
            setOrdersWithIds(raw.map((o: any, idx: number) => ({
              ...o,
              _stableId: o.id ?? o.orderId ?? `order-${Date.now()}-${idx}`,
              id: o.id ?? o.orderId,
              pair: o.symbol ?? o.pair,
              side: o.side ?? "BUY",
              status: (o.status ?? "open").toLowerCase(),
              exchange: o.exchange ?? "—",
              type: o.type ?? o.orderType ?? "market",
              quantity: Number(o.quantity ?? o.size ?? 0),
              price: Number(o.price ?? 0),
              executedPrice: o.filled ? Number(o.price ?? 0) : undefined,
              slippage: 0,
              latencyMs: 0,
              fee: 0,
              timestamp: o.createdAt,
              createdAt: o.createdAt,
            })));
          } else {
            setOrdersWithIds(getOrderExecutions().map((o, idx) => ({
              ...o,
              _stableId: buildStableId(o, idx),
            })));
          }
        }
      } catch {
        if (mounted) {
          setOrdersWithIds(getOrderExecutions().map((o, idx) => ({
            ...o,
            _stableId: buildStableId(o, idx),
          })));
        }
      } finally {
        if (mounted) setLoadingOrders(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, []);

  const filtered = useMemo(() => {
    let list = [...ordersWithIds];
    if (filter !== "todos") {
      list = list.filter((o) => {
        if (filter === "pending")   return o.status === "pending" || o.status === "acknowledged";
        if (filter === "cancelled") return o.status === "cancelled" || o.status === "rejected";
        return o.status === filter;
      });
    }
    if (sortBy === "slippage")
      list.sort((a, b) => Math.abs(b.slippage ?? 0) - Math.abs(a.slippage ?? 0));
    if (sortBy === "latency")
      list.sort((a, b) => (b.latency ?? b.latencyMs ?? 0) - (a.latency ?? a.latencyMs ?? 0));
    return list;
  }, [ordersWithIds, filter, sortBy]);

  const handleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSort = (key: "time" | "slippage" | "latency") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortBy(key);
  };

  const counts = useMemo(() => ({
    todos:     ordersWithIds.length,
    filled:    ordersWithIds.filter((o) => o.status === "filled").length,
    pending:   ordersWithIds.filter((o) => o.status === "pending" || o.status === "acknowledged").length,
    cancelled: ordersWithIds.filter((o) => o.status === "cancelled" || o.status === "rejected").length,
  }), [ordersWithIds]);

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Monitor de Execução</Text>
          <Text style={s.subtitle}>{ordersWithIds.length} ordens recentes</Text>
        </View>
        <View style={[s.liveBadge, { backgroundColor: C.successDim, borderColor: `${C.success}40` }]}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>Live</Text>
        </View>
      </View>

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={s.summaryWrap}>
          <SummaryTopCard orders={ordersWithIds} primary={primary} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={s.filterScroll}
        >
          <FilterPill label="Todos"     active={filter === "todos"}     onPress={() => setFilter("todos")}     primary={primary} count={counts.todos} />
          <FilterPill label="Executado" active={filter === "filled"}    onPress={() => setFilter("filled")}    primary={primary} count={counts.filled} />
          <FilterPill label="Pendente"  active={filter === "pending"}   onPress={() => setFilter("pending")}   primary={primary} count={counts.pending} />
          <FilterPill label="Cancelado" active={filter === "cancelled"} onPress={() => setFilter("cancelled")} primary={primary} count={counts.cancelled} />
        </ScrollView>

        <View style={s.sortRow}>
          <Text style={s.sortLabel}>Ordenar:</Text>
          {(["time", "slippage", "latency"] as const).map((key) => {
            const labels = { time: "Recente", slippage: "Slippage", latency: "Latência" };
            const active = sortBy === key;
            return (
              <Pressable
                key={key}
                onPress={() => handleSort(key)}
                style={[
                  s.sortChip,
                  active && { backgroundColor: `${primary}20`, borderColor: `${primary}50` },
                ]}
              >
                <Text style={[s.sortChipText, { color: active ? primary : C.textSecondary }]}>
                  {labels[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={40} color={C.textTertiary} />
              <Text style={s.emptyText}>Nenhuma ordem encontrada</Text>
            </View>
          ) : (
            filtered.map((order) => (
              <ExecutionCard
                key={order._stableId}
                order={order}
                primary={primary}
                expanded={expandedId === order._stableId}
                onPress={() => handleExpand(order._stableId)}
              />
            ))
          )}

          {filtered.length > 0 && (
            <View style={[s.analysisCard, { borderColor: `${primary}30` }]}>
              <View style={s.analysisHeader}>
                <Ionicons name="analytics-outline" size={16} color={primary} />
                <Text style={[s.analysisTitle, { color: primary }]}>
                  Análise de Slippage
                </Text>
              </View>
              {filtered.map((o) => {
                const slip  = Math.abs(o.slippage ?? 0);
                const color = slip < 0.05 ? C.success : slip < 0.15 ? C.warning : C.danger;
                const pct   = Math.min((slip / 0.5) * 100, 100);
                return (
                  <View key={o._stableId} style={s.slipRow}>
                    <Text style={s.slipSymbol}>
                      {(o.symbol ?? o.pair ?? "—").replace("USDT", "").replace("/USDT", "")}
                    </Text>
                    <View style={s.slipTrack}>
                      <View
                        style={[
                          s.slipFill,
                          { width: `${pct}%` as any, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={[s.slipVal, { color }]}>
                      {formatPercent(o.slippage ?? 0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.background },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
  title:         { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  subtitle:      { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, marginTop: 2 },
  liveBadge:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  liveText:      { fontFamily: "Inter_700Bold", fontSize: 11, color: C.success },
  summaryWrap:   { paddingHorizontal: 16 },
  filterScroll:  { maxHeight: 48 },
  filterRow:     { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingBottom: 4 },
  sortRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  sortLabel:     { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  sortChip:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  sortChipText:  { fontFamily: "Inter_500Medium", fontSize: 12 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  empty:         { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText:     { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textTertiary },
  analysisCard:  { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8 },
  analysisHeader:{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  analysisTitle: { fontFamily: "Inter_700Bold", fontSize: 14 },
  slipRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  slipSymbol:    { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text, width: 36 },
  slipTrack:     { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" },
  slipFill:      { height: "100%", borderRadius: 2 },
  slipVal:       { fontFamily: "Inter_600SemiBold", fontSize: 11, width: 52, textAlign: "right" },
});
