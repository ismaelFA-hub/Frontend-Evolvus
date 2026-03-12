import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  async function handleResetRequest() {
    if (!email.trim()) {
      setError("Preencha todos os campos");
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiRequest('POST', '/api/auth/forgot-password', { email: email.trim() });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Esqueceu a Senha?</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: webTopInset + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.description}>
            {success 
              ? "Se as informações estiverem corretas, você receberá um link para redefinir sua senha em instantes."
              : "Digite seu e-mail para receber as instruções de recuperação de senha."}
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={C.primary} />
              <Pressable 
                style={styles.loginButton} 
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.loginButtonText}>Voltar para Login</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={C.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('email')}
                  placeholderTextColor={C.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.loginButton, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleResetRequest}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.loginButtonText}>Enviar Instruções</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.background,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: C.text,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  form: {
    gap: 24,
    marginTop: 20,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.textSecondary,
    lineHeight: 24,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.dangerDim,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.danger,
    flex: 1,
  },
  successBox: {
    alignItems: "center",
    gap: 24,
    marginTop: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: C.text,
    padding: 16,
    paddingLeft: 12,
  },
  loginButton: {
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
  },
  loginButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0A0E17",
  },
});
