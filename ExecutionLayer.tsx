/**
 * ExecutionLayer — renders entry/exit trade markers as triangles on the chart.
 * Entry = upward triangle below the candle low (green for long, red for short).
 * Exit = downward triangle above the candle high.
 */

import React from "react";
import { G, Polygon, Circle, Text as SvgText } from "react-native-svg";
import { Candle, ChartDimensions, priceToY, indexToX } from "../chartUtils";

export interface Execution {
  id: string;
  direction: "long" | "short" | "buy" | "sell";
  entryPrice: number;
  exitPrice: number;
  sizeUSDT: number;
  pnl: number;
  pnlPercent: number;
  outcome: string;
  closeReason: string;
  openedAt: string;
  closedAt: string;
  botId?: string | null;
}

interface Props {
  executions: Execution[];
  candles: Candle[];
  visibleStart: number;
  visibleCount: number;
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth?: number;
  onPress?: (exec: Execution) => void;
}

const SIZE = 7;

export function ExecutionLayer({
  executions,
  candles,
  visibleStart,
  visibleCount,
  dim,
  minPrice,
  maxPrice,
  volumeProfileWidth = 0,
  onPress,
}: Props) {
  const markers: React.ReactNode[] = [];

  for (const exec of executions) {
    const isLong = exec.direction === "long" || exec.direction === "buy";
    const entryTime = new Date(exec.openedAt).getTime();
    const exitTime = new Date(exec.closedAt).getTime();
    const won = exec.pnl >= 0;

    for (const [ts, price, isEntry] of [
      [entryTime, exec.entryPrice, true] as const,
      [exitTime, exec.exitPrice, false] as const,
    ]) {
      const candleIdx = candles.findIndex(c => c.time >= ts);
      if (candleIdx < 0) continue;
      const localIdx = candleIdx - visibleStart;
      if (localIdx < 0 || localIdx >= visibleCount) continue;

      const x = indexToX(localIdx, visibleCount, dim, volumeProfileWidth);
      const y = priceToY(price, minPrice, maxPrice, dim);
      const candle = candles[candleIdx];
      const color = isEntry ? (isLong ? "#22c55e" : "#ef4444") : (won ? "#22c55e" : "#ef4444");

      if (isEntry) {
        const tipY = priceToY(candle.low, minPrice, maxPrice, dim) + SIZE + 4;
        markers.push(
          <G key={`entry-${exec.id}`} onPress={() => onPress?.(exec)}>
            <Polygon
              points={`${x},${tipY} ${x - SIZE},${tipY + SIZE * 1.5} ${x + SIZE},${tipY + SIZE * 1.5}`}
              fill={color}
              opacity={0.9}
            />
          </G>
        );
      } else {
        const tipY = priceToY(candle.high, minPrice, maxPrice, dim) - SIZE - 4;
        markers.push(
          <G key={`exit-${exec.id}`} onPress={() => onPress?.(exec)}>
            <Polygon
              points={`${x},${tipY} ${x - SIZE},${tipY - SIZE * 1.5} ${x + SIZE},${tipY - SIZE * 1.5}`}
              fill={color}
              opacity={0.9}
            />
            <SvgText
              x={x}
              y={tipY - SIZE * 1.5 - 4}
              fontSize={8}
              textAnchor="middle"
              fill={color}
              fontWeight="bold"
            >
              {exec.pnl >= 0 ? "+" : ""}{exec.pnlPercent.toFixed(1)}%
            </SvgText>
          </G>
        );
      }
    }
  }

  return <G>{markers}</G>;
}
