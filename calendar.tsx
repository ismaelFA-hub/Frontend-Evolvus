import { useState, useMemo } from "react";
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
import { getCalendarEvents, type CalendarEvent } from "@/lib/quantum-engine";

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

type Category = "all" | "crypto" | "macro" | "earnings" | "token_unlock" | "airdrop";
type Impact = "all" | "high" | "medium" | "low";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "crypto", label: "Crypto" },
  { key: "macro", label: "Macro" },
  { key: "earnings", label: "Earnings" },
  { key: "token_unlock", label: "Token Unlocks" },
  { key: "airdrop", label: "Airdrops" },
];

const IMPACTS: { key: Impact; label: string; color: string }[] = [
  { key: "all", label: "Todos", color: C.textSecondary },
  { key: "high", label: "Alto", color: C.danger },
  { key: "medium", label: "Médio", color: C.warning },
  { key: "low", label: "Baixo", color: C.textTertiary },
];

const CATEGORY_COLORS: Record<string, string> = {
  crypto: C.success,
  macro: C.secondary,
  earnings: C.accent,
  token_unlock: C.warning,
  airdrop: C.success,
};

const IMPACT_NOTES: Record<string, string> = {
  high: "Alto impacto esperado nos mercados. Considere ajustar posições antes do evento.",
  medium: "Impacto moderado possível. Monitore a volatilidade ao redor do horário.",
  low: "Baixo impacto histórico. Mínima movimentação de mercado esperada.",
};

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const { planTheme, planType } = usePlanTheme();
  const { user } = useAuth();
  const { t } = useI18n();

  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [selectedImpact, setSelectedImpact] = useState<Impact>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allEvents = useMemo(() => getCalendarEvents(), []);

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (selectedCategory !== "all" && e.category !== selectedCategory) return false;
      if (selectedImpact !== "all" && e.impact !== selectedImpact) return false;
      return true;
    });
  }, [allEvents, selectedCategory, selectedImpact]);

  const visibleEvents = planGte(planType, "pro") ? filtered : filtered.slice(0, 3);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    visibleEvents.forEach((e) => {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleEvents]);

  function formatDate(d: string) {
    const [, m, day] = d.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
  }

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
        <Text style={s.headerTitle}>{t('economicCalendar')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={{ marginBottom: 10 }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              style={[s.filterPill, selectedCategory === cat.key && s.filterPillActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategory(cat.key);
              }}
            >
              <Text
                style={[
                  s.filterPillText,
                  selectedCategory === cat.key && { color: C.text },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Impact filter */}
        <View style={s.impactRow}>
          {IMPACTS.map((imp) => (
            <Pressable
              key={imp.key}
              style={[
                s.impactPill,
                selectedImpact === imp.key && { borderColor: imp.color, backgroundColor: `${imp.color}18` },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedImpact(imp.key);
              }}
            >
              <Text
                style={[
                  s.impactPillText,
                  { color: selectedImpact === imp.key ? imp.color : C.textTertiary },
                ]}
              >
                {imp.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Events grouped by date */}
        {grouped.map(([date, events]) => (
          <View key={date} style={s.dateGroup}>
            <Text style={s.dateHeader}>{formatDate(date)}</Text>
            {events.map((ev) => {
              const isExpanded = expandedId === ev.id;
              const impactColor =
                ev.impact === "high" ? C.danger : ev.impact === "medium" ? C.warning : C.textTertiary;
              const catColor = CATEGORY_COLORS[ev.category] ?? C.textSecondary;
              return (
                <Pressable
                  key={ev.id}
                  style={s.eventCard}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setExpandedId(isExpanded ? null : ev.id);
                  }}
                >
                  <View style={s.eventTop}>
                    <View style={[s.impactDot, { backgroundColor: impactColor }]} />
                    <View style={s.eventMain}>
                      <Text style={s.eventTitle}>{ev.titlePt}</Text>
                      <View style={s.eventMeta}>
                        <Text style={s.eventTime}>{ev.time}</Text>
                        <View style={[s.catBadge, { backgroundColor: `${catColor}18` }]}>
                          <Text style={[s.catBadgeText, { color: catColor }]}>{ev.category.replace("_", " ")}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={C.textTertiary}
                    />
                  </View>

                  {isExpanded && (
                    <View style={s.eventExpanded}>
                      {ev.affectedAssets.length > 0 && (
                        <View style={s.assetsRow}>
                          {ev.affectedAssets.map((a) => (
                            <View key={a} style={s.assetPill}>
                              <Text style={s.assetPillText}>{a}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <Text style={s.eventDesc}>{ev.descriptionPt}</Text>
                      {planGte(planType, "premium") && (
                        <View style={[s.impactNote, { backgroundColor: `${impactColor}18`, borderLeftColor: impactColor }]}>
                          <Text style={[s.impactNoteText, { color: impactColor }]}>
                            {IMPACT_NOTES[ev.impact]}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        {!planGte(planType, "pro") && (
          <View style={[s.gateCard]}>
            <PlanGate required="pro" />
          </View>
        )}

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
  filterRow: { paddingBottom: 4, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterPillActive: { backgroundColor: C.secondary, borderColor: C.secondary },
  filterPillText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  impactRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  impactPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  impactPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  dateGroup: { marginBottom: 18 },
  dateHeader: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.textSecondary, marginBottom: 8, textTransform: "uppercase" },
  eventCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  eventTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  impactDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  eventMain: { flex: 1 },
  eventTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 5 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  eventTime: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  catBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  eventExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  assetsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  assetPill: { backgroundColor: C.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  assetPillText: { fontFamily: "Inter_700Bold", fontSize: 11, color: C.accent },
  eventDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  impactNote: { marginTop: 10, padding: 10, borderRadius: 8, borderLeftWidth: 3 },
  impactNoteText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  gateCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    marginBottom: 12,
  },
  // PlanGate
  gateOverlay: { alignItems: "center", paddingVertical: 16, gap: 10 },
  gateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  gateBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  gateBtnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
});
