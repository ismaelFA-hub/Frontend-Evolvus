/**
 * Evolvus Core Quantum — Payment Success Screen (Sprint LXV)
 *
 * Displayed after a successful Stripe Checkout session.
 * URL: /payment/success?session_id=cs_...
 *
 * The Stripe webhook (POST /api/payment/webhook) updates the user's plan
 * server-side. This screen shows a confirmation and refreshes the auth
 * context so the new plan is reflected immediately.
 */

import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

const C = Colors.dark;

export default function PaymentSuccessScreen() {
  const insets = useSafeAreaInsets();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const { refreshUser } = useAuth();
  const [refreshed, setRefreshed] = useState(false);
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  // Refresh the user profile so the new plan is reflected in the app
  useEffect(() => {
    let cancelled = false;
    async function doRefresh() {
      try {
        if (typeof refreshUser === "function") {
          await refreshUser();
        }
      } finally {
        if (!cancelled) setRefreshed(true);
      }
    }
    doRefresh();
    return () => { cancelled = true; };
  }, [refreshUser]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + webTopInset, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Success icon */}
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={96} color="#00D4AA" />
      </View>

      {/* Heading */}
      <Text style={styles.title}>Pagamento confirmado! 🎉</Text>
      <Text style={styles.subtitle}>
        O seu plano foi atualizado com sucesso. As novas funcionalidades já estão disponíveis na sua conta.
      </Text>

      {/* Session ID for reference */}
      {session_id ? (
        <View style={styles.sessionBox}>
          <Text style={styles.sessionLabel}>Referência do pedido</Text>
          <Text style={styles.sessionId} numberOfLines={1} ellipsizeMode="middle">
            {session_id}
          </Text>
        </View>
      ) : null}

      {/* CTA */}
      <Pressable
        style={styles.ctaBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.replace("/(tabs)/");
        }}
        disabled={!refreshed}
        accessibilityRole="button"
        accessibilityLabel="Ir para o Dashboard"
      >
        <Ionicons name="home" size={20} color="#000" />
        <Text style={styles.ctaBtnText}>Ir para o Dashboard</Text>
      </Pressable>

      {/* Secondary: view current plan */}
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => {
          Haptics.selectionAsync();
          router.push("/payment" as never);
        }}
        accessibilityRole="button"
        accessibilityLabel="Ver meu plano"
      >
        <Text style={styles.secondaryBtnText}>Ver meu plano</Text>
      </Pressable>

      <Text style={styles.note}>
        Nota: o webhook do Stripe processa o pagamento em segundos. Se o seu plano ainda não foi atualizado, aguarde um momento e reabra o app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  iconWrap: {
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
  },
  sessionBox: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: 12,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  sessionLabel: {
    fontSize: 11,
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sessionId: {
    fontSize: 13,
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00D4AA",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    maxWidth: 380,
    marginTop: 8,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontSize: 14,
    color: "#00D4AA",
    fontWeight: "600",
  },
  note: {
    fontSize: 12,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 340,
    marginTop: 8,
  },
});
