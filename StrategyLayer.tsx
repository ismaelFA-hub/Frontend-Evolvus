/**
 * StrategyLayer — visualizes Grid Bot levels, Martingale entry ladder,
 * and DCA average price on the chart.
 */

import React from "react";
import { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { ChartDimensions, priceToY } from "../chartUtils";

export interface GridLevel {
  price: number;
  isBuy: boolean;
  filled?: boolean;
}

export interface DCALevel {
  price: number;
  avgPrice?: number;
}

export interface MartingaleLevel {
  price: number;
  multiplier: number;
}

export interface StrategyData {
  type: "grid" | "dca" | "martingale";
  gridLevels?: GridLevel[];
  dcaLevels?: DCALevel[];
  martingaleLevels?: MartingaleLevel[];
  avgEntryPrice?: number;
}

interface Props {
  strategy: StrategyData | null;
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth?: number;
}

export function StrategyLayer({ strategy, dim, minPrice, maxPrice, volumeProfileWidth = 0 }: Props) {
  if (!strategy) return null;

  const leftX = dim.padding.left;
  const rightX = dim.width - dim.padding.right - volumeProfileWidth;
  const elements: React.ReactNode[] = [];

  if (strategy.type === "grid" && strategy.gridLevels) {
    for (const [i, lvl] of strategy.gridLevels.entries()) {
      const y = priceToY(lvl.price, minPrice, maxPrice, dim);
      if (y < dim.padding.top || y > dim.padding.top + dim.candleAreaHeight) continue;
      const color = lvl.isBuy ? "#22c55e" : "#ef4444";
      elements.push(
        <G key={`grid-${i}`}>
          <Line
            x1={leftX} y1={y} x2={rightX} y2={y}
            stroke={color}
            strokeWidth={lvl.filled ? 1.5 : 0.8}
            strokeDasharray={lvl.filled ? undefined : "4,3"}
            opacity={0.7}
          />
          <SvgText x={rightX + 2} y={y + 3} fontSize={7} fill={color} opacity={0.8}>
            {lvl.isBuy ? "B" : "S"}
          </SvgText>
        </G>
      );
    }
  }

  if (strategy.type === "martingale" && strategy.martingaleLevels) {
    for (const [i, lvl] of strategy.martingaleLevels.entries()) {
      const y = priceToY(lvl.price, minPrice, maxPrice, dim);
      if (y < dim.padding.top || y > dim.padding.top + dim.candleAreaHeight) continue;
      elements.push(
        <G key={`mart-${i}`}>
          <Line
            x1={leftX} y1={y} x2={rightX} y2={y}
            stroke="#f59e0b"
            strokeWidth={0.8}
            strokeDasharray="3,3"
            opacity={0.7}
          />
          <Rect x={leftX} y={y - 5} width={24} height={10} fill="#f59e0b" opacity={0.15} rx={2} />
          <SvgText x={leftX + 3} y={y + 3} fontSize={7} fill="#f59e0b" fontWeight="bold">
            ×{lvl.multiplier}
          </SvgText>
        </G>
      );
    }
  }

  if (strategy.type === "dca" && strategy.dcaLevels) {
    for (const [i, lvl] of strategy.dcaLevels.entries()) {
      const y = priceToY(lvl.price, minPrice, maxPrice, dim);
      if (y < dim.padding.top || y > dim.padding.top + dim.candleAreaHeight) continue;
      elements.push(
        <Line
          key={`dca-${i}`}
          x1={leftX} y1={y} x2={rightX} y2={y}
          stroke="#818cf8"
          strokeWidth={0.8}
          strokeDasharray="5,3"
          opacity={0.6}
        />
      );
    }
    if (strategy.avgEntryPrice !== undefined) {
      const avgY = priceToY(strategy.avgEntryPrice, minPrice, maxPrice, dim);
      if (avgY >= dim.padding.top && avgY <= dim.padding.top + dim.candleAreaHeight) {
        elements.push(
          <G key="dca-avg">
            <Line
              x1={leftX} y1={avgY} x2={rightX} y2={avgY}
              stroke="#818cf8"
              strokeWidth={1.5}
              opacity={0.9}
            />
            <SvgText x={leftX + 4} y={avgY - 3} fontSize={8} fill="#818cf8" fontWeight="bold">
              AVG
            </SvgText>
          </G>
        );
      }
    }
  }

  return <G>{elements}</G>;
}
