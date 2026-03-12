/**
 * CryptoHistoryBar — horizontal scrollable row of recently viewed crypto pills.
 *
 * Shown in the Markets screen when the search input is empty.
 * Tapping a pill fills the search field with that symbol so the user can
 * quickly jump back to a previously viewed asset.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  clearCryptoHistory,
  getCryptoHistory,
  type HistoryEntry,
} from "@/lib/cryptoHistory";

const C = Colors.dark;

/** All values in CRYPTO_ACCENT are #RRGGBB hex — the alpha suffix pattern (e.g. '40') is safe. */
const CRYPTO_ACCENT: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  BNB: "#F3BA2F",
  XRP: "#23292F",
  ADA: "#0033AD",
  AVAX: "#E84142",
  DOT: "#E6007A",
  LINK: "#2A5ADA",
  MATIC: "#8247E5",
  UNI: "#FF007A",
  ATOM: "#2E3148",
};

function accent(symbol: string) {
  return CRYPTO_ACCENT[symbol] ?? "#8A94A6";
}

type Props = {
  /** Called when the user taps a history pill — parent should set its search text */
  onSelect: (symbol: string) => void;
};

export function CryptoHistoryBar({ onSelect }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const appState = useRef(AppState.currentState);

  const load = useCallback(async () => {
    const entries = await getCryptoHistory();
    setHistory(entries);
  }, []);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  // Reload when app comes back to foreground (e.g. after navigating away)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        load();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [load]);

  const handleClear = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await clearCryptoHistory();
    setHistory([]);
  }, []);

  if (!history.length) return null;

  return (
    <View style={styles.wrapper} testID="crypto-history-bar">
      <View style={styles.headerRow}>
        <Text style={styles.label}>Recentes</Text>
        <Pressable
          onPress={handleClear}
          style={styles.clearBtn}
          testID="crypto-history-clear-btn"
          accessibilityRole="button"
          accessibilityLabel="Limpar histórico"
        >
          <Ionicons name="trash-outline" size={13} color={C.textTertiary} />
          <Text style={styles.clearText}>Limpar</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {history.map((entry) => {
          const color = accent(entry.symbol);
          return (
            <Pressable
              key={entry.symbol}
              style={[styles.pill, { borderColor: `${color}40`, backgroundColor: `${color}18` }]}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(entry.symbol);
              }}
              testID={`history-pill-${entry.symbol}`}
              accessibilityRole="button"
              accessibilityLabel={`Ver ${entry.name}`}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.pillText, { color }]}>{entry.symbol}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 6,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.textTertiary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  clearText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textTertiary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});

export default CryptoHistoryBar;
