import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Switch, ActivityIndicator, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

const ALERT_TYPES = [
  { key: "signal", label: "Sinais de Trading", icon: "pulse" as const },
  { key: "trade", label: "Trades Abertos/Fechados", icon: "trending-up" as const },
  { key: "circuit_breaker", label: "Circuit Breaker", icon: "shield" as const },
  { key: "liquidation", label: "Alertas de Liquidação", icon: "warning" as const },
];

interface TelegramConfig {
  enabled: boolean;
  chatId: string;
  alertTypes: string[];
  hasToken: boolean;
}

export default function TelegramSetupScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;

  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabledTypes, setEnabledTypes] = useState<string[]>(["signal", "trade", "circuit_breaker", "liquidation"]);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/telegram/config");
      const c = res as TelegramConfig;
      setConfig(c);
      setChatId(c.chatId ?? "");
      setEnabledTypes(c.alertTypes ?? ["signal", "trade", "circuit_breaker", "liquidation"]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (!token && !config?.hasToken) {
      Alert.alert("Erro", "Insira o Bot Token do Telegram.");
      return;
    }
    if (!chatId) {
      Alert.alert("Erro", "Insira o Chat ID.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/telegram/config", { botToken: token || undefined, chatId, enabled: true, alertTypes: enabledTypes });
      await load();
      Alert.alert("Salvo", "Telegram configurado com sucesso!");
    } catch {
      Alert.alert("Erro", "Falha ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  }, [token, chatId, enabledTypes, config?.hasToken, load]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    try {
      await apiRequest("POST", "/api/telegram/test");
      Alert.alert("Teste Enviado", "Verifique seu Telegram!");
    } catch {
      Alert.alert("Erro", "Falha ao enviar mensagem de teste. Verifique as credenciais.");
    } finally {
      setTesting(false);
    }
  }, []);

  const toggleType = useCallback((key: string) => {
    setEnabledTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  if (loading) {
    return (
      <View style={[s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }

  const connected = config?.enabled && config?.hasToken;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Alertas Telegram</Text>
          <Text style={s.sub}>Notificações em tempo real no seu celular</Text>
        </View>
        <View style={[s.statusDot, { backgroundColor: connected ? C.success : C.danger }]} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Status */}
        <View style={[s.statusCard, { borderColor: connected ? `${C.success}40` : `${C.danger}40` }]}>
          <Ionicons name={connected ? "checkmark-circle" : "close-circle"} size={24} color={connected ? C.success : C.danger} />
          <Text style={[s.statusText, { color: connected ? C.success : C.danger }]}>
            {connected ? "Telegram conectado" : "Telegram não configurado"}
          </Text>
        </View>

        {/* Credentials */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <Text style={s.cardTitle}>Credenciais do Bot</Text>
          <Pressable onPress={() => Linking.openURL("https://t.me/BotFather")}>
            <Text style={[s.helpLink, { color: primary }]}>Como obter seu Bot Token →</Text>
          </Pressable>
          <View>
            <Text style={s.label}>Bot Token</Text>
            <TextInput
              style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
              placeholder={config?.hasToken ? "••••••••• (salvo)" : "1234567890:ABCdef..."}
              placeholderTextColor={C.textSecondary}
              value={token}
              onChangeText={setToken}
              secureTextEntry
            />
          </View>
          <View>
            <Text style={s.label}>Chat ID</Text>
            <TextInput
              style={[s.input, { borderColor: `${primary}40`, color: C.text }]}
              placeholder="-1001234567890"
              placeholderTextColor={C.textSecondary}
              value={chatId}
              onChangeText={setChatId}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Alert types */}
        <View style={[s.card, { borderColor: `${primary}30` }]}>
          <Text style={s.cardTitle}>Tipos de Alerta</Text>
          {ALERT_TYPES.map((at) => (
            <View key={at.key} style={s.alertRow}>
              <Ionicons name={at.icon} size={20} color={enabledTypes.includes(at.key) ? primary : C.textTertiary} />
              <Text style={[s.alertLabel, { color: enabledTypes.includes(at.key) ? C.text : C.textSecondary }]}>{at.label}</Text>
              <Switch
                value={enabledTypes.includes(at.key)}
                onValueChange={() => toggleType(at.key)}
                trackColor={{ false: C.surface, true: `${primary}80` }}
                thumbColor={enabledTypes.includes(at.key) ? primary : C.textTertiary}
              />
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable style={[s.saveBtn, { backgroundColor: primary, opacity: saving ? 0.6 : 1 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={s.saveBtnText}>Salvar Configuração</Text>}
        </Pressable>

        {config?.hasToken && (
          <Pressable style={[s.testBtn, { borderColor: primary, opacity: testing ? 0.6 : 1 }]} onPress={sendTest} disabled={testing}>
            {testing ? <ActivityIndicator color={primary} size="small" /> : (
              <>
                <Ionicons name="paper-plane-outline" size={16} color={primary} />
                <Text style={[s.testBtnText, { color: primary }]}>Enviar Mensagem de Teste</Text>
              </>
            )}
          </Pressable>
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
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  content: { padding: 16, gap: 14 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 14 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  card: { backgroundColor: "#111", borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  helpLink: { fontFamily: "Inter_500Medium", fontSize: 12 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14, backgroundColor: "#1a1a1a" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  alertLabel: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#000" },
  testBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  testBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
