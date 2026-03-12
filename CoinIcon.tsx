/**
 * CoinIcon — Unified crypto coin icon component (Phase 4 / Sprint LIV)
 *
 * Strategy:
 *  1. Try loading a real logo from the CoinCap CDN (lazy, memory-disk cache).
 *  2. On error fall back to a branded Ionicons glyph inside a colour-tinted circle.
 *
 * Usage:
 *   <CoinIcon symbol="BTC" size={32} />
 *   <CoinIcon symbol="ETH" size={24} testID="eth-icon" />
 */

import { useState } from "react";
import { View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

// ── CDN ──────────────────────────────────────────────────────────────────────

export const COIN_CDN_BASE =
  "https://assets.coincap.io/assets/icons/";

/** Returns a remote PNG URL for the given symbol (lower-cased). */
export function coinIconUri(symbol: string): string {
  return `${COIN_CDN_BASE}${symbol.toLowerCase()}.png`;
}

// ── Fallback icon map (Ionicons glyphs + brand colours) ──────────────────────

export interface FallbackIconConfig {
  name: string;
  bg: string;
}

export const COIN_FALLBACK_ICONS: Record<string, FallbackIconConfig> = {
  BTC: { name: "logo-bitcoin", bg: "#F7931A" },
  ETH: { name: "diamond-outline", bg: "#627EEA" },
  SOL: { name: "sunny-outline", bg: "#9945FF" },
  BNB: { name: "cube-outline", bg: "#F3BA2F" },
  XRP: { name: "water-outline", bg: "#23292F" },
  ADA: { name: "layers-outline", bg: "#0033AD" },
  AVAX: { name: "triangle-outline", bg: "#E84142" },
  DOT: { name: "ellipse-outline", bg: "#E6007A" },
  LINK: { name: "link-outline", bg: "#2A5ADA" },
  MATIC: { name: "diamond-outline", bg: "#8247E5" },
  UNI: { name: "color-filter-outline", bg: "#FF007A" },
  ATOM: { name: "planet-outline", bg: "#2E3148" },
  LTC: { name: "flash-outline", bg: "#345D9D" },
  DOGE: { name: "happy-outline", bg: "#C2A633" },
  SHIB: { name: "paw-outline", bg: "#E03C31" },
};

const DEFAULT_FALLBACK: FallbackIconConfig = {
  name: "ellipse-outline",
  bg: "#888",
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CoinIconProps {
  symbol: string;
  size?: number;
  style?: ViewStyle;
  testID?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CoinIcon({ symbol, size = 32, style, testID }: CoinIconProps) {  const [imgError, setImgError] = useState(false);

  const fallback = COIN_FALLBACK_ICONS[symbol.toUpperCase()] ?? DEFAULT_FALLBACK;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (!imgError) {
    return (
      <View
        style={[containerStyle, { backgroundColor: `${fallback.bg}20` }, style]}
        testID={testID}
        accessibilityLabel={`${symbol} icon`}
      >
        <Image
          source={{ uri: coinIconUri(symbol) }}
          style={{ width: size * 0.8, height: size * 0.8 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          // lazyLoad: expo-image defers decoding until the view is near the
          // viewport, improving initial render performance.
          priority="low"
          onError={() => setImgError(true)}
          testID={testID ? `${testID}-img` : undefined}
          transition={150}
        />
      </View>
    );
  }

  // Ionicons fallback
  return (
    <View
      style={[containerStyle, { backgroundColor: `${fallback.bg}20` }, style]}
      testID={testID}
      accessibilityLabel={`${symbol} icon`}
    >
      <Ionicons
        name={fallback.name as any}
        size={size * 0.55}
        color={fallback.bg}
      />
    </View>
  );
}

export default CoinIcon;
