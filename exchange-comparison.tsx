import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Platform, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { getExchangeFavicon } from "@/lib/exchanges";

const C = Colors.dark;

interface ExchangeCapability {
  name: string;
  supportsSpot: boolean;
  supportsMargin: boolean;
  supportsFutures: boolean;
  supportsOptions: boolean;
  supportsGrid: boolean;
  maxLeverage: number;
  makerFee: number;
  takerFee: number;
  availablePairs: number;
}

const FILTER_OPTIONS = [
  { id: "all", label: "Todas" },
  { id: "leverage", label: "Alta Alavancagem" },
  { id: "low_fees", label: "Baixas Taxas" },
  { id: "futures", label: "Futuros" },
  { id: "grid", label: "Grid Bots" },
];

export default function ExchangeComparisonScreen() {
  const insets = useSafeAreaInsets();
  const [capabilities, setCapabilities] = useState<ExchangeCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    apiRequest("GET", "/api/exchanges/capabilities")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : Object.values(data);
        setCapabilities(list as ExchangeCapability[]);
      })
      .catch(() => setCapabilities([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = capabilities.filter((ex) => {
    if (filter === "leverage") return ex.maxLeverage >= 50;
    if (filter === "low_fees") return ex.takerFee <= 0.0006;
    if (filter === "futures") return ex.supportsFutures;
    if (filter === "grid") return ex.supportsGrid;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.maxLeverage - a.maxLeverage);

  const CheckIcon = ({ val }: { val: boolean }) => (
    <Ionicons name={val ? "checkmark-circle" : "close-circle-outline"} size={16} color={val ? C.success : C.textTertiary} />
  );

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View>
          <Text style={s.title}>📊 Comparação de Exchanges</Text>
          <Text style={s.subtitle}>{capabilities.length} exchanges analisadas</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
        {FILTER_OPTIONS.map((f) => (
          <Pressable
            key={f.id}
            style={[s.filterChip, filter === f.id && s.filterChipActive]}
            onPress={() => { Haptics.selectionAsync(); setFilter(f.id); }}
          >
            <Text style={[s.filterChipText, filter === f.id && s.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <View style={s.tableHeader}>
          <Text style={[s.thCell, { flex: 2 }]}>Exchange</Text>
          <Text style={s.thCell}>Spot</Text>
          <Text style={s.thCell}>Futuros</Text>
          <Text style={s.thCell}>Alavancagem</Text>
          <Text style={s.thCell}>Taxa Maker</Text>
        </View>
        {sorted.map((ex, i) => {
          const domain = ex.name.toLowerCase().replace(/\s+/g, "").replace(".", "") + ".com";
          return (
            <View key={i} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
              <View style={[s.cell, { flex: 2, flexDirection: "row", alignItems: "center", gap: 8 }]}>
                <Image source={{ uri: getExchangeFavicon(domain, 24) }} style={s.rowLogo} />
                <View>
                  <Text style={s.exchangeName}>{ex.name}</Text>
                  {ex.supportsGrid && <Text style={s.gridBadge}>Grid</Text>}
                </View>
              </View>
              <View style={s.cell}>
                <CheckIcon val={ex.supportsSpot} />
              </View>
              <View style={s.cell}>
                <CheckIcon val={ex.supportsFutures} />
              </View>
              <View style={s.cell}>
                <Text style={[s.leverageText, ex.maxLeverage >= 100 && { color: C.primary }]}>
                  {ex.maxLeverage}x
                </Text>
              </View>
              <View style={s.cell}>
                <Text style={[s.feeText, ex.makerFee <= 0.0002 && { color: C.success }]}>
                  {(ex.makerFee * 100).toFixed(3)}%
                </Text>
              </View>
            </View>
          );
        })}

        {sorted.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>Nenhuma exchange encontrada com este filtro.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  filterScroll: { maxHeight: 50 },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1A2035", borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.primaryDim, borderColor: C.primary },
  filterChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  filterChipTextActive: { color: C.primary },
  scroll: { paddingHorizontal: 12 },
  tableHeader: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 8, backgroundColor: "#0D1120", borderRadius: 8, marginBottom: 4 },
  thCell: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.textTertiary, textAlign: "center" },
  tableRow: { flexDirection: "row", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, alignItems: "center" },
  tableRowAlt: { backgroundColor: "#0D1120" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center" },
  rowLogo: { width: 24, height: 24, borderRadius: 6 },
  exchangeName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  gridBadge: { fontFamily: "Inter_400Regular", fontSize: 9, color: C.primary, backgroundColor: C.primaryDim, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, alignSelf: "flex-start" },
  leverageText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  feeText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  emptyCard: { padding: 32, alignItems: "center" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary },
});
