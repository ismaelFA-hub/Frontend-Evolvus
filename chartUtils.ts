/**
 * Chart math utilities — indicators, scale helpers, coordinate transforms.
 * All functions are pure and testable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  candleAreaHeight: number;
  volumeAreaHeight: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ScaleProps {
  candles: Candle[];
  visibleStart: number;
  visibleCount: number;
  dim: ChartDimensions;
}

// ─── Scale Helpers ────────────────────────────────────────────────────────────

export function getVisibleCandles(candles: Candle[], visibleStart: number, visibleCount: number): Candle[] {
  const start = Math.max(0, visibleStart);
  const end = Math.min(candles.length, start + visibleCount);
  return candles.slice(start, end);
}

export function getPriceRange(candles: Candle[]): { minPrice: number; maxPrice: number } {
  if (!candles.length) return { minPrice: 0, maxPrice: 1 };
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  }
  const pad = (maxPrice - minPrice) * 0.05;
  return { minPrice: minPrice - pad, maxPrice: maxPrice + pad };
}

export function getVolumeMax(candles: Candle[]): number {
  if (!candles.length) return 1;
  return Math.max(...candles.map(c => c.volume));
}

/** Convert price value to Y pixel coordinate in the candle area. */
export function priceToY(price: number, minPrice: number, maxPrice: number, dim: ChartDimensions): number {
  const range = maxPrice - minPrice || 1;
  const ratio = (maxPrice - price) / range;
  return dim.padding.top + ratio * dim.candleAreaHeight;
}

/** Convert candle index (within visible range) to X pixel center. */
export function indexToX(
  idx: number,
  visibleCount: number,
  dim: ChartDimensions,
  volumeProfileWidth: number = 0,
): number {
  const chartWidth = dim.width - dim.padding.left - dim.padding.right - volumeProfileWidth;
  const slotWidth = chartWidth / Math.max(visibleCount, 1);
  return dim.padding.left + (idx + 0.5) * slotWidth;
}

export function getCandleWidth(visibleCount: number, dim: ChartDimensions, volumeProfileWidth: number = 0): number {
  const chartWidth = dim.width - dim.padding.left - dim.padding.right - volumeProfileWidth;
  return Math.max(1, (chartWidth / Math.max(visibleCount, 1)) * 0.8);
}

/** Volume bar Y + height */
export function volumeToRect(
  vol: number,
  maxVol: number,
  dim: ChartDimensions,
): { y: number; h: number } {
  const top = dim.padding.top + dim.candleAreaHeight;
  const ratio = vol / Math.max(maxVol, 1);
  const h = ratio * dim.volumeAreaHeight;
  return { y: top + dim.volumeAreaHeight - h, h };
}

/** Convert timestamp to pixel X based on visible candle range */
export function timeToX(
  t: number,
  candles: Candle[],
  visibleStart: number,
  visibleCount: number,
  dim: ChartDimensions,
  volumeProfileWidth: number = 0,
): number | null {
  const idx = candles.findIndex(c => c.time >= t);
  if (idx < 0) return null;
  const localIdx = idx - visibleStart;
  if (localIdx < 0 || localIdx >= visibleCount) return null;
  return indexToX(localIdx, visibleCount, dim, volumeProfileWidth);
}

// ─── Indicator Calculations ────────────────────────────────────────────────────

export function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    result.push(sum / period);
  }
  return result;
}

export function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (ema === null) {
      ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

export interface BollingerBands {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function calcBollingerBands(closes: number[], period = 20, multiplier = 2): BollingerBands {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) { upper.push(null); lower.push(null); continue; }
    const slice = closes.slice(Math.max(0, i - period + 1), i + 1);
    const avg = middle[i]!;
    const variance = slice.reduce((acc, v) => acc + (v - avg) ** 2, 0) / slice.length;
    const std = Math.sqrt(variance);
    upper.push(avg + multiplier * std);
    lower.push(avg - multiplier * std);
  }
  return { upper, middle, lower };
}

export interface RSIResult {
  values: (number | null)[];
}

export function calcRSI(closes: number[], period = 14): RSIResult {
  const values: (number | null)[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i < period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      values.push(null);
    } else if (i === period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      values.push(100 - 100 / (1 + rs));
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      values.push(100 - 100 / (1 + rs));
    }
  }
  values.unshift(null);
  return { values };
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
}

export function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9): MACDResult {
  const fastEMA = calcEMA(closes, fast);
  const slowEMA = calcEMA(closes, slow);
  const macdLine: (number | null)[] = fastEMA.map((f, i) => {
    const s = slowEMA[i];
    return f !== null && s !== null ? f - s : null;
  });
  const macdValues = macdLine.filter((v): v is number => v !== null);
  const signalEMA = calcEMA(macdValues, signal);
  const signalPadding = macdLine.length - macdValues.length;
  const signalFull: (number | null)[] = [
    ...Array(signalPadding).fill(null),
    ...signalEMA,
  ];
  const hist: (number | null)[] = macdLine.map((m, i) => {
    const s = signalFull[i];
    return m !== null && s !== null ? m - s : null;
  });
  return { macd: macdLine, signal: signalFull, hist };
}

// ─── SVG Path Helpers ────────────────────────────────────────────────────────

/** Build a polyline path string from (number | null)[] y-values. */
export function buildLinePath(
  values: (number | null)[],
  visibleStart: number,
  visibleCount: number,
  dim: ChartDimensions,
  toY: (v: number) => number,
  volumeProfileWidth = 0,
): string {
  let d = "";
  for (let i = 0; i < visibleCount; i++) {
    const globalIdx = visibleStart + i;
    const val = values[globalIdx];
    if (val === null) { d = ""; continue; }
    const x = indexToX(i, visibleCount, dim, volumeProfileWidth);
    const y = toY(val);
    d += d ? ` L${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/** Build a closed area path (e.g. Bollinger Band fill) between two value arrays. */
export function buildAreaPath(
  upper: (number | null)[],
  lower: (number | null)[],
  visibleStart: number,
  visibleCount: number,
  dim: ChartDimensions,
  toY: (v: number) => number,
  volumeProfileWidth = 0,
): string {
  const topPts: string[] = [];
  const botPts: string[] = [];
  for (let i = 0; i < visibleCount; i++) {
    const globalIdx = visibleStart + i;
    const u = upper[globalIdx];
    const l = lower[globalIdx];
    if (u === null || l === null) continue;
    const x = indexToX(i, visibleCount, dim, volumeProfileWidth);
    topPts.push(`${x.toFixed(1)},${toY(u).toFixed(1)}`);
    botPts.push(`${x.toFixed(1)},${toY(l).toFixed(1)}`);
  }
  if (!topPts.length) return "";
  return `M${topPts.join(" L")} L${botPts.reverse().join(" L")} Z`;
}

// ─── Projection Calculation ────────────────────────────────────────────────────

export interface ProjectionPoint {
  x: number;
  yMid: number;
  yUpper: number;
  yLower: number;
}

export function buildProjection(
  lastCandles: Candle[],
  steps: number,
  lastX: number,
  slotWidth: number,
  minPrice: number,
  maxPrice: number,
  dim: ChartDimensions,
): ProjectionPoint[] {
  const closes = lastCandles.map(c => c.close);
  const rsi = calcRSI(closes, 14).values;
  const lastRSI = rsi[rsi.length - 1] ?? 50;
  const lastClose = closes[closes.length - 1];
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const volatility = returns.length
    ? Math.sqrt(returns.reduce((a, b) => a + (b - avgReturn) ** 2, 0) / returns.length)
    : 0.002;

  const momentum = lastRSI > 55 ? 1 : lastRSI < 45 ? -1 : 0;
  const drift = avgReturn * 0.5 + momentum * volatility * 0.3;

  const result: ProjectionPoint[] = [];
  let midPrice = lastClose;
  for (let i = 1; i <= steps; i++) {
    midPrice = midPrice * (1 + drift);
    const spread = volatility * Math.sqrt(i) * midPrice;
    const x = lastX + i * slotWidth;
    result.push({
      x,
      yMid: priceToY(midPrice, minPrice, maxPrice, dim),
      yUpper: priceToY(midPrice + spread * 1.5, minPrice, maxPrice, dim),
      yLower: priceToY(midPrice - spread * 1.5, minPrice, maxPrice, dim),
    });
  }
  return result;
}

// ─── Volume Profile ────────────────────────────────────────────────────────────

export interface VolumeProfileBucket {
  priceLevel: number;
  volume: number;
  isPOC: boolean;
}

export function buildVolumeProfile(candles: Candle[], buckets = 24): VolumeProfileBucket[] {
  if (!candles.length) return [];
  const { minPrice, maxPrice } = getPriceRange(candles);
  const range = maxPrice - minPrice;
  const bucketSize = range / buckets;
  const vol: number[] = Array(buckets).fill(0);

  for (const c of candles) {
    const low = Math.max(c.low, minPrice);
    const high = Math.min(c.high, maxPrice);
    const startBucket = Math.floor((low - minPrice) / bucketSize);
    const endBucket = Math.min(Math.floor((high - minPrice) / bucketSize), buckets - 1);
    for (let b = startBucket; b <= endBucket; b++) {
      if (b >= 0 && b < buckets) vol[b] += c.volume / Math.max(1, endBucket - startBucket + 1);
    }
  }

  const maxVol = Math.max(...vol, 1);
  const pocIdx = vol.indexOf(maxVol);

  return vol.map((v, i) => ({
    priceLevel: minPrice + (i + 0.5) * bucketSize,
    volume: v / maxVol,
    isPOC: i === pocIdx,
  }));
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

/** Cumulative VWAP for each candle. Returns array aligned with input candles. */
export function calcVWAP(candles: Candle[]): number[] {
  let cumTypicalVol = 0;
  let cumVol = 0;
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3;
    cumTypicalVol += typical * c.volume;
    cumVol += c.volume;
    return cumVol > 0 ? cumTypicalVol / cumVol : typical;
  });
}

// ─── Format Helpers ──────────────────────────────────────────────────────────

export function fmtPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function fmtTime(ts: number, interval: string): string {
  const d = new Date(ts);
  if (interval === "1d" || interval === "3d" || interval === "1w" || interval === "1M") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function fmtVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(1);
}
