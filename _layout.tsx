import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, Suspense, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeKeyboardProvider as KeyboardProvider } from "@/lib/safe-keyboard-provider";
import { StatusBar } from "expo-status-bar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScreenFallback } from "@/components/ScreenFallback";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { I18nProvider } from "@/lib/i18n-context";
import { LiteProProvider } from "@/lib/lite-pro-context";
import { UserLevelProvider } from "@/lib/user-level-context";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import analytics from "@/lib/analytics";
import { useWsNotifications } from "@/lib/use-ws-notifications";
import { View, Text, Animated, StyleSheet, Dimensions } from "react-native";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

/** Global Toast Notification System */
function GlobalToast() {
  const { lastEvent } = useWsNotifications();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (!lastEvent) return;

    let msg = "";
    if (lastEvent.type === "trade_executed") {
      const { symbol, outcome, pnl } = lastEvent.data;
      msg = `Trade executado: ${symbol} ${outcome} PnL: ${pnl}`;
    } else if (lastEvent.type === "alert_triggered") {
      msg = `Alerta disparado: ${lastEvent.data.message}`;
    } else if (lastEvent.type === "bot_status_change") {
      msg = `Bot ${lastEvent.data.name}: ${lastEvent.data.status}`;
    } else if (lastEvent.type === "black_swan_alert") {
      msg = `🦢 Cisne Negro [${lastEvent.data.severity?.toUpperCase()}]: ${lastEvent.data.message}`;
    } else if (lastEvent.type === "emergency_breaker") {
      msg = `🚨 Circuit Breaker ativado! ${lastEvent.data.botsAffected ?? 0} bots pausados.`;
    }

    if (msg) {
      setMessage(msg);
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
        });
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [lastEvent]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.toast}>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  toast: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  toastText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

/** Track screen views for analytics whenever the active route changes. */
function ScreenTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) analytics.screen(pathname);
  }, [pathname]);
  return null;
}

function RootLayoutNav() {
  return (
    <>
      <ScreenTracker />
      <GlobalToast />
      {/* Suspense boundary: shown while lazily-loaded route modules are being parsed.
          Secondary screens (admin, AI tools, advanced settings) are loaded on demand
          by Expo Router's file-based lazy loading — this fallback prevents a blank
          flash during those transitions. */}
      <Suspense fallback={<ScreenFallback />}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="splash-intro" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="(auth)" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="verify-email" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="asset/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="copy-trading"    options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="monte-carlo"     options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="payment"         options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="trade-history" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="wallet" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="staking" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="news" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="scanner" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="p2p" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="strategy-builder"    options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="risk-mode-selector"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="strategy-generator"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="advanced-orders"     options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="risk-manager"        options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="multi-exchange"      options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="portfolio-analytics" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="smart-alerts"        options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="sentiment"           options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="on-chain"            options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="calendar"            options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="heatmap"             options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="funding-rates"       options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="api-health"          options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="billing"             options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="performance-proof"   options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="execution-monitor"   options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="api-key-manager"     options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="trade-journal"       options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="bot/[id]"           options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="notifications-center" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="security-center"      options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="support-chat"         options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="hive-mind"            options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="digital-twin"         options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="governance"           options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="hormones"             options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="admin-dashboard"      options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="admin/logs"           options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="security"             options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="admin/data-health"    options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="grid-trading"         options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="arbitrage"            options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="genetic-lab"          options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="brain-weights"        options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="ai-regime"            options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="ai-explain"           options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="paper-trading"        options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="market-analysis"      options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="dev-console"          options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="partners"             options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="daily-goal"           options={{ headerShown: false, animation: "slide_from_right" }} />
          {/* DAO e Endocrine — Premium/Enterprise */}
          <Stack.Screen name="dao"              options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="endocrine"        options={{ headerShown: false, animation: "slide_from_right" }} />
          {/* Futuristic Modules — Premium/Enterprise */}
          <Stack.Screen name="futuristic/scenario-simulator" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="futuristic/black-swan"          options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="futuristic/orchestrator"        options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="futuristic/adaptive-leverage"   options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="futuristic/dex-fallback"        options={{ headerShown: false, animation: "slide_from_right" }} />
        </Stack>
      </Suspense>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Initialize analytics and track session start
      analytics.init().then(() => {
        analytics.track('session_start', { platform: 'mobile' });
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0A0E1A' }} />;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <I18nProvider>
              <LiteProProvider>
              <UserLevelProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="light" />
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
              </UserLevelProvider>
              </LiteProProvider>
            </I18nProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
