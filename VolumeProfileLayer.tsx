/**
 * VolumeProfileLayer — horizontal volume bars on the right side of the chart.
 * The Point of Control (POC) is highlighted with the primary accent color.
 */

import React from "react";
import { G, Rect, Line } from "react-native-svg";
import { VolumeProfileBucket, ChartDimensions, priceToY } from "../chartUtils";

interface Props {
  buckets: VolumeProfileBucket[];
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  width?: number;
}

export const VOLUME_PROFILE_WIDTH = 52;

export function VolumeProfileLayer({
  buckets,
  dim,
  minPrice,
  maxPrice,
  width = VOLUME_PROFILE_WIDTH,
}: Props) {
  if (!buckets.length) return null;

  const areaRange = maxPrice - minPrice || 1;
  const bucketPriceRange = areaRange / buckets.length;
  const rightEdge = dim.width - dim.padding.right;
  const startX = rightEdge - width;

  const elements: React.ReactNode[] = [];

  for (const [i, bucket] of buckets.entries()) {
    const priceTop = bucket.priceLevel + bucketPriceRange / 2;
    const priceBot = bucket.priceLevel - bucketPriceRange / 2;
    const yTop = priceToY(priceTop, minPrice, maxPrice, dim);
    const yBot = priceToY(priceBot, minPrice, maxPrice, dim);
    const h = Math.max(1, yBot - yTop);
    const barW = bucket.volume * (width - 4);
    const color = bucket.isPOC ? "#f59e0b" : "#4b5563";

    elements.push(
      <Rect
        key={`vp-${i}`}
        x={startX}
        y={yTop}
        width={barW}
        height={h}
        fill={color}
        opacity={bucket.isPOC ? 0.9 : 0.5}
      />
    );

    if (bucket.isPOC) {
      elements.push(
        <Line
          key="poc-line"
          x1={dim.padding.left}
          y1={priceToY(bucket.priceLevel, minPrice, maxPrice, dim)}
          x2={startX}
          y2={priceToY(bucket.priceLevel, minPrice, maxPrice, dim)}
          stroke="#f59e0b"
          strokeWidth={0.8}
          strokeDasharray="5,3"
          opacity={0.6}
        />
      );
    }
  }

  return <G>{elements}</G>;
}
