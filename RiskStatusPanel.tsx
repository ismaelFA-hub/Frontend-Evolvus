/**
 * RiskStatusPanel — Painel compacto do Sistema Endócrino + Risk Guard + VaR.
 * Suporta dois modos:
 *   - compact: renderiza apenas um dot colorido + label para usar no header
 *   - full (padrão): renderiza o painel expandível completo
 */
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const C = Colors.dark;

interface RiskStatus {
  dopamine: number;
  cortisol: number;
  hormoneStatus: string;
  circuitBreakerActive: boolean;
  circuitBreakerReason: string | null;
  varDay: number;
  drawdownDay: number;
  drawdownLimit: number;
  riskMode: string;
}

interface Props {
  visible?: boolean;
  compact?: boolean;
  onDotPress?: () => void;
}

export function RiskStatusPanel({ visible = true, compact = false, onDotPress }: Props) {
  const [status, setStatus] = useState<RiskStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const bannerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchStatus = async () => {
    try {
      const res = await apiRequest("GET", "/api/risk/status");
      const data = await res.json();
      setStatus(data);
    } catch {
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status?.circuitBreakerActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bannerAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(bannerAnim, { toValue: 0.3, duration: 600, useNativeDriver: false }),
        ])
      );
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 500, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
        ])
      );
      loop.start();
      pulse.start();
      return () => { loop.stop(); pulse.stop(); };
    } else {
      bannerAnim.setValue(1);
      pulseAnim.setValue(1);
    }
  }, [status?.circuitBreakerActive]);

  const getDotColor = () => {
    if (!status) return "#374151";
    if (status.circuitBreakerActive) return "#ef4444";
    if (status.cortisol > 70) return "#f59e0b";
    return "#22c55e";
  };

  if (compact) {
    const dotColor = getDotColor();
    return (
      <TouchableOpacity style={styles.dotWrapper} onPress={onDotPress} activeOpacity={0.7}>
        <View style={[styles.dotIndicator, { backgroundColor: dotColor }]} />
        <Text style={[styles.dotLabel, { color: dotColor }]}>RISK</Text>
      </TouchableOpacity>
    );
  }

  if (!visible || !status) return null;

  const drawdownPct = Math.min(1, status.drawdownLimit > 0 ? status.drawdownDay / status.drawdownLimit : 0);
  const drawdownColor = drawdownPct > 0.8 ? "#ef4444" : drawdownPct > 0.5 ? "#f59e0b" : "#22c55e";
  const cortisolColor = status.cortisol > 70 ? "#ef4444" : status.cortisol > 40 ? "#f59e0b" : "#22c55e";
  const dopamineColor = status.dopamine > 70 ? "#a78bfa" : status.dopamine > 40 ? "#60a5fa" : "#94a3b8";

  return (
    <View>
      {status.circuitBreakerActive && (
        <Animated.View style={[styles.circuitBanner, { opacity: bannerAnim }]}>
          <Ionicons name="warning-outline" size={13} color="#f59e0b" />
          <Text style={styles.circuitBannerText}>
            Risk Guard ativo — novas entradas bloqueadas
            {status.circuitBreakerReason ? `: ${status.circuitBreakerReason}` : ""}
          </Text>
        </Animated.View>
      )}

      <TouchableOpacity
        style={styles.container}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
      >
        <View style={styles.row}>
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: dopamineColor }]} />
            <Text style={[styles.chipLabel, { color: dopamineColor }]}>
              DOP {status.dopamine}
            </Text>
          </View>
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: cortisolColor }]} />
            <Text style={[styles.chipLabel, { color: cortisolColor }]}>
              COR {status.cortisol}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: status.circuitBreakerActive ? "#ef444422" : "#22c55e11" }]}>
            <Ionicons
              name={status.circuitBreakerActive ? "ban-outline" : "shield-checkmark-outline"}
              size={11}
              color={status.circuitBreakerActive ? "#ef4444" : "#22c55e"}
            />
            <Text style={[styles.chipLabel, { color: status.circuitBreakerActive ? "#ef4444" : "#22c55e" }]}>
              {status.circuitBreakerActive ? "CB ATIVO" : "CB OK"}
            </Text>
          </View>
          <Text style={styles.varText}>VaR {status.varDay.toFixed(2)}%</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={13}
            color="#6b7280"
            style={styles.chevron}
          />
        </View>

        {expanded && (
          <View style={styles.expanded}>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Drawdown {status.drawdownDay.toFixed(2)}% / {status.drawdownLimit}%</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${drawdownPct * 100}%` as any, backgroundColor: drawdownColor }]} />
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Modo: {status.riskMode}</Text>
              <Text style={styles.metaText}>Status hormonal: {status.hormoneStatus}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  dotWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#ffffff08",
  },
  dotIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  circuitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#78350f33",
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  circuitBannerText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  container: {
    backgroundColor: "#0d0f14",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff0a",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff08",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  varText: {
    color: "#94a3b8",
    fontSize: 10,
    marginLeft: 2,
  },
  chevron: {
    marginLeft: "auto",
  },
  expanded: {
    marginTop: 8,
    gap: 6,
  },
  barRow: {
    gap: 4,
  },
  barLabel: {
    color: "#94a3b8",
    fontSize: 10,
  },
  barTrack: {
    height: 4,
    backgroundColor: "#ffffff0a",
    borderRadius: 2,
    overflow: "hidden",
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaText: {
    color: "#6b7280",
    fontSize: 10,
  },
});
