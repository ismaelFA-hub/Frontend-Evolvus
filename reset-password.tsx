import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { token } = useLocalSearchParams<{ token: string }>();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  async function handleResetPassword() {
    if (!password.trim() || !confirmPassword.trim()) {
      setError("Preencha todos os campos");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiRequest('POST', '/api/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.background }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Redefinir Senha</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: webTopInset + 20 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.description}>
            {success 
              ? "Sua senha foi redefinida com sucesso."
              : "Escolha uma nova senha segura para sua conta."}
          </Text>

          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={C.primary} />
              <Pressable 
                style={styles.loginButton} 
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.loginButtonText}>Ir para Login</Text>
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
                <Ionicons name="lock-closed-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nova Senha"
                  placeholderTextColor={C.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={C.textTertiary} />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={C.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar Nova Senha"
                  placeholderTextColor={C.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.loginButton, { opacity: pressed ? 0.85 : 1 }]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.loginButtonText}>Redefinir Senha</Text>
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.background,
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
    textAlign: 'center',
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
  eyeButton: {
    padding: 16,
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
