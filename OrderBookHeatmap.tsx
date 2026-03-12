/**
 * OrderBookHeatmap — renders bid/ask pressure as semi-transparent rectangles
 * behind the candles. Bid levels (green) below mid, ask levels (red) above mid.
 * Opacity is proportional to order size.
 */

import React from "react";
import { G, Rect } from "react-native-svg";
import { ChartDimensions, priceToY } from "../chartUtils";

export interface OrderBookData {
  bids: [number, number][];
  asks: [number, number][];
}

interface Props {
  orderBook: OrderBookData | null;
  dim: ChartDimensions;
  minPrice: number;
  maxPrice: number;
  volumeProfileWidth?: number;
}

export function OrderBookHeatmap({ orderBook, dim, minPrice, maxPrice, volumeProfileWidth = 0 }: Props) {
  if (!orderBook) return null;

  const leftX = dim.padding.left;
  const rightX = dim.width - dim.padding.right - volumeProfileWidth;
  const totalW = rightX - leftX;

  const maxBidVol = Math.max(...orderBook.bids.map(([, q]) => q), 1);
  const maxAskVol = Math.max(...orderBook.asks.map(([, q]) => q), 1);
  const maxVol = Math.max(maxBidVol, maxAskVol);

  const elements: React.ReactNode[] = [];
  const priceStep = (maxPrice - minPrice) / 40;

  for (const [i, [price, qty]] of orderBook.bids.entries()) {
    if (price < minPrice || price > maxPrice) continue;
    const y = priceToY(price, minPrice, maxPrice, dim);
    const pixelH = Math.max(1, (priceStep / (maxPrice - minPrice)) * dim.candleAreaHeight);
    const opacity = (qty / maxVol) * 0.35;
    elements.push(
      <Rect
        key={`bid-${i}`}
        x={leftX}
        y={y - pixelH / 2}
        width={totalW}
        height={pixelH}
        fill="#22c55e"
        opacity={opacity}
      />
    );
  }

  for (const [i, [price, qty]] of orderBook.asks.entries()) {
    if (price < minPrice || price > maxPrice) continue;
    const y = priceToY(price, minPrice, maxPrice, dim);
    const pixelH = Math.max(1, (priceStep / (maxPrice - minPrice)) * dim.candleAreaHeight);
    const opacity = (qty / maxVol) * 0.35;
    elements.push(
      <Rect
        key={`ask-${i}`}
        x={leftX}
        y={y - pixelH / 2}
        width={totalW}
        height={pixelH}
        fill="#ef4444"
        opacity={opacity}
      />
    );
  }

  return <G>{elements}</G>;
}
