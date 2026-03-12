/**
 * MultiAssetOverlay — draws a normalized BTC reference line behind the candles.
 * Prices are normalized to the same starting point as the visible asset to
 * allow relative performance comparison.
 */

import React from "react";
import { G, Path, Text as SvgText, Rect } from "react-native-svg";
import { Candle, ChartDimensions, buildLinePath, priceToY, getPriceRange } from "../chartUtils";

interface Props {
  overlayCandles: Candle[];
  mainCandles: Candle[];
  visibleStart: number;
  visibleCount: number;
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth?: number;
  label?: string;
}

export function MultiAssetOverlay({
  overlayCandles,
  mainCandles,
  visibleStart,
  visibleCount,
  dim,
  minPrice,
  maxPrice,
  volumeProfileWidth = 0,
  label = "BTC",
}: Props) {
  if (!overlayCandles.length || !mainCandles.length) return null;

  const mainVisible = mainCandles.slice(visibleStart, visibleStart + visibleCount);
  if (!mainVisible.length) return null;

  const mainFirstClose = mainVisible[0].close;
  const mainLastClose = mainVisible[mainVisible.length - 1].close;

  const overlayVisible = overlayCandles.slice(
    Math.max(0, overlayCandles.length - visibleCount),
    overlayCandles.length,
  ).slice(0, visibleCount);

  if (!overlayVisible.length) return null;

  const overlayFirstClose = overlayVisible[0].close;

  const normalizedValues: (number | null)[] = mainVisible.map((mc, i) => {
    const oc = overlayVisible[i];
    if (!oc) return null;
    const overlayReturn = (oc.close - overlayFirstClose) / overlayFirstClose;
    return mainFirstClose * (1 + overlayReturn);
  });

  const path = buildLinePath(
    normalizedValues,
    0,
    visibleCount,
    dim,
    (v) => priceToY(v, minPrice, maxPrice, dim),
    volumeProfileWidth,
  );

  if (!path) return null;

  const labelX = dim.width - dim.padding.right - volumeProfileWidth - 4;
  const lastVal = normalizedValues.filter((v): v is number => v !== null).pop();
  const labelY = lastVal ? priceToY(lastVal, minPrice, maxPrice, dim) : dim.padding.top + 20;

  const overlayReturn = ((overlayVisible[overlayVisible.length - 1]?.close ?? overlayFirstClose) - overlayFirstClose) / overlayFirstClose * 100;

  return (
    <G>
      <Path
        d={path}
        stroke="#60a5fa"
        strokeWidth={1.2}
        strokeDasharray="6,3"
        fill="none"
        opacity={0.7}
      />
      <Rect x={labelX - 26} y={labelY - 8} width={30} height={10} fill="#60a5fa" opacity={0.2} rx={3} />
      <SvgText x={labelX - 12} y={labelY + 0} fontSize={8} fill="#60a5fa" textAnchor="middle" fontWeight="bold">
        {label}
      </SvgText>
      <SvgText x={labelX - 12} y={labelY + 10} fontSize={7} fill={overlayReturn >= 0 ? "#22c55e" : "#ef4444"} textAnchor="middle">
        {overlayReturn >= 0 ? "+" : ""}{overlayReturn.toFixed(1)}%
      </SvgText>
    </G>
  );
}
