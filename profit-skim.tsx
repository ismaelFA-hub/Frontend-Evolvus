import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

function fmt2(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SkimConfig {
  enabled: boolean;
  skimPct: number;
  vaultBalanceUsdt: number;
  totalSkimmedUsdt: number;
}

interface SkimEntry {
  id: number;
  tradeId: string;
  profitUsdt: number;
  skimmedUsdt: number;
  vaultBalanceAfter: number;
  createdAt: string;
}

export default function ProfitSkimScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme, planType } = usePlanTheme();
  const primary = planTheme.primary;

  const [config, setConfig] = useState<SkimConfig | null>(null);
  const [ledger, setLedger] = useState<SkimEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(false);
  const [localPct, setLocalPct] = useState(20);

  const load = useCallback(async () => {
    try {
      const [cfg, led] = await Promise.all([
        apiRequest("GET", "/api/profit-skim/config"),
        apiRequest("GET", "/api/profit-skim/ledger"),
      ]);
      const c = cfg as SkimConfig;
      setConfig(c);
      setLocalEnabled(c.enabled);
      setLocalPct(c.skimPct ?? 20);
      setLedger((led as any)?.entries ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/profit-skim/config", { enabled: localEnabled, skimPct: localPct });
      await load();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar configuração.");
    } finally {
      setSaving(false);
    }
  }, [localEnabled, localPct, load]);

  const withdraw = useCallback(async () => {
    if (!config || config.vaultBalanceUsdt <= 0) return;
    Alert.alert("Retirar do Cofre", `Retirar $${fmt2(config.vaultBalanceUsdt)} USDT?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar", onPress: async () => {
          try {
            await apiRequest("POST", "/api/profit-skim/withdraw", { amount: config.vaultBalanceUsdt });
            await load();
          } catch {
            Alert.alert("Erro", "Falha ao retirar.");
          }
        },
      },
    ]);
  }, [config, load]);

  const PCT_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50];

  if (planType !== "premium" && planType !== "enterprise" && (planType as string) !== "admin") {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Ionicons name="lock-closed" size={56} color={C.textSecondary} />
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 16, marginBottom: 8 }}>
          Profit Skimming
        </Text>
        <Text style={{ color: C.textSecondary, fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          Disponível a partir do plano Premium. Automatize a colheita de lucros com thresholds configuráveis.
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

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={primary} size="large" />
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
          <Text style={s.title}>Dízimo / Profit Skim</Text>
          <Text style={s.sub}>Reserve parte dos lucros automaticamente</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Vault Balance */}
        <View style={[s.vaultCard, { borderColor: `${primary}50` }]}>
          <Ionicons name="wallet" size={28} color="#FFD700" />
          <Text style={s.vaultLabel}>Cofre</Text>
          <Text style={[s.vaultBalance, { color: primary }]}>${fmt2(config?.vaultBalanceUsdt ?? 0)}</Text>
          <Text style={s.vaultSub}>Total separado: ${fmt2(config?.totalSkimmedUsdt ?? 0)}</Text>
          {(config?.vaultBalanceUsdt ?? 0) > 0 && (
            <Pressable style={[s.withdrawBtn, { borderColor: primary }]} onPress={withdraw}>
              <Ionicons name="arrow-up-circle-outline" size={16} color={primary} />
              <Text style={[s.withdrawText, { color: primary }]}>Retirar</Text>
            </Pressable>
          )}
        </View>

        {/* Toggle */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Ativar Dízimo</Text>
              <Text style={s.cardSub}>Separa % de cada lucro automaticamente</Text>
            </View>
            <Switch
              value={localEnabled}
              onValueChange={setLocalEnabled}
              trackColor={{ false: C.surface, true: `${primary}80` }}
              thumbColor={localEnabled ? primary : C.textTertiary}
            />
          </View>
        </View>

        {/* Percentage picker */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <Text style={s.cardTitle}>Percentual por Lucro</Text>
          <View style={s.pctGrid}>
            {PCT_OPTIONS.map((pct) => (
              <Pressable
                key={pct}
                style={[s.pctBtn, localPct === pct && { backgroundColor: primary, borderColor: primary }]}
                onPress={() => setLocalPct(pct)}
              >
                <Text style={[s.pctText, localPct === pct && { color: "#000" }]}>{pct}%</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Save */}
        <Pressable style={[s.saveBtn, { backgroundColor: primary, opacity: saving ? 0.6 : 1 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.saveBtnText}>Salvar Configuração</Text>}
        </Pressable>

        {/* Ledger */}
        {ledger.length > 0 && (
          <View style={[s.card, { borderColor: `${primary}30` }]}>
            <Text style={s.cardTitle}>Histórico de Skims</Text>
            {ledger.slice(0, 20).map((entry) => (
              <View key={entry.id} style={s.ledgerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ledgerTrade}>Trade #{entry.tradeId}</Text>
                  <Text style={s.ledgerDate}>{new Date(entry.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.ledgerSkim, { color: primary }]}>+${fmt2(entry.skimmedUsdt)}</Text>
                  <Text style={s.ledgerProfit}>Lucro: ${fmt2(entry.profitUsdt)}</Text>
                </View>
              </View>
            ))}
          </View>
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
  content: { padding: 16, gap: 14 },
  vaultCard: { backgroundColor: "#111", borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 6 },
  vaultLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary, marginTop: 4 },
  vaultBalance: { fontFamily: "Inter_700Bold", fontSize: 36 },
  vaultSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  withdrawBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  withdrawText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  cardSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  toggleRow: { flexDirection: "row", alignItems: "center" },
  pctGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pctBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  pctText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#000" },
  ledgerRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  ledgerTrade: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text },
  ledgerDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  ledgerSkim: { fontFamily: "Inter_700Bold", fontSize: 14 },
  ledgerProfit: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
});
