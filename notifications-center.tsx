// app/notifications-center.tsx
// Layer 3.D — Notifications Center com governance_block e directive_violation

import React, { useState, useMemo, useRef, useCallback } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import Colors from "@/constants/colors";
import { getNotifications, type NotificationItem } from "@/lib/quantum-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType =
  | "trade"
  | "alert"
  | "bot"
  | "risk"
  | "system"
  | "price_target"
  | "signal"
  | "governance_block"
  | "directive_violation";

type Priority = "low" | "medium" | "high" | "critical";

interface Notification {
  id: string;
  type: NotifType;
  priority: Priority;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  asset?: string;
  symbol?: string;
  exchange?: string;
  value?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = Colors.dark;

const TYPE_CONFIG: Record<
  NotifType,
  { icon: string; color: string; label: string }
> = {
  trade:               { icon: "swap-horizontal",  color: C.primary,        label: "Trade"      },
  alert:               { icon: "notifications",    color: C.warning,        label: "Alert"      },
  bot:                 { icon: "hardware-chip",    color: "#a855f7",        label: "Bot"        },
  risk:                { icon: "warning",          color: C.danger,         label: "Risk"       },
  system:              { icon: "settings",         color: C.textSecondary,  label: "System"     },
  price_target:        { icon: "flag",             color: "#06b6d4",        label: "Price"      },
  signal:              { icon: "radio",            color: "#f59e0b",        label: "Signal"     },
  governance_block:    { icon: "shield-checkmark", color: C.warning,        label: "Governance" },
  directive_violation: { icon: "lock-closed",      color: C.danger,         label: "Directive"  },
};

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string }> = {
  low:      { color: C.textSecondary, label: "Low"      },
  medium:   { color: C.warning,       label: "Medium"   },
  high:     { color: "#f97316",       label: "High"     },
  critical: { color: C.danger,        label: "Critical" },
};

// ─── Mock extra notifications ─────────────────────────────────────────────────

const GOVERNANCE_MOCK: Notification[] = [
  {
    id:       "gov-1",
    type:     "governance_block",
    priority: "high",
    title:    "Governance Gate Bloqueado",
    body:     "BTC LONG bloqueado: Sentiment check falhou — Fear & Greed em 22",
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    read:     false,
    symbol:   "BTC/USDT",
    exchange: "Binance",
  },
  {
    id:       "dir-1",
    type:     "directive_violation",
    priority: "critical",
    title:    "Diretriz Inegociavel Ativada",
    body:     "Daily loss limit atingido (-10.2%). Trading pausado automaticamente.",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read:     false,
    value:    "-10.2%",
  },
  {
    id:       "gov-2",
    type:     "governance_block",
    priority: "high",
    title:    "Governance Gate Bloqueado",
    body:     "ETH SHORT bloqueado: Confluence score 42% abaixo do threshold de 55%",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read:     false,
    symbol:   "ETH/USDT",
    exchange: "Bybit",
  },
  {
    id:       "dir-2",
    type:     "directive_violation",
    priority: "medium",
    title:    "Aviso de Diretriz",
    body:     "Portfolio exposure em 75% — aproximando do limite maximo de 80%",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    read:     true,
    value:    "75%",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateKey(timestamp: string | null | undefined): string {
  if (!timestamp) return "outros";
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) {
    const iso = d.toISOString().split("T")[0];
    const today    = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (iso === today)     return "Hoje";
    if (iso === yesterday) return "Ontem";
    return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(timestamp)) return timestamp.slice(0, 10);
  return "Recentes";
}

function mergeNotifications(raw: NotificationItem[]): Notification[] {
  const base: Notification[] = (raw ?? []).map((n, idx) => ({
    id:        n.id ?? `notif-${idx}`,
    type:      (n.type ?? "system") as NotifType,
    priority:  "medium" as Priority,
    title:     n.title ?? "Notificacao",
    body:      n.description ?? "",
    timestamp: n.timestamp ?? new Date().toISOString(),
    read:      n.read ?? false,
    asset:     undefined,
    symbol:    undefined,
    exchange:  undefined,
    value:     undefined,
  }));
  const existingIds = new Set(base.map((n) => n.id));
  const extras = GOVERNANCE_MOCK.filter((n) => !existingIds.has(n.id));
  return [...extras, ...base].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <View
      style={[
        nc.priorityDot,
        { backgroundColor: cfg.color },
      ]}
    />
  );
}

function TypePill({ type }: { type: NotifType }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.system;
  return (
    <View style={[nc.typePill, { backgroundColor: cfg.color + "22" }]}>
      <Text style={[nc.typePillText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={nc.actionBtn}>
      <Ionicons name={icon as any} size={13} color={color} />
      <Text style={[nc.actionBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── AnimatedToggle ─────────────────────────────────────────────────────────────

function AnimatedToggle({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle: () => void;
  label: string;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue:         value ? 1 : 0,
      duration:        200,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [value]);

  const translateX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [2, 18],
  });

  return (
    <Pressable onPress={onToggle} style={nc.toggleRow}>
      <Text style={nc.toggleLabel}>{label}</Text>
      <View
        style={[
          nc.toggleTrack,
          { backgroundColor: value ? C.primary : C.surfaceLight },
        ]}
      >
        <Animated.View
          style={[nc.toggleThumb, { transform: [{ translateX }] }]}
        />
      </View>
    </Pressable>
  );
}

// ── SummaryStrip ───────────────────────────────────────────────────────────────

function SummaryStrip({
  notifications,
}: {
  notifications: Notification[];
}) {
  const unread    = notifications.filter((n) => !n.read).length;
  const critical  = notifications.filter((n) => n.priority === "critical").length;
  const risk      = notifications.filter(
    (n) => n.type === "risk" || n.type === "directive_violation"
  ).length;
  const trades    = notifications.filter((n) => n.type === "trade").length;

  return (
    <View style={nc.summaryStrip}>
      {[
        { label: "Nao lidas", value: unread,   color: unread   > 0 ? C.primary : C.textSecondary },
        { label: "Criticas",  value: critical,  color: critical > 0 ? C.danger  : C.textSecondary },
        { label: "Riscos",    value: risk,      color: risk     > 0 ? C.warning : C.textSecondary },
        { label: "Trades",    value: trades,    color: C.textSecondary },
      ].map(({ label, value, color }) => (
        <View key={label} style={nc.summaryItem}>
          <Text style={[nc.summaryValue, { color }]}>{value}</Text>
          <Text style={nc.summaryLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={nc.empty}>
      <Ionicons name="notifications-off-outline" size={44} color={C.textSecondary} />
      <Text style={nc.emptyTitle}>Nenhuma notificacao</Text>
      <Text style={nc.emptyBody}>Tudo limpo por aqui</Text>
    </View>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={nc.sectionHeader}>
      <Text style={nc.sectionHeaderText}>{title}</Text>
    </View>
  );
}

// ── ClearReadModal ─────────────────────────────────────────────────────────────

function ClearReadModal({
  visible,
  readCount,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  readCount: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={nc.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={nc.modalBox}>
          <Ionicons name="trash-outline" size={28} color={C.danger} />
          <Text style={nc.modalTitle}>Limpar lidas</Text>
          <Text style={nc.modalBody}>
            Remover{" "}
            <Text style={{ color: C.danger, fontWeight: "700" }}>
              {readCount}
            </Text>{" "}
            notificac{readCount === 1 ? "ao lida" : "oes lidas"}?
          </Text>
          <View style={nc.modalActions}>
            <Pressable onPress={onClose} style={nc.modalBtnCancel}>
              <Text style={nc.modalBtnCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => { onConfirm(); onClose(); }}
              style={nc.modalBtnConfirm}
            >
              <Text style={nc.modalBtnConfirmText}>Limpar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── NotificationCard ───────────────────────────────────────────────────────────

function NotificationCard({
  notif,
  onMarkRead,
  onDismiss,
}: {
  notif: Notification;
  onMarkRead: (id: string) => void;
  onDismiss:  (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;

  return (
    <View
      style={[
        nc.card,
        !notif.read && nc.cardUnread,
        notif.priority === "critical" && nc.cardCritical,
      ]}
    >
      <View style={nc.cardTop}>
        <View style={nc.cardIconWrap}>
          <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
        </View>
        <View style={nc.cardContent}>
          <View style={nc.cardTitleRow}>
            <PriorityDot priority={notif.priority} />
            <Text style={nc.cardTitle} numberOfLines={1}>
              {notif.title}
            </Text>
            <TypePill type={notif.type} />
          </View>
          <Text style={nc.cardBody}>{notif.body}</Text>

          <View style={nc.cardMeta}>
            {notif.symbol && (
              <View style={nc.metaChip}>
                <Text style={nc.metaChipText}>{notif.symbol}</Text>
              </View>
            )}
            {notif.exchange && (
              <View style={nc.metaChip}>
                <Text style={nc.metaChipText}>{notif.exchange}</Text>
              </View>
            )}
            {notif.value && (
              <View style={[nc.metaChip, { backgroundColor: C.danger + "22" }]}>
                <Text style={[nc.metaChipText, { color: C.danger }]}>
                  {notif.value}
                </Text>
              </View>
            )}
          </View>

          <Text style={nc.cardTime}>
            {parseDateKey(notif.timestamp) === "Hoje"
              ? new Date(notif.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit", minute: "2-digit",
                })
              : parseDateKey(notif.timestamp)}
          </Text>
        </View>
      </View>

      <View style={nc.cardActions}>
        {!notif.read && (
          <ActionBtn
            icon="checkmark-circle-outline"
            label="Marcar lida"
            color={C.success}
            onPress={() => { Haptics.selectionAsync(); onMarkRead(notif.id); }}
          />
        )}
        <ActionBtn
          icon="close-circle-outline"
          label="Dispensar"
          color={C.textSecondary}
          onPress={() => { Haptics.selectionAsync(); onDismiss(notif.id); }}
        />
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsCenterScreen() {
  const insets     = useSafeAreaInsets();
  const { user }   = useAuth();
  const { planTheme } = usePlanTheme();
  const { t }      = useI18n();

  const bellAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  const [typeFilter,  setTypeFilter]  = useState<NotifType | "all">("all");
  const [onlyUnread,  setOnlyUnread]  = useState(false);
  const [showClear,   setShowClear]   = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>(() =>
    mergeNotifications((getNotifications?.() ?? []) as NotificationItem[])
  );

  // ── Fade in ──────────────────────────────────────────────────────────────

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: Platform.OS !== "web",
    }).start();
  }, []);

  // ── Bell shake on critical unread ─────────────────────────────────────────

  const hasCritical = useMemo(
    () => notifications.some((n) => !n.read && n.priority === "critical"),
    [notifications]
  );

  React.useEffect(() => {
    if (!hasCritical) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(bellAnim, { toValue:  1, duration: 80, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(bellAnim, { toValue: -1, duration: 80, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(bellAnim, { toValue:  1, duration: 80, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(bellAnim, { toValue:  0, duration: 80, useNativeDriver: Platform.OS !== "web" }),
      ]),
      { iterations: 3 }
    ).start();
  }, [hasCritical]);

  const bellRotate = bellAnim.interpolate({
    inputRange:  [-1, 0, 1],
    outputRange: ["-15deg", "0deg", "15deg"],
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const typeCounts = useMemo(() => {
    const map: Partial<Record<NotifType | "all", number>> = { all: notifications.length };
    notifications.forEach((n) => {
      map[n.type] = (map[n.type] ?? 0) + 1;
    });
    return map;
  }, [notifications]);

  const filtered = useMemo(() => {
    let list = [...notifications];
    if (onlyUnread)        list = list.filter((n) => !n.read);
    if (typeFilter !== "all") list = list.filter((n) => n.type === typeFilter);
    return list;
  }, [notifications, onlyUnread, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    filtered.forEach((n) => {
      const key = parseDateKey(n.timestamp);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const readCount = useMemo(
    () => notifications.filter((n) => n.read).length,
    [notifications]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const handleClearRead = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setNotifications((prev) => prev.filter((n) => !n.read));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[nc.root, { opacity: fadeAnim }]}>
      <ScrollView
        style={nc.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[nc.header, { paddingTop: insets.top + 12 }]}>
          <View style={nc.headerLeft}>
            <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={{ padding: 4, marginRight: 4 }}>
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </Pressable>
            <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
              <Ionicons name="notifications" size={24} color={C.text} />
            </Animated.View>
            <Text style={nc.headerTitle}>Notifications</Text>
            {typeCounts.all != null && typeCounts.all > 0 && (
              <View style={nc.headerBadge}>
                <Text style={nc.headerBadgeText}>
                  {notifications.filter((n) => !n.read).length}
                </Text>
              </View>
            )}
          </View>
          <View style={nc.headerActions}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); handleMarkAllRead(); }}
              style={nc.headerBtn}
            >
              <Ionicons name="checkmark-done" size={18} color={C.primary} />
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowClear(true); }}
              style={nc.headerBtn}
              disabled={readCount === 0}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={readCount > 0 ? C.danger : C.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        <SummaryStrip notifications={notifications} />

        <View style={nc.toggleWrapper}>
          <AnimatedToggle
            value={onlyUnread}
            onToggle={() => { Haptics.selectionAsync(); setOnlyUnread((v) => !v); }}
            label="Somente nao lidas"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={nc.filterRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setTypeFilter("all"); }}
            style={[nc.pill, typeFilter === "all" && nc.pillActive]}
          >
            <Text style={[nc.pillText, typeFilter === "all" && nc.pillTextActive]}>
              Todos ({typeCounts.all ?? 0})
            </Text>
          </Pressable>
          {(Object.keys(TYPE_CONFIG) as NotifType[]).map((type) => {
            const count = typeCounts[type] ?? 0;
            if (count === 0) return null;
            const cfg = TYPE_CONFIG[type];
            return (
              <Pressable
                key={type}
                onPress={() => { Haptics.selectionAsync(); setTypeFilter(type); }}
                style={[
                  nc.pill,
                  typeFilter === type && { ...nc.pillActive, borderColor: cfg.color },
                ]}
              >
                <Ionicons
                  name={cfg.icon as any}
                  size={11}
                  color={typeFilter === type ? cfg.color : C.textSecondary}
                  style={{ marginRight: 3 }}
                />
                <Text
                  style={[
                    nc.pillText,
                    typeFilter === type && { ...nc.pillTextActive, color: cfg.color },
                  ]}
                >
                  {cfg.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={nc.list}>
            {grouped.map(([dateKey, items]) => (
              <View key={dateKey}>
                <SectionHeader title={dateKey} />
                {items.map((notif) => (
                  <NotificationCard
                    key={notif.id}
                    notif={notif}
                    onMarkRead={handleMarkRead}
                    onDismiss={handleDismiss}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <ClearReadModal
        visible={showClear}
        readCount={readCount}
        onConfirm={handleClearRead}
        onClose={() => setShowClear(false)}
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const nc = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.background },
  scroll:             { flex: 1 },

  header:             { flexDirection: "row", justifyContent: "space-between",
                        alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  headerLeft:         { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle:        { fontSize: 22, fontWeight: "700", color: C.text },
  headerBadge:        { backgroundColor: C.danger, borderRadius: 10,
                        paddingHorizontal: 6, paddingVertical: 2 },
  headerBadgeText:    { fontSize: 11, color: "#fff", fontWeight: "700" },
  headerActions:      { flexDirection: "row", gap: 8 },
  headerBtn:          { backgroundColor: C.surfaceLight, borderRadius: 10,
                        padding: 8, borderWidth: 1, borderColor: C.border },

  summaryStrip:       { flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
                        backgroundColor: C.surface, borderRadius: 12, padding: 12,
                        borderWidth: 1, borderColor: C.border },
  summaryItem:        { flex: 1, alignItems: "center" },
  summaryValue:       { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  summaryLabel:       { fontSize: 11, color: C.textSecondary },

  toggleWrapper:      { marginHorizontal: 16, marginBottom: 10 },
  toggleRow:          { flexDirection: "row", justifyContent: "space-between",
                        alignItems: "center", backgroundColor: C.surface,
                        borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  toggleLabel:        { fontSize: 13, color: C.text, fontWeight: "500" },
  toggleTrack:        { width: 40, height: 22, borderRadius: 11, justifyContent: "center" },
  toggleThumb:        { width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff" },

  filterRow:          { marginBottom: 12 },
  pill:               { flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
                        paddingVertical: 6, borderRadius: 20, backgroundColor: C.surfaceLight,
                        borderWidth: 1, borderColor: C.border },
  pillActive:         { backgroundColor: C.primary + "22", borderColor: C.primary },
  pillText:           { fontSize: 12, color: C.textSecondary, fontWeight: "500" },
  pillTextActive:     { color: C.primary, fontWeight: "700" },

  list:               { paddingHorizontal: 16, gap: 4 },
  sectionHeader:      { paddingVertical: 8, paddingHorizontal: 4 },
  sectionHeaderText:  { fontSize: 12, color: C.textSecondary, fontWeight: "600",
                        textTransform: "uppercase", letterSpacing: 1 },

  card:               { backgroundColor: C.surface, borderRadius: 14, padding: 14,
                        marginBottom: 8, borderWidth: 1, borderColor: C.border },
  cardUnread:         { borderLeftWidth: 3, borderLeftColor: C.primary },
  cardCritical:       { borderLeftWidth: 3, borderLeftColor: C.danger },
  cardTop:            { flexDirection: "row", gap: 12 },
  cardIconWrap:       { width: 36, height: 36, borderRadius: 10, backgroundColor: C.surfaceLight,
                        alignItems: "center", justifyContent: "center" },
  cardContent:        { flex: 1 },
  cardTitleRow:       { flexDirection: "row", alignItems: "center", gap: 6,
                        marginBottom: 4, flexWrap: "wrap" },
  cardTitle:          { flex: 1, fontSize: 13, fontWeight: "700", color: C.text },
  cardBody:           { fontSize: 12, color: C.textSecondary, lineHeight: 17, marginBottom: 6 },
  cardMeta:           { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  metaChip:           { backgroundColor: C.surfaceLight, paddingHorizontal: 8, paddingVertical: 2,
                        borderRadius: 12 },
  metaChipText:       { fontSize: 11, color: C.textSecondary },
  cardTime:           { fontSize: 11, color: C.textSecondary },
  cardActions:        { flexDirection: "row", gap: 12, marginTop: 10,
                        paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  actionBtn:          { flexDirection: "row", alignItems: "center", gap: 4 },
  actionBtnText:      { fontSize: 12, fontWeight: "600" },

  priorityDot:        { width: 7, height: 7, borderRadius: 4 },
  typePill:           { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  typePillText:       { fontSize: 10, fontWeight: "700" },

  empty:              { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle:         { fontSize: 16, fontWeight: "700", color: C.text },
  emptyBody:          { fontSize: 13, color: C.textSecondary },

  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
                        justifyContent: "center", alignItems: "center" },
  modalBox:           { backgroundColor: C.surface, borderRadius: 16, padding: 24,
                        width: "80%", alignItems: "center", gap: 12,
                        borderWidth: 1, borderColor: C.border },
  modalTitle:         { fontSize: 17, fontWeight: "700", color: C.text },
  modalBody:          { fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20 },
  modalActions:       { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtnCancel:     { flex: 1, paddingVertical: 12, borderRadius: 10,
                        backgroundColor: C.surfaceLight, alignItems: "center",
                        borderWidth: 1, borderColor: C.border },
  modalBtnCancelText: { fontSize: 14, color: C.textSecondary, fontWeight: "600" },
  modalBtnConfirm:    { flex: 1, paddingVertical: 12, borderRadius: 10,
                        backgroundColor: C.danger + "22", alignItems: "center",
                        borderWidth: 1, borderColor: C.danger },
  modalBtnConfirmText:{ fontSize: 14, color: C.danger, fontWeight: "700" },
});
