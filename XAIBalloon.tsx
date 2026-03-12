/**
 * XAIBalloon — renders the XAI explanation balloon on the last visible candle.
 * Tapping it triggers onPress to open the full explanation modal.
 */
import React from "react";
import { G, Rect, Text as SvgText, Path, Line } from "react-native-svg";
import { ChartDimensions, priceToY } from "../chartUtils";

export interface XAIExplanation {
  signal: string;
  score: number;
  shortText: string;
  factors?: { name: string; weight: number; direction: "positive" | "negative" | "neutral" }[];
}

interface Props {
  explanation: XAIExplanation | null;
  dim: ChartDimensions;
  lastCandleX: number;
  lastCandleY: number;
}

export function XAIBalloon({ explanation, dim, lastCandleX, lastCandleY }: Props) {
  if (!explanation) return null;

  const { signal, score, shortText } = explanation;
  const signalColor = signal === "BUY" ? "#22c55e" : signal === "SELL" ? "#ef4444" : "#f59e0b";
  const boxW = 130;
  const boxH = 44;

  const rawBx = lastCandleX - boxW / 2;
  const bx = Math.max(dim.padding.left + 4, Math.min(rawBx, dim.width - dim.padding.right - boxW - 4));
  const by = Math.max(dim.padding.top + 2, lastCandleY - boxH - 14);

  const tailX = Math.max(bx + 8, Math.min(lastCandleX, bx + boxW - 8));
  const tailTopY = by + boxH;
  const tailBotY = lastCandleY - 2;

  const scoreLabel = score >= 65 ? "↑ Bullish" : score <= 45 ? "↓ Bearish" : "→ Neutral";
  const truncated = shortText.length > 52 ? shortText.slice(0, 49) + "…" : shortText;

  return (
    <G>
      <Line
        x1={tailX}
        y1={tailTopY}
        x2={tailX}
        y2={tailBotY}
        stroke={signalColor}
        strokeWidth={1}
        strokeDasharray="3,2"
        opacity={0.6}
      />
      <Rect
        x={bx}
        y={by}
        width={boxW}
        height={boxH}
        fill="#1e293b"
        rx={7}
        opacity={0.96}
      />
      <Rect
        x={bx}
        y={by}
        width={boxW}
        height={3}
        fill={signalColor}
        rx={7}
      />
      <Rect
        x={bx + boxW - 38}
        y={by + 5}
        width={32}
        height={12}
        fill={signalColor + "33"}
        rx={4}
      />
      <SvgText
        x={bx + boxW - 22}
        y={by + 14}
        fontSize={8}
        fill={signalColor}
        textAnchor="middle"
        fontWeight="bold"
      >
        {scoreLabel}
      </SvgText>
      <SvgText
        x={bx + 5}
        y={by + 14}
        fontSize={8}
        fill="#60a5fa"
        fontWeight="bold"
      >
        🤖 XAI
      </SvgText>
      <SvgText
        x={bx + 5}
        y={by + 27}
        fontSize={7.5}
        fill="#cbd5e1"
      >
        {truncated.length > 0 ? truncated.slice(0, 26) : ""}
      </SvgText>
      {truncated.length > 26 && (
        <SvgText
          x={bx + 5}
          y={by + 37}
          fontSize={7.5}
          fill="#94a3b8"
        >
          {truncated.slice(26, 52)}
        </SvgText>
      )}
    </G>
  );
}
