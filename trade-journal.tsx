// app/trade-journal.tsx
// Layer 3.C — Trade Journal atualizado com category, convictionLevel, governanceGates

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import {
  getTradeJournal,
  type TradeJournalEntry,
  type ConvictionLevel,
  type TradeCategory,
  type GovernanceGate,
  getConvictionData,
  getGovernanceGates,
} from "@/lib/quantum-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradeJournalEntryWithId extends TradeJournalEntry {
  _stableId: string;
  category: TradeCategory;
  convictionLevel: ConvictionLevel;
  governanceGates: GovernanceGate[];
}

type OutcomeFilter = "all" | "win" | "loss" | "break";
type CategoryFilter = "all" | TradeCategory;
type TabKey = "journal" | "stats" | "insights";

// ─── Constants ────────────────────────────────────────────────────────────────

const C = Colors.dark;

const CONVICTION_CONFIG: Record<
  ConvictionLevel,
  { label: string; color: string; bg: string }
> = {
  normal:       { label: "Normal",        color: C.textSecondary, bg: C.surfaceLight },
  strong:       { label: "Strong",        color: C.success,       bg: "#0d2e1a" },
  very_strong:  { label: "Very Strong",   color: "#a855f7",       bg: "#1e0a3c" },
  stratospheric:{ label: "Stratospheric", color: "#f59e0b",       bg: "#2d1a00" },
};

const CATEGORY_CONFIG: Record<
  TradeCategory,
  { label: string; color: string; bg: string }
> = {
  scalp:    { label: "Scalp",    color: "#06b6d4", bg: "#0a2a30" },
  swing:    { label: "Swing",    color: "#a855f7", bg: "#1e0a3c" },
  position: { label: "Position", color: "#f59e0b", bg: "#2d1a00" },
};

const MOOD_CONFIG: Record<
  string,
  { icon: string; color: string }
> = {
  confident:  { icon: "😎", color: C.success },
  neutral:    { icon: "😐", color: C.textSecondary },
  anxious:    { icon: "😰", color: C.warning },
  fearful:    { icon: "😨", color: C.danger },
  euphoric:   { icon: "🤩", color: "#f59e0b" },
  disciplined:{ icon: "🧘", color: "#06b6d4" },
};

const BAR_MAX_HEIGHT = 48;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyCategory(entry: TradeJournalEntry): TradeCategory {
  const openedAt  = (entry as any).openedAt  ?? (entry as any).entryTime ?? (entry as any).createdAt ?? null;
  const closedAt  = (entry as any).closedAt  ?? (entry as any).exitTime  ?? (entry as any).updatedAt ?? null;
  if (!openedAt || !closedAt) return "swing";
  const diffMs   = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1)        return "scalp";
  if (diffHours <= 168)     return "swing";
  return "position";
}

function mockConviction(idx: number): ConvictionLevel {
  const levels: ConvictionLevel[] = [
    "normal", "strong", "very_strong", "stratospheric",
  ];
  return levels[idx % levels.length];
}

function mockGates(): GovernanceGate[] {
  const gates = [
    "Risk Check",
    "Confluence Check",
    "Directives Check",
    "Sentiment Check",
    "Regime Check",
  ];
  return gates.map((name, i) => ({
    id:        `gate-${i}`,
    name,
    status:    "passed" as const,
    checkedAt: new Date().toISOString(),
  }));
}

function formatDuration(entry: TradeJournalEntry): string {
  const openedAt = (entry as any).openedAt ?? (entry as any).entryTime ?? (entry as any).createdAt ?? null;
  const closedAt = (entry as any).closedAt ?? (entry as any).exitTime  ?? (entry as any).updatedAt ?? null;
  if (!openedAt || !closedAt) return "—";
  const diffMs = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const h = Math.floor(diffMs / 3600000);
  const m = Math.floor((diffMs % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
}

function formatPnl(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagChip({ label }: { label: string }) {
  return (
    <View style={sc.tagChip}>
      <Text style={sc.tagText}>#{label}</Text>
    </View>
  );
}

function MoodBadge({ mood }: { mood: string }) {
  const cfg = MOOD_CONFIG[mood] ?? { icon: "😐", color: C.textSecondary };
  return (
    <View style={[sc.moodBadge, { borderColor: cfg.color }]}>
      <Text style={sc.moodIcon}>{cfg.icon}</Text>
      <Text style={[sc.moodLabel, { color: cfg.color }]}>
        {mood ?? "—"}
      </Text>
    </View>
  );
}

function SideBadge({ side }: { side: string }) {
  const isLong = (side ?? "").toLowerCase() === "long" ||
                 (side ?? "").toLowerCase() === "buy";
  return (
    <View style={[sc.sideBadge, { backgroundColor: isLong ? "#0d2e1a" : "#2d0a0a" }]}>
      <Text style={[sc.sideText, { color: isLong ? C.success : C.danger }]}>
        {isLong ? "LONG" : "SHORT"}
      </Text>
    </View>
  );
}

function OutcomeBadge({ pnl }: { pnl: number | null | undefined }) {
  const outcome =
    (pnl ?? 0) > 0 ? "win" :
    (pnl ?? 0) < 0 ? "loss" : "break";
  const cfg = {
    win:   { label: "WIN",   color: C.success, bg: "#0d2e1a" },
    loss:  { label: "LOSS",  color: C.danger,  bg: "#2d0a0a" },
    break: { label: "BREAK", color: C.warning, bg: "#2d1a00" },
  }[outcome];
  return (
    <View style={[sc.outcomeBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[sc.outcomeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function ConvictionBadge({ level }: { level: ConvictionLevel }) {
  const cfg = CONVICTION_CONFIG[level] ?? CONVICTION_CONFIG.normal;
  return (
    <View style={[sc.convictionBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons
        name={level === "stratospheric" ? "flash" : "bar-chart"}
        size={10}
        color={cfg.color}
        style={{ marginRight: 3 }}
      />
      <Text style={[sc.convictionText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

function CategoryBadge({ category }: { category: TradeCategory }) {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.swing;
  return (
    <View style={[sc.categoryBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[sc.categoryText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

function GovernanceGatesRow({ gates }: { gates: GovernanceGate[] }) {
  return (
    <View style={sc.gatesRow}>
      {gates.map((gate) => (
        <View key={gate.id} style={sc.gateItem}>
          <Ionicons
            name={
              gate.status === "passed" ? "checkmark-circle" :
              gate.status === "blocked" ? "close-circle" : "remove-circle"
            }
            size={13}
            color={
              gate.status === "passed" ? C.success :
              gate.status === "blocked" ? C.danger : C.textSecondary
            }
          />
        </View>
      ))}
      <Text style={sc.gatesLabel}>Gates</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={sc.statCard}>
      <Text style={[sc.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={sc.statLabel}>{label}</Text>
    </View>
  );
}

function PnLMiniBar({ entries }: { entries: TradeJournalEntryWithId[] }) {
  const last12 = entries.slice(-12);
  if (last12.length === 0) return null;
  const maxAbs = Math.max(...last12.map((e) => Math.abs(e.pnl ?? 0)), 1);
  return (
    <View style={sc.pnlBarContainer}>
      <Text style={sc.pnlBarTitle}>P&L (últimos {last12.length} trades)</Text>
      <View style={sc.pnlBarRow}>
        {last12.map((e) => {
          const pnl = e.pnl ?? 0;
          const h   = Math.max((Math.abs(pnl) / maxAbs) * BAR_MAX_HEIGHT, 3);
          const isP = pnl >= 0;
          return (
            <View key={e._stableId} style={sc.pnlBarWrapper}>
              <View
                style={[
                  sc.pnlBar,
                  {
                    height:          h,
                    backgroundColor: isP ? C.success : C.danger,
                    marginTop:       BAR_MAX_HEIGHT - h,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MoodDistribution({
  entries,
}: {
  entries: TradeJournalEntryWithId[];
}) {
  const dist = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach((e) => {
      const m = e.mood ?? "neutral";
      map[m]  = (map[m] ?? 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  if (dist.length === 0) return null;
  const total = entries.length;

  return (
    <View style={sc.moodDist}>
      <Text style={sc.moodDistTitle}>Mood Distribution</Text>
      {dist.map(([mood, count]) => {
        const cfg = MOOD_CONFIG[mood] ?? { icon: "😐", color: C.textSecondary };
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <View key={mood} style={sc.moodDistRow}>
            <Text style={sc.moodDistIcon}>{cfg.icon}</Text>
            <Text style={[sc.moodDistLabel, { color: cfg.color }]}>
              {mood}
            </Text>
            <View style={sc.moodDistBarBg}>
              <View
                style={[
                  sc.moodDistBar,
                  { width: `${pct}%` as any, backgroundColor: cfg.color },
                ]}
              />
            </View>
            <Text style={sc.moodDistPct}>{pct.toFixed(0)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function CategoryStats({
  entries,
}: {
  entries: TradeJournalEntryWithId[];
}) {
  const stats = useMemo(() => {
    const cats: TradeCategory[] = ["scalp", "swing", "position"];
    return cats.map((cat) => {
      const group  = entries.filter((e) => e.category === cat);
      const wins   = group.filter((e) => (e.pnl ?? 0) > 0).length;
      const winRate = group.length > 0 ? (wins / group.length) * 100 : 0;
      const avgPnl  = group.length > 0
        ? group.reduce((acc, e) => acc + (e.pnl ?? 0), 0) / group.length
        : 0;
      const avgDur  = group.length > 0
        ? group.reduce((acc, e) => {
            const o = (e as any).openedAt ?? (e as any).entryTime ?? (e as any).createdAt ?? null;
            const c = (e as any).closedAt ?? (e as any).exitTime  ?? (e as any).updatedAt ?? null;
            if (!o || !c) return acc;
            return acc + (new Date(c).getTime() - new Date(o).getTime());
          }, 0) / group.length / 3600000
        : 0;
      return { cat, count: group.length, winRate, avgPnl, avgDur };
    });
  }, [entries]);

  return (
    <View style={sc.catStats}>
      <Text style={sc.catStatsTitle}>Stats por Categoria</Text>
      {stats.map(({ cat, count, winRate, avgPnl, avgDur }) => {
        const cfg = CATEGORY_CONFIG[cat];
        return (
          <View key={cat} style={[sc.catStatCard, { borderLeftColor: cfg.color }]}>
            <View style={sc.catStatHeader}>
              <CategoryBadge category={cat} />
              <Text style={sc.catStatCount}>{count} trades</Text>
            </View>
            <View style={sc.catStatRow}>
              <Text style={sc.catStatLabel}>Win Rate</Text>
              <Text style={[sc.catStatValue, {
                color: winRate >= 50 ? C.success : C.danger,
              }]}>
                {winRate.toFixed(1)}%
              </Text>
            </View>
            <View style={sc.catStatRow}>
              <Text style={sc.catStatLabel}>Avg P&L</Text>
              <Text style={[sc.catStatValue, {
                color: avgPnl >= 0 ? C.success : C.danger,
              }]}>
                {formatPnl(avgPnl)}
              </Text>
            </View>
            <View style={sc.catStatRow}>
              <Text style={sc.catStatLabel}>Avg Duration</Text>
              <Text style={sc.catStatValue}>
                {avgDur > 0 ? `${avgDur.toFixed(1)}h` : "—"}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function FilterPill({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[sc.filterPill, active && sc.filterPillActive]}
    >
      <Text style={[sc.filterPillText, active && sc.filterPillTextActive]}>
        {label}
        {count != null ? ` (${count})` : ""}
      </Text>
    </Pressable>
  );
}

// ─── Journal Card ─────────────────────────────────────────────────────────────

function JournalCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: TradeJournalEntryWithId;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { planTheme } = usePlanTheme();
  const anim = React.useRef(new Animated.Value(0)).current;
  const [aiReview, setAiReview] = React.useState<{ review: string; lessons: string[]; rating: number } | null>(null);
  const [reviewLoading, setReviewLoading] = React.useState(false);

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue:         expanded ? 1 : 0,
      duration:        220,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [expanded]);

  async function requestAiReview() {
    setReviewLoading(true);
    try {
      const response = await apiRequest("POST", "/api/content/trade-review", {
        tradeId: entry.id ?? entry._stableId,
        symbol: (entry as any).symbol ?? entry.pair ?? "—",
        side: entry.side ?? (entry as any).direction ?? "long",
        pnl: entry.pnl ?? 0,
        strategy: "auto",
      });
      const res = await response.json();
      if (res && typeof res === 'object' && ('review' in res || 'lessons' in res || 'rating' in res)) {
        setAiReview(res);
      }
    } catch {
      // silently fail
    } finally {
      setReviewLoading(false);
    }
  }

  const pnl     = entry.pnl ?? 0;
  const pnlPct  = entry.pnlPercent ?? (entry as any).pnlPct ?? null;
  const tags    = entry.tags ?? [];
  const notes   = entry.notes ?? (entry as any).setup ?? null;
  const lessons = (entry as any).lessons ?? (entry as any).lesson ?? null;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      style={sc.journalCard}
    >
      {/* Header row */}
      <View style={sc.cardHeader}>
        <View style={sc.cardHeaderLeft}>
          <Text style={sc.cardSymbol}>
            {(entry as any).symbol ?? entry.pair ?? "—"}
          </Text>
          <SideBadge side={entry.side ?? (entry as any).direction ?? "long"} />
          <OutcomeBadge pnl={pnl} />
          <CategoryBadge category={entry.category} />
        </View>
        <View style={sc.cardHeaderRight}>
          <Text style={[sc.cardPnl, { color: pnl >= 0 ? C.success : C.danger }]}>
            {formatPnl(pnl)}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={C.textSecondary}
          />
        </View>
      </View>

      {/* Conviction + Gates row */}
      <View style={sc.cardMetaRow}>
        <ConvictionBadge level={entry.convictionLevel} />
        <GovernanceGatesRow gates={entry.governanceGates} />
        {entry.mood && <MoodBadge mood={entry.mood} />}
      </View>

      {/* Expanded details */}
      {expanded && (
        <Animated.View style={{ opacity: anim }}>
          <View style={sc.divider} />

          <View style={sc.detailGrid}>
            <View style={sc.detailItem}>
              <Text style={sc.detailLabel}>Entry</Text>
              <Text style={sc.detailValue}>
                ${(entry.entryPrice ?? (entry as any).entry ?? 0).toFixed(2)}
              </Text>
            </View>
            <View style={sc.detailItem}>
              <Text style={sc.detailLabel}>Exit</Text>
              <Text style={sc.detailValue}>
                ${(entry.exitPrice ?? (entry as any).exit ?? 0).toFixed(2)}
              </Text>
            </View>
            <View style={sc.detailItem}>
              <Text style={sc.detailLabel}>P&L %</Text>
              <Text style={[sc.detailValue, {
                color: (pnlPct ?? 0) >= 0 ? C.success : C.danger,
              }]}>
                {pnlPct != null ? `${pnlPct.toFixed(2)}%` : "—"}
              </Text>
            </View>
            <View style={sc.detailItem}>
              <Text style={sc.detailLabel}>Duration</Text>
              <Text style={sc.detailValue}>{formatDuration(entry)}</Text>
            </View>
            <View style={sc.detailItem}>
              <Text style={sc.detailLabel}>Strategy</Text>
              <Text style={sc.detailValue}>
                {entry.strategy ?? (entry as any).strategyName ?? "—"}
              </Text>
            </View>
            <View style={sc.detailItem}>
              <Text style={sc.detailLabel}>R:R</Text>
              <Text style={sc.detailValue}>
                {(entry as any).riskReward ?? (entry as any).rrRatio ?? "—"}
              </Text>
            </View>
          </View>

          {/* Governance gates detail */}
          <View style={sc.gatesDetail}>
            <Text style={sc.gatesDetailTitle}>Governance Gates</Text>
            <View style={sc.gatesDetailRow}>
              {entry.governanceGates.map((gate) => (
                <View key={gate.id} style={sc.gateDetailItem}>
                  <Ionicons
                    name={
                      gate.status === "passed" ? "checkmark-circle" :
                      gate.status === "blocked" ? "close-circle" : "remove-circle"
                    }
                    size={14}
                    color={
                      gate.status === "passed" ? C.success :
                      gate.status === "blocked" ? C.danger : C.textSecondary
                    }
                  />
                  <Text style={sc.gateDetailLabel}>{gate.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {notes && (
            <View style={sc.noteBlock}>
              <Text style={sc.noteLabel}>Notes</Text>
              <Text style={sc.noteText}>{notes}</Text>
            </View>
          )}
          {lessons && (
            <View style={[sc.noteBlock, { marginTop: 8 }]}>
              <Text style={sc.noteLabel}>Lessons</Text>
              <Text style={sc.noteText}>{lessons}</Text>
            </View>
          )}
          {tags.length > 0 && (
            <View style={sc.tagRow}>
              {tags.map((t: string, i: number) => (
                <TagChip key={`${t}-${i}`} label={t} />
              ))}
            </View>
          )}

          {/* IA Review */}
          <Pressable
            onPress={requestAiReview}
            disabled={reviewLoading}
            style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${planTheme.primary}18`, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: `${planTheme.primary}30` }}
          >
            {reviewLoading
              ? <ActivityIndicator size="small" color={planTheme.primary} />
              : <Ionicons name="sparkles-outline" size={14} color={planTheme.primary} />}
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: planTheme.primary }}>
              {aiReview ? "Atualizar Revisão IA" : "Revisão IA"}
            </Text>
          </Pressable>
          {aiReview && (
            <View style={{ marginTop: 8, backgroundColor: C.surfaceLight, borderRadius: 8, padding: 10, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="star" size={12} color={planTheme.primary} />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: planTheme.primary }}>Rating: {aiReview.rating}/10</Text>
              </View>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, lineHeight: 17 }}>{aiReview.review}</Text>
              {aiReview.lessons?.length > 0 && (
                <View>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>Lições:</Text>
                  {aiReview.lessons.map((lesson: string, i: number) => (
                    <Text key={i} style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary }}>• {lesson}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TradeJournalScreen() {
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const { planTheme } = usePlanTheme();
  const { t }       = useI18n();

  const fadeAnim    = React.useRef(new Animated.Value(0)).current;

  const [tab, setTab]                 = useState<TabKey>("journal");
  const [outcomeFilter, setOutcome]   = useState<OutcomeFilter>("all");
  const [categoryFilter, setCategory] = useState<CategoryFilter>("all");
  const [search, setSearch]           = useState("");
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: Platform.OS !== "web",
    }).start();
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────

  const [rawEntries, setRawEntries] = useState<TradeJournalEntry[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await apiRequest("GET", "/api/trades");
        const res = await response.json();
        if (mounted) setRawEntries(Array.isArray(res) ? res : []);
      } catch {
        if (mounted) setRawEntries((getTradeJournal() ?? []) as TradeJournalEntry[]);
      } finally {
        if (mounted) setLoadingTrades(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const entries = useMemo<TradeJournalEntryWithId[]>(
    () =>
      rawEntries.map((e, idx) => ({
        ...e,
        _stableId:      `${e.id ?? (e as any).tradeId ?? (e as any).symbol ?? "entry"}-${idx}`,
        category:       classifyCategory(e),
        convictionLevel: mockConviction(idx),
        governanceGates: mockGates(),
      })),
    [rawEntries]
  );

  // ── Filters ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = [...entries];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          ((e as any).symbol ?? "").toLowerCase().includes(q) ||
          (e.strategy ?? "").toLowerCase().includes(q) ||
          (e.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
      );
    }
    if (outcomeFilter !== "all") {
      list = list.filter((e) => {
        const pnl = e.pnl ?? 0;
        if (outcomeFilter === "win")   return pnl > 0;
        if (outcomeFilter === "loss")  return pnl < 0;
        if (outcomeFilter === "break") return pnl === 0;
        return true;
      });
    }
    if (categoryFilter !== "all") {
      list = list.filter((e) => e.category === categoryFilter);
    }
    return list;
  }, [entries, search, outcomeFilter, categoryFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (entries.length === 0) {
      return {
        winRate: 0, totalPnl: 0, count: 0,
        avgWin: 0, avgLoss: 0, bestTrade: null,
        confidentWinRate: 0,
      };
    }
    const wins    = entries.filter((e) => (e.pnl ?? 0) > 0);
    const losses  = entries.filter((e) => (e.pnl ?? 0) < 0);
    const winRate = (wins.length / entries.length) * 100;
    const totalPnl = entries.reduce((a, e) => a + (e.pnl ?? 0), 0);
    const avgWin   = wins.length > 0
      ? wins.reduce((a, e) => a + (e.pnl ?? 0), 0) / wins.length : 0;
    const avgLoss  = losses.length > 0
      ? losses.reduce((a, e) => a + (e.pnl ?? 0), 0) / losses.length : 0;
    const bestTrade = entries.reduce<TradeJournalEntryWithId | null>(
      (best, e) =>
        best == null ? e : (e.pnl ?? 0) > (best.pnl ?? 0) ? e : best,
      null
    );
    const confidentTrades = entries.filter((e) => e.mood === "confident");
    const confidentWinRate = confidentTrades.length > 0
      ? (confidentTrades.filter((e) => (e.pnl ?? 0) > 0).length /
          confidentTrades.length) * 100
      : 0;
    return { winRate, totalPnl, count: entries.length, avgWin, avgLoss, bestTrade, confidentWinRate };
  }, [entries]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[sc.root, { opacity: fadeAnim }]}>
      <ScrollView
        style={sc.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[sc.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <Pressable onPress={() => { Haptics.selectionAsync(); router.back(); }} style={{ padding: 4 }}>
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </Pressable>
            <Text style={sc.headerTitle}>Trade Journal</Text>
          </View>
          <Text style={[sc.headerSub, { paddingLeft: 40 }]}>{entries.length} trades registrados</Text>
        </View>

        {/* Tabs */}
        <View style={sc.tabBar}>
          {(["journal", "stats", "insights"] as TabKey[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => { Haptics.selectionAsync(); setTab(k); }}
              style={[sc.tab, tab === k && sc.tabActive]}
            >
              <Text style={[sc.tabText, tab === k && sc.tabTextActive]}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── JOURNAL TAB ── */}
        {tab === "journal" && (
          <>
            {/* Search */}
            <View style={sc.searchRow}>
              <Ionicons name="search" size={16} color={C.textSecondary} />
              <TextInput
                style={sc.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar pair, strategy, tag..."
                placeholderTextColor={C.textSecondary}
              />
            </View>

            {/* Outcome filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={sc.filterRow}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {(["all", "win", "loss", "break"] as OutcomeFilter[]).map((f) => (
                <FilterPill
                  key={f}
                  label={f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
                  active={outcomeFilter === f}
                  onPress={() => { Haptics.selectionAsync(); setOutcome(f); }}
                  count={
                    f === "all" ? entries.length :
                    f === "win"  ? entries.filter((e) => (e.pnl ?? 0) > 0).length :
                    f === "loss" ? entries.filter((e) => (e.pnl ?? 0) < 0).length :
                    entries.filter((e) => (e.pnl ?? 0) === 0).length
                  }
                />
              ))}
            </ScrollView>

            {/* Category filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={sc.filterRow}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {(["all", "scalp", "swing", "position"] as CategoryFilter[]).map((f) => (
                <FilterPill
                  key={f}
                  label={f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  active={categoryFilter === f}
                  onPress={() => { Haptics.selectionAsync(); setCategory(f); }}
                  count={
                    f === "all" ? entries.length :
                    entries.filter((e) => e.category === f).length
                  }
                />
              ))}
            </ScrollView>

            {/* Entry list */}
            <View style={sc.list}>
              {loadingTrades ? (
                <ActivityIndicator color={planTheme.primary} style={{ marginTop: 32 }} />
              ) : filtered.length === 0 ? (
                <View style={sc.empty}>
                  <Ionicons name="journal-outline" size={40} color={C.textSecondary} />
                  <Text style={sc.emptyText}>Nenhum dado disponível</Text>
                </View>
              ) : (
                filtered.map((entry) => (
                  <JournalCard
                    key={entry._stableId}
                    entry={entry}
                    expanded={expandedId === entry._stableId}
                    onToggle={() => toggleExpand(entry._stableId)}
                  />
                ))
              )}
            </View>
          </>
        )}

        {/* ── STATS TAB ── */}
        {tab === "stats" && (
          <View style={sc.statsContainer}>
            <View style={sc.statsGrid}>
              <StatCard
                label="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                color={stats.winRate >= 50 ? C.success : C.danger}
              />
              <StatCard
                label="Total P&L"
                value={formatPnl(stats.totalPnl)}
                color={stats.totalPnl >= 0 ? C.success : C.danger}
              />
              <StatCard label="Trades" value={`${stats.count}`} />
              <StatCard
                label="Avg Win"
                value={formatPnl(stats.avgWin)}
                color={C.success}
              />
              <StatCard
                label="Avg Loss"
                value={formatPnl(stats.avgLoss)}
                color={C.danger}
              />
              <StatCard
                label="Best Trade"
                value={formatPnl(stats.bestTrade?.pnl)}
                color={C.success}
              />
            </View>

            <PnLMiniBar entries={entries} />
            <MoodDistribution entries={entries} />
            <CategoryStats entries={entries} />
          </View>
        )}

        {/* ── INSIGHTS TAB ── */}
        {tab === "insights" && (
          <View style={sc.insightsContainer}>
            {/* Strategy ranking */}
            <Text style={sc.insightTitle}>Top Strategies</Text>
            {(() => {
              const map: Record<string, number> = {};
              entries.forEach((e) => {
                const s = e.strategy ?? (e as any).strategyName ?? "Unknown";
                map[s]  = (map[s] ?? 0) + (e.pnl ?? 0);
              });
              return Object.entries(map)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, pnl], i) => (
                  <View key={name} style={sc.rankRow}>
                    <Text style={sc.rankNum}>#{i + 1}</Text>
                    <Text style={sc.rankName}>{name}</Text>
                    <Text style={[sc.rankPnl, {
                      color: pnl >= 0 ? C.success : C.danger,
                    }]}>
                      {formatPnl(pnl)}
                    </Text>
                  </View>
                ));
            })()}

            {/* Mood insight */}
            {stats.confidentWinRate > 0 && (
              <View style={sc.insightCard}>
                <Ionicons name="bulb" size={18} color={C.warning} />
                <Text style={sc.insightText}>
                  Trades com mood{" "}
                  <Text style={{ color: C.success }}>Confident</Text> têm win rate
                  de{" "}
                  <Text style={{ color: C.success }}>
                    {stats.confidentWinRate.toFixed(1)}%
                  </Text>
                </Text>
              </View>
            )}

            {/* Top pairs */}
            <Text style={[sc.insightTitle, { marginTop: 20 }]}>Top Pairs</Text>
            {(() => {
              const map: Record<string, number> = {};
              entries.forEach((e) => {
                const p = (e as any).symbol ?? e.pair ?? "Unknown";
                map[p]  = (map[p] ?? 0) + (e.pnl ?? 0);
              });
              return Object.entries(map)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([pair, pnl], i) => (
                  <View key={pair} style={sc.rankRow}>
                    <Text style={sc.rankNum}>#{i + 1}</Text>
                    <Text style={sc.rankName}>{pair}</Text>
                    <Text style={[sc.rankPnl, {
                      color: pnl >= 0 ? C.success : C.danger,
                    }]}>
                      {formatPnl(pnl)}
                    </Text>
                  </View>
                ));
            })()}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.background },
  scroll:            { flex: 1 },
  header:            { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle:       { fontSize: 22, fontWeight: "700", color: C.text },
  headerSub:         { fontSize: 13, color: C.textSecondary, marginTop: 2 },

  tabBar:            { flexDirection: "row", marginHorizontal: 16, marginBottom: 12,
                       backgroundColor: C.surfaceLight, borderRadius: 10, padding: 4 },
  tab:               { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive:         { backgroundColor: C.surface },
  tabText:           { fontSize: 13, color: C.textSecondary, fontWeight: "500" },
  tabTextActive:     { color: C.text, fontWeight: "700" },

  searchRow:         { flexDirection: "row", alignItems: "center", marginHorizontal: 16,
                       marginBottom: 8, backgroundColor: C.surfaceLight, borderRadius: 10,
                       paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  searchInput:       { flex: 1, color: C.text, fontSize: 14 },

  filterRow:         { marginBottom: 8 },
  filterPill:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                       backgroundColor: C.surfaceLight, borderWidth: 1, borderColor: C.border },
  filterPillActive:  { backgroundColor: C.primary + "22", borderColor: C.primary },
  filterPillText:    { fontSize: 12, color: C.textSecondary, fontWeight: "500" },
  filterPillTextActive: { color: C.primary, fontWeight: "700" },

  list:              { paddingHorizontal: 16, gap: 10 },
  empty:             { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText:         { color: C.textSecondary, fontSize: 14 },

  journalCard:       { backgroundColor: C.surface, borderRadius: 14, padding: 14,
                       borderWidth: 1, borderColor: C.border },
  cardHeader:        { flexDirection: "row", justifyContent: "space-between",
                       alignItems: "center", marginBottom: 8 },
  cardHeaderLeft:    { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardHeaderRight:   { flexDirection: "row", alignItems: "center", gap: 8 },
  cardSymbol:        { fontSize: 15, fontWeight: "700", color: C.text, marginRight: 2 },
  cardPnl:           { fontSize: 15, fontWeight: "700" },
  cardMetaRow:       { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },

  sideBadge:         { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  sideText:          { fontSize: 10, fontWeight: "700" },
  outcomeBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  outcomeText:       { fontSize: 10, fontWeight: "700" },
  categoryBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  categoryText:      { fontSize: 10, fontWeight: "700" },
  convictionBadge:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 6,
                       paddingVertical: 2, borderRadius: 5 },
  convictionText:    { fontSize: 10, fontWeight: "700" },
  moodBadge:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 6,
                       paddingVertical: 2, borderRadius: 5, borderWidth: 1, gap: 3 },
  moodIcon:          { fontSize: 11 },
  moodLabel:         { fontSize: 10, fontWeight: "600" },

  gatesRow:          { flexDirection: "row", alignItems: "center", gap: 3 },
  gateItem:          {},
  gatesLabel:        { fontSize: 10, color: C.textSecondary, marginLeft: 2 },

  divider:           { height: 1, backgroundColor: C.border, marginVertical: 10 },
  detailGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  detailItem:        { width: "30%" as any, minWidth: 80 },
  detailLabel:       { fontSize: 11, color: C.textSecondary, marginBottom: 2 },
  detailValue:       { fontSize: 13, color: C.text, fontWeight: "600" },

  gatesDetail:       { marginBottom: 10 },
  gatesDetailTitle:  { fontSize: 12, color: C.textSecondary, marginBottom: 6 },
  gatesDetailRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gateDetailItem:    { flexDirection: "row", alignItems: "center", gap: 4 },
  gateDetailLabel:   { fontSize: 11, color: C.textSecondary },

  noteBlock:         { backgroundColor: C.surfaceLight, borderRadius: 8, padding: 10 },
  noteLabel:         { fontSize: 11, color: C.textSecondary, marginBottom: 4 },
  noteText:          { fontSize: 13, color: C.text, lineHeight: 18 },
  tagRow:            { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tagChip:           { backgroundColor: C.surfaceLight, paddingHorizontal: 8, paddingVertical: 3,
                       borderRadius: 12 },
  tagText:           { fontSize: 11, color: C.textSecondary },

  statsContainer:    { paddingHorizontal: 16 },
  statsGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:          { flex: 1, minWidth: "28%" as any, backgroundColor: C.surface, borderRadius: 12,
                       padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border },
  statValue:         { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 4 },
  statLabel:         { fontSize: 11, color: C.textSecondary, textAlign: "center" },

  pnlBarContainer:   { backgroundColor: C.surface, borderRadius: 12, padding: 14,
                       marginBottom: 16, borderWidth: 1, borderColor: C.border },
  pnlBarTitle:       { fontSize: 13, color: C.textSecondary, marginBottom: 10 },
  pnlBarRow:         { flexDirection: "row", alignItems: "flex-end", gap: 4,
                       height: BAR_MAX_HEIGHT },
  pnlBarWrapper:     { flex: 1, justifyContent: "flex-end" },
  pnlBar:            { borderRadius: 3 },

  moodDist:          { backgroundColor: C.surface, borderRadius: 12, padding: 14,
                       marginBottom: 16, borderWidth: 1, borderColor: C.border },
  moodDistTitle:     { fontSize: 13, color: C.textSecondary, marginBottom: 10 },
  moodDistRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  moodDistIcon:      { fontSize: 14, width: 20 },
  moodDistLabel:     { fontSize: 12, width: 72 },
  moodDistBarBg:     { flex: 1, height: 6, backgroundColor: C.surfaceLight, borderRadius: 3 },
  moodDistBar:       { height: 6, borderRadius: 3 },
  moodDistPct:       { fontSize: 11, color: C.textSecondary, width: 34, textAlign: "right" },

  catStats:          { backgroundColor: C.surface, borderRadius: 12, padding: 14,
                       marginBottom: 16, borderWidth: 1, borderColor: C.border },
  catStatsTitle:     { fontSize: 13, color: C.textSecondary, marginBottom: 10 },
  catStatCard:       { backgroundColor: C.surfaceLight, borderRadius: 10, padding: 12,
                       marginBottom: 10, borderLeftWidth: 3 },
  catStatHeader:     { flexDirection: "row", justifyContent: "space-between",
                       alignItems: "center", marginBottom: 8 },
  catStatCount:      { fontSize: 12, color: C.textSecondary },
  catStatRow:        { flexDirection: "row", justifyContent: "space-between",
                       marginBottom: 4 },
  catStatLabel:      { fontSize: 12, color: C.textSecondary },
  catStatValue:      { fontSize: 12, fontWeight: "600", color: C.text },

  insightsContainer: { paddingHorizontal: 16 },
  insightTitle:      { fontSize: 15, fontWeight: "700", color: C.text, marginBottom: 10 },
  rankRow:           { flexDirection: "row", alignItems: "center", gap: 10,
                       backgroundColor: C.surface, borderRadius: 10, padding: 12,
                       marginBottom: 8, borderWidth: 1, borderColor: C.border },
  rankNum:           { fontSize: 12, color: C.textSecondary, width: 24 },
  rankName:          { flex: 1, fontSize: 13, color: C.text, fontWeight: "600" },
  rankPnl:           { fontSize: 13, fontWeight: "700" },
  insightCard:       { flexDirection: "row", gap: 10, backgroundColor: C.surface,
                       borderRadius: 12, padding: 14, marginTop: 12, alignItems: "flex-start",
                       borderWidth: 1, borderColor: C.border },
  insightText:       { flex: 1, fontSize: 13, color: C.textSecondary, lineHeight: 18 },
});
