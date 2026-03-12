/**
 * InstallPrompt — PWA install banner (Phase 5 / Sprint LV)
 *
 * Web-only component. Listens for the browser's `beforeinstallprompt` event
 * and shows a styled install banner at the bottom of the screen.
 *
 * On native (iOS/Android), returns null — installation is handled by the
 * respective app stores.
 *
 * Usage:
 *   Place inside the root layout (app/_layout.tsx) so it is available on
 *   every screen:
 *
 *   import InstallPrompt from '@/components/InstallPrompt';
 *   ...
 *   <InstallPrompt />
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Animated } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

// The browser fires this event when the PWA is installable.
// It is a web-only event; on native it never fires.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Key used to remember if the user dismissed the banner permanently
const INSTALL_DISMISSED_KEY = "evolvus_install_dismissed";

export interface InstallPromptProps {
  /** Pass a custom label for the install button (for i18n). Default: "Instalar app" */
  installLabel?: string;
  /** Pass a custom label for the dismiss button. Default: "Agora não" */
  dismissLabel?: string;
  /** Pass a custom prompt text. Default: "Instale o Evolvus para acesso rápido e uso offline." */
  promptText?: string;
  testID?: string;
}

export function InstallPrompt({
  installLabel = "Instalar app",
  dismissLabel = "Agora não",
  promptText = "Instale o Evolvus para acesso rápido e uso offline.",
  testID,
}: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  // useRef keeps the Animated.Value stable across renders without re-creating it
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    // Only relevant on web
    if (Platform.OS !== "web") return;

    // Don't show again if permanently dismissed
    try {
      if (typeof window !== "undefined" && localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
    } catch {
      // localStorage unavailable (e.g. private mode) — show the prompt anyway
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    };

    // Also register the service worker when the component mounts
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          if (__DEV__) console.warn("[InstallPrompt] SW registration failed:", err);
        });
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
      }
    } catch {
      // ignore
    }
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  if (!visible) return null;
  // Extra safety: never render on native
  if (Platform.OS !== "web") return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      testID={testID}
      accessibilityRole="banner"
      accessibilityLabel="Install Evolvus app"
    >
      <View style={styles.inner}>
        <Text style={styles.promptText}>{promptText}</Text>
        <View style={styles.buttons}>
          <Pressable
            style={styles.dismissButton}
            onPress={handleDismiss}
            testID={testID ? `${testID}-dismiss` : "install-prompt-dismiss"}
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
          >
            <Text style={styles.dismissText}>{dismissLabel}</Text>
          </Pressable>
          <Pressable
            style={styles.installButton}
            onPress={handleInstall}
            testID={testID ? `${testID}-install` : "install-prompt-install"}
            accessibilityRole="button"
            accessibilityLabel={installLabel}
          >
            <Text style={styles.installText}>{installLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default InstallPrompt;

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  inner: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 28,
  },
  promptText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  dismissText: {
    color: C.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  installButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#00C6FF",
  },
  installText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
});
