/**
 * AnnotationLayer — renders user annotations (notes) as badges above candles.
 * Tap to view, long-press (in annotation mode) to create new notes.
 */

import React from "react";
import { G, Rect, Text as SvgText, Circle } from "react-native-svg";
import { Candle, ChartDimensions, priceToY, indexToX } from "../chartUtils";

export interface Annotation {
  id: string;
  symbol: string;
  candleTime: string;
  text: string;
  color: string;
  createdAt: string;
}

interface Props {
  annotations: Annotation[];
  candles: Candle[];
  visibleStart: number;
  visibleCount: number;
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth?: number;
  onPress?: (annotation: Annotation) => void;
}

export function AnnotationLayer({
  annotations,
  candles,
  visibleStart,
  visibleCount,
  dim,
  minPrice,
  maxPrice,
  volumeProfileWidth = 0,
  onPress,
}: Props) {
  const elements: React.ReactNode[] = [];

  for (const ann of annotations) {
    const ts = new Date(ann.candleTime).getTime();
    const candleIdx = candles.findIndex(c => c.time >= ts);
    if (candleIdx < 0) continue;
    const localIdx = candleIdx - visibleStart;
    if (localIdx < 0 || localIdx >= visibleCount) continue;

    const candle = candles[candleIdx];
    const x = indexToX(localIdx, visibleCount, dim, volumeProfileWidth);
    const highY = priceToY(candle.high, minPrice, maxPrice, dim);
    const badgeY = highY - 22;

    elements.push(
      <G key={ann.id} onPress={() => onPress?.(ann)}>
        <Circle cx={x} cy={highY - 8} r={4} fill={ann.color} opacity={0.9} />
        <Rect
          x={x - 24}
          y={badgeY - 10}
          width={48}
          height={12}
          fill={ann.color}
          opacity={0.85}
          rx={3}
        />
        <SvgText
          x={x}
          y={badgeY - 2}
          fontSize={7}
          fill="#fff"
          textAnchor="middle"
          fontWeight="bold"
        >
          {ann.text.length > 8 ? ann.text.slice(0, 8) + "…" : ann.text}
        </SvgText>
      </G>
    );
  }

  return <G>{elements}</G>;
}
