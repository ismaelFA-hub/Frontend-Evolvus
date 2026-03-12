/**
 * ChartEngine — Professional SVG chart engine for Evolvus Core Quantum.
 *
 * Renders real OHLCV data from /api/chart/ohlcv/:symbol using react-native-svg.
 * All intelligence layers compose inside a single Svg element for crisp rendering.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
  Animated,
  Text,
  TouchableOpacity,
} from "react-native";
import {
  Svg,
  G,
  Rect,
  Line,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  ClipPath,
} from "react-native-svg";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import {
  Candle,
  ChartDimensions,
  getVisibleCandles,
  getPriceRange,
  getVolumeMax,
  priceToY,
  indexToX,
  volumeToRect,
  calcBollingerBands,
  calcRSI,
  calcMACD,
  calcVWAP,
  buildLinePath,
  buildAreaPath,
  buildProjection,
  buildVolumeProfile,
  fmtPrice,
  fmtTime,
  fmtVolume,
  getCandleWidth,
} from "./chartUtils";

import { ExecutionLayer, Execution } from "./layers/ExecutionLayer";
import { RegimeLayer, RegimeData, buildRegimeData } from "./layers/RegimeLayer";
import { ProjectionLayer } from "./layers/ProjectionLayer";
import { HiveMindBar } from "./layers/HiveMindBar";
import { StrategyLayer, StrategyData } from "./layers/StrategyLayer";
import { VolumeProfileLayer, VOLUME_PROFILE_WIDTH } from "./layers/VolumeProfileLayer";
import { OrderBookHeatmap, OrderBookData } from "./layers/OrderBookHeatmap";
import { AnnotationLayer, Annotation } from "./layers/AnnotationLayer";
import { MultiAssetOverlay } from "./layers/MultiAssetOverlay";
import { AlertLayer, PriceAlert } from "./layers/AlertLayer";
import { ActiveBotLayer, ActiveBot } from "./layers/ActiveBotLayer";
import { XAIBalloon, XAIExplanation } from "./layers/XAIBalloon";

const C = Colors.dark;

// ─── Config ────────────────────────────────────────────────────────────────────

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
const DEFAULT_TF: Timeframe = "4h";
const DEFAULT_LIMIT = 200;
const CANDLE_CHART_RATIO = 0.62;
const VOLUME_RATIO = 0.14;
const RSI_HEIGHT = 70;
const MACD_HEIGHT = 70;
const Y_AXIS_WIDTH = 54;
const X_AXIS_HEIGHT = 22;
const CHART_PADDING_TOP = 28;

// ─── Layer Toggles ─────────────────────────────────────────────────────────────

export interface LayerToggles {
  executions: boolean;
  orderBook: boolean;
  volumeProfile: boolean;
  overlay: boolean;
  strategy: boolean;
  annotations: boolean;
  regime: boolean;
  projection: boolean;
  hiveMind: boolean;
  bb: boolean;
  rsi: boolean;
  macd: boolean;
  vwap: boolean;
  volumeDelta: boolean;
  crosshair: boolean;
  priceAlerts: boolean;
  botOverlay: boolean;
  xaiBalloon: boolean;
  fundingHistory: boolean;
  markPrice: boolean;
}

export const DEFAULT_LAYERS: LayerToggles = {
  executions: true,
  orderBook: false,
  volumeProfile: true,
  overlay: false,
  strategy: true,
  annotations: true,
  regime: true,
  projection: true,
  hiveMind: true,
  bb: true,
  rsi: true,
  macd: false,
  vwap: true,
  volumeDelta: true,
  crosshair: true,
  priceAlerts: true,
  botOverlay: true,
  xaiBalloon: true,
  fundingHistory: false,
  markPrice: false,
};

// ─── Tooltip State ─────────────────────────────────────────────────────────────

interface TooltipState {
  candle: Candle;
  x: number;
  y: number;
  localIdx: number;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface FundingPoint {
  time: number;
  rate: number;
}

export interface ChartEngineProps {
  symbol: string;
  layers?: Partial<LayerToggles>;
  regimes?: RegimeData[];
  currentRegime?: string;
  brainScore?: number;
  hiveMindBull?: number;
  executions?: Execution[];
  orderBook?: OrderBookData | null;
  overlayCandles?: Candle[];
  annotations?: Annotation[];
  strategy?: StrategyData | null;
  replayIndex?: number;
  onCandleLongPress?: (candle: Candle, x: number, y: number) => void;
  onExecutionPress?: (exec: Execution) => void;
  onAnnotationPress?: (ann: Annotation) => void;
  alertActive?: boolean;
  priceAlerts?: PriceAlert[];
  activeBots?: ActiveBot[];
  xaiExplanation?: XAIExplanation | null;
  fundingHistory?: FundingPoint[];
  markPrice?: number | null;
  leverageGuardActive?: boolean;
  adaptiveLeverage?: number | null;
  onCandlesLoad?: (candles: Candle[]) => void;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ChartEngine({
  symbol,
  layers: layerOverrides,
  regimes,
  currentRegime = "neutral",
  brainScore = 50,
  hiveMindBull = 50,
  executions = [],
  orderBook = null,
  overlayCandles = [],
  annotations = [],
  strategy = null,
  replayIndex,
  onCandleLongPress,
  onExecutionPress,
  onAnnotationPress,
  alertActive = false,
  priceAlerts = [],
  activeBots = [],
  xaiExplanation = null,
  fundingHistory = [],
  markPrice = null,
  leverageGuardActive = false,
  adaptiveLeverage = null,
  onCandlesLoad,
}: ChartEngineProps) {
  const layers: LayerToggles = { ...DEFAULT_LAYERS, ...layerOverrides };

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TF);
  const [dim, setDim] = useState<ChartDimensions | null>(null);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleCount, setVisibleCount] = useState(80);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null);
  const alertAnim = useRef(new Animated.Value(1)).current;

  const volumeProfileWidth = layers.volumeProfile ? VOLUME_PROFILE_WIDTH : 0;

  // ── Fetch OHLCV ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setTooltip(null);

    apiRequest("GET", `/api/chart/ohlcv/${symbol}?interval=${timeframe}&limit=${DEFAULT_LIMIT}`)
      .then((res: any) => res.json())
      .then((data: any) => {
        if (!active) return;
        if (data?.candles?.length) {
          setCandles(data.candles);
          setVisibleStart(Math.max(0, data.candles.length - 80));
          setVisibleCount(80);
          onCandlesLoad?.(data.candles);
        } else {
          setError("No data available.");
        }
      })
      .catch(() => {
        if (!active) setError("Failed to load candles.");
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [symbol, timeframe]);

  // ── Brain Score Alert Animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!alertActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(alertAnim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.timing(alertAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [alertActive]);

  // ── Replay clamp ─────────────────────────────────────────────────────────────
  const effectiveCandles = useMemo(() => {
    if (replayIndex !== undefined && replayIndex > 0) {
      return candles.slice(0, replayIndex);
    }
    return candles;
  }, [candles, replayIndex]);

  const visibleCandlesCount = Math.min(visibleCount, effectiveCandles.length);
  const safeStart = Math.max(0, Math.min(visibleStart, effectiveCandles.length - visibleCandlesCount));

  const visibleCandles = useMemo(
    () => getVisibleCandles(effectiveCandles, safeStart, visibleCandlesCount),
    [effectiveCandles, safeStart, visibleCandlesCount]
  );

  const { minPrice, maxPrice } = useMemo(() => getPriceRange(visibleCandles), [visibleCandles]);
  const maxVol = useMemo(() => getVolumeMax(visibleCandles), [visibleCandles]);

  // ── Volume Profile ────────────────────────────────────────────────────────────
  const volumeProfileBuckets = useMemo(
    () => layers.volumeProfile ? buildVolumeProfile(visibleCandles) : [],
    [layers.volumeProfile, visibleCandles]
  );

  // ── Indicators ───────────────────────────────────────────────────────────────
  const allCloses = useMemo(() => effectiveCandles.map(c => c.close), [effectiveCandles]);
  const bb = useMemo(() => layers.bb ? calcBollingerBands(allCloses) : null, [layers.bb, allCloses]);
  const rsi = useMemo(() => layers.rsi ? calcRSI(allCloses) : null, [layers.rsi, allCloses]);
  const macd = useMemo(() => layers.macd ? calcMACD(allCloses) : null, [layers.macd, allCloses]);

  // ── VWAP ─────────────────────────────────────────────────────────────────────
  const vwapValues = useMemo(
    () => layers.vwap ? calcVWAP(effectiveCandles) : null,
    [layers.vwap, effectiveCandles]
  );

  // ── Regime Data ──────────────────────────────────────────────────────────────
  const regimeData = useMemo(
    () => regimes ?? buildRegimeData(effectiveCandles, currentRegime),
    [regimes, effectiveCandles, currentRegime]
  );

  // ── Layout ───────────────────────────────────────────────────────────────────
  const onLayout = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (width < 10 || height < 10) return;
    const rsiH = layers.rsi ? RSI_HEIGHT : 0;
    const macdH = layers.macd ? MACD_HEIGHT : 0;
    const mainH = height - rsiH - macdH;
    const candleAreaHeight = mainH * CANDLE_CHART_RATIO - CHART_PADDING_TOP - X_AXIS_HEIGHT;
    const volumeAreaHeight = mainH * VOLUME_RATIO;
    setDim({
      width,
      height: mainH,
      candleAreaHeight,
      volumeAreaHeight,
      padding: {
        top: CHART_PADDING_TOP,
        right: 2,
        bottom: X_AXIS_HEIGHT,
        left: Y_AXIS_WIDTH,
      },
    });
  }, [layers.rsi, layers.macd]);

  // ── Pan Gesture ──────────────────────────────────────────────────────────────
  const lastPanX = useRef(0);
  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: (_, gs) => {
        lastPanX.current = gs.x0;
        if (layers.crosshair && dim) {
          setCrosshairPos({ x: gs.x0, y: gs.y0 });
        }
      },
      onPanResponderMove: (_, gs) => {
        if (!dim || !effectiveCandles.length) return;
        if (layers.crosshair) {
          setCrosshairPos({ x: gs.moveX, y: gs.moveY });
        }
        if (Math.abs(gs.dx) <= 4) return;
        const slotW = (dim.width - Y_AXIS_WIDTH - volumeProfileWidth) / Math.max(visibleCandlesCount, 1);
        const delta = Math.round((lastPanX.current - gs.moveX) / slotW);
        if (delta === 0) return;
        lastPanX.current = gs.moveX;
        setVisibleStart(prev => {
          const next = prev + delta;
          return Math.max(0, Math.min(effectiveCandles.length - visibleCandlesCount, next));
        });
      },
      onPanResponderRelease: (_, gs) => {
        setCrosshairPos(null);
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5 && dim) {
          handleTap(gs.x0, gs.y0);
        }
      },
    }),
  [dim, effectiveCandles.length, visibleCandlesCount, volumeProfileWidth, layers.crosshair]);

  const handleTap = useCallback((tapX: number, tapY: number) => {
    if (!dim) return;
    const slotW = (dim.width - Y_AXIS_WIDTH - volumeProfileWidth) / Math.max(visibleCandlesCount, 1);
    const localIdx = Math.floor((tapX - Y_AXIS_WIDTH) / slotW);
    if (localIdx < 0 || localIdx >= visibleCandlesCount) { setTooltip(null); return; }
    const candle = visibleCandles[localIdx];
    if (!candle) return;
    const x = indexToX(localIdx, visibleCandlesCount, dim, volumeProfileWidth);
    const y = priceToY(candle.close, minPrice, maxPrice, dim);
    setTooltip({ candle, x, y, localIdx });
  }, [dim, visibleCandlesCount, visibleCandles, minPrice, maxPrice, volumeProfileWidth]);

  const handleLongPress = useCallback((tapX: number, tapY: number) => {
    if (!dim || !onCandleLongPress) return;
    const slotW = (dim.width - Y_AXIS_WIDTH - volumeProfileWidth) / Math.max(visibleCandlesCount, 1);
    const localIdx = Math.floor((tapX - Y_AXIS_WIDTH) / slotW);
    const candle = visibleCandles[localIdx];
    if (!candle) return;
    const x = indexToX(localIdx, visibleCandlesCount, dim, volumeProfileWidth);
    const y = priceToY(candle.high, minPrice, maxPrice, dim);
    onCandleLongPress(candle, x, y);
  }, [dim, visibleCandlesCount, visibleCandles, minPrice, maxPrice, volumeProfileWidth, onCandleLongPress]);

  // ── Zoom ─────────────────────────────────────────────────────────────────────
  const handleZoom = (direction: "in" | "out") => {
    setVisibleCount(prev => {
      const next = direction === "in" ? Math.max(20, prev - 20) : Math.min(effectiveCandles.length, prev + 20);
      setVisibleStart(s => Math.max(0, Math.min(effectiveCandles.length - next, s)));
      return next;
    });
  };

  // ── Projection ────────────────────────────────────────────────────────────────
  const projectionPoints = useMemo(() => {
    if (!layers.projection || !dim || !visibleCandles.length) return [];
    const lastSlotW = (dim.width - Y_AXIS_WIDTH - volumeProfileWidth) / Math.max(visibleCandlesCount, 1);
    const lastX = indexToX(visibleCandlesCount - 1, visibleCandlesCount, dim, volumeProfileWidth);
    return buildProjection(
      visibleCandles.slice(-30),
      8,
      lastX,
      lastSlotW,
      minPrice,
      maxPrice,
      dim,
    );
  }, [layers.projection, dim, visibleCandles, visibleCandlesCount, minPrice, maxPrice, volumeProfileWidth]);

  // ── Y Axis Labels ─────────────────────────────────────────────────────────────
  const yLabels = useMemo(() => {
    if (!dim) return [];
    const steps = 6;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const price = minPrice + (maxPrice - minPrice) * (1 - i / steps);
      const y = priceToY(price, minPrice, maxPrice, dim);
      return { price, y };
    });
  }, [dim, minPrice, maxPrice]);

  // ── X Axis Labels ─────────────────────────────────────────────────────────────
  const xLabels = useMemo(() => {
    if (!dim || !visibleCandles.length) return [];
    const step = Math.max(1, Math.floor(visibleCandlesCount / 6));
    return visibleCandles
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => i % step === 0)
      .map(({ c, i }) => ({
        time: c.time,
        x: indexToX(i, visibleCandlesCount, dim, volumeProfileWidth),
        label: fmtTime(c.time, timeframe),
      }));
  }, [dim, visibleCandles, visibleCandlesCount, timeframe, volumeProfileWidth]);

  // ─── Render helpers ────────────────────────────────────────────────────────────

  function renderVWAP() {
    if (!dim || !vwapValues) return null;
    const toY = (v: number) => priceToY(v, minPrice, maxPrice, dim);
    const path = buildLinePath(vwapValues, safeStart, visibleCandlesCount, dim, toY, volumeProfileWidth);
    if (!path) return null;
    return (
      <G>
        <Path d={path} stroke="#60a5fa" strokeWidth={1.2} fill="none" strokeDasharray="4,3" opacity={0.75} />
        <SvgText
          x={dim.width - dim.padding.right - volumeProfileWidth - 2}
          y={toY(vwapValues[safeStart + visibleCandlesCount - 1] ?? vwapValues[vwapValues.length - 1]) - 3}
          fontSize={8}
          fill="#60a5fa"
          textAnchor="end"
          opacity={0.85}
        >
          VWAP
        </SvgText>
      </G>
    );
  }

  function renderCrosshair() {
    if (!dim || !crosshairPos || !layers.crosshair) return null;
    const { x, y } = crosshairPos;
    const leftX = dim.padding.left;
    const rightX = dim.width - dim.padding.right - volumeProfileWidth;
    const topY = dim.padding.top;
    const bottomY = dim.padding.top + dim.candleAreaHeight;

    if (x < leftX || x > rightX || y < topY || y > bottomY) return null;

    const price = minPrice + (maxPrice - minPrice) * (1 - (y - topY) / dim.candleAreaHeight);

    return (
      <G>
        <Line x1={leftX} y1={y} x2={rightX} y2={y} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
        <Line x1={x} y1={topY} x2={x} y2={bottomY} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
        <Rect x={dim.padding.left - Y_AXIS_WIDTH} y={y - 7} width={Y_AXIS_WIDTH - 4} height={14} fill="#374151" rx={2} />
        <SvgText x={dim.padding.left - 4} y={y + 4} fontSize={9} fill="#e2e8f0" textAnchor="end">
          {fmtPrice(price)}
        </SvgText>
      </G>
    );
  }

  function renderMarkPriceLine() {
    if (!dim || !markPrice || !layers.markPrice) return null;
    if (markPrice < minPrice || markPrice > maxPrice) return null;
    const y = priceToY(markPrice, minPrice, maxPrice, dim);
    const leftX = dim.padding.left;
    const rightX = dim.width - dim.padding.right - volumeProfileWidth;
    return (
      <G>
        <Line
          x1={leftX}
          y1={y}
          x2={rightX}
          y2={y}
          stroke="#a78bfa"
          strokeWidth={1}
          strokeDasharray="6,3"
          opacity={0.7}
        />
        <Rect x={rightX - 44} y={y - 7} width={42} height={13} fill="#a78bfa22" rx={3} />
        <SvgText x={rightX - 2} y={y + 3} fontSize={8} fill="#a78bfa" textAnchor="end">
          Mark
        </SvgText>
      </G>
    );
  }

  function renderFundingHistoryLayer() {
    if (!dim || !fundingHistory.length || !layers.fundingHistory) return null;
    const leftX = dim.padding.left;
    const rightX = dim.width - dim.padding.right - volumeProfileWidth;
    const baseY = dim.padding.top + dim.candleAreaHeight - 18;
    const scaleH = 14;

    const rates = fundingHistory.map(f => f.rate);
    const maxRate = Math.max(...rates.map(Math.abs), 0.001);

    if (visibleCandles.length === 0) return null;
    const timeStart = visibleCandles[0].time;
    const timeEnd = visibleCandles[visibleCandlesCount - 1].time;
    const timeRange = timeEnd - timeStart || 1;

    const visible = fundingHistory.filter(f => f.time >= timeStart && f.time <= timeEnd);
    if (visible.length === 0) return null;

    return (
      <G>
        {visible.map((f, i) => {
          const xFrac = (f.time - timeStart) / timeRange;
          const fx = leftX + xFrac * (rightX - leftX);
          const normH = Math.abs(f.rate) / maxRate;
          const barH = Math.max(1, normH * scaleH);
          const fy = f.rate >= 0 ? baseY - barH : baseY;
          const color = f.rate >= 0 ? "#22c55e" : "#ef4444";
          return (
            <Rect key={i} x={fx - 1.5} y={fy} width={3} height={barH} fill={color} opacity={0.5} />
          );
        })}
        <SvgText x={leftX + 3} y={baseY - scaleH - 2} fontSize={7} fill="#6b7280">Funding</SvgText>
      </G>
    );
  }

  function renderLeverageGuardOverlay() {
    if (!dim || !leverageGuardActive) return null;
    const leftX = dim.padding.left;
    const topY = dim.padding.top;
    const w = dim.width - leftX - dim.padding.right - volumeProfileWidth;
    const h = dim.candleAreaHeight;
    return (
      <G>
        <Rect x={leftX} y={topY} width={w} height={h} fill="#ef4444" opacity={0.07} />
        <SvgText
          x={leftX + w / 2}
          y={topY + h / 2}
          fontSize={11}
          fill="#ef4444"
          textAnchor="middle"
          fontWeight="bold"
          opacity={0.55}
        >
          ⚠ LEVERAGE GUARD ATIVO
        </SvgText>
      </G>
    );
  }

  function renderCandleLayer() {
    if (!dim) return null;
    const cw = getCandleWidth(visibleCandlesCount, dim, volumeProfileWidth);
    return visibleCandles.map((c, i) => {
      const x = indexToX(i, visibleCandlesCount, dim, volumeProfileWidth);
      const isBull = c.close >= c.open;
      const color = isBull ? "#22c55e" : "#ef4444";
      const bodyTop = priceToY(Math.max(c.open, c.close), minPrice, maxPrice, dim);
      const bodyBot = priceToY(Math.min(c.open, c.close), minPrice, maxPrice, dim);
      const bodyH = Math.max(1, bodyBot - bodyTop);
      const highY = priceToY(c.high, minPrice, maxPrice, dim);
      const lowY = priceToY(c.low, minPrice, maxPrice, dim);

      const isAlert = alertActive && i === visibleCandlesCount - 1;

      return (
        <G key={c.time}>
          <Line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth={1} />
          <Rect
            x={x - cw / 2}
            y={bodyTop}
            width={cw}
            height={bodyH}
            fill={color}
            opacity={isAlert ? 0.95 : 0.85}
            stroke={isAlert ? "#f59e0b" : "none"}
            strokeWidth={isAlert ? 2 : 0}
          />
        </G>
      );
    });
  }

  function renderVolumeLayer() {
    if (!dim) return null;
    const cw = getCandleWidth(visibleCandlesCount, dim, volumeProfileWidth);
    return visibleCandles.map((c, i) => {
      const x = indexToX(i, visibleCandlesCount, dim, volumeProfileWidth);
      const { y, h } = volumeToRect(c.volume, maxVol, dim);
      const isBull = c.close >= c.open;

      if (!layers.volumeDelta) {
        return (
          <Rect
            key={`vol-${c.time}`}
            x={x - cw / 2}
            y={y}
            width={cw}
            height={Math.max(1, h)}
            fill={isBull ? "#22c55e" : "#ef4444"}
            opacity={0.45}
          />
        );
      }

      // Volume delta: split bar into buy (green) and sell (red) fractions
      const range = c.high - c.low || 0.0001;
      const buyFrac = Math.max(0, Math.min(1, (c.close - c.low) / range));
      const sellFrac = 1 - buyFrac;
      const buyH = Math.max(0.5, h * buyFrac);
      const sellH = Math.max(0.5, h * sellFrac);

      return (
        <G key={`vol-${c.time}`}>
          <Rect x={x - cw / 2} y={y} width={cw / 2} height={Math.max(1, h)} fill="#22c55e" opacity={buyFrac * 0.6 + 0.15} />
          <Rect x={x} y={y} width={cw / 2} height={Math.max(1, h)} fill="#ef4444" opacity={sellFrac * 0.6 + 0.15} />
        </G>
      );
    });
  }

  function renderBollingerBands() {
    if (!dim || !bb) return null;
    const toY = (v: number) => priceToY(v, minPrice, maxPrice, dim);
    const areaPath = buildAreaPath(bb.upper, bb.lower, safeStart, visibleCandlesCount, dim, toY, volumeProfileWidth);
    const upperPath = buildLinePath(bb.upper, safeStart, visibleCandlesCount, dim, toY, volumeProfileWidth);
    const midPath = buildLinePath(bb.middle, safeStart, visibleCandlesCount, dim, toY, volumeProfileWidth);
    const lowerPath = buildLinePath(bb.lower, safeStart, visibleCandlesCount, dim, toY, volumeProfileWidth);
    return (
      <G>
        {areaPath ? <Path d={areaPath} fill="#818cf8" opacity={0.06} /> : null}
        {upperPath ? <Path d={upperPath} stroke="#818cf8" strokeWidth={0.8} fill="none" opacity={0.6} /> : null}
        {midPath ? <Path d={midPath} stroke="#818cf8" strokeWidth={0.5} fill="none" strokeDasharray="3,3" opacity={0.5} /> : null}
        {lowerPath ? <Path d={lowerPath} stroke="#818cf8" strokeWidth={0.8} fill="none" opacity={0.6} /> : null}
      </G>
    );
  }

  function renderGrid() {
    if (!dim) return null;
    const leftX = dim.padding.left;
    const rightX = dim.width - dim.padding.right - volumeProfileWidth;
    const topY = dim.padding.top;
    const bottomY = dim.padding.top + dim.candleAreaHeight + dim.volumeAreaHeight;
    return (
      <G>
        {yLabels.map(({ y }, i) => (
          <Line key={`hg-${i}`} x1={leftX} y1={y} x2={rightX} y2={y} stroke="#374151" strokeWidth={0.5} />
        ))}
        {xLabels.map(({ x, label }, i) => (
          <Line key={`vg-${i}`} x1={x} y1={topY} x2={x} y2={bottomY} stroke="#374151" strokeWidth={0.5} />
        ))}
        <Line x1={leftX} y1={topY} x2={leftX} y2={bottomY} stroke="#4b5563" strokeWidth={0.8} />
        <Line x1={leftX} y1={topY + dim.candleAreaHeight} x2={rightX} y2={topY + dim.candleAreaHeight} stroke="#4b5563" strokeWidth={0.8} />
      </G>
    );
  }

  function renderYAxis() {
    if (!dim) return null;
    const lastClose = effectiveCandles[effectiveCandles.length - 1]?.close;
    return (
      <G>
        {yLabels.map(({ price, y }, i) => (
          <SvgText key={`yl-${i}`} x={dim.padding.left - 4} y={y + 3} fontSize={9} fill="#9ca3af" textAnchor="end">
            {fmtPrice(price)}
          </SvgText>
        ))}
        {lastClose !== undefined && (
          <>
            <Rect
              x={dim.padding.left - Y_AXIS_WIDTH}
              y={priceToY(lastClose, minPrice, maxPrice, dim) - 7}
              width={Y_AXIS_WIDTH - 4}
              height={14}
              fill={lastClose >= (effectiveCandles[effectiveCandles.length - 2]?.close ?? lastClose) ? "#22c55e" : "#ef4444"}
              rx={2}
            />
            <SvgText
              x={dim.padding.left - 4}
              y={priceToY(lastClose, minPrice, maxPrice, dim) + 4}
              fontSize={9}
              fill="#fff"
              textAnchor="end"
              fontWeight="bold"
            >
              {fmtPrice(lastClose)}
            </SvgText>
          </>
        )}
      </G>
    );
  }

  function renderXAxis() {
    if (!dim) return null;
    const y = dim.padding.top + dim.candleAreaHeight + dim.volumeAreaHeight + 12;
    return (
      <G>
        {xLabels.map(({ x, label }, i) => (
          <SvgText key={`xl-${i}`} x={x} y={y} fontSize={8} fill="#6b7280" textAnchor="middle">
            {label}
          </SvgText>
        ))}
      </G>
    );
  }

  function renderTooltip() {
    if (!tooltip || !dim) return null;
    const { candle, x } = tooltip;
    const boxW = 120;
    const boxH = 80;
    const bx = Math.min(x - boxW / 2, dim.width - boxW - 8);
    const by = dim.padding.top + 4;
    const isBull = candle.close >= candle.open;
    const change = ((candle.close - candle.open) / candle.open) * 100;
    return (
      <G>
        <Line x1={x} y1={dim.padding.top} x2={x} y2={dim.padding.top + dim.candleAreaHeight} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3,2" opacity={0.6} />
        <Rect x={bx} y={by} width={boxW} height={boxH} fill="#1f2937" rx={6} opacity={0.95} />
        <Rect x={bx} y={by} width={boxW} height={4} fill={isBull ? "#22c55e" : "#ef4444"} rx={6} />
        <SvgText x={bx + 6} y={by + 17} fontSize={8} fill="#9ca3af">O: <SvgText fill="#e5e7eb">{fmtPrice(candle.open)}</SvgText></SvgText>
        <SvgText x={bx + 6} y={by + 29} fontSize={8} fill="#9ca3af">H: <SvgText fill="#22c55e">{fmtPrice(candle.high)}</SvgText></SvgText>
        <SvgText x={bx + 6} y={by + 41} fontSize={8} fill="#9ca3af">L: <SvgText fill="#ef4444">{fmtPrice(candle.low)}</SvgText></SvgText>
        <SvgText x={bx + 6} y={by + 53} fontSize={8} fill="#9ca3af">C: <SvgText fill="#e5e7eb">{fmtPrice(candle.close)}</SvgText></SvgText>
        <SvgText x={bx + 6} y={by + 65} fontSize={8} fill="#9ca3af">V: <SvgText fill="#e5e7eb">{fmtVolume(candle.volume)}</SvgText></SvgText>
        <SvgText x={bx + boxW - 6} y={by + 17} fontSize={8} fill={isBull ? "#22c55e" : "#ef4444"} textAnchor="end">
          {isBull ? "+" : ""}{change.toFixed(2)}%
        </SvgText>
      </G>
    );
  }

  function renderRSIPanel(rsiDim: ChartDimensions) {
    if (!rsi) return null;
    const leftX = rsiDim.padding.left;
    const rightX = rsiDim.width - rsiDim.padding.right - volumeProfileWidth;

    const toY = (v: number) => rsiDim.padding.top + ((100 - v) / 100) * RSI_HEIGHT * 0.85;
    const path = buildLinePath(rsi.values, safeStart, visibleCandlesCount, rsiDim, toY, volumeProfileWidth);

    const ob70Y = rsiDim.padding.top + ((100 - 70) / 100) * RSI_HEIGHT * 0.85;
    const os30Y = rsiDim.padding.top + ((100 - 30) / 100) * RSI_HEIGHT * 0.85;

    return (
      <G>
        <Rect x={leftX} y={rsiDim.padding.top} width={rightX - leftX} height={RSI_HEIGHT} fill="#111827" opacity={0.5} />
        <Line x1={leftX} y1={ob70Y} x2={rightX} y2={ob70Y} stroke="#ef4444" strokeWidth={0.6} strokeDasharray="3,2" opacity={0.5} />
        <Line x1={leftX} y1={os30Y} x2={rightX} y2={os30Y} stroke="#22c55e" strokeWidth={0.6} strokeDasharray="3,2" opacity={0.5} />
        {path ? <Path d={path} stroke="#a78bfa" strokeWidth={1.2} fill="none" /> : null}
        <SvgText x={leftX + 3} y={rsiDim.padding.top + 10} fontSize={8} fill="#6b7280">RSI(14)</SvgText>
      </G>
    );
  }

  function renderMACDPanel(macdDim: ChartDimensions) {
    if (!macd) return null;
    const leftX = macdDim.padding.left;
    const rightX = macdDim.width - macdDim.padding.right - volumeProfileWidth;
    const zeroY = macdDim.padding.top + MACD_HEIGHT * 0.5;

    const histVals = macd.hist.filter((v): v is number => v !== null);
    const maxHist = Math.max(Math.abs(Math.min(...histVals)), Math.abs(Math.max(...histVals)), 0.001);
    const scale = (MACD_HEIGHT * 0.4) / maxHist;
    const slotW = (rightX - leftX) / Math.max(visibleCandlesCount, 1);
    const cw = Math.max(1, slotW * 0.8);

    return (
      <G>
        <Rect x={leftX} y={macdDim.padding.top} width={rightX - leftX} height={MACD_HEIGHT} fill="#111827" opacity={0.5} />
        <Line x1={leftX} y1={zeroY} x2={rightX} y2={zeroY} stroke="#4b5563" strokeWidth={0.6} />
        {macd.hist.slice(safeStart, safeStart + visibleCandlesCount).map((v, i) => {
          if (v === null) return null;
          const x = leftX + (i + 0.5) * slotW;
          const h = Math.abs(v) * scale;
          const y = v >= 0 ? zeroY - h : zeroY;
          return (
            <Rect key={`mh-${i}`} x={x - cw / 2} y={y} width={cw} height={Math.max(0.5, h)}
              fill={v >= 0 ? "#22c55e" : "#ef4444"} opacity={0.7} />
          );
        })}
        <SvgText x={leftX + 3} y={macdDim.padding.top + 10} fontSize={8} fill="#6b7280">MACD(12,26,9)</SvgText>
      </G>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Timeframe selector */}
      <View style={styles.tfRow}>
        {TIMEFRAMES.map(tf => (
          <TouchableOpacity
            key={tf}
            style={[styles.tfBtn, timeframe === tf && styles.tfBtnActive]}
            onPress={() => setTimeframe(tf)}
          >
            <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.zoomBtns}>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom("in")}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom("out")}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Brain score badge */}
      <Animated.View style={[styles.brainBadge, { opacity: alertActive ? alertAnim : 1 }]}>
        <Text style={[styles.brainText, { color: brainScore >= 65 ? "#22c55e" : brainScore <= 45 ? "#ef4444" : "#f59e0b" }]}>
          ⚡ {brainScore}
        </Text>
      </Animated.View>

      {/* Main chart area */}
      <View
        style={styles.chartArea}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={C.primary} size="small" />
            <Text style={styles.loadingText}>Loading {symbol}…</Text>
          </View>
        )}
        {error && !loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!loading && !error && dim && (
          <>
            <Svg width={dim.width} height={dim.height}>
              <Defs>
                <ClipPath id="chartClip">
                  <Rect x={dim.padding.left} y={0} width={dim.width - dim.padding.left - dim.padding.right} height={dim.height} />
                </ClipPath>
              </Defs>

              {/* Background */}
              <Rect x={0} y={0} width={dim.width} height={dim.height} fill="#0d0f14" />

              {/* Grid */}
              {renderGrid()}

              {/* Order book heatmap (behind candles) */}
              {layers.orderBook && (
                <G clipPath="url(#chartClip)">
                  <OrderBookHeatmap
                    orderBook={orderBook}
                    dim={dim}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    volumeProfileWidth={volumeProfileWidth}
                  />
                </G>
              )}

              {/* Regime tints */}
              {layers.regime && (
                <G clipPath="url(#chartClip)">
                  <RegimeLayer
                    regimes={regimeData}
                    candles={effectiveCandles}
                    visibleStart={safeStart}
                    visibleCount={visibleCandlesCount}
                    dim={dim}
                    volumeProfileWidth={volumeProfileWidth}
                  />
                </G>
              )}

              {/* Funding History layer (subtle bars behind candles) */}
              {layers.fundingHistory && fundingHistory.length > 0 && (
                <G clipPath="url(#chartClip)">
                  {renderFundingHistoryLayer()}
                </G>
              )}

              {/* Bollinger Bands */}
              {layers.bb && (
                <G clipPath="url(#chartClip)">
                  {renderBollingerBands()}
                </G>
              )}

              {/* Strategy lines */}
              {layers.strategy && strategy && (
                <StrategyLayer
                  strategy={strategy}
                  dim={dim}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  volumeProfileWidth={volumeProfileWidth}
                />
              )}

              {/* Candles */}
              <G clipPath="url(#chartClip)">
                {renderCandleLayer()}
              </G>

              {/* Volume bars */}
              <G clipPath="url(#chartClip)">
                {renderVolumeLayer()}
              </G>

              {/* Multi-asset overlay */}
              {layers.overlay && overlayCandles.length > 0 && (
                <G clipPath="url(#chartClip)">
                  <MultiAssetOverlay
                    overlayCandles={overlayCandles}
                    mainCandles={effectiveCandles}
                    visibleStart={safeStart}
                    visibleCount={visibleCandlesCount}
                    dim={dim}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    volumeProfileWidth={volumeProfileWidth}
                  />
                </G>
              )}

              {/* Execution markers */}
              {layers.executions && executions.length > 0 && (
                <G clipPath="url(#chartClip)">
                  <ExecutionLayer
                    executions={executions}
                    candles={effectiveCandles}
                    visibleStart={safeStart}
                    visibleCount={visibleCandlesCount}
                    dim={dim}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    volumeProfileWidth={volumeProfileWidth}
                    onPress={onExecutionPress}
                  />
                </G>
              )}

              {/* Annotations */}
              {layers.annotations && annotations.length > 0 && (
                <G clipPath="url(#chartClip)">
                  <AnnotationLayer
                    annotations={annotations}
                    candles={effectiveCandles}
                    visibleStart={safeStart}
                    visibleCount={visibleCandlesCount}
                    dim={dim}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    volumeProfileWidth={volumeProfileWidth}
                    onPress={onAnnotationPress}
                  />
                </G>
              )}

              {/* VWAP line */}
              {layers.vwap && vwapValues && (
                <G clipPath="url(#chartClip)">
                  {renderVWAP()}
                </G>
              )}

              {/* Mark Price line */}
              {layers.markPrice && markPrice && (
                <G clipPath="url(#chartClip)">
                  {renderMarkPriceLine()}
                </G>
              )}

              {/* Active Bot overlays */}
              {layers.botOverlay && activeBots.length > 0 && (
                <G clipPath="url(#chartClip)">
                  <ActiveBotLayer
                    bots={activeBots}
                    dim={dim}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    volumeProfileWidth={volumeProfileWidth}
                  />
                </G>
              )}

              {/* Price Alert lines */}
              {layers.priceAlerts && priceAlerts.length > 0 && (
                <G clipPath="url(#chartClip)">
                  <AlertLayer
                    alerts={priceAlerts}
                    dim={dim}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    volumeProfileWidth={volumeProfileWidth}
                  />
                </G>
              )}

              {/* XAI Balloon on last candle */}
              {layers.xaiBalloon && xaiExplanation && visibleCandles.length > 0 && (
                <G>
                  <XAIBalloon
                    explanation={xaiExplanation}
                    dim={dim}
                    lastCandleX={indexToX(visibleCandlesCount - 1, visibleCandlesCount, dim, volumeProfileWidth)}
                    lastCandleY={priceToY(visibleCandles[visibleCandlesCount - 1]?.high ?? 0, minPrice, maxPrice, dim)}
                  />
                </G>
              )}

              {/* Leverage Guard overlay */}
              {leverageGuardActive && renderLeverageGuardOverlay()}

              {/* Projection cone */}
              {layers.projection && projectionPoints.length > 0 && (
                <ProjectionLayer
                  points={projectionPoints}
                  lastX={indexToX(visibleCandlesCount - 1, visibleCandlesCount, dim, volumeProfileWidth)}
                  lastY={priceToY(visibleCandles[visibleCandlesCount - 1]?.close ?? 0, minPrice, maxPrice, dim)}
                  brainScore={brainScore}
                />
              )}

              {/* Volume profile (right side) */}
              {layers.volumeProfile && (
                <VolumeProfileLayer
                  buckets={volumeProfileBuckets}
                  dim={dim}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  width={VOLUME_PROFILE_WIDTH}
                />
              )}

              {/* HiveMind bar (top strip) */}
              {layers.hiveMind && (
                <HiveMindBar
                  bullPercent={hiveMindBull}
                  dim={dim}
                  volumeProfileWidth={volumeProfileWidth}
                />
              )}

              {/* Y Axis */}
              {renderYAxis()}

              {/* X Axis */}
              {renderXAxis()}

              {/* Tooltip */}
              {renderTooltip()}

              {/* Crosshair — always on top */}
              {layers.crosshair && renderCrosshair()}
            </Svg>

            {/* RSI Panel */}
            {layers.rsi && (
              <Svg width={dim.width} height={RSI_HEIGHT + 6}>
                {renderRSIPanel({
                  ...dim,
                  height: RSI_HEIGHT,
                  candleAreaHeight: RSI_HEIGHT,
                  volumeAreaHeight: 0,
                  padding: { top: 2, right: dim.padding.right, bottom: 4, left: dim.padding.left },
                })}
              </Svg>
            )}

            {/* MACD Panel */}
            {layers.macd && (
              <Svg width={dim.width} height={MACD_HEIGHT + 6}>
                {renderMACDPanel({
                  ...dim,
                  height: MACD_HEIGHT,
                  candleAreaHeight: MACD_HEIGHT,
                  volumeAreaHeight: 0,
                  padding: { top: 2, right: dim.padding.right, bottom: 4, left: dim.padding.left },
                })}
              </Svg>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0f14",
  },
  tfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff0a",
    backgroundColor: "#0d0f14",
  },
  tfBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 5,
    minWidth: 28,
    alignItems: "center",
  },
  tfBtnActive: {
    backgroundColor: "#06b6d422",
  },
  tfText: {
    fontSize: 11,
    color: "#4b5563",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  tfTextActive: {
    color: "#06b6d4",
    fontWeight: "700",
  },
  zoomBtns: {
    flexDirection: "row",
    marginLeft: "auto",
    gap: 3,
  },
  zoomBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#ffffff08",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ffffff0a",
  },
  zoomText: {
    color: "#6b7280",
    fontSize: 15,
    lineHeight: 17,
    fontWeight: "bold",
  },
  brainBadge: {
    position: "absolute",
    top: 36,
    right: 56,
    zIndex: 10,
    backgroundColor: "#0d0f14",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#ffffff0a",
  },
  brainText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  chartArea: {
    flex: 1,
    minHeight: 280,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#6b7280",
    fontSize: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
  },
});
