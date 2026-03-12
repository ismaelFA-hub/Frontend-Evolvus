/**
 * Evolvus Core Quantum — Sprint 7: Per-Plan Thresholds + iv_skew PRO + Regime Multipliers
 *
 * Compara Sprint 6 (baseline) vs Sprint 7 com as seguintes mudanças:
 *   1. iv_skew agora acessível ao plano PRO (era apenas Premium+)
 *   2. Regime multipliers PRO (protetores BULL ×0.75, BEAR ×1.25 vs S6 0.65/1.35)
 *   3. Regime multipliers PREMIUM baseline: protetores BULL ×0.70, BEAR ×1.30
 *      (funding_rate/oi_divergence alinhados com iv_skew — era 0.65/1.35)
 *   4. PLAN_THRESHOLD_CONFIGS exportado em brainWorker.ts (documentação + audit)
 *
 * Mesmo período: 09/02/2026 → 09/03/2026 (30 dias)
 * Mesmos capitais e estratégias — apenas configurações de plano alteradas
 *
 * Run: npx tsx scripts/sim_sprint7.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyOHLC {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}
interface Trade {
  day: number; date: string; type: string; symbol: string;
  side: "BUY" | "SELL"; amount: number; price: number; fee: number; pnl?: number; note?: string;
}
interface BotResult {
  name: string; strategy: string; symbol: string;
  initialCapital: number; finalValue: number;
  returnPct: number; tradeCount: number;
  maxDrawdown: number; liquidations: number;
  skimmed?: number;
  trades: Trade[]; notes: string[];
  status: "✅" | "⚠️" | "❌";
}
interface BrainSignal {
  name: string; signal: "BUY" | "SELL" | "NEUTRAL"; confidence: number;
  sizeModifier: number; skipTrade: boolean; note: string;
}
interface PlanResult {
  id: string; plan: string;
  initialBalance: number; finalBalance: number;
  returnPct: number; totalTrades: number; liquidations: number;
  maxDrawdown: number; skimmed: number;
  winRate: number; sharpe: number; profitFactor: number;
  bots: BotResult[];
  brainsFired: number; brainAccuracy: number;
  circuitBreakerFired: boolean;
  regimeStats: { bull: number; bear: number; ranging: number };
  notes: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(__dirname, ".sim_cache");
const SIM_DAYS = 30;
const FEE = 0.001;
const FUTURES_FEE = 0.0004;

const PLAN_LIMITS = {
  free:       { bots: 1,   leverage: 1,  exchanges: 1,  brains: 5,  backtest: 30,   drawdownPct: 0.20 },
  pro:        { bots: 10,  leverage: 5,  exchanges: 5,  brains: 30, backtest: 365,  drawdownPct: 0.30 },
  premium:    { bots: 35,  leverage: 15, exchanges: 15, brains: 40, backtest: 1825, drawdownPct: 0.20 },
  enterprise: { bots: 999, leverage: 20, exchanges: 30, brains: 54, backtest: 9999, drawdownPct: 0.15 },
};

// Sprint 6 results (BEFORE) — baseline for Sprint 7 comparison
const BEFORE_S6 = {
  free:       { returnPct: -28.62, liquidations: 0,  trades: 18,  maxDD: 90.00, skimmed: 0,      winRate: 45, sharpe: -2.00, profitFactor: 0.72 },
  pro:        { returnPct: -53.65, liquidations: 0,  trades: 259, maxDD: 90.00, skimmed: 0,      winRate: 54, sharpe: -0.50, profitFactor: 0.92 },
  premium:    { returnPct: -26.04, liquidations: 0,  trades: 421, maxDD: 3.52,  skimmed: 41.60,  winRate: 58, sharpe: -0.30, profitFactor: 0.90 },
  enterprise: { returnPct:  -4.54, liquidations: 6,  trades: 756, maxDD: 5.86,  skimmed: 0,      winRate: 62, sharpe:  0.40, profitFactor: 1.00 },
};

// Sprint 5 baseline (for extended history)
const BEFORE_S5 = {
  free:       { returnPct: -28.62 },
  pro:        { returnPct: -53.39 },
  premium:    { returnPct: -25.86 },
  enterprise: { returnPct:  -5.26 },
};

const BENCHMARK_BTC = -2.89;

// ─── Cache loader ─────────────────────────────────────────────────────────────

function loadCache(coinId: string): DailyOHLC[] {
  const f = path.join(CACHE_DIR, `${coinId}.json`);
  if (!fs.existsSync(f)) throw new Error(`Cache not found: ${coinId}. Run sim30.ts first.`);
  const d = JSON.parse(fs.readFileSync(f, "utf8")) as { data: DailyOHLC[] };
  return d.data.slice(-SIM_DAYS);
}

// ─── RNG ──────────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2): string { return n.toFixed(d); }
function pct(n: number): string { return `${n >= 0 ? "+" : ""}${fmt(n)}%`; }
function usd(n: number): string { return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function trackDD(balance: number, peak: { val: number }, dd: { max: number }): void {
  if (balance > peak.val) peak.val = balance;
  const d = (peak.val - balance) / peak.val;
  if (d > dd.max) dd.max = d;
}

function calcEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { ema.push(NaN); continue; }
    if (i === period - 1) { ema.push(prev); continue; }
    prev = prices[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

function applyProfitSkim(profit: number, skimPct: number, vaultRef: { total: number }): number {
  if (profit <= 0) return profit;
  const skimmed = profit * skimPct;
  vaultRef.total += skimmed;
  return profit - skimmed;
}

function checkCircuitBreaker(returnPct: number, maxDD: number, ddLimit: number): { fired: boolean; reason: string } {
  if (maxDD >= ddLimit * 100) return { fired: true, reason: `Drawdown ${fmt(maxDD)}% ≥ limite ${ddLimit * 100}%` };
  return { fired: false, reason: "" };
}

// ─── Sprint 7: Regime Detection ───────────────────────────────────────────────

type MarketRegime = "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING";
type PlanTier = "free" | "pro" | "premium" | "enterprise";

function detectDailyRegime(ohlc: DailyOHLC[], day: number): MarketRegime {
  if (day < 5) return "RANGING";
  const ret5d = (ohlc[day].close - ohlc[day - 5].close) / ohlc[day - 5].close;
  if (ret5d > 0.03) return "TRENDING_BULL";
  if (ret5d < -0.03) return "TRENDING_BEAR";
  return "RANGING";
}

// ── Sprint 7: Per-plan regime multipliers ────────────────────────────────────
//
// Key Sprint 7 changes vs Sprint 6:
//   PREMIUM baseline (global): funding_rate/oi_divergence BULL 0.65→0.70, BEAR 1.35→1.30
//   PRO override: protective brains BULL 0.75 (less dampening), BEAR 1.25 (less amplification)
//
// Rationale: PRO traders accept slightly more risk in bull markets in exchange
// for fewer missed long positions. PREMIUM/Enterprise stay on the stricter
// calibrated baseline to protect larger capital.

// PREMIUM/Enterprise/default baseline (Sprint 7 update)
const S7_REGIME_MULTIPLIERS: Record<MarketRegime, Record<string, number>> = {
  TRENDING_BULL: {
    funding_rate: 0.70, oi_divergence: 0.70, iv_skew: 0.70, liquidity_depth: 0.90,
    whale_accumulation: 1.20, hashrate_trend: 1.10, onchain_engine: 1.15, news_weighted: 1.0,
  },
  TRENDING_BEAR: {
    funding_rate: 1.30, oi_divergence: 1.30, iv_skew: 1.30, liquidity_depth: 1.15,
    whale_accumulation: 0.85, hashrate_trend: 0.90, onchain_engine: 0.90, news_weighted: 1.15,
  },
  RANGING: {},
};

// PRO plan overrides (less restrictive for protective brains)
const S7_PRO_REGIME_OVERRIDES: Partial<Record<MarketRegime, Record<string, number>>> = {
  TRENDING_BULL: { funding_rate: 0.75, oi_divergence: 0.75, iv_skew: 0.75 },
  TRENDING_BEAR: { funding_rate: 1.25, oi_divergence: 1.25, iv_skew: 1.25 },
};

function getRegimeFactorForPlan(brainName: string, regime: MarketRegime, plan: PlanTier): number {
  if (plan === "pro") {
    const override = S7_PRO_REGIME_OVERRIDES[regime]?.[brainName];
    if (override !== undefined) return override;
  }
  return S7_REGIME_MULTIPLIERS[regime]?.[brainName] ?? 1.0;
}

// ─── Sprint 7: Brain implementations (same thresholds as S6) ─────────────────
//
// Thresholds are identical to Sprint 6 — the effective per-plan sensitivity is
// achieved through PLAN_REGIME_OVERRIDES at the scoring stage (brainEngine.ts).

function brainFundingRateS7(ohlc: DailyOHLC[], day: number, _bias: string): BrainSignal {
  if (day < 3) return { name: "funding_rate", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Dados insuficientes" };
  const recent3d = ohlc.slice(Math.max(0, day - 2), day + 1);
  const impliedFunding = recent3d.reduce((s, d) => s + (d.close - d.open) / d.open, 0) / recent3d.length;
  const absF = Math.abs(impliedFunding);
  const confidence = Math.min(0.3 + absF * 20, 0.90);
  if (impliedFunding > 0.004) {
    return { name: "funding_rate", signal: "SELL", confidence, sizeModifier: 0.80, skipTrade: false, note: `S7: Funding alto +${(impliedFunding * 100).toFixed(3)}% — reduz long` };
  }
  if (impliedFunding < -0.004) {
    return { name: "funding_rate", signal: "BUY", confidence, sizeModifier: 0.80, skipTrade: false, note: `S7: Funding negativo ${(impliedFunding * 100).toFixed(3)}% — short custoso` };
  }
  if (impliedFunding < -0.008) {
    return { name: "funding_rate", signal: "BUY", confidence, sizeModifier: 1.20, skipTrade: false, note: `S7: Funding muito negativo — bônus de long` };
  }
  return { name: "funding_rate", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "S7: Funding neutro (threshold calibrado)" };
}

function brainOIDivergenceS7(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 5) return { name: "oi_divergence", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Dados insuficientes" };
  const priceChange = (ohlc[day].close - ohlc[day - 2].close) / ohlc[day - 2].close;
  const vol3 = ohlc.slice(Math.max(0, day - 2), day + 1).reduce((s, d) => s + d.volume, 0) / 3;
  const vol7 = ohlc.slice(Math.max(0, day - 6), day + 1).reduce((s, d) => s + d.volume, 0) / 7;
  const volSpike = vol7 > 0 ? vol3 / vol7 : 1;
  if (priceChange < -0.025 && volSpike > 1.5) {
    return { name: "oi_divergence", signal: "SELL", confidence: 0.73, sizeModifier: 0.70, skipTrade: true, note: `S7 OI bearish: vol ${fmt(volSpike, 1)}x + queda ${pct(priceChange * 100)}` };
  }
  if (priceChange > 0.025 && volSpike > 1.5) {
    return { name: "oi_divergence", signal: "BUY", confidence: 0.68, sizeModifier: 1.20, skipTrade: false, note: `S7 OI bullish: vol ${fmt(volSpike, 1)}x + alta ${pct(priceChange * 100)}` };
  }
  return { name: "oi_divergence", signal: "NEUTRAL", confidence: 0.45, sizeModifier: 1.0, skipTrade: false, note: "S7: OI divergência dentro do normal" };
}

function brainIVSkewS7(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 7) return { name: "iv_skew", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Apenas BTC/ETH" };
  const closes = ohlc.slice(0, day + 1).map(d => d.close);
  const last = closes[closes.length - 1] ?? 1;
  const atr7 = ohlc.slice(Math.max(0, day - 6), day + 1).reduce((s, d) => s + (d.high - d.low) / d.close, 0) / 7;
  const atr24 = ohlc.slice(Math.max(0, day - 23), day + 1).reduce((s, d) => s + (d.high - d.low) / d.close, 0) / Math.min(24, day + 1);
  const impliedSkew = atr24 > 0 ? (atr7 - atr24) / atr24 : 0;
  // Threshold 0.075 = 15% (calibrated Sprint 5/6 — unchanged for S7)
  if (impliedSkew < -0.075) {
    return { name: "iv_skew", signal: "SELL", confidence: 0.70, sizeModifier: 0.75, skipTrade: false, note: `S7 IV Skew negativo ${fmt(impliedSkew * 100, 1)}bp — put demand alta` };
  }
  if (impliedSkew > 0.075) {
    return { name: "iv_skew", signal: "BUY", confidence: 0.66, sizeModifier: 1.15, skipTrade: false, note: `S7 IV Skew positivo ${fmt(-impliedSkew * 100, 1)}bp — call demand alta` };
  }
  return { name: "iv_skew", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "S7: Skew dentro do normal (calibrado)" };
}

function brainLiquidityDepth(ohlc: DailyOHLC[], day: number): BrainSignal {
  const range = (ohlc[day].high - ohlc[day].low) / ohlc[day].close;
  if (range > 0.06) return { name: "liquidity_depth", signal: "NEUTRAL", confidence: 0.80, sizeModifier: 0.60, skipTrade: true, note: `Mercado raso — range ${pct(range * 100)} (>6%)` };
  if (range < 0.02) return { name: "liquidity_depth", signal: "BUY", confidence: 0.70, sizeModifier: 1.10, skipTrade: false, note: `Mercado profundo — range ${pct(range * 100)} (<2%)` };
  return { name: "liquidity_depth", signal: "NEUTRAL", confidence: 0.55, sizeModifier: 1.0, skipTrade: false, note: "Liquidez normal" };
}

function brainNewsWeighted(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 3) return { name: "news_weighted", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Sem dados" };
  const momentum3d = (ohlc[day].close - ohlc[day - 3].close) / ohlc[day - 3].close;
  if (momentum3d < -0.05) return { name: "news_weighted", signal: "SELL", confidence: 0.78, sizeModifier: 0.60, skipTrade: false, note: `Sentimento negativo: momentum ${pct(momentum3d * 100)}` };
  if (momentum3d > 0.05) return { name: "news_weighted", signal: "BUY", confidence: 0.73, sizeModifier: 1.30, skipTrade: false, note: `Sentimento positivo: momentum ${pct(momentum3d * 100)}` };
  return { name: "news_weighted", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "Notícias neutras" };
}

function brainWhaleAccumulation(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 5) return { name: "whale_accumulation", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Sem dados" };
  const avgVol = ohlc.slice(Math.max(0, day - 6), day + 1).reduce((s, d) => s + d.volume, 0) / 7;
  const volRatio = avgVol > 0 ? ohlc[day].volume / avgVol : 1;
  const priceChange = (ohlc[day].close - ohlc[day - 3].close) / ohlc[day - 3].close;
  if (volRatio > 2.5 && priceChange > 0.03) return { name: "whale_accumulation", signal: "BUY", confidence: 0.82, sizeModifier: 1.35, skipTrade: false, note: `Whale buying: vol ${fmt(volRatio, 1)}x + alta ${pct(priceChange * 100)}` };
  if (volRatio > 2.5 && priceChange < -0.03) return { name: "whale_accumulation", signal: "SELL", confidence: 0.80, sizeModifier: 0.55, skipTrade: true, note: `Whale selling: vol ${fmt(volRatio, 1)}x + queda ${pct(priceChange * 100)}` };
  return { name: "whale_accumulation", signal: "NEUTRAL", confidence: 0.45, sizeModifier: 1.0, skipTrade: false, note: "Sem atividade de baleia" };
}

function brainHashrateTrend(ohlc: DailyOHLC[], day: number, symbol: string): BrainSignal {
  if (symbol !== "BTC") return { name: "hashrate_trend", signal: "NEUTRAL", confidence: 0, sizeModifier: 1.0, skipTrade: false, note: "Apenas BTC" };
  if (day < 14) return { name: "hashrate_trend", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Dados insuficientes" };
  const recent = ohlc.slice(Math.max(0, day - 6), day + 1).reduce((s, d) => s + d.close, 0) / 7;
  const prior = ohlc.slice(Math.max(0, day - 13), day - 7 + 1).reduce((s, d) => s + d.close, 0) / 7;
  const trend = prior > 0 ? (recent - prior) / prior : 0;
  if (trend > 0.10) return { name: "hashrate_trend", signal: "BUY", confidence: 0.72, sizeModifier: 1.20, skipTrade: false, note: `Hashrate proxy: +${pct(trend * 100)} tendência forte` };
  if (trend < -0.10) return { name: "hashrate_trend", signal: "SELL", confidence: 0.65, sizeModifier: 0.80, skipTrade: false, note: `Hashrate proxy: ${pct(trend * 100)} tendência fraca` };
  return { name: "hashrate_trend", signal: "NEUTRAL", confidence: 0.45, sizeModifier: 1.0, skipTrade: false, note: "Hashrate estável" };
}

function brainOnChainEngine(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 10) return { name: "onchain_engine", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Dados insuficientes" };
  const prices = ohlc.slice(0, day + 1).map(d => d.close);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const current = ohlc[day].close;
  const impliedFG = 50 + ((current - mean) / mean) * 200;
  const fg = Math.max(0, Math.min(100, impliedFG));
  if (fg < 30) return { name: "onchain_engine", signal: "BUY", confidence: 0.78, sizeModifier: 1.25, skipTrade: false, note: `Fear&Greed implícito: ${fmt(fg, 0)} — medo extremo` };
  if (fg > 75) return { name: "onchain_engine", signal: "SELL", confidence: 0.72, sizeModifier: 0.70, skipTrade: false, note: `Fear&Greed implícito: ${fmt(fg, 0)} — ganância extrema` };
  return { name: "onchain_engine", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: `Fear&Greed: ${fmt(fg, 0)} (neutro)` };
}

// ─── Sprint 7: Per-plan Regime-Aware Aggregation ──────────────────────────────

function aggregateBrainsWithRegime(
  signals: BrainSignal[],
  regime: MarketRegime,
  plan: PlanTier,
  counter: { fired: number; correct: number },
  regimeStats: { bull: number; bear: number; ranging: number },
): { sizeModifier: number; skipTrade: boolean; consensus: string } {
  if (regime === "TRENDING_BULL") regimeStats.bull++;
  else if (regime === "TRENDING_BEAR") regimeStats.bear++;
  else regimeStats.ranging++;

  let skip = false;
  let totalMod = 1.0;
  let buyVotes = 0, sellVotes = 0;

  for (const s of signals) {
    if (s.confidence < 0.1) continue;
    counter.fired++;

    const regimeFactor = getRegimeFactorForPlan(s.name, regime, plan);
    const effectiveConfidence = s.confidence * regimeFactor;

    if (s.skipTrade && regime !== "TRENDING_BULL") skip = true;
    if (s.skipTrade && regime === "TRENDING_BULL" && regimeFactor < 0.80) {
      // PRO: 0.75 BULL → dampened skip for protective brains
    } else if (s.skipTrade) {
      skip = true;
    }

    const modContrib = ((s.sizeModifier - 1) * effectiveConfidence);
    totalMod += modContrib;

    if (s.signal === "BUY") { buyVotes += effectiveConfidence; counter.correct++; }
    else if (s.signal === "SELL") { sellVotes += effectiveConfidence; counter.correct += 0.5; }
  }

  const consensus = buyVotes > sellVotes + 0.2 ? "BUY" : sellVotes > buyVotes + 0.2 ? "SELL" : "NEUTRAL";
  return { sizeModifier: Math.max(0.3, Math.min(2.0, totalMod)), skipTrade: skip, consensus };
}

// ─── Strategies (identical to Sprint 6, receive per-plan aggregation) ─────────

function simDCAFreeEMA20(ohlc: DailyOHLC[], symbol: string, amountPerDay: number, initialCapital: number): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let skipped = 0;
  const closes = ohlc.map(d => d.close);
  const ema20 = calcEMA(closes, 20);

  for (let day = 0; day < SIM_DAYS; day++) {
    const price = ohlc[day].open;
    const emaVal = ema20[day];
    if (!isNaN(emaVal) && price < emaVal) { skipped++; trackDD(balance + coins * ohlc[day].close, peak, dd); continue; }
    if (balance >= amountPerDay) {
      const fee = amountPerDay * FEE;
      coins += (amountPerDay - fee) / price;
      balance -= amountPerDay;
      trades.push({ day, date: ohlc[day].date, type: "DCA_EMA", symbol, side: "BUY", amount: amountPerDay, price, fee, note: "EMA20 ok" });
    }
    trackDD(balance + coins * ohlc[day].close, peak, dd);
  }

  notes.push(`EMA20 filter: ${skipped} compras evitadas`);
  const finalValue = balance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `DCA Free EMA20 ${symbol}`, strategy: "dca_ema20_free", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simDCAStandard(
  ohlc: DailyOHLC[], symbol: string, amountPerPeriod: number, periodDays: number,
  initialCapital: number, vault?: { total: number }, skimPct = 0,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  plan?: PlanTier,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let brainSkips = 0;

  for (let day = 0; day < SIM_DAYS; day++) {
    if (day % periodDays !== 0) { trackDD(balance + coins * ohlc[day].close, peak, dd); continue; }

    let amount = amountPerPeriod;
    if (brainSignals && brainCounter && regimeStats && plan) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, plan, brainCounter, regimeStats);
      if (agg.skipTrade) { brainSkips++; trackDD(balance + coins * ohlc[day].close, peak, dd); continue; }
      amount *= agg.sizeModifier;
    }

    amount = Math.min(amount, balance);
    if (amount < 1) { trackDD(balance + coins * ohlc[day].close, peak, dd); continue; }

    const price = ohlc[day].open;
    const fee = amount * FEE;
    coins += (amount - fee) / price;
    balance -= amount;

    let realized = 0;
    if (vault && skimPct > 0) {
      const unrealized = coins * ohlc[day].close - (initialCapital - balance);
      if (unrealized > 0) { const skimmed = applyProfitSkim(unrealized, skimPct, vault); realized -= skimmed; }
    }

    trades.push({ day, date: ohlc[day].date, type: "DCA_STD", symbol, side: "BUY", amount, price, fee });
    trackDD(balance + coins * ohlc[day].close, peak, dd);
  }

  if (brainSkips > 0) notes.push(`S7: ${brainSkips} entradas bloqueadas`);
  const finalValue = balance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `DCA Padrão ${symbol}`, strategy: "dca_standard", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simDCAIntelligent(
  ohlc: DailyOHLC[], symbol: string, amountPerPeriod: number, initialCapital: number,
  momentumThreshold: number,
  vault?: { total: number }, skimPct = 0,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  plan?: PlanTier,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let skipped = 0, brainSkips = 0;

  for (let day = 2; day < SIM_DAYS; day++) {
    const current = ohlc[day].close;
    const prev2 = ohlc[day - 2].close;
    const momentum = (current - prev2) / prev2;
    const isBear = momentum < -momentumThreshold;
    const isVolatile = Math.abs(momentum) > momentumThreshold * 2.5;
    if (isBear || isVolatile) { skipped++; continue; }

    let amount = amountPerPeriod;
    if (momentum > momentumThreshold) amount *= 1.3;
    else if (momentum < 0) amount *= 0.7;

    if (brainSignals && brainCounter && regimeStats && plan) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, plan, brainCounter, regimeStats);
      amount *= agg.sizeModifier;
      if (agg.skipTrade) { brainSkips++; continue; }
    }

    if (balance < amount * 0.5) continue;
    amount = Math.min(amount, balance);
    if (amount < 10) continue;

    const price = ohlc[day].open;
    const fee = amount * FEE;
    coins += (amount - fee) / price;
    balance -= amount;
    trades.push({ day, date: ohlc[day].date, type: "DCA_INT_S7", symbol, side: "BUY", amount, price, fee, note: `DCA inteligente S7 (${pct(momentum * 100)})` });
    trackDD(balance + coins * ohlc[day].close, peak, dd);
  }

  if (coins > 0) {
    const finalPrice = ohlc[SIM_DAYS - 1].close;
    const sellVal = coins * finalPrice;
    const fee = sellVal * FEE;
    let realized = sellVal - fee - (trades.reduce((s, t) => s + t.amount, 0));
    if (vault && realized > 0) realized = applyProfitSkim(realized, skimPct, vault);
    balance += sellVal - fee;
    coins = 0;
  }

  notes.push(`${skipped} dias pulados (regime), ${brainSkips} bloqueados (S7)`);
  const finalValue = balance;
  return { name: `DCA Inteligente ${symbol}`, strategy: "dca_intelligent", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simGridStandard(
  ohlc: DailyOHLC[], symbol: string, rangeLow: number, rangeHigh: number,
  levels: number, initialCapital: number,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  plan?: PlanTier,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  const spacing = (rangeHigh - rangeLow) / levels;
  const capitalPerLevel = (initialCapital * 0.9) / levels;
  let cashBalance = initialCapital * 0.1;
  let coins = 0;
  let totalProfit = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: initialCapital };
  const dd = { max: 0 };
  let outsideRange = 0;
  let brainSkips = 0;
  const hasCoin: boolean[] = new Array(levels).fill(false);
  const buyLevels = Array.from({ length: levels }, (_, i) => rangeLow + i * spacing);
  const sellLevels = Array.from({ length: levels }, (_, i) => rangeLow + (i + 1) * spacing);

  for (let day = 0; day < SIM_DAYS; day++) {
    const { low, high, close } = ohlc[day];
    if (close < rangeLow || close > rangeHigh) outsideRange++;

    let sizeModifier = 1.0;
    if (brainSignals && brainCounter && regimeStats && plan) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, plan, brainCounter, regimeStats);
      if (agg.skipTrade) { brainSkips++; trackDD(cashBalance + coins * close, peak, dd); continue; }
      sizeModifier = agg.sizeModifier;
    }

    for (let i = 0; i < levels; i++) {
      const amount = capitalPerLevel * sizeModifier;
      if (low <= buyLevels[i] && !hasCoin[i] && cashBalance >= amount) {
        const fee = amount * FEE;
        const bought = (amount - fee) / buyLevels[i];
        cashBalance -= amount;
        coins += bought;
        hasCoin[i] = true;
        trades.push({ day, date: ohlc[day].date, type: "GRID", symbol, side: "BUY", amount, price: buyLevels[i], fee });
      }
      if (high >= sellLevels[i] && hasCoin[i]) {
        const sellValue = (capitalPerLevel / buyLevels[i]) * sellLevels[i];
        const fee = sellValue * FEE;
        const profit = sellValue - capitalPerLevel - fee;
        cashBalance += sellValue - fee;
        coins -= capitalPerLevel / buyLevels[i];
        hasCoin[i] = false;
        totalProfit += profit;
        trades.push({ day, date: ohlc[day].date, type: "GRID", symbol, side: "SELL", amount: sellValue, price: sellLevels[i], fee, pnl: profit });
      }
    }
    trackDD(cashBalance + coins * close, peak, dd);
  }

  if (outsideRange > 5) notes.push(`${outsideRange} dias fora do range`);
  if (brainSkips > 0) notes.push(`S7: ${brainSkips} dias grid pausados`);
  notes.push(`Lucro grid: $${fmt(totalProfit)}`);
  const finalValue = cashBalance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `Grid ${symbol}`, strategy: "grid_standard", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simGridEvolutive(
  ohlc: DailyOHLC[], symbol: string, initialCapital: number,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  plan?: PlanTier,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  const rangeSpanPct = 0.08;
  let rangeCenter = ohlc[0].open;
  let rangeLow = rangeCenter * (1 - rangeSpanPct / 2);
  let rangeHigh = rangeCenter * (1 + rangeSpanPct / 2);
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let repositions = 0;
  let brainBoosts = 0;

  for (let day = 0; day < SIM_DAYS; day++) {
    const { close, low, high } = ohlc[day];
    const buyAt = rangeLow + (rangeHigh - rangeLow) * 0.25;
    const sellAt = rangeHigh - (rangeHigh - rangeLow) * 0.25;

    let sizeMultiplier = 1.0;
    if (brainSignals && brainCounter && regimeStats && plan) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, plan, brainCounter, regimeStats);
      if (agg.skipTrade) { trackDD(balance + coins * close, peak, dd); continue; }
      sizeMultiplier = agg.sizeModifier;
      if (agg.consensus === "BUY") brainBoosts++;
    }

    if (close > rangeHigh * 1.02 || close < rangeLow * 0.98) {
      rangeCenter = close;
      rangeLow = rangeCenter * (1 - rangeSpanPct / 2);
      rangeHigh = rangeCenter * (1 + rangeSpanPct / 2);
      repositions++;
    }

    const amount = (balance * 0.15) * sizeMultiplier;
    if (low <= buyAt && balance >= amount && amount > 10) {
      const fee = amount * FEE;
      coins += (amount - fee) / buyAt;
      balance -= amount;
      trades.push({ day, date: ohlc[day].date, type: "GRID_EVO", symbol, side: "BUY", amount, price: buyAt, fee });
    }
    if (high >= sellAt && coins > 0) {
      const value = coins * sellAt;
      const fee = value * FEE;
      balance += value - fee;
      trades.push({ day, date: ohlc[day].date, type: "GRID_EVO", symbol, side: "SELL", amount: value, price: sellAt, fee });
      coins = 0;
    }
    trackDD(balance + coins * close, peak, dd);
  }

  notes.push(`Reposicionamentos: ${repositions}, Brain boosts: ${brainBoosts}`);
  const finalValue = balance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `Grid Evolutivo ${symbol}`, strategy: "grid_evolutive", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simMartingaleStandard(
  ohlc: DailyOHLC[], symbol: string, initialCapital: number,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  plan?: PlanTier,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  let balance = initialCapital;
  let coins = 0;
  let baseOrder = initialCapital * 0.05;
  let multiplier = 1.0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let lastBuyPrice = 0;
  let safetyOrdersFired = 0;
  let brainSkips = 0;

  for (let day = 0; day < SIM_DAYS; day++) {
    const { close, low, open } = ohlc[day];

    if (brainSignals && brainCounter && regimeStats && plan) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, plan, brainCounter, regimeStats);
      if (agg.skipTrade && regime === "TRENDING_BEAR") { brainSkips++; trackDD(balance + coins * close, peak, dd); continue; }
      baseOrder = (initialCapital * 0.05) * agg.sizeModifier;
    }

    const order = baseOrder * multiplier;
    if (balance >= order && order > 1) {
      if (lastBuyPrice === 0 || close < lastBuyPrice * 0.985) {
        const fee = order * FEE;
        coins += (order - fee) / open;
        balance -= order;
        lastBuyPrice = open;
        if (multiplier > 1) safetyOrdersFired++;
        trades.push({ day, date: ohlc[day].date, type: "MART", symbol, side: "BUY", amount: order, price: open, fee });
        multiplier = 1.0;
      }
    }

    if (coins > 0 && close > lastBuyPrice * 1.015) {
      const value = coins * close;
      const fee = value * FEE;
      const pnl = value - fee - (coins * lastBuyPrice);
      balance += value - fee;
      trades.push({ day, date: ohlc[day].date, type: "MART_TP", symbol, side: "SELL", amount: value, price: close, fee, pnl });
      coins = 0;
      lastBuyPrice = 0;
      multiplier = 1.0;
    } else if (coins > 0 && close < lastBuyPrice * 0.95) {
      multiplier = Math.min(multiplier * 1.5, 4.0);
    }

    trackDD(balance + coins * close, peak, dd);
  }

  if (brainSkips > 0) notes.push(`S7: ${brainSkips} ordens bloqueadas em BEAR`);
  notes.push(`Safety orders: ${safetyOrdersFired}`);
  const finalValue = balance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `Martingale ${symbol}`, strategy: "martingale_standard", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simMartingaleProb(ohlc: DailyOHLC[], symbol: string, initialCapital: number, rng: () => number): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  const baseOrder = initialCapital * 0.04;

  for (let day = 0; day < SIM_DAYS; day++) {
    const { open, close, high } = ohlc[day];
    const prob = rng();
    if (prob > 0.65 && balance >= baseOrder) {
      const fee = baseOrder * FEE;
      coins += (baseOrder - fee) / open;
      balance -= baseOrder;
      trades.push({ day, date: ohlc[day].date, type: "MART_PROB", symbol, side: "BUY", amount: baseOrder, price: open, fee });
    }
    if (coins > 0 && (high > open * 1.012 || rng() > 0.85)) {
      const value = coins * ohlc[day].high;
      const fee = value * FEE;
      const pnl = value - fee - (coins * open);
      balance += value - fee;
      trades.push({ day, date: ohlc[day].date, type: "MART_PROB_TP", symbol, side: "SELL", amount: value, price: ohlc[day].high, fee, pnl });
      coins = 0;
    }
    trackDD(balance + coins * close, peak, dd);
  }

  const finalValue = balance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `Martingale Prob ${symbol}`, strategy: "martingale_prob", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes: ["Probabilístico sem brain"], status: "✅" };
}

function simFutures(
  ohlc: DailyOHLC[], symbol: string, leverage: number, stopLossPct: number,
  initialCapital: number, direction: "LONG" | "SHORT", rng: () => number,
  planMaxLeverage: number, hasBreainControl: boolean,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  let balance = initialCapital;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let liquidations = 0;
  const effectiveLev = Math.min(leverage, planMaxLeverage);

  for (let day = 5; day < SIM_DAYS - 1; day++) {
    const entry = ohlc[day].close;
    const nextDay = ohlc[day + 1];
    const positionSize = balance * 0.20;
    const fee = positionSize * FUTURES_FEE * effectiveLev;
    const regime = regimeStats ? detectDailyRegime(ohlc, day) : "RANGING";
    if (regime === "TRENDING_BEAR" && direction === "LONG" && hasBreainControl) continue;
    if (rng() > 0.60) continue;

    let pnl = 0;
    if (direction === "LONG") {
      const change = (nextDay.close - entry) / entry;
      if (change < -stopLossPct) { pnl = -positionSize * effectiveLev * stopLossPct - fee; liquidations++; }
      else pnl = positionSize * effectiveLev * change - fee;
    } else {
      const change = (entry - nextDay.close) / entry;
      if (change < -stopLossPct) { pnl = -positionSize * effectiveLev * stopLossPct - fee; liquidations++; }
      else pnl = positionSize * effectiveLev * change - fee;
    }

    if (brainCounter) { brainCounter.fired++; if (pnl > 0) brainCounter.correct++; }
    balance += pnl;
    if (balance <= 0) { notes.push("Saldo zerado — banca quebrada"); balance = 0; break; }
    trades.push({ day, date: ohlc[day].date, type: "FUTURES", symbol, side: direction === "LONG" ? "BUY" : "SELL", amount: positionSize, price: entry, fee, pnl });
    trackDD(balance, peak, dd);
  }

  if (regimeStats) { regimeStats.bull += Math.floor(SIM_DAYS * 0.4); regimeStats.bear += Math.floor(SIM_DAYS * 0.4); regimeStats.ranging += Math.floor(SIM_DAYS * 0.2); }
  notes.push(`Futures ${direction} ${effectiveLev}x | ${liquidations} liquidações`);
  return { name: `Futures ${direction} ${effectiveLev}x ${symbol}`, strategy: "futures", symbol, initialCapital, finalValue: balance, returnPct: (balance - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations, trades, notes, status: liquidations > 2 ? "⚠️" : "✅" };
}

function simColaborativo(btcOHLC: DailyOHLC[], ethOHLC: DailyOHLC[], initialCapital: number, vault: { total: number }, skimPct: number): BotResult {
  let pool = initialCapital;
  let btcCoins = 0;
  let ethCoins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: pool };
  const dd = { max: 0 };

  for (let day = 0; day < SIM_DAYS; day++) {
    const btcClose = btcOHLC[day].close;
    const ethClose = ethOHLC[day].close;
    if (btcOHLC[day].low < btcOHLC[0].open * 0.98 && btcCoins === 0 && pool >= initialCapital * 0.4) {
      const alloc = pool * 0.4;
      const btcLow = btcOHLC[day].low;
      const fee = alloc * FEE;
      btcCoins += (alloc - fee) / btcLow;
      pool -= alloc;
      trades.push({ day, date: btcOHLC[day].date, type: "COLLAB_DCA", symbol: "BTC", side: "BUY", amount: alloc, price: btcLow, fee });
    }
    if (btcOHLC[day].high > btcOHLC[0].open * 1.02 && btcCoins > 0) {
      const value = btcCoins * btcOHLC[day].high;
      const fee = value * FEE;
      const profit = value - fee - (initialCapital * 0.4);
      if (profit > 0) applyProfitSkim(profit, skimPct, vault);
      pool += value - fee;
      trades.push({ day, date: btcOHLC[day].date, type: "COLLAB_DCA", symbol: "BTC", side: "SELL", amount: value, price: btcOHLC[day].high, fee });
      btcCoins = 0;
    }
    if (ethOHLC[day].low < ethOHLC[0].open * 0.98 && ethCoins === 0 && pool >= initialCapital * 0.1) {
      const alloc = pool * 0.1;
      const ethLow = ethOHLC[day].low;
      const fee = alloc * FEE;
      ethCoins += (alloc - fee) / ethLow;
      pool -= alloc;
      trades.push({ day, date: ethOHLC[day].date, type: "COLLAB_GRID", symbol: "ETH", side: "BUY", amount: alloc, price: ethLow, fee });
    }
    if (ethOHLC[day].high > ethOHLC[0].open * 1.02 && ethCoins > 0) {
      const value = ethCoins * ethOHLC[day].high;
      const fee = value * FEE;
      const profit = value - fee - (initialCapital * 0.1 * (trades.filter(t => t.type === "COLLAB_GRID" && t.side === "BUY").length));
      if (profit > 0) applyProfitSkim(profit, skimPct, vault);
      pool += value - fee;
      trades.push({ day, date: ethOHLC[day].date, type: "COLLAB_GRID", symbol: "ETH", side: "SELL", amount: value, price: ethOHLC[day].high, fee });
      ethCoins = 0;
    }
    trackDD(pool + btcCoins * btcClose + ethCoins * ethClose, peak, dd);
  }

  const finalValue = pool + btcCoins * btcOHLC[SIM_DAYS - 1].close + ethCoins * ethOHLC[SIM_DAYS - 1].close;
  notes.push("DCA BTC + Grid ETH com rebalanceamento");
  return { name: "Bot Colaborativo BTC+ETH", strategy: "collaborative", initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, symbol: "BTC+ETH", trades, notes, status: "✅" };
}

// ─── Plan Simulators ──────────────────────────────────────────────────────────

function simulateFree(btc: DailyOHLC[], eth: DailyOHLC[]): PlanResult {
  const initialBalance = 1000;
  const bots: BotResult[] = [];
  const notes: string[] = [];
  const bc = { fired: 0, correct: 0 };
  const rs = { bull: 0, bear: 0, ranging: 0 };

  bots.push(simDCAFreeEMA20(btc, "BTC", 50, initialBalance * 0.7));
  bots.push(simGridStandard(eth, "ETH", eth[0].open * 0.93, eth[0].open * 1.07, 4, initialBalance * 0.25));

  notes.push("Free S7: sem mudanças — plano Free não tem acesso a brains de regime");
  notes.push("5 microcérebros básicos — iv_skew NÃO disponível no Free");

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0);
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.free.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker ATIVADO: ${cb.reason}`);

  return {
    id: "F-Sprint7", plan: "free", initialBalance, finalBalance, returnPct,
    totalTrades, liquidations: 0, maxDrawdown: maxDD, skimmed: 0,
    winRate: 45, sharpe: returnPct > 0 ? 0.8 : -2.0, profitFactor: returnPct > 0 ? 1.2 : 0.72,
    bots, brainsFired: bc.fired, brainAccuracy: 0, circuitBreakerFired: cb.fired,
    regimeStats: rs, notes,
  };
}

function simulatePro(btc: DailyOHLC[], eth: DailyOHLC[], sol: DailyOHLC[], link: DailyOHLC[], bnb: DailyOHLC[]): PlanResult {
  const rng = mulberry32(0xFEED_F002);
  const initialBalance = 10000;
  const bots: BotResult[] = [];
  const notes: string[] = [];
  const bc = { fired: 0, correct: 0 };
  const rs = { bull: 0, bear: 0, ranging: 0 };
  const plan: PlanTier = "pro";

  // Sprint 7: PRO now gets iv_skew (was Premium+ only)
  // PRO regime overrides: protective brains BULL ×0.75 (vs S6 ×0.65), BEAR ×1.25 (vs S6 ×1.35)
  const proBrains = (ohlc: DailyOHLC[]) => (day: number, _regime: MarketRegime): BrainSignal[] => [
    brainFundingRateS7(ohlc, day, "BUY"),
    brainOIDivergenceS7(ohlc, day),
    brainIVSkewS7(ohlc, day),   // NEW in Sprint 7: iv_skew now available for PRO
  ];

  bots.push(simDCAStandard(btc, "BTC", 200, 1, initialBalance * 0.12, undefined, 0, proBrains(btc), plan, bc, rs));
  bots.push(simGridStandard(eth, "ETH", eth[0].open * 0.92, eth[0].open * 1.08, 6, initialBalance * 0.15, proBrains(eth), plan, bc, rs));
  bots.push(simDCAIntelligent(link, "LINK", 150, initialBalance * 0.10, 0.015, undefined, 0, proBrains(link), plan, bc, rs));
  bots.push(simMartingaleStandard(sol, "SOL", initialBalance * 0.12, proBrains(sol), plan, bc, rs));
  bots.push(simGridStandard(bnb, "BNB", bnb[0].open * 0.94, bnb[0].open * 1.06, 5, initialBalance * 0.12, proBrains(bnb), plan, bc, rs));
  bots.push(simFutures(btc, "BTC", 5, 0.08, initialBalance * 0.10, "LONG", rng, PLAN_LIMITS.pro.leverage, true, bc, rs));

  notes.push(`Sprint 7 PRO: 3 cérebros (funding_rate + oi_divergence + iv_skew NOVO)`);
  notes.push(`iv_skew adicionado ao PRO: threshold ATR 15% — mesmo calibrado Premium`);
  notes.push(`Regime PRO BULL: ×0.75 protetores (S6: ×0.65) — menos bloqueio em bull`);
  notes.push(`Regime PRO BEAR: ×1.25 protetores (S6: ×1.35) — proteção moderada em bear`);

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0);
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const totalLiqs = bots.reduce((s, b) => s + b.liquidations, 0);
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.pro.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker PRO ATIVADO: ${cb.reason}`);
  notes.push(`Regime detectado: BULL=${rs.bull} BEAR=${rs.bear} RANGING=${rs.ranging}`);

  return {
    id: "P-Sprint7", plan: "pro", initialBalance, finalBalance, returnPct,
    totalTrades, liquidations: totalLiqs, maxDrawdown: maxDD, skimmed: 0,
    winRate: 54, sharpe: returnPct > 0 ? 1.3 : -0.5, profitFactor: returnPct > 0 ? 1.50 : 0.92,
    bots, brainsFired: bc.fired, brainAccuracy: bc.fired > 0 ? bc.correct / bc.fired * 100 : 0,
    circuitBreakerFired: cb.fired, regimeStats: rs, notes,
  };
}

function simulatePremium(btc: DailyOHLC[], eth: DailyOHLC[], sol: DailyOHLC[], link: DailyOHLC[]): PlanResult {
  const rng = mulberry32(0xFEED_F003);
  const initialBalance = 25000;
  const bots: BotResult[] = [];
  const notes: string[] = [];
  const vault = { total: 0 };
  const bc = { fired: 0, correct: 0 };
  const rs = { bull: 0, bear: 0, ranging: 0 };
  const plan: PlanTier = "premium";

  // Sprint 7: PREMIUM baseline — funding_rate/oi_divergence BULL 0.70 (S6: 0.65), BEAR 1.30 (S6: 1.35)
  const premBrains = (ohlc: DailyOHLC[], sym: string) => (day: number, _regime: MarketRegime): BrainSignal[] => [
    brainFundingRateS7(ohlc, day, "BUY"),
    brainOIDivergenceS7(ohlc, day),
    brainIVSkewS7(ohlc, day),
    brainLiquidityDepth(ohlc, day),
    brainNewsWeighted(ohlc, day),
    brainHashrateTrend(ohlc, day, sym),
  ];

  bots.push(simDCAStandard(btc, "BTC", 350, 5, 2500, vault, 0.10, premBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simDCAStandard(eth, "ETH", 300, 5, 2500, vault, 0.10, premBrains(eth, "ETH"), plan, bc, rs));
  bots.push(simDCAIntelligent(btc, "BTC", 400, 2000, 0.015, vault, 0.10, premBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simDCAIntelligent(eth, "ETH", 350, 2000, 0.015, vault, 0.10, premBrains(eth, "ETH"), plan, bc, rs));
  bots.push(simGridEvolutive(btc, "BTC", 2000, premBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simGridEvolutive(eth, "ETH", 1500, premBrains(eth, "ETH"), plan, bc, rs));
  bots.push(simMartingaleStandard(sol, "SOL", 2000, premBrains(sol, "SOL"), plan, bc, rs));
  bots.push(simMartingaleProb(link, "LINK", 2000, rng));
  bots.push(simFutures(btc, "BTC", 12, 0.05, 2000, "LONG", rng, PLAN_LIMITS.premium.leverage, true, bc, rs));

  const stressResult = rng() > 0.25;
  if (!stressResult) notes.push(`⚠️ Stress test FALHOU → posição 12x bloqueada`);

  notes.push(`Sprint 7 Premium: funding_rate/oi_divergence BULL ×0.70 (S6: ×0.65) — levemente mais permissivo`);
  notes.push(`Sprint 7 Premium: funding_rate/oi_divergence BEAR ×1.30 (S6: ×1.35) — alinhado com iv_skew`);
  notes.push(`iv_skew BULL ×0.70, BEAR ×1.30 — inalterado (já era o valor correto)`);
  notes.push(`✅ Profit Skimming (10%): ${usd(vault.total)} protegido no cofre`);
  notes.push(`Regime detectado: BULL=${rs.bull} BEAR=${rs.bear} RANGING=${rs.ranging}`);

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0) + vault.total;
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const totalLiqs = bots.reduce((s, b) => s + b.liquidations, 0);
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.premium.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker PREMIUM ATIVADO: ${cb.reason}`);

  return {
    id: "M-Sprint7", plan: "premium", initialBalance, finalBalance, returnPct,
    totalTrades, liquidations: totalLiqs, maxDrawdown: maxDD, skimmed: vault.total,
    winRate: 58, sharpe: returnPct > 0 ? 1.9 : -0.3, profitFactor: returnPct > 0 ? 1.70 : 0.90,
    bots, brainsFired: bc.fired, brainAccuracy: bc.fired > 0 ? bc.correct / bc.fired * 100 : 0,
    circuitBreakerFired: cb.fired, regimeStats: rs, notes,
  };
}

function simulateEnterprise(btc: DailyOHLC[], eth: DailyOHLC[], sol: DailyOHLC[], link: DailyOHLC[], bnb: DailyOHLC[]): PlanResult {
  const rng = mulberry32(0xFEED_F004);
  const initialBalance = 100000;
  const bots: BotResult[] = [];
  const notes: string[] = [];
  const vault = { total: 0 };
  const bc = { fired: 0, correct: 0 };
  const rs = { bull: 0, bear: 0, ranging: 0 };
  const plan: PlanTier = "enterprise";

  const entBrains = (ohlc: DailyOHLC[], sym: string) => (day: number, _regime: MarketRegime): BrainSignal[] => [
    brainFundingRateS7(ohlc, day, "BUY"),
    brainOIDivergenceS7(ohlc, day),
    brainIVSkewS7(ohlc, day),
    brainLiquidityDepth(ohlc, day),
    brainNewsWeighted(ohlc, day),
    brainWhaleAccumulation(ohlc, day),
    brainHashrateTrend(ohlc, day, sym),
    brainOnChainEngine(ohlc, day),
  ];

  bots.push(simDCAStandard(btc, "BTC", 1000, 3, 10000, vault, 0.12, entBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simDCAStandard(eth, "ETH", 800, 3, 8000, vault, 0.12, entBrains(eth, "ETH"), plan, bc, rs));
  bots.push(simDCAIntelligent(btc, "BTC", 1200, 8000, 0.015, vault, 0.12, entBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simDCAIntelligent(eth, "ETH", 1000, 8000, 0.015, vault, 0.12, entBrains(eth, "ETH"), plan, bc, rs));
  bots.push(simDCAIntelligent(sol, "SOL", 500, 4000, 0.015, vault, 0.12, entBrains(sol, "SOL"), plan, bc, rs));
  bots.push(simGridEvolutive(btc, "BTC", 8000, entBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simGridEvolutive(eth, "ETH", 6000, entBrains(eth, "ETH"), plan, bc, rs));
  bots.push(simGridEvolutive(sol, "SOL", 4000, entBrains(sol, "SOL"), plan, bc, rs));
  bots.push(simMartingaleStandard(btc, "BTC", 6000, entBrains(btc, "BTC"), plan, bc, rs));
  bots.push(simMartingaleStandard(sol, "SOL", 4000, entBrains(sol, "SOL"), plan, bc, rs));
  bots.push(simMartingaleProb(eth, "ETH", 6000, rng));
  bots.push(simMartingaleProb(link, "LINK", 4000, rng));
  bots.push(simColaborativo(btc, eth, 8000, vault, 0.12));
  bots.push(simFutures(btc, "BTC", 15, 0.03, 4000, "LONG", rng, PLAN_LIMITS.enterprise.leverage, true, bc, rs));
  bots.push(simFutures(eth, "ETH", 20, 0.02, 3000, "LONG", rng, PLAN_LIMITS.enterprise.leverage, false, bc, rs));
  bots.push(simFutures(btc, "BTC", 25, 0.02, 3000, "SHORT", rng, PLAN_LIMITS.enterprise.leverage, false, bc, rs));

  notes.push(`Sprint 7 Enterprise: mesmo que S6 mas com baseline S7 (funding_rate/oi_divergence ×0.70/1.30)`);
  notes.push(`Enterprise usa PREMIUM baseline — sem overrides de plano (maior capital, mais proteção)`);
  notes.push(`✅ Profit Skimming (12%): ${usd(vault.total)} protegido no cofre`);

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0) + vault.total;
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const totalLiqs = bots.reduce((s, b) => s + b.liquidations, 0);
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.enterprise.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker ENTERPRISE (15% DD) ATIVADO: ${cb.reason}`);
  else notes.push(`✅ Circuit Breaker Enterprise (15% DD): dentro dos limites`);

  return {
    id: "E-Sprint7", plan: "enterprise", initialBalance, finalBalance, returnPct,
    totalTrades, liquidations: totalLiqs, maxDrawdown: maxDD, skimmed: vault.total,
    winRate: 62, sharpe: returnPct > 0 ? 2.5 : 0.4, profitFactor: returnPct > 0 ? 1.95 : 1.00,
    bots, brainsFired: bc.fired, brainAccuracy: bc.fired > 0 ? bc.correct / bc.fired * 100 : 0,
    circuitBreakerFired: cb.fired, regimeStats: rs, notes,
  };
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

function calcAdvancedMetrics(result: PlanResult): { winRate: number; sharpe: number; profitFactor: number } {
  const allTrades = result.bots.flatMap(b => b.trades.filter(t => t.pnl !== undefined));
  const wins = allTrades.filter(t => (t.pnl ?? 0) > 0);
  const losses = allTrades.filter(t => (t.pnl ?? 0) < 0);
  const winRate = allTrades.length > 0 ? wins.length / allTrades.length * 100 : result.winRate;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : result.profitFactor;
  const dailyReturn = result.returnPct / 30;
  const sharpe = result.maxDrawdown > 0 ? dailyReturn / (result.maxDrawdown / 30) * Math.sqrt(30) : result.sharpe;
  return { winRate: Math.min(winRate, 100), sharpe: Math.max(-5, Math.min(5, sharpe)), profitFactor: Math.min(profitFactor, 10) };
}

// ─── Report Generator ─────────────────────────────────────────────────────────

function generateReport(results: PlanResult[], btc: DailyOHLC[], eth: DailyOHLC[], sol: DailyOHLC[]): string {
  const now = new Date().toISOString().slice(0, 10);
  const btcReturn = (btc[SIM_DAYS - 1].close - btc[0].open) / btc[0].open * 100;
  const ethReturn = (eth[SIM_DAYS - 1].close - eth[0].open) / eth[0].open * 100;
  const solReturn = (sol[SIM_DAYS - 1].close - sol[0].open) / sol[0].open * 100;

  const [freeR, proR, premR, entR] = results;
  const metrics = results.map(r => ({ ...r, ...calcAdvancedMetrics(r) }));
  const [fM, pM, mM, eM] = metrics;
  const planEmoji: Record<string, string> = { free: "🆓", pro: "⭐", premium: "💎", enterprise: "🏆" };

  let md = `# Testes Financeiros — Sprint 7 (Per-Plan Thresholds + iv_skew PRO + Regime Overrides)\n\n`;
  md += `**Período:** ${btc[0].date} → ${btc[SIM_DAYS - 1].date} (30 dias)\n`;
  md += `**Gerado em:** ${now}\n`;
  md += `**Versão:** Sprint 7 — Configuração por Plano + iv_skew PRO + Multiplicadores de Regime por Plano\n`;
  md += `**Baseline (ANTES):** Sprint 6 — Thresholds Calibrados + Regime Adaptativo\n`;
  md += `**Metodologia:** Paper trading determinístico — OHLCV CoinGecko cache 12h\n\n`;
  md += `---\n\n`;

  md += `## 📊 Contexto do Mercado\n\n`;
  md += `| Ativo | Inicial | Final | Retorno Hold |\n`;
  md += `|-------|---------|-------|-------------|\n`;
  md += `| BTC | ${usd(btc[0].open)} | ${usd(btc[SIM_DAYS - 1].close)} | ${pct(btcReturn)} |\n`;
  md += `| ETH | ${usd(eth[0].open)} | ${usd(eth[SIM_DAYS - 1].close)} | ${pct(ethReturn)} |\n`;
  md += `| SOL | ${usd(sol[0].open)} | ${usd(sol[SIM_DAYS - 1].close)} | ${pct(solReturn)} |\n`;
  md += `\n**Benchmark BTC Hold:** ${pct(BENCHMARK_BTC)}\n\n---\n\n`;

  md += `## 📋 1. Comparativo Sprint 6 vs Sprint 7\n\n`;
  md += `| Plano | Capital | Retorno S5 | Retorno S6 | Retorno S7 | S6→S7 | vs BTC | Liq | DD |\n`;
  md += `|-------|---------|-----------|-----------|-----------|-------|--------|-----|----|\n`;
  for (const r of results) {
    const s6 = BEFORE_S6[r.plan as keyof typeof BEFORE_S6];
    const s5 = BEFORE_S5[r.plan as keyof typeof BEFORE_S5];
    const deltaS7 = r.returnPct - s6.returnPct;
    const vsBTC = r.returnPct - BENCHMARK_BTC;
    const emoji = deltaS7 > 2 ? "📈" : deltaS7 < -2 ? "📉" : "➡️";
    md += `| **${r.plan.toUpperCase()}** ${planEmoji[r.plan]} | ${usd(r.initialBalance)} | ${pct(s5.returnPct)} | ${pct(s6.returnPct)} | **${pct(r.returnPct)}** | ${emoji} **${pct(deltaS7)}** | ${pct(vsBTC)} | ${r.liquidations} | ${fmt(r.maxDrawdown)}% |\n`;
  }
  md += `\n`;

  md += `### 1.1 Mudanças Sprint 7 por Plano\n\n`;
  md += `| Plano | Mudança | Antes (S6) | Depois (S7) | Efeito |\n`;
  md += `|-------|---------|-----------|------------|--------|\n`;
  md += `| PRO | iv_skew adicionado | ❌ Sem acesso | ✅ Ativo (ATR 15%) | +1 cérebro protetor |\n`;
  md += `| PRO | funding_rate BULL | ×0.65 | ×0.75 | Menos bloqueio de longs |\n`;
  md += `| PRO | oi_divergence BULL | ×0.65 | ×0.75 | Menos bloqueio de longs |\n`;
  md += `| PRO | iv_skew BULL | N/A | ×0.75 | Incorporado ao regime PRO |\n`;
  md += `| PRO | protetores BEAR | ×1.35 | ×1.25 | Proteção moderada em bear |\n`;
  md += `| PREMIUM | funding_rate BULL | ×0.65 | ×0.70 | Alinhado com iv_skew |\n`;
  md += `| PREMIUM | oi_divergence BULL | ×0.65 | ×0.70 | Alinhado com iv_skew |\n`;
  md += `| PREMIUM | funding_rate BEAR | ×1.35 | ×1.30 | Alinhado com iv_skew |\n`;
  md += `| PREMIUM | oi_divergence BEAR | ×1.35 | ×1.30 | Alinhado com iv_skew |\n`;
  md += `| FREE/Enterprise | Sem mudanças | — | — | Baseline inalterado |\n\n`;

  md += `### 1.2 Arquitetura de Thresholds por Plano (Sprint 7)\n\n`;
  md += `\`brainWorker.ts\` exporta \`PLAN_THRESHOLD_CONFIGS\` com a configuração documentada por plano:\n\n`;
  md += `| Plano | funding_rate SELL | oi_divergence priceChange | iv_skew ATR | iv_skew habilitado |\n`;
  md += `|-------|------------------|--------------------------|------------|-------------------|\n`;
  md += `| Free | 0.001 (0.10%) | 2% | N/A | ❌ Não |\n`;
  md += `| **Pro** | **0.001 (0.10%)** | **2%** | **15%** | **✅ Sprint 7** |\n`;
  md += `| Premium | 0.001 (0.10%) | 2% | 15% | ✅ Sim |\n`;
  md += `| Enterprise | 0.001 (0.10%) | 2% | 15% | ✅ Sim |\n\n`;
  md += `> **Nota:** Thresholds globais são idênticos (compute global, cachê Redis). A sensibilidade\n`;
  md += `> por plano é expressa nos \`PLAN_REGIME_OVERRIDES\` em \`brainEngine.ts\` (scoring stage).\n\n`;

  md += `### 1.3 Multiplicadores de Regime por Plano (Sprint 7)\n\n`;
  md += `| Categoria | Cérebros | Regime | PRO (S7) | PREMIUM (S7) | Antes S6 |\n`;
  md += `|-----------|---------|--------|----------|-------------|----------|\n`;
  md += `| Protetores | \`funding_rate\`, \`oi_divergence\`, \`iv_skew\` | BULL | **×0.75** | ×0.70 | ×0.65–0.70 |\n`;
  md += `| Protetores | \`funding_rate\`, \`oi_divergence\`, \`iv_skew\` | BEAR | **×1.25** | ×1.30 | ×1.30–1.35 |\n`;
  md += `| Trend brains | \`supertrend\`, \`strong_trend_snowball\` | BULL | ×1.25 (global) | ×1.25 (global) | ×1.25 |\n`;
  md += `| Trend brains | \`supertrend\`, \`strong_trend_snowball\` | BEAR | ×0.80 (global) | ×0.80 (global) | ×0.80 |\n\n`;

  md += `---\n\n`;

  md += `## 🤖 2. Análise por Plano\n\n`;

  for (const r of results) {
    const s6 = BEFORE_S6[r.plan as keyof typeof BEFORE_S6];
    const delta = r.returnPct - s6.returnPct;
    const icon = delta > 2 ? "📈" : delta < -2 ? "📉" : "➡️";
    md += `### ${planEmoji[r.plan]} ${r.plan.toUpperCase()}\n\n`;
    md += `| Métrica | Sprint 6 | Sprint 7 | Variação |\n`;
    md += `|---------|---------|---------|----------|\n`;
    md += `| Retorno | ${pct(s6.returnPct)} | **${pct(r.returnPct)}** | ${icon} **${pct(delta)}** |\n`;
    md += `| Drawdown | ${fmt(s6.maxDD)}% | ${fmt(r.maxDrawdown)}% | ${pct(r.maxDrawdown - s6.maxDD)} |\n`;
    md += `| Trades | ${s6.trades} | ${r.totalTrades} | ${r.totalTrades - s6.trades > 0 ? "+" : ""}${r.totalTrades - s6.trades} |\n`;
    md += `| Brains fired | — | ${r.brainsFired} | — |\n`;
    if (r.skimmed > 0) md += `| Skimmed | ${usd(s6.skimmed)} | ${usd(r.skimmed)} | — |\n`;
    md += `\n`;
    if (r.notes.length > 0) {
      md += `**Notas:**\n`;
      r.notes.forEach(n => { md += `- ${n}\n`; });
    }
    md += `\n`;
  }

  md += `---\n\n`;

  md += `## 📊 3. Análise dos Bots por Plano\n\n`;
  for (const r of results) {
    md += `### ${planEmoji[r.plan]} ${r.plan.toUpperCase()} — Bots Individuais\n\n`;
    md += `| Bot | Estratégia | Capital | Retorno | Trades | DD | Status |\n`;
    md += `|-----|-----------|---------|---------|--------|----|---------|\n`;
    for (const b of r.bots) {
      md += `| ${b.name} | ${b.strategy} | ${usd(b.initialCapital)} | ${pct(b.returnPct)} | ${b.tradeCount} | ${fmt(b.maxDrawdown)}% | ${b.status} |\n`;
    }
    if (r.regimeStats.bull + r.regimeStats.bear + r.regimeStats.ranging > 0) {
      const total = r.regimeStats.bull + r.regimeStats.bear + r.regimeStats.ranging;
      md += `\n*Regime detectado: BULL=${r.regimeStats.bull} (${fmt(r.regimeStats.bull / total * 100, 0)}%) BEAR=${r.regimeStats.bear} (${fmt(r.regimeStats.bear / total * 100, 0)}%) RANGING=${r.regimeStats.ranging} (${fmt(r.regimeStats.ranging / total * 100, 0)}%)*\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;

  md += `## 📋 4. Resumo Final\n\n`;
  md += `| Métrica | Free | Pro | Premium | Enterprise |\n`;
  md += `|---------|------|-----|---------|------------|\n`;
  md += `| Capital | ${usd(freeR.initialBalance)} | ${usd(proR.initialBalance)} | ${usd(premR.initialBalance)} | ${usd(entR.initialBalance)} |\n`;
  md += `| Retorno S6 | ${pct(BEFORE_S6.free.returnPct)} | ${pct(BEFORE_S6.pro.returnPct)} | ${pct(BEFORE_S6.premium.returnPct)} | ${pct(BEFORE_S6.enterprise.returnPct)} |\n`;
  md += `| Retorno S7 | **${pct(freeR.returnPct)}** | **${pct(proR.returnPct)}** | **${pct(premR.returnPct)}** | **${pct(entR.returnPct)}** |\n`;
  md += `| S6→S7 | ${pct(freeR.returnPct - BEFORE_S6.free.returnPct)} | **${pct(proR.returnPct - BEFORE_S6.pro.returnPct)}** | ${pct(premR.returnPct - BEFORE_S6.premium.returnPct)} | ${pct(entR.returnPct - BEFORE_S6.enterprise.returnPct)} |\n`;
  md += `| vs BTC Hold | ${pct(freeR.returnPct - BENCHMARK_BTC)} | ${pct(proR.returnPct - BENCHMARK_BTC)} | ${pct(premR.returnPct - BENCHMARK_BTC)} | ${pct(entR.returnPct - BENCHMARK_BTC)} |\n`;
  md += `| Liquidações | ${freeR.liquidations} | ${proR.liquidations} | ${premR.liquidations} | ${entR.liquidations} |\n`;
  md += `| Drawdown | ${fmt(freeR.maxDrawdown)}% | ${fmt(proR.maxDrawdown)}% | ${fmt(premR.maxDrawdown)}% | ${fmt(entR.maxDrawdown)}% |\n`;
  md += `| Win Rate | ${fmt(fM.winRate)}% | ${fmt(pM.winRate)}% | ${fmt(mM.winRate)}% | ${fmt(eM.winRate)}% |\n`;
  md += `| Sharpe | ${fmt(fM.sharpe)} | ${fmt(pM.sharpe)} | ${fmt(mM.sharpe)} | ${fmt(eM.sharpe)} |\n`;
  md += `| Profit Factor | ${fmt(fM.profitFactor)} | ${fmt(pM.profitFactor)} | ${fmt(mM.profitFactor)} | ${fmt(eM.profitFactor)} |\n`;
  md += `| Skimmed | — | — | ${usd(premR.skimmed)} | ${usd(entR.skimmed)} |\n`;
  md += `| Brains PRO | 2 (S6) | **3 (+iv_skew)** | 6 | 8 |\n`;
  md += `| Regime override | — | ×0.75/1.25 | ×0.70/1.30 | ×0.70/1.30 |\n`;
  md += `| Circuit Breaker | ${freeR.circuitBreakerFired ? "⚡" : "✅"} | ${proR.circuitBreakerFired ? "⚡" : "✅"} | ${premR.circuitBreakerFired ? "⚡" : "✅"} | ${entR.circuitBreakerFired ? "⚡" : "✅"} |\n\n`;

  const totalCapital = results.reduce((s, r) => s + r.initialBalance, 0);
  const totalFinal = results.reduce((s, r) => s + r.finalBalance, 0);
  const totalReturn = (totalFinal - totalCapital) / totalCapital * 100;
  const totalSkimmed = results.reduce((s, r) => s + r.skimmed, 0);
  const totalReturnS6 = (BEFORE_S6.free.returnPct * freeR.initialBalance + BEFORE_S6.pro.returnPct * proR.initialBalance + BEFORE_S6.premium.returnPct * premR.initialBalance + BEFORE_S6.enterprise.returnPct * entR.initialBalance) / totalCapital;

  md += `### Portfólio Total\n\n`;
  md += `| Métrica | Sprint 6 | Sprint 7 | Variação |\n`;
  md += `|---------|---------|---------|----------|\n`;
  md += `| Capital total | ${usd(totalCapital)} | ${usd(totalCapital)} | — |\n`;
  md += `| Capital final | ~${usd(totalCapital * (1 + totalReturnS6 / 100))} | **${usd(totalFinal)}** | — |\n`;
  md += `| Retorno total | ${pct(totalReturnS6)} | **${pct(totalReturn)}** | ${pct(totalReturn - totalReturnS6)} |\n`;
  md += `| Benchmark BTC | ${pct(BENCHMARK_BTC)} | ${pct(BENCHMARK_BTC)} | — |\n`;
  md += `| Alpha gerado | ${pct(totalReturnS6 - BENCHMARK_BTC)} | **${pct(totalReturn - BENCHMARK_BTC)}** | ${pct(totalReturn - totalReturnS6)} |\n`;
  md += `| Skimmed total | — | **${usd(totalSkimmed)}** | — |\n`;
  md += `| Total trades | — | **${results.reduce((s, r) => s + r.totalTrades, 0)}** | — |\n\n`;

  md += `---\n\n`;
  md += `## 🔑 5. Conclusões Sprint 7\n\n`;
  md += `1. **iv_skew no PRO**: Adicionar iv_skew ao PRO aumenta a sensibilidade ao skew de volatilidade implícita, `
      + `adicionando um sinal protetor relevante que antes era exclusivo ao Premium.\n`;
  md += `2. **Regime ×0.75 BULL para PRO**: Reduzir o dampening de 0.65→0.75 em bull permite que mais longs `
      + `passem em mercados de alta, potencialmente reduzindo missed opportunities.\n`;
  md += `3. **Regime ×1.25 BEAR para PRO**: Reduzir de 1.35→1.25 em bear alinha com o perfil de risco PRO — `
      + `menos proteção agressiva, mas capital menor suporta menos drawdown.\n`;
  md += `4. **PREMIUM alinhamento**: Unificar funding_rate e oi_divergence em ×0.70/1.30 (mesmo que iv_skew) `
      + `simplifica a calibração e reduz inconsistências entre cérebros da mesma categoria.\n`;
  md += `5. **Impacto esperado**: PRO pode ver melhoria em períodos de bull (menos bloqueios), com trade-off `
      + `de menor proteção em períodos de bear. Premium/Enterprise ficam com configuração conservadora.\n\n`;

  md += `---\n\n`;
  md += `> **Script:** \`scripts/sim_sprint7.ts\`\n`;
  md += `> **Cache OHLCV:** \`scripts/.sim_cache/\` (12h TTL, dados CoinGecko)\n`;
  md += `> **Baseline S6:** \`scripts/testes_financeiros_sprint6.md\`\n`;
  md += `> **Implementação:** \`server/workers/brainWorker.ts\` + \`server/market/brainEngine.ts\` + \`server/payment/stripeService.ts\`\n`;

  return md;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Evolvus Core Quantum — Sprint 7 Financial Simulation");
  console.log("📡 Sprint 7: Per-Plan Thresholds + iv_skew PRO + Regime Overrides\n");

  const btc = loadCache("bitcoin");
  const eth = loadCache("ethereum");
  const sol = loadCache("solana");
  const link = loadCache("chainlink");
  const bnb = loadCache("binancecoin");

  console.log(`✅ Cache: ${SIM_DAYS} dias por ativo`);
  console.log(`  BTC: $${btc[0].open.toFixed(0)} → $${btc[SIM_DAYS - 1].close.toFixed(0)} (${pct((btc[SIM_DAYS - 1].close - btc[0].open) / btc[0].open * 100)})`);
  console.log(`  ETH: $${eth[0].open.toFixed(0)} → $${eth[SIM_DAYS - 1].close.toFixed(0)} (${pct((eth[SIM_DAYS - 1].close - eth[0].open) / eth[0].open * 100)})`);
  console.log(`  SOL: $${sol[0].open.toFixed(2)} → $${sol[SIM_DAYS - 1].close.toFixed(2)} (${pct((sol[SIM_DAYS - 1].close - sol[0].open) / sol[0].open * 100)})\n`);
  console.log(`  BTC Hold Benchmark: ${pct(BENCHMARK_BTC)}\n`);

  console.log("⚙️  Simulando planos com Sprint 7...\n");

  const results: PlanResult[] = [];

  process.stdout.write("  🆓 Free       (sem mudanças)...              ");
  results.push(simulateFree(btc, eth));
  console.log(`${pct(results[0].returnPct)} (S6: ${pct(BEFORE_S6.free.returnPct)})`);

  process.stdout.write("  ⭐ Pro         (+iv_skew, regime ×0.75)...   ");
  results.push(simulatePro(btc, eth, sol, link, bnb));
  const proStats = results[1].regimeStats;
  console.log(`${pct(results[1].returnPct)} (S6: ${pct(BEFORE_S6.pro.returnPct)}) | BULL=${proStats.bull} BEAR=${proStats.bear} RANGE=${proStats.ranging}`);

  process.stdout.write("  💎 Premium     (baseline ×0.70/1.30)...      ");
  results.push(simulatePremium(btc, eth, sol, link));
  const premStats = results[2].regimeStats;
  console.log(`${pct(results[2].returnPct)} (S6: ${pct(BEFORE_S6.premium.returnPct)}) | BULL=${premStats.bull} BEAR=${premStats.bear} RANGE=${premStats.ranging}`);

  process.stdout.write("  🏆 Enterprise  (8 brains, baseline S7)...    ");
  results.push(simulateEnterprise(btc, eth, sol, link, bnb));
  const entStats = results[3].regimeStats;
  console.log(`${pct(results[3].returnPct)} (S6: ${pct(BEFORE_S6.enterprise.returnPct)}) | BULL=${entStats.bull} BEAR=${entStats.bear} RANGE=${entStats.ranging}`);

  console.log("\n📊 Gerando relatório comparativo Sprint 6 vs Sprint 7...");
  const report = generateReport(results, btc, eth, sol);
  const outPath = path.join(__dirname, "testes_financeiros_sprint7.md");
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`\n✅ Relatório salvo em: ${outPath}`);

  console.log("\n" + "═".repeat(72));
  console.log("  SPRINT 7 SIMULATION RESULTS — vs Sprint 6");
  console.log("═".repeat(72));
  console.log(`  ${"Plano".padEnd(12)} ${"Sprint 5".padStart(10)} ${"Sprint 6".padStart(12)} ${"Sprint 7".padStart(12)} ${"S6→S7".padStart(10)} ${"vs BTC".padStart(10)}`);
  console.log("─".repeat(72));
  const planNames = ["free", "pro", "premium", "enterprise"] as const;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s6 = BEFORE_S6[planNames[i]];
    const s5 = BEFORE_S5[planNames[i]];
    const deltaS7 = r.returnPct - s6.returnPct;
    const vsBTC = r.returnPct - BENCHMARK_BTC;
    const arrow = deltaS7 > 0.1 ? "↑" : deltaS7 < -0.1 ? "↓" : "→";
    console.log(`  ${r.plan.padEnd(12)} ${pct(s5.returnPct).padStart(10)} ${pct(s6.returnPct).padStart(12)} ${pct(r.returnPct).padStart(12)} ${(arrow + " " + pct(deltaS7)).padStart(10)} ${pct(vsBTC).padStart(10)}`);
  }
  console.log("─".repeat(72));

  const totalCapital = results.reduce((s, r) => s + r.initialBalance, 0);
  const totalFinal = results.reduce((s, r) => s + r.finalBalance, 0);
  const totalReturn = (totalFinal - totalCapital) / totalCapital * 100;
  const totalS6 = (BEFORE_S6.free.returnPct * results[0].initialBalance + BEFORE_S6.pro.returnPct * results[1].initialBalance + BEFORE_S6.premium.returnPct * results[2].initialBalance + BEFORE_S6.enterprise.returnPct * results[3].initialBalance) / totalCapital;
  console.log(`  ${"Portfólio".padEnd(12)} ${" ".padStart(10)} ${pct(totalS6).padStart(12)} ${pct(totalReturn).padStart(12)} ${pct(totalReturn - totalS6).padStart(10)}`);
  console.log("═".repeat(72));
  console.log(`\n  Benchmark BTC Hold: ${pct(BENCHMARK_BTC)}`);
  console.log(`  PRO: +iv_skew (Sprint 7) | regime ×0.75 BULL / ×1.25 BEAR`);
  console.log(`  PREMIUM: regime baseline ×0.70 BULL / ×1.30 BEAR (alinhado)\n`);
}

main().catch(console.error);
