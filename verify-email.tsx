import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useI18n } from "@/lib/i18n-context";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { token } = useLocalSearchParams<{ token: string }>();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      handleVerification();
    } else {
      setError("Token de verificação ausente.");
      setLoading(false);
    }
  }, [token]);

  async function handleVerification() {
    try {
      await apiRequest('GET', `/api/auth/verify-email?token=${token}`);
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || "Falha na verificação do e-mail.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color={C.primary} />
              <Text style={styles.statusText}>Verificando e-mail...</Text>
            </View>
          ) : success ? (
            <View style={styles.statusContainer}>
              <Ionicons name="checkmark-circle" size={80} color={C.primary} />
              <Text style={styles.title}>E-mail Verificado!</Text>
              <Text style={styles.description}>
                Sua conta foi ativada com sucesso. Agora você pode acessar todos os recursos do Evolvus Core.
              </Text>
              <Pressable 
                style={styles.button} 
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.buttonText}>Ir para Login</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <Ionicons name="close-circle" size={80} color={C.danger} />
              <Text style={styles.title}>Verificação Falhou</Text>
              <Text style={styles.description}>{error}</Text>
              <Pressable 
                style={[styles.button, { backgroundColor: C.surface }]} 
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={[styles.buttonText, { color: C.text }]}>Voltar para Login</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  statusContainer: {
    alignItems: "center",
    gap: 20,
    width: "100%",
  },
  statusText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: C.textSecondary,
    marginTop: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: C.text,
    textAlign: "center",
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    backgroundColor: C.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    width: "100%",
  },
  buttonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#0A0E17",
  },
});
