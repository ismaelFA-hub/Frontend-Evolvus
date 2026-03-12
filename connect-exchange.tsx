import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { getExchangeById } from "@/lib/exchanges";

const C = Colors.dark;

const EXCHANGE_TUTORIALS: Record<string, { step2: string; step3: string }> = {
  binance:  { step2: "Vá em: Perfil > Gerenciamento de API", step3: 'Clique em "Criar API" e habilite "Leitura" e "Trading Spot"' },
  bybit:    { step2: "Vá em: Conta > Chaves de API", step3: 'Clique em "Criar Chave" e ative permissões de negociação' },
  okx:      { step2: "Vá em: Conta > API", step3: 'Clique em "Criar API" e defina permissões de trading' },
  coinbase: { step2: "Vá em: Configurações > Chaves de API", step3: 'Crie uma nova chave e selecione permissões de negociação' },
  kraken:   { step2: "Vá em: Segurança > API", step3: 'Gere uma nova chave com permissões: "Query Funds" e "Trade"' },
  bitget:   { step2: "Vá em: Conta > Gerenciamento de API", step3: 'Crie uma API Key com permissões de leitura e trading' },
  kucoin:   { step2: "Vá em: Conta > Gerenciamento de API", step3: 'Crie uma API Key, defina senha e ative trading spot' },
};

const DEFAULT_TUTORIAL = {
  step2: "Vá em: Configurações de Conta > API ou Segurança",
  step3: 'Crie uma nova API Key com permissões de leitura e trading',
};

const ERROR_MESSAGES: Record<string, string> = {
  "401": "API Key inválida. Verifique se copiou corretamente.",
  "403": "Sem permissão de trading. Habilite as permissões de negociação na exchange.",
  "503": "Exchange fora do ar ou em manutenção. Tente novamente mais tarde.",
  "network": "Erro de rede. Verifique sua conexão e tente novamente.",
};

export default function ConnectExchangeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ exchangeId: string; existingKeyId?: string }>();
  const exchangeId = params.exchangeId || "binance";
  const existingKeyId = params.existingKeyId;

  const exchange = getExchangeById(exchangeId);
  const tutorial = EXCHANGE_TUTORIALS[exchangeId] || DEFAULT_TUTORIAL;

  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState(`Conta Principal`);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleTestAndConnect = async () => {
    if (!apiKey.trim() || !secret.trim()) {
      Alert.alert("Campos obrigatórios", "Preencha a Chave API e a Secret Key.");
      return;
    }
    if (apiKey.trim().length < 10) {
      Alert.alert("Chave inválida", "A API Key parece muito curta. Verifique se copiou corretamente.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTesting(true);
    setTestStatus("idle");
    setErrorMessage("");

    let createdId: string | null = null;

    try {
      const createRes = await apiRequest("POST", "/api/security/api-keys", {
        exchange: exchangeId,
        label,
        apiKey: apiKey.trim(),
        apiSecret: secret.trim(),
        permissions: ["spot_trading", "read"],
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.message || "Erro ao salvar chave.");
      }

      const createData = await createRes.json();
      createdId = createData.apiKey?.id;

      if (!createdId) throw new Error("Erro interno ao criar chave.");

      const testRes = await apiRequest("POST", `/api/user/api-keys/${createdId}/test`);
      if (!testRes.ok) {
        const statusCode = String(testRes.status);
        await apiRequest("DELETE", `/api/security/api-keys/${createdId}`).catch(() => {});
        const msg = ERROR_MESSAGES[statusCode] || "Não foi possível conectar. Verifique suas credenciais.";
        setErrorMessage(msg);
        setTestStatus("error");
        return;
      }

      setTestStatus("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 1500);
    } catch (err: unknown) {
      if (createdId) {
        await apiRequest("DELETE", `/api/security/api-keys/${createdId}`).catch(() => {});
      }
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setErrorMessage(msg.includes("network") ? ERROR_MESSAGES.network : msg);
      setTestStatus("error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>
          🔌 Conectar {exchange?.label || exchangeId.toUpperCase()}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.tutorialCard}>
          <Text style={s.tutorialTitle}>📘 TUTORIAL RÁPIDO</Text>
          <Text style={s.tutorialSub}>Primeira vez? Siga os passos:</Text>
          {[
            `Acesse sua conta ${exchange?.label || "da exchange"} no navegador`,
            tutorial.step2,
            tutorial.step3,
            "Copie a Chave API e a Secret Key",
            "Cole abaixo e clique em \"Testar Conexão\"",
          ].map((step, i) => (
            <View key={i} style={s.tutorialStep}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={s.formCard}>
          <View style={s.field}>
            <Text style={s.fieldLabel}>📝 Label (nome da conta)</Text>
            <TextInput
              style={s.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Ex: Conta Principal, Trading Bot..."
              placeholderTextColor={C.textTertiary}
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>🔑 CHAVE API</Text>
            <TextInput
              style={s.input}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Cole sua API Key aqui..."
              placeholderTextColor={C.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>🔐 SECRET KEY</Text>
            <View style={s.secretRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={secret}
                onChangeText={setSecret}
                placeholder="Cole sua Secret Key aqui..."
                placeholderTextColor={C.textTertiary}
                secureTextEntry={!showSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => setShowSecret(!showSecret)} style={s.eyeBtn}>
                <Ionicons name={showSecret ? "eye-off-outline" : "eye-outline"} size={20} color={C.textTertiary} />
              </Pressable>
            </View>
          </View>

          <View style={s.permissionsNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={C.success} />
            <Text style={s.permissionsText}>
              Habilite: Leitura de saldo + Trading Spot. Nunca habilite saque.
            </Text>
          </View>
        </View>

        {testStatus === "success" && (
          <View style={s.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color={C.success} />
            <Text style={s.successText}>✅ Conexão bem-sucedida! Exchange conectada.</Text>
          </View>
        )}

        {testStatus === "error" && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={C.danger} />
            <Text style={s.errorText}>{errorMessage}</Text>
          </View>
        )}

        <Pressable
          style={[s.testBtn, testing && s.testBtnDisabled]}
          onPress={handleTestAndConnect}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={s.testBtnText}>
                {testStatus === "error" ? "TENTAR NOVAMENTE" : "⚡ TESTAR CONEXÃO"}
              </Text>
            </>
          )}
        </Pressable>

        <Text style={s.helpNote}>
          Após testar com sucesso, a exchange será ativada para uso no ecossistema Evolvus.
        </Text>

        <View style={s.errorsGuide}>
          <Text style={s.errorsTitle}>❓ Problemas comuns:</Text>
          <Text style={s.errorsItem}>• "API key inválida" → verifique se copiou corretamente</Text>
          <Text style={s.errorsItem}>• "Sem permissão" → habilite trading na API da exchange</Text>
          <Text style={s.errorsItem}>• "Exchange fora do ar" → tente novamente em alguns minutos</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  tutorialCard: { backgroundColor: "#0D1B2A", borderRadius: 16, padding: 18, gap: 12, borderLeftWidth: 3, borderLeftColor: "#3B82F6" },
  tutorialTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#3B82F6" },
  tutorialSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
  tutorialStep: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumText: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  stepText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1, lineHeight: 20 },
  formCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, gap: 16, borderWidth: 1, borderColor: C.border },
  field: { gap: 6 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  input: {
    backgroundColor: "#0D1120", borderRadius: 10, padding: 14,
    fontFamily: "Inter_400Regular", fontSize: 14, color: C.text,
    borderWidth: 1, borderColor: C.border,
  },
  secretRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { padding: 14, backgroundColor: "#0D1120", borderRadius: 10, borderWidth: 1, borderColor: C.border },
  permissionsNote: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0A1F14", borderRadius: 8, padding: 10 },
  permissionsText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.success, flex: 1 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0A1F14", borderRadius: 12, padding: 14 },
  successText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.success },
  errorBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#1F0A0A", borderRadius: 12, padding: 14 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.danger, flex: 1 },
  testBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
  },
  testBtnDisabled: { opacity: 0.6 },
  testBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  helpNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary, textAlign: "center" },
  errorsGuide: { backgroundColor: "#1A1A2E", borderRadius: 12, padding: 14, gap: 6 },
  errorsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  errorsItem: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
});
