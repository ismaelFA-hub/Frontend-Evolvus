/**
 * ModeSelector — Hierarquia correta de modos de trading:
 *   Spot | Margin (→ Cross / Isolated) | Futures (→ USDT-M / Coin-M / Perpétuo / Opções)
 *
 * Cross e Isolated são sub-modos de Margin.
 * Perpétuo, USDT-M, Coin-M e Opções são sub-modos de Futures.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

export type ChartMode =
  | "spot"
  | "margin_cross"
  | "margin_isolated"
  | "futures_usdtm"
  | "futures_coinm"
  | "futures_perp"
  | "futures_options";

type TopLevel = "spot" | "margin" | "futures";

interface SubMode {
  key: ChartMode;
  label: string;
  badge?: string;
}

const SUB_MODES: Record<"margin" | "futures", SubMode[]> = {
  margin: [
    { key: "margin_cross", label: "Cross" },
    { key: "margin_isolated", label: "Isolated" },
  ],
  futures: [
    { key: "futures_usdtm", label: "USDT-M" },
    { key: "futures_coinm", label: "Coin-M" },
    { key: "futures_perp", label: "Perpétuo", badge: "PERP" },
    { key: "futures_options", label: "Opções", badge: "OPT" },
  ],
};

function getTopLevel(mode: ChartMode): TopLevel {
  if (mode === "spot") return "spot";
  if (mode.startsWith("margin")) return "margin";
  return "futures";
}

interface FundingInfo {
  rate: number;
  nextFunding?: number;
  openInterest?: number;
  markPrice?: number;
  lastPrice?: number;
}

interface Props {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
  funding?: FundingInfo | null;
  liquidationPrice?: number | null;
  suggestedLeverage?: number | null;
  leverageRisk?: "low" | "medium" | "high" | null;
  leverageGuardActive?: boolean;
}

export function ModeSelector({
  mode,
  onChange,
  funding,
  liquidationPrice,
  suggestedLeverage,
  leverageRisk,
  leverageGuardActive,
}: Props) {
  const [topLevel, setTopLevel] = useState<TopLevel>(getTopLevel(mode));
  const [countdown, setCountdown] = useState<string>("");
  const guardAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setTopLevel(getTopLevel(mode));
  }, [mode]);

  // Funding countdown timer
  useEffect(() => {
    if (!funding?.nextFunding) { setCountdown(""); return; }
    const tick = () => {
      const diff = funding.nextFunding! - Date.now();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [funding?.nextFunding]);

  // Guard pulse animation
  useEffect(() => {
    if (!leverageGuardActive) { guardAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(guardAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(guardAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [leverageGuardActive]);

  const handleTopLevel = (tl: TopLevel) => {
    setTopLevel(tl);
    if (tl === "spot") {
      onChange("spot");
    } else {
      const subs = SUB_MODES[tl];
      const current = subs.find(s => s.key === mode);
      if (!current) onChange(subs[0].key);
    }
  };

  const isMargin = topLevel === "margin";
  const isFutures = topLevel === "futures";
  const isPerp = mode === "futures_perp";
  const hasLiquidation = liquidationPrice != null && topLevel !== "spot";

  const leverageColor =
    leverageRisk === "low" ? "#22c55e" :
    leverageRisk === "medium" ? "#f59e0b" :
    leverageRisk === "high" ? "#ef4444" : "#6b7280";

  return (
    <View style={styles.wrapper}>
      {/* Leverage Guard Banner */}
      {leverageGuardActive && (
        <Animated.View style={[styles.guardBanner, { opacity: guardAnim }]}>
          <Text style={styles.guardText}>⚠ LEVERAGE GUARD ATIVO — novas entradas bloqueadas</Text>
        </Animated.View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {/* Top-level mode buttons */}
        {(["spot", "margin", "futures"] as TopLevel[]).map(tl => (
          <TouchableOpacity
            key={tl}
            style={[styles.btn, topLevel === tl && styles.btnActive]}
            onPress={() => handleTopLevel(tl)}
          >
            <Text style={[styles.label, topLevel === tl && styles.labelActive]}>
              {tl === "spot" ? "Spot" : tl === "margin" ? "Margin" : "Futures"}
            </Text>
            {tl === "futures" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>F</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Sub-mode selectors */}
        {(isMargin || isFutures) && (
          <View style={styles.subDivider} />
        )}
        {(isMargin ? SUB_MODES.margin : isFutures ? SUB_MODES.futures : []).map(sub => (
          <TouchableOpacity
            key={sub.key}
            style={[styles.subBtn, mode === sub.key && styles.subBtnActive]}
            onPress={() => onChange(sub.key)}
          >
            <Text style={[styles.subLabel, mode === sub.key && styles.subLabelActive]}>
              {sub.label}
            </Text>
            {sub.badge && (
              <View style={[styles.subBadge, mode === sub.key && styles.subBadgeActive]}>
                <Text style={[styles.subBadgeText, mode === sub.key && styles.subBadgeTextActive]}>
                  {sub.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Info chips */}
        {isFutures && funding?.rate != null && (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Funding</Text>
            <Text style={[styles.chipValue, { color: funding.rate >= 0 ? "#22c55e" : "#ef4444" }]}>
              {funding.rate >= 0 ? "+" : ""}{(funding.rate * 100).toFixed(4)}%
            </Text>
            {countdown ? <Text style={styles.chipCountdown}>{countdown}</Text> : null}
          </View>
        )}

        {isFutures && funding?.openInterest != null && (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>OI</Text>
            <Text style={styles.chipValueWhite}>
              ${(funding.openInterest / 1_000_000).toFixed(1)}M
            </Text>
          </View>
        )}

        {isFutures && funding?.markPrice != null && funding?.lastPrice != null && (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Basis</Text>
            <Text style={[
              styles.chipValue,
              { color: funding.markPrice >= funding.lastPrice ? "#22c55e" : "#ef4444" }
            ]}>
              {((funding.markPrice - funding.lastPrice) / funding.lastPrice * 100).toFixed(3)}%
            </Text>
          </View>
        )}

        {hasLiquidation && (
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>Liq.</Text>
            <Text style={styles.chipValueRed}>
              ${liquidationPrice!.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </Text>
          </View>
        )}

        {suggestedLeverage != null && (
          <View style={[styles.chip, { borderColor: `${leverageColor}44` }]}>
            <Text style={styles.chipLabel}>Lev. sugerida</Text>
            <Text style={[styles.chipValue, { color: leverageColor }]}>
              {suggestedLeverage}×
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  guardBanner: {
    backgroundColor: "#ef444420",
    borderBottomWidth: 1,
    borderBottomColor: "#ef4444",
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  guardText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#1f2937",
  },
  btnActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#f59e0b18",
  },
  label: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  labelActive: {
    color: "#f59e0b",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#f59e0b",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 8,
    color: "#000",
    fontWeight: "800",
  },
  subDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#374151",
    marginHorizontal: 2,
  },
  subBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2d3748",
    backgroundColor: "#161f2e",
  },
  subBtnActive: {
    borderColor: "#06b6d4",
    backgroundColor: "#06b6d418",
  },
  subLabel: {
    fontSize: 11,
    color: "#4b5563",
    fontWeight: "500",
  },
  subLabelActive: {
    color: "#06b6d4",
    fontWeight: "700",
  },
  subBadge: {
    backgroundColor: "#374151",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  subBadgeActive: {
    backgroundColor: "#06b6d4",
  },
  subBadgeText: {
    fontSize: 7,
    color: "#9ca3af",
    fontWeight: "800",
  },
  subBadgeTextActive: {
    color: "#000",
  },
  chip: {
    marginLeft: 6,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#111827",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 1,
  },
  chipLabel: {
    fontSize: 8,
    color: "#4b5563",
  },
  chipValue: {
    fontSize: 11,
    fontWeight: "700",
  },
  chipValueWhite: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  chipValueRed: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
  },
  chipCountdown: {
    fontSize: 9,
    color: "#6b7280",
    fontFamily: Platform?.OS === "web" ? "monospace" : undefined,
  } as any,
});
