/**
 * ActiveBotLayer — renders active bot strategy overlays on the chart.
 *
 * Grid:       horizontal price level lines + filled badge
 * DCA:        circle markers at entry prices + average price line
 * Martingale: escalating order ladder (width ∝ size)
 */
import React from "react";
import { G, Line, Rect, Circle, Text as SvgText, Path } from "react-native-svg";
import { ChartDimensions, priceToY, fmtPrice } from "../chartUtils";

export interface BotVisualization {
  type: "grid" | "dca" | "martingale" | string;
  levels?: { price: number; filled: boolean; fillPct: number }[];
  entries?: { price: number; triggered: boolean; size: number }[];
  avgPrice?: number;
  ladder?: { price: number; size: number; triggered: boolean }[];
}

export interface ActiveBot {
  id: string;
  type: string;
  symbol: string;
  pnl?: number;
  pnlPercent?: number;
  visualization: BotVisualization;
}

interface Props {
  bots: ActiveBot[];
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth: number;
}

export function ActiveBotLayer({ bots, dim, minPrice, maxPrice, volumeProfileWidth }: Props) {
  if (!bots.length || !dim) return null;
  const leftX = dim.padding.left;
  const rightX = dim.width - dim.padding.right - volumeProfileWidth;

  const inRange = (price: number) => price >= minPrice && price <= maxPrice;

  return (
    <G>
      {bots.map(bot => {
        const viz = bot.visualization;

        if (viz.type === "grid" && viz.levels) {
          return (
            <G key={bot.id}>
              {viz.levels.map((level, i) => {
                if (!inRange(level.price)) return null;
                const y = priceToY(level.price, minPrice, maxPrice, dim);
                const color = level.filled ? "#22c55e" : "#6b7280";
                return (
                  <G key={i}>
                    <Line
                      x1={leftX}
                      y1={y}
                      x2={rightX}
                      y2={y}
                      stroke={color}
                      strokeWidth={0.6}
                      strokeDasharray={level.filled ? "none" : "4,3"}
                      opacity={0.55}
                    />
                    {i % 3 === 0 && (
                      <>
                        <Rect
                          x={leftX + 2}
                          y={y - 6}
                          width={28}
                          height={11}
                          fill={color + "33"}
                          rx={2}
                        />
                        <SvgText x={leftX + 16} y={y + 3} fontSize={7} fill={color} textAnchor="middle">
                          {level.fillPct.toFixed(0)}%
                        </SvgText>
                      </>
                    )}
                  </G>
                );
              })}
            </G>
          );
        }

        if (viz.type === "dca" && viz.entries) {
          const avgY = viz.avgPrice && inRange(viz.avgPrice)
            ? priceToY(viz.avgPrice, minPrice, maxPrice, dim)
            : null;

          return (
            <G key={bot.id}>
              {avgY !== null && (
                <Line
                  x1={leftX}
                  y1={avgY}
                  x2={rightX}
                  y2={avgY}
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  opacity={0.7}
                />
              )}
              {avgY !== null && (
                <>
                  <Rect
                    x={leftX + 2}
                    y={avgY - 8}
                    width={36}
                    height={14}
                    fill="#f59e0b22"
                    rx={3}
                  />
                  <SvgText x={leftX + 20} y={avgY + 3} fontSize={7.5} fill="#f59e0b" textAnchor="middle">
                    Avg DCA
                  </SvgText>
                </>
              )}
              {viz.entries.map((entry, i) => {
                if (!inRange(entry.price)) return null;
                const y = priceToY(entry.price, minPrice, maxPrice, dim);
                const color = entry.triggered ? "#22c55e" : "#94a3b8";
                return (
                  <Circle
                    key={i}
                    cx={leftX + 10}
                    cy={y}
                    r={4}
                    fill={color}
                    opacity={0.75}
                  />
                );
              })}
            </G>
          );
        }

        if (viz.type === "martingale" && viz.ladder) {
          const maxSize = Math.max(...viz.ladder.map(l => l.size), 1);
          return (
            <G key={bot.id}>
              {viz.ladder.map((rung, i) => {
                if (!inRange(rung.price)) return null;
                const y = priceToY(rung.price, minPrice, maxPrice, dim);
                const w = Math.max(12, (rung.size / maxSize) * 60);
                const color = rung.triggered ? "#f97316" : "#64748b";
                return (
                  <G key={i}>
                    <Rect
                      x={leftX + 2}
                      y={y - 5}
                      width={w}
                      height={9}
                      fill={color}
                      opacity={0.5}
                      rx={2}
                    />
                    <SvgText x={leftX + w / 2 + 2} y={y + 3} fontSize={7} fill="#fff" textAnchor="middle">
                      {rung.size >= 1000 ? `${(rung.size / 1000).toFixed(0)}K` : rung.size.toFixed(0)}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          );
        }

        return null;
      })}
    </G>
  );
}
