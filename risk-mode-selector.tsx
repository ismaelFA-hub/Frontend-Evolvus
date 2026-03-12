/**
 * Evolvus Core Quantum — Seletor de Modo de Risco
 * 
 * Tela de seleção dos 3 produtos de risco nomeados:
 *   🛡️ Guardião — proteção de capital
 *   🦅 Predador — agressividade máxima
 *   🏦 Vault — acumulação pura
 *
 * Rota: /risk-mode-selector
 */

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskModeConfig {
  mode: "guardian" | "predator" | "vault";
  name: string;
  nameLocalized: { pt: string; en: string };
  emoji: string;
  tagline: { pt: string; en: string };
  drawdownThresholdPct: number;
  skimPct: number;
  leverageMultiplier: number;
  conservativeModeActive: boolean;
  futuresBlocked: boolean;
  blockedStrategies: string[];
  preferredStrategies: string[];
  maxLeverageCap: number | null;
  color: string;
  accentColor: string;
}

// ─── Mode Card ────────────────────────────────────────────────────────────────

function ModeCard({
  config,
  isActive,
  onSelect,
}: {
  config: RiskModeConfig;
  isActive: boolean;
  onSelect: () => void;
}) {
  const borderColor = isActive ? config.accentColor : C.border;

  return (
    <Pressable
      style={[styles.card, { borderColor, backgroundColor: isActive ? config.color + "22" : C.surface }]}
      onPress={onSelect}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>{config.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.modeName, { color: config.accentColor }]}>
            {config.nameLocalized.pt}
          </Text>
          <Text style={styles.modeTagline}>{config.tagline.pt}</Text>
        </View>
        {isActive && (
          <View style={[styles.activeBadge, { backgroundColor: config.accentColor }]}>
            <Text style={styles.activeBadgeText}>ATIVO</Text>
          </View>
        )}
      </View>

      <View style={styles.statsGrid}>
        <StatItem label="Drawdown máx" value={`${config.drawdownThresholdPct}%`} color={config.accentColor} />
        <StatItem label="Skim de lucro" value={`${config.skimPct}%`} color={config.accentColor} />
        <StatItem
          label="Leverage"
          value={config.maxLeverageCap !== null ? `${config.maxLeverageCap}x máx` : `${(config.leverageMultiplier * 100).toFixed(0)}% do limite`}
          color={config.accentColor}
        />
        <StatItem
          label="Modo conserv."
          value={config.conservativeModeActive ? "ON" : "OFF"}
          color={config.conservativeModeActive ? C.success : C.danger}
        />
      </View>

      {config.futuresBlocked && (
        <View style={styles.warningRow}>
          <Ionicons name="lock-closed" size={12} color={C.warning} />
          <Text style={styles.warningText}>Futuros bloqueados neste modo</Text>
        </View>
      )}

      {config.preferredStrategies.length > 0 && (
        <View style={styles.strategiesRow}>
          <Text style={styles.strategiesLabel}>Preferidas: </Text>
          <Text style={styles.strategiesValue}>{config.preferredStrategies.join(", ")}</Text>
        </View>
      )}
    </Pressable>
  );
}

function StatItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RiskModeSelectorScreen() {
  const insets = useSafeAreaInsets();
  const [modes, setModes] = useState<RiskModeConfig[]>([]);
  const [currentMode, setCurrentMode] = useState<string>("guardian");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [modesRes, modeRes] = await Promise.all([
        apiRequest("GET", "/api/risk/modes"),
        apiRequest("GET", "/api/risk/mode"),
      ]);
      const modesData = await modesRes.json() as { modes: RiskModeConfig[] };
      const modeData = await modeRes.json() as { mode: string };
      setModes(modesData.modes ?? []);
      setCurrentMode(modeData.mode ?? "guardian");
    } catch {
      // defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSelect = async (mode: string) => {
    if (mode === currentMode || saving) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const modeConfig = modes.find((m) => m.mode === mode);

    Alert.alert(
      `${modeConfig?.emoji ?? ""} Ativar ${modeConfig?.nameLocalized.pt ?? mode}?`,
      modeConfig?.tagline.pt ?? "",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          style: "default",
          onPress: async () => {
            setSaving(true);
            try {
              await apiRequest("PUT", "/api/risk/mode", { mode });
              setCurrentMode(mode);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Erro", "Não foi possível alterar o modo de risco.");
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Modo de Risco</Text>
          <Text style={styles.subtitle}>Escolha sua filosofia de trading</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.sectionLabel}>3 modos disponíveis — toque para ativar</Text>

          {modes.map((m) => (
            <ModeCard
              key={m.mode}
              config={m}
              isActive={m.mode === currentMode}
              onSelect={() => void handleSelect(m.mode)}
            />
          ))}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color={C.textSecondary} />
            <Text style={styles.infoText}>
              O modo de risco aplica-se a todos os bots ativos. Alterar o modo não cancela posições abertas — apenas novas entradas respeitarão as novas regras.
            </Text>
          </View>
        </ScrollView>
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.savingText}>Aplicando modo...</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "700", color: C.text },
  subtitle: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  centerLoad: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, gap: 12 },
  sectionLabel: { fontSize: 12, color: C.textSecondary, marginBottom: 4, letterSpacing: 0.5 },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  emoji: { fontSize: 32 },
  modeName: { fontSize: 18, fontWeight: "700" },
  modeTagline: { fontSize: 12, color: C.textSecondary, marginTop: 2, lineHeight: 16 },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  activeBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    width: "48%",
    backgroundColor: "#ffffff08",
    borderRadius: 8,
    padding: 8,
  },
  statLabel: { fontSize: 10, color: C.textSecondary, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "700" },
  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f59e0b11",
    padding: 8,
    borderRadius: 8,
  },
  warningText: { fontSize: 11, color: C.warning },
  strategiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  strategiesLabel: { fontSize: 11, color: C.textSecondary },
  strategiesValue: { fontSize: 11, color: C.textSecondary, flex: 1 },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: C.surface,
    borderRadius: 10,
    marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 11, color: C.textSecondary, lineHeight: 16 },
  savingOverlay: {
    position: "absolute",
    bottom: 40,
    left: "50%",
    transform: [{ translateX: -80 }],
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  savingText: { color: C.text, fontSize: 14 },
});
