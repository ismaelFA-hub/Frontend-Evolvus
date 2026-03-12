import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import { ONBOARDING_KEY } from "@/app/onboarding";

const C = Colors.dark;

export default function VerifyEmailPromptScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const maskedEmail = user?.email
    ? user.email.replace(/(.{2})(.*)(@.*)/, (_: string, a: string, b: string, c: string) => `${a}${'*'.repeat(Math.min(b.length, 4))}${c}`)
    : "seu e-mail";

  async function handleResend() {
    setResending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email: user?.email });
      setResent(true);
    } catch {
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  async function handleContinue() {
    setVerifying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      router.replace("/onboarding");
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail" size={56} color="#00D4E8" />
        </View>

        <Text style={styles.title}>Verifique seu e-mail</Text>
        <Text style={styles.subtitle}>
          Enviamos um link de confirmação para
        </Text>
        <Text style={styles.email}>{maskedEmail}</Text>
        <Text style={styles.hint}>
          Clique no link do e-mail para ativar sua conta. Verifique também a pasta de spam.
        </Text>

        <View style={styles.card}>
          <Ionicons name="sparkles" size={18} color="#7B61FF" />
          <Text style={styles.cardText}>
            Bem-vindo ao Evolvus Core Quantum — a plataforma com 54 microcérebros de IA, automação 24/7 e inteligência quântica para traders que querem resultados reais.
          </Text>
        </View>

        {resent && (
          <View style={styles.resentBadge}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} />
            <Text style={styles.resentText}>E-mail reenviado com sucesso!</Text>
          </View>
        )}

        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleContinue}
          disabled={verifying}
        >
          {verifying ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.btnPrimaryText}>Já verifiquei — Entrar</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnSecondary, resent && { opacity: 0.5 }]}
          onPress={handleResend}
          disabled={resending || resent}
        >
          {resending ? (
            <ActivityIndicator size="small" color="#00D4E8" />
          ) : (
            <Text style={styles.btnSecondaryText}>
              {resent ? "E-mail reenviado" : "Reenviar e-mail"}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.backLink}>
          <Text style={styles.backLinkText}>Voltar para o login</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 16 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#00D4E810", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: C.text, textAlign: "center" },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textSecondary, textAlign: "center", marginBottom: -8 },
  email: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#00D4E8", textAlign: "center" },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, textAlign: "center", lineHeight: 20 },
  card: { backgroundColor: "#7B61FF15", borderRadius: 14, borderWidth: 1, borderColor: "#7B61FF30", padding: 16, flexDirection: "row", gap: 12, alignItems: "flex-start", marginVertical: 8 },
  cardText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, flex: 1, lineHeight: 20 },
  resentBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.successDim, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  resentText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.success },
  btn: { width: "100%", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  btnPrimary: { backgroundColor: "#00D4E8" },
  btnPrimaryText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#0A0E17" },
  btnSecondary: { borderWidth: 1, borderColor: "#00D4E830" },
  btnSecondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#00D4E8" },
  backLink: { marginTop: 8 },
  backLinkText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textTertiary },
});
