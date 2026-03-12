/**
 * RegimeLayer — colors candle area with tint based on market regime,
 * and draws transition arrows at regime change points.
 */

import React from "react";
import { G, Rect, Polygon, Text as SvgText } from "react-native-svg";
import { Candle, ChartDimensions, indexToX } from "../chartUtils";

export type Regime = "bull" | "bear" | "neutral" | "volatile";

export interface RegimeData {
  candleIndex: number;
  regime: Regime;
}

interface Props {
  regimes: RegimeData[];
  candles: Candle[];
  visibleStart: number;
  visibleCount: number;
  dim: ChartDimensions;
  volumeProfileWidth?: number;
}

const REGIME_COLORS: Record<Regime, string> = {
  bull: "#22c55e",
  bear: "#ef4444",
  neutral: "#6b7280",
  volatile: "#f59e0b",
};

export function RegimeLayer({
  regimes,
  candles,
  visibleStart,
  visibleCount,
  dim,
  volumeProfileWidth = 0,
}: Props) {
  if (!regimes.length || !candles.length) return null;

  const slotWidth = (dim.width - dim.padding.left - dim.padding.right - volumeProfileWidth) / Math.max(visibleCount, 1);
  const areaTop = dim.padding.top;
  const areaH = dim.candleAreaHeight;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < visibleCount; i++) {
    const globalIdx = visibleStart + i;
    const regEntry = regimes[globalIdx];
    if (!regEntry) continue;
    const x = dim.padding.left + i * slotWidth;
    const color = REGIME_COLORS[regEntry.regime];
    elements.push(
      <Rect
        key={`regime-${i}`}
        x={x}
        y={areaTop}
        width={slotWidth}
        height={areaH}
        fill={color}
        opacity={0.06}
      />
    );

    const prevEntry = globalIdx > 0 ? regimes[globalIdx - 1] : null;
    if (prevEntry && prevEntry.regime !== regEntry.regime) {
      const cx = x + slotWidth / 2;
      const cy = areaTop + 14;
      const isBullish = regEntry.regime === "bull";
      const arrowColor = color;
      if (isBullish) {
        elements.push(
          <G key={`regime-arrow-${i}`}>
            <Polygon
              points={`${cx},${cy - 6} ${cx - 5},${cy + 4} ${cx + 5},${cy + 4}`}
              fill={arrowColor}
              opacity={0.85}
            />
          </G>
        );
      } else {
        elements.push(
          <G key={`regime-arrow-${i}`}>
            <Polygon
              points={`${cx},${cy + 6} ${cx - 5},${cy - 4} ${cx + 5},${cy - 4}`}
              fill={arrowColor}
              opacity={0.85}
            />
          </G>
        );
      }
    }
  }

  return <G>{elements}</G>;
}

/**
 * Convert EcosystemPanel regime string into RegimeData array.
 * Since we don't have per-candle regime, we fill all visible candles
 * with the current regime.
 */
export function buildRegimeData(candles: Candle[], currentRegime: string): RegimeData[] {
  const regime = (["bull", "bear", "neutral", "volatile"].includes(currentRegime)
    ? currentRegime
    : "neutral") as Regime;
  return candles.map((_, i) => ({ candleIndex: i, regime }));
}
