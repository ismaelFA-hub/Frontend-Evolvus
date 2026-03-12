/**
 * AlertLayer — renders user price alert horizontal lines on the SVG chart.
 */
import React from "react";
import { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { ChartDimensions, priceToY } from "../chartUtils";

export interface PriceAlert {
  id: string;
  price: number;
  direction: "above" | "below";
  label?: string | null;
  triggered?: boolean;
}

interface Props {
  alerts: PriceAlert[];
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth: number;
}

export function AlertLayer({ alerts, dim, minPrice, maxPrice, volumeProfileWidth }: Props) {
  if (!alerts.length) return null;
  const leftX = dim.padding.left;
  const rightX = dim.width - dim.padding.right - volumeProfileWidth;

  return (
    <G>
      {alerts.map(alert => {
        if (alert.price < minPrice || alert.price > maxPrice) return null;
        const y = priceToY(alert.price, minPrice, maxPrice, dim);
        const color = alert.triggered ? "#6b7280" : alert.direction === "above" ? "#22d3ee" : "#f97316";
        const labelText = alert.label ?? (alert.direction === "above" ? "▲ Alert" : "▼ Alert");

        return (
          <G key={alert.id}>
            <Line
              x1={leftX}
              y1={y}
              x2={rightX}
              y2={y}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="5,3"
              opacity={alert.triggered ? 0.35 : 0.8}
            />
            <Rect
              x={rightX - 56}
              y={y - 8}
              width={54}
              height={14}
              fill={color + "22"}
              rx={3}
            />
            <SvgText
              x={rightX - 4}
              y={y + 4}
              fontSize={8}
              fill={color}
              textAnchor="end"
              opacity={alert.triggered ? 0.5 : 1}
            >
              {labelText}
            </SvgText>
          </G>
        );
      })}
    </G>
  );
}
