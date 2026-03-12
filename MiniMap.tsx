/**
 * MiniMap — Compact full-history chart strip with drag-and-drop window selector.
 * Shows the entire candle history in ~60px height with a draggable selection window.
 */
import React, { useRef, useCallback } from "react";
import { View, StyleSheet, PanResponder } from "react-native";
import { Svg, Rect, G, Line } from "react-native-svg";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MiniMapProps {
  candles: Candle[];
  visibleStart: number;
  visibleCount: number;
  onWindowChange: (start: number) => void;
  width: number;
}

const HEIGHT = 52;
const WINDOW_MIN_ALPHA = 0.12;

export function MiniMap({ candles, visibleStart, visibleCount, onWindowChange, width }: MiniMapProps) {
  if (!candles.length || width < 10) return null;

  const total = candles.length;
  const slotW = width / total;

  const minP = Math.min(...candles.map(c => c.low));
  const maxP = Math.max(...candles.map(c => c.high));
  const range = maxP - minP || 1;

  const toY = (p: number) => HEIGHT - ((p - minP) / range) * HEIGHT * 0.9 - 2;
  const lastDragX = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gs) => { lastDragX.current = gs.x0; },
      onPanResponderMove: (_, gs) => {
        const delta = Math.round((gs.moveX - lastDragX.current) / slotW);
        if (delta === 0) return;
        lastDragX.current = gs.moveX;
        const next = Math.max(0, Math.min(total - visibleCount, visibleStart + delta));
        onWindowChange(next);
      },
    })
  ).current;

  const windowX = visibleStart * slotW;
  const windowW = Math.min(visibleCount * slotW, width - windowX);

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      <Svg width={width} height={HEIGHT}>
        <Rect x={0} y={0} width={width} height={HEIGHT} fill="#0f172a" />

        {candles.map((c, i) => {
          const x = i * slotW + slotW / 2;
          const isBull = c.close >= c.open;
          const highY = toY(c.high);
          const lowY = toY(c.low);
          const bodyTop = toY(Math.max(c.open, c.close));
          const bodyH = Math.max(1, toY(Math.min(c.open, c.close)) - bodyTop);
          const cw = Math.max(0.8, slotW * 0.7);
          const color = isBull ? "#22c55e" : "#ef4444";
          return (
            <G key={i}>
              <Line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth={0.5} opacity={0.6} />
              <Rect x={x - cw / 2} y={bodyTop} width={cw} height={bodyH} fill={color} opacity={0.6} />
            </G>
          );
        })}

        <Rect
          x={windowX}
          y={0}
          width={windowW}
          height={HEIGHT}
          fill="#60a5fa"
          opacity={WINDOW_MIN_ALPHA}
        />
        <Rect
          x={windowX}
          y={0}
          width={1.5}
          height={HEIGHT}
          fill="#60a5fa"
          opacity={0.6}
        />
        <Rect
          x={windowX + windowW - 1.5}
          y={0}
          width={1.5}
          height={HEIGHT}
          fill="#60a5fa"
          opacity={0.6}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    height: HEIGHT,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
  },
});
