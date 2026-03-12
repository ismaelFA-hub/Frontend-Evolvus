/**
 * HiveMindBar — horizontal strip at the top of the chart showing
 * Hive Mind consensus: % bullish vs % bearish across connected bots.
 */

import React from "react";
import { G, Rect, Text as SvgText } from "react-native-svg";
import { ChartDimensions } from "../chartUtils";

interface Props {
  bullPercent: number;
  dim: ChartDimensions;
  volumeProfileWidth?: number;
}

const BAR_H = 6;

export function HiveMindBar({ bullPercent, dim, volumeProfileWidth = 0 }: Props) {
  const chartLeft = dim.padding.left;
  const chartRight = dim.width - dim.padding.right - volumeProfileWidth;
  const totalW = chartRight - chartLeft;
  const bullW = (bullPercent / 100) * totalW;
  const bearW = totalW - bullW;
  const y = dim.padding.top - BAR_H - 4;

  return (
    <G>
      <Rect x={chartLeft} y={y} width={bullW} height={BAR_H} fill="#22c55e" rx={2} />
      <Rect x={chartLeft + bullW} y={y} width={bearW} height={BAR_H} fill="#ef4444" rx={2} />
      <SvgText x={chartLeft + 4} y={y - 2} fontSize={8} fill="#22c55e" fontWeight="bold">
        {bullPercent.toFixed(0)}% Bull
      </SvgText>
      <SvgText x={chartRight - 4} y={y - 2} fontSize={8} fill="#ef4444" textAnchor="end" fontWeight="bold">
        {(100 - bullPercent).toFixed(0)}% Bear
      </SvgText>
    </G>
  );
}
