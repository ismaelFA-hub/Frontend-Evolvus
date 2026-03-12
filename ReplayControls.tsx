/**
 * ReplayControls — time-travel replay mode for the chart.
 * Shows a slider + play/pause/speed controls below the chart.
 * Parent passes total candle count; component calls back with current replay index.
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.dark;

const SPEEDS = [0.5, 1, 2, 4];

interface Props {
  totalCandles: number;
  replayIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function ReplayControls({ totalCandles, replayIndex, onIndexChange, onClose }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        onIndexChange(prev => {
          const next = prev + 1;
          if (next >= totalCandles) {
            setPlaying(false);
            return totalCandles;
          }
          return next;
        });
      }, 600 / SPEEDS[speedIdx]);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speedIdx, totalCandles]);

  const progressPct = totalCandles > 0 ? (replayIndex / totalCandles) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⏪ Replay Mode</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeBtn}>✕ Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.indexLabel}>{replayIndex}/{totalCandles}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progressPct}%` }]} />
          <TouchableOpacity
            style={styles.trackFull}
            onPress={(e) => {
              const ratio = e.nativeEvent.locationX / 300;
              onIndexChange(Math.round(ratio * totalCandles));
            }}
          />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={() => onIndexChange(Math.max(10, replayIndex - 10))}>
          <Text style={styles.btnText}>⏮ -10</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.playBtn]} onPress={() => setPlaying(p => !p)}>
          <Text style={styles.playText}>{playing ? "⏸" : "▶"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onIndexChange(Math.min(totalCandles, replayIndex + 10))}>
          <Text style={styles.btnText}>+10 ⏭</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.speedBtn}
          onPress={() => setSpeedIdx(i => (i + 1) % SPEEDS.length)}
        >
          <Text style={styles.speedText}>{SPEEDS[speedIdx]}×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1f2937",
    borderTopWidth: 1,
    borderTopColor: "#374151",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    color: "#6b7280",
    fontSize: 12,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  indexLabel: {
    color: "#6b7280",
    fontSize: 10,
    width: 60,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    overflow: "hidden",
    position: "relative",
  },
  fill: {
    height: 6,
    backgroundColor: "#f59e0b",
    borderRadius: 3,
  },
  trackFull: {
    ...StyleSheet.absoluteFillObject,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#374151",
    borderRadius: 6,
  },
  btnText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  playBtn: {
    backgroundColor: "#f59e0b22",
    paddingHorizontal: 18,
  },
  playText: {
    fontSize: 16,
    color: "#f59e0b",
  },
  speedBtn: {
    marginLeft: "auto" as any,
    backgroundColor: "#374151",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  speedText: {
    color: "#a78bfa",
    fontSize: 12,
    fontWeight: "700",
  },
});
