/**
 * ProjectionLayer — AI projection cone rendered after the last candle.
 * Shows the predicted mid-price and the confidence band (±1.5σ).
 */

import React from "react";
import { G, Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import { ProjectionPoint } from "../chartUtils";

interface Props {
  points: ProjectionPoint[];
  lastX: number;
  lastY: number;
  brainScore?: number;
}

export function ProjectionLayer({ points, lastX, lastY, brainScore = 50 }: Props) {
  if (!points.length) return null;

  const bullish = brainScore >= 50;
  const primaryColor = bullish ? "#22c55e" : "#ef4444";

  const upperPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.yUpper.toFixed(1)}`).join(" ");
  const lowerPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.yLower.toFixed(1)}`).join(" ");
  const midPath = `M${lastX.toFixed(1)},${lastY.toFixed(1)} ` + points.map(p => `L${p.x.toFixed(1)},${p.yMid.toFixed(1)}`).join(" ");

  const areaPath = `M${lastX.toFixed(1)},${lastY.toFixed(1)} ${upperPath.replace(/^M/, "L")} L${points[points.length - 1].x.toFixed(1)},${points[points.length - 1].yLower.toFixed(1)} ${lowerPath.split(" ").reverse().join(" ")} Z`;

  const lastPt = points[points.length - 1];

  return (
    <G>
      <Defs>
        <LinearGradient id="projGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={primaryColor} stopOpacity={0.12} />
          <Stop offset="1" stopColor={primaryColor} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      <Path d={areaPath} fill="url(#projGrad)" />
      <Path d={upperPath} stroke={primaryColor} strokeWidth={1} strokeDasharray="4,3" fill="none" opacity={0.5} />
      <Path d={lowerPath} stroke={primaryColor} strokeWidth={1} strokeDasharray="4,3" fill="none" opacity={0.5} />
      <Path d={midPath} stroke={primaryColor} strokeWidth={1.5} fill="none" opacity={0.9} />

      <Circle cx={lastPt.x} cy={lastPt.yMid} r={3} fill={primaryColor} opacity={0.8} />
      <SvgText
        x={lastPt.x + 5}
        y={lastPt.yMid + 4}
        fontSize={9}
        fill={primaryColor}
        opacity={0.9}
        fontWeight="bold"
      >
        AI
      </SvgText>
    </G>
  );
}
