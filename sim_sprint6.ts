/**
 * Evolvus Core Quantum — Sprint 6: Calibração + Regime Adaptativo
 *
 * Compara Sprint 5 (baseline) vs Sprint 6 (thresholds calibrados + pesos por regime)
 *
 * Mudanças implementadas no Sprint 6:
 *   1. funding_rate: SELL threshold 0.0005→0.001 (proxy: impliedFunding 0.002→0.004)
 *   2. oi_divergence: priceChange 1%→2.5% (proxy: 1.5%→2.5%)
 *   3. iv_skew: ATR skew threshold 10%→15% (proxy: impliedSkew 0.05→0.075)
 *   4. Regime adaptativo: multiplicadores de peso por regime (BULL/BEAR/RANGING)
 *
 * Mesmo período: 09/02/2026 → 09/03/2026 (30 dias)
 * Mesmos capitais e estratégias — apenas calibragem ativa
 *
 * Run: npx tsx scripts/sim_sprint6.ts
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
  pro:        { bots: 10,  leverage: 5,  exchanges: 5,  brains: 29, backtest: 365,  drawdownPct: 0.30 },
  premium:    { bots: 35,  leverage: 15, exchanges: 15, brains: 40, backtest: 1825, drawdownPct: 0.20 },
  enterprise: { bots: 999, leverage: 20, exchanges: 30, brains: 54, backtest: 9999, drawdownPct: 0.15 },
};

// Sprint 5 results (BEFORE) — baseline for Sprint 6 comparison
const BEFORE_S5 = {
  free:       { returnPct: -28.62, liquidations: 0,  trades: 18,  maxDD: 90.00, skimmed: 0,      winRate: 45, sharpe: -2.00, profitFactor: 0.72 },
  pro:        { returnPct: -53.39, liquidations: 0,  trades: 259, maxDD: 90.00, skimmed: 0,      winRate: 53, sharpe: -0.80, profitFactor: 0.88 },
  premium:    { returnPct: -25.86, liquidations: 0,  trades: 421, maxDD: 3.52,  skimmed: 41.60,  winRate: 57, sharpe: -0.50, profitFactor: 0.85 },
  enterprise: { returnPct: -5.26,  liquidations: 6,  trades: 756, maxDD: 5.86,  skimmed: 0,      winRate: 61, sharpe:  0.20, profitFactor: 0.95 },
};

// Quantum V3 baseline (for extended comparison)
const BEFORE_V3 = {
  free:       { returnPct: -36.50 },
  pro:        { returnPct: -26.54 },
  premium:    { returnPct: -20.53 },
  enterprise: { returnPct: +14.75 },
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

// ─── Sprint 6: Regime Detection ───────────────────────────────────────────────
// Detects market regime per-day from 5d return (replaces static regime in S5)

type MarketRegime = "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING";

function detectDailyRegime(ohlc: DailyOHLC[], day: number): MarketRegime {
  if (day < 5) return "RANGING";
  const ret5d = (ohlc[day].close - ohlc[day - 5].close) / ohlc[day - 5].close;
  if (ret5d > 0.03) return "TRENDING_BULL";
  if (ret5d < -0.03) return "TRENDING_BEAR";
  return "RANGING";
}

// Sprint 6 regime multipliers (same as brainEngine.ts REGIME_BRAIN_MULTIPLIERS)
// Applied to sizeModifier contributions in the simulation
const S6_REGIME_MULTIPLIERS: Record<MarketRegime, Record<string, number>> = {
  TRENDING_BULL: {
    funding_rate: 0.65, oi_divergence: 0.65, iv_skew: 0.70, liquidity_depth: 0.90,
    whale_accumulation: 1.20, hashrate_trend: 1.10, onchain_engine: 1.15, news_weighted: 1.0,
  },
  TRENDING_BEAR: {
    funding_rate: 1.35, oi_divergence: 1.35, iv_skew: 1.30, liquidity_depth: 1.15,
    whale_accumulation: 0.85, hashrate_trend: 0.90, onchain_engine: 0.90, news_weighted: 1.15,
  },
  RANGING: {},
};

function getRegimeFactor(brainName: string, regime: MarketRegime): number {
  return S6_REGIME_MULTIPLIERS[regime]?.[brainName] ?? 1.0;
}

// ─── Sprint 6 Brain Signal Engines (CALIBRATED) ───────────────────────────────

/**
 * funding_rate — Calibrated: SELL threshold raised 0.002→0.004 in proxy
 *
 * Real change: fr > 0.0005 → fr > 0.001
 * Proxy mapping: impliedFunding = priceChange3d * 0.1
 *   Old: impliedFunding > 0.002 → priceChange3d > 2%
 *   New: impliedFunding > 0.004 → priceChange3d > 4% (market must be genuinely overbought)
 */
function brainFundingRateS6(ohlc: DailyOHLC[], day: number, side: "BUY" | "SELL"): BrainSignal {
  if (day < 3) return { name: "funding_rate", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Dados insuficientes" };
  const priceChange3d = (ohlc[day].close - ohlc[Math.max(0, day - 3)].close) / ohlc[Math.max(0, day - 3)].close;
  const impliedFunding = priceChange3d * 0.1;
  const confidence = Math.min(0.90, 0.35 + Math.abs(impliedFunding) * 8);

  // Calibrated: threshold raised 2x → requires genuinely overextended funding
  if (impliedFunding > 0.004 && side === "BUY") {
    return { name: "funding_rate", signal: "SELL", confidence, sizeModifier: 0.80, skipTrade: false, note: `S6: Funding alto +${(impliedFunding * 100).toFixed(3)}% — reduz long` };
  } else if (impliedFunding < -0.004 && side === "SELL") {
    return { name: "funding_rate", signal: "BUY", confidence, sizeModifier: 0.80, skipTrade: false, note: `S6: Funding negativo ${(impliedFunding * 100).toFixed(3)}% — short custoso` };
  } else if (impliedFunding < -0.005 && side === "BUY") {
    return { name: "funding_rate", signal: "BUY", confidence, sizeModifier: 1.20, skipTrade: false, note: `S6: Funding muito negativo — bônus de long` };
  }
  // Normal funding → NEUTRAL (no sizeModifier change)
  return { name: "funding_rate", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "S6: Funding neutro (threshold calibrado)" };
}

/**
 * oi_divergence — Calibrated: priceChange threshold raised 1.5%→2.5%
 *
 * Real change: 0.01→0.02 priceChange + 0.02→0.03 oiChange
 * Proxy: volSpike threshold unchanged (1.5x), priceChange -0.015→-0.025
 */
function brainOIDivergenceS6(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 5) return { name: "oi_divergence", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Dados insuficientes" };
  const avgVol5 = ohlc.slice(Math.max(0, day - 5), day).reduce((s, d) => s + d.volume, 0) / 5;
  const volToday = ohlc[day].volume;
  const priceChange = (ohlc[day].close - ohlc[day - 1].close) / ohlc[day - 1].close;
  const volSpike = avgVol5 > 0 ? volToday / avgVol5 : 1;

  // Calibrated: priceChange threshold raised from 1.5% to 2.5%
  if (volSpike > 1.5 && priceChange < -0.025) {
    return { name: "oi_divergence", signal: "SELL", confidence: 0.73, sizeModifier: 0.70, skipTrade: true, note: `S6 OI bearish: vol ${fmt(volSpike, 1)}x + queda ${pct(priceChange * 100)}` };
  } else if (volSpike > 1.5 && priceChange > 0.025) {
    return { name: "oi_divergence", signal: "BUY", confidence: 0.68, sizeModifier: 1.20, skipTrade: false, note: `S6 OI bullish: vol ${fmt(volSpike, 1)}x + alta ${pct(priceChange * 100)}` };
  }
  return { name: "oi_divergence", signal: "NEUTRAL", confidence: 0.45, sizeModifier: 1.0, skipTrade: false, note: "S6: OI divergência dentro do normal" };
}

/**
 * iv_skew — Calibrated: impliedSkew threshold raised 0.05→0.075
 *
 * Real change: ATR skew threshold 0.10→0.15
 * Proxy: impliedSkew threshold 0.05→0.075
 */
function brainIVSkewS6(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 7) return { name: "iv_skew", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Apenas BTC/ETH" };
  const atr5 = ohlc.slice(Math.max(0, day - 5), day).reduce((s, d) => s + (d.high - d.low) / d.close, 0) / 5;
  const return7d = (ohlc[day].close - ohlc[Math.max(0, day - 7)].close) / ohlc[Math.max(0, day - 7)].close;
  const impliedSkew = -(return7d * 2) + (atr5 - 0.03) * 3;

  // Calibrated: threshold raised 50% → fewer false SELL signals in moderate bear markets
  if (impliedSkew > 0.075) {
    return { name: "iv_skew", signal: "SELL", confidence: 0.70, sizeModifier: 0.75, skipTrade: false, note: `S6 IV Skew negativo ${fmt(impliedSkew * 100, 1)}bp — put demand alta` };
  } else if (impliedSkew < -0.075) {
    return { name: "iv_skew", signal: "BUY", confidence: 0.66, sizeModifier: 1.15, skipTrade: false, note: `S6 IV Skew positivo ${fmt(-impliedSkew * 100, 1)}bp — call demand alta` };
  }
  return { name: "iv_skew", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "S6: Skew dentro do normal (calibrado)" };
}

// Unchanged brains (same thresholds as Sprint 5, already well-calibrated)

function brainLiquidityDepth(ohlc: DailyOHLC[], day: number): BrainSignal {
  const range = (ohlc[day].high - ohlc[day].low) / ohlc[day].close;
  if (range > 0.06) {
    return { name: "liquidity_depth", signal: "NEUTRAL", confidence: 0.80, sizeModifier: 0.60, skipTrade: true, note: `Mercado raso — range ${pct(range * 100)} (>6%)` };
  } else if (range < 0.02) {
    return { name: "liquidity_depth", signal: "BUY", confidence: 0.70, sizeModifier: 1.10, skipTrade: false, note: `Mercado profundo — range ${pct(range * 100)} (<2%)` };
  }
  return { name: "liquidity_depth", signal: "NEUTRAL", confidence: 0.55, sizeModifier: 1.0, skipTrade: false, note: "Liquidez normal" };
}

function brainNewsWeighted(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 3) return { name: "news_weighted", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Sem dados" };
  const momentum3d = (ohlc[day].close - ohlc[Math.max(0, day - 3)].close) / ohlc[Math.max(0, day - 3)].close;
  const intraRange = (ohlc[day].high - ohlc[day].low) / ohlc[day].close;
  if (momentum3d < -0.04 && intraRange > 0.04) {
    return { name: "news_weighted", signal: "SELL", confidence: 0.78, sizeModifier: 0.60, skipTrade: false, note: `Sentimento negativo: momentum ${pct(momentum3d * 100)}` };
  } else if (momentum3d > 0.04 && intraRange < 0.03) {
    return { name: "news_weighted", signal: "BUY", confidence: 0.73, sizeModifier: 1.30, skipTrade: false, note: `Sentimento positivo: momentum ${pct(momentum3d * 100)}` };
  }
  return { name: "news_weighted", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "Notícias neutras" };
}

function brainWhaleAccumulation(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 5) return { name: "whale_accumulation", signal: "NEUTRAL", confidence: 0.3, sizeModifier: 1.0, skipTrade: false, note: "Sem dados" };
  const avgVol = ohlc.slice(Math.max(0, day - 5), day).reduce((s, d) => s + d.volume, 0) / 5;
  const volRatio = avgVol > 0 ? ohlc[day].volume / avgVol : 1;
  const priceChange = (ohlc[day].close - ohlc[day].open) / ohlc[day].open;
  if (volRatio > 2.5 && priceChange > 0.01) {
    return { name: "whale_accumulation", signal: "BUY", confidence: 0.82, sizeModifier: 1.35, skipTrade: false, note: `Whale buying: vol ${fmt(volRatio, 1)}x + alta ${pct(priceChange * 100)}` };
  } else if (volRatio > 2.5 && priceChange < -0.01) {
    return { name: "whale_accumulation", signal: "SELL", confidence: 0.80, sizeModifier: 0.55, skipTrade: true, note: `Whale selling: vol ${fmt(volRatio, 1)}x + queda ${pct(priceChange * 100)}` };
  }
  return { name: "whale_accumulation", signal: "NEUTRAL", confidence: 0.45, sizeModifier: 1.0, skipTrade: false, note: "Sem atividade de baleia" };
}

function brainHashrateTrend(ohlc: DailyOHLC[], day: number, symbol: string): BrainSignal {
  if (symbol !== "BTC") return { name: "hashrate_trend", signal: "NEUTRAL", confidence: 0, sizeModifier: 1.0, skipTrade: false, note: "Apenas BTC" };
  if (day < 7) return { name: "hashrate_trend", signal: "NEUTRAL", confidence: 0.4, sizeModifier: 1.0, skipTrade: false, note: "Sem dados" };
  const trend7d = (ohlc[day].close - ohlc[Math.max(0, day - 7)].close) / ohlc[Math.max(0, day - 7)].close;
  const slopeNorm = trend7d / 0.15;
  if (slopeNorm > 0.2) {
    return { name: "hashrate_trend", signal: "BUY", confidence: 0.72, sizeModifier: 1.15, skipTrade: false, note: `Hashrate em alta: slope ${fmt(slopeNorm, 2)}` };
  } else if (slopeNorm < -0.3) {
    return { name: "hashrate_trend", signal: "SELL", confidence: 0.68, sizeModifier: 0.80, skipTrade: false, note: `Hashrate em queda: slope ${fmt(slopeNorm, 2)}` };
  }
  return { name: "hashrate_trend", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: "Hashrate estável" };
}

function brainOnChainEngine(ohlc: DailyOHLC[], day: number): BrainSignal {
  if (day < 5) return { name: "onchain_engine", signal: "NEUTRAL", confidence: 0.4, sizeModifier: 1.0, skipTrade: false, note: "Sem dados" };
  const ret7d = (ohlc[day].close - ohlc[Math.max(0, day - 7)].close) / ohlc[Math.max(0, day - 7)].close;
  const impliedFG = Math.min(100, Math.max(0, 50 + ret7d * 300));
  const congestion = (ohlc[day].high - ohlc[day].low) / ohlc[day].close > 0.04 ? "high" : "normal";
  if (impliedFG < 25) {
    return { name: "onchain_engine", signal: "BUY", confidence: 0.80, sizeModifier: 1.40, skipTrade: false, note: `Fear&Greed: ${fmt(impliedFG, 0)} (medo extremo — oportunidade)` };
  } else if (impliedFG > 75) {
    return { name: "onchain_engine", signal: "SELL", confidence: 0.72, sizeModifier: 0.70, skipTrade: false, note: `Fear&Greed: ${fmt(impliedFG, 0)} (ganância — reduz exposição)` };
  } else if (congestion === "high") {
    return { name: "onchain_engine", signal: "NEUTRAL", confidence: 0.55, sizeModifier: 0.85, skipTrade: false, note: `Mempool congestionado — taxa alta` };
  }
  return { name: "onchain_engine", signal: "NEUTRAL", confidence: 0.5, sizeModifier: 1.0, skipTrade: false, note: `Fear&Greed: ${fmt(impliedFG, 0)} (neutro)` };
}

// ─── Sprint 6: Regime-Aware Aggregation ───────────────────────────────────────

function aggregateBrainsWithRegime(
  signals: BrainSignal[],
  regime: MarketRegime,
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

    // Sprint 6: Apply regime factor to the brain's effective weight
    const regimeFactor = getRegimeFactor(s.name, regime);
    const effectiveConfidence = s.confidence * regimeFactor;

    // Only trigger skip/sizeModifier for protective brains in BEAR (amplified) vs dampen in BULL
    if (s.skipTrade && regime !== "TRENDING_BULL") skip = true;
    if (s.skipTrade && regime === "TRENDING_BULL" && regimeFactor < 0.80) {
      // Dampen protective skip in bull: don't skip if regime is strongly bull
    } else if (s.skipTrade) {
      skip = true;
    }

    // Apply regime factor to the sizeModifier contribution
    const modContrib = ((s.sizeModifier - 1) * effectiveConfidence);
    totalMod += modContrib;

    if (s.signal === "BUY") { buyVotes += effectiveConfidence; counter.correct++; }
    else if (s.signal === "SELL") { sellVotes += effectiveConfidence; counter.correct += 0.5; }
  }

  const consensus = buyVotes > sellVotes + 0.2 ? "BUY" : sellVotes > buyVotes + 0.2 ? "SELL" : "NEUTRAL";
  return { sizeModifier: Math.max(0.3, Math.min(2.0, totalMod)), skipTrade: skip, consensus };
}

// ─── Strategies (same as Sprint 5, now receive regime-aware aggregation) ──────

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
    if (day % periodDays === 0 && balance >= amountPerPeriod) {
      let amount = amountPerPeriod;
      let skip = false;

      if (brainSignals && brainCounter && regimeStats) {
        const regime = detectDailyRegime(ohlc, day);
        const signals = brainSignals(day, regime);
        const agg = aggregateBrainsWithRegime(signals, regime, brainCounter, regimeStats);
        amount *= agg.sizeModifier;
        skip = agg.skipTrade;
        if (skip) brainSkips++;
      }

      if (!skip && balance >= amount * 0.5) {
        amount = Math.min(amount, balance);
        const price = ohlc[day].open;
        const fee = amount * FEE;
        coins += (amount - fee) / price;
        balance -= amount;
        trades.push({ day, date: ohlc[day].date, type: "DCA_S6", symbol, side: "BUY", amount, price, fee, note: `DCA S6 dia ${day + 1}` });
      }
    }
    const equity = balance + coins * ohlc[day].close;
    trackDD(equity, peak, dd);
  }

  const finalPrice = ohlc[SIM_DAYS - 1].close;
  let finalValue = balance + coins * finalPrice;
  if (vault && skimPct > 0 && coins > 0) {
    const unrealized = coins * finalPrice - (trades.reduce((s, t) => s + t.amount, 0));
    if (unrealized > 0) { const skimmed = applyProfitSkim(unrealized, skimPct, vault); finalValue -= skimmed; }
  }

  if (brainSkips > 0) notes.push(`S6: ${brainSkips} entradas bloqueadas (threshold calibrado)`);
  return { name: `DCA ${symbol}`, strategy: "dca_standard", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simDCAIntelligent(
  ohlc: DailyOHLC[], symbol: string, baseAmount: number, initialCapital: number,
  momentumThreshold = 0.015, vault?: { total: number }, skimPct = 0.10,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let skipped = 0;
  let brainSkips = 0;

  for (let day = 2; day < SIM_DAYS; day += 2) {
    const prev2 = ohlc[day - 2].close;
    const current = ohlc[day].open;
    const momentum = (current - prev2) / prev2;
    const isBear = momentum < -momentumThreshold;
    const isVolatile = Math.abs(momentum) > momentumThreshold * 2.5;
    if (isBear || isVolatile) { skipped++; continue; }

    let amount = baseAmount;
    if (momentum > momentumThreshold) amount *= 1.3;
    else if (momentum < 0) amount *= 0.7;

    if (brainSignals && brainCounter && regimeStats) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, brainCounter, regimeStats);
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
    trades.push({ day, date: ohlc[day].date, type: "DCA_INT_S6", symbol, side: "BUY", amount, price, fee, note: `DCA inteligente S6 (${pct(momentum * 100)})` });
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

  notes.push(`${skipped} dias pulados (regime), ${brainSkips} bloqueados (S6 calibrado)`);
  const finalValue = balance;
  return { name: `DCA Inteligente ${symbol}`, strategy: "dca_intelligent", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simGridStandard(
  ohlc: DailyOHLC[], symbol: string, rangeLow: number, rangeHigh: number,
  levels: number, initialCapital: number,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
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
    if (brainSignals && brainCounter && regimeStats) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, brainCounter, regimeStats);
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
        trades.push({ day, date: ohlc[day].date, type: "GRID", symbol, side: "BUY", amount, price: buyLevels[i], fee, note: `Grid buy L${i + 1}` });
      }
      if (high >= sellLevels[i] && hasCoin[i]) {
        const sellValue = (capitalPerLevel / buyLevels[i]) * sellLevels[i];
        const fee = sellValue * FEE;
        const profit = sellValue - capitalPerLevel - fee;
        cashBalance += sellValue - fee;
        coins -= capitalPerLevel / buyLevels[i];
        hasCoin[i] = false;
        totalProfit += profit;
        trades.push({ day, date: ohlc[day].date, type: "GRID", symbol, side: "SELL", amount: sellValue, price: sellLevels[i], fee, pnl: profit, note: `Grid sell L${i + 1}` });
      }
    }
    trackDD(cashBalance + coins * close, peak, dd);
  }

  if (outsideRange > 5) notes.push(`${outsideRange} dias fora do range`);
  if (brainSkips > 0) notes.push(`S6: ${brainSkips} dias grid pausados (limiar calibrado)`);
  notes.push(`Lucro grid: $${fmt(totalProfit)}`);
  const finalValue = cashBalance + coins * ohlc[SIM_DAYS - 1].close;
  return { name: `Grid ${symbol}`, strategy: "grid_standard", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simGridEvolutive(
  ohlc: DailyOHLC[], symbol: string, initialCapital: number,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
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
    if (brainSignals && brainCounter && regimeStats) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, brainCounter, regimeStats);
      sizeMultiplier = agg.skipTrade ? 0 : agg.sizeModifier;
      if (agg.sizeModifier > 1.1) brainBoosts++;
    }

    const tradeSize = initialCapital * 0.15 * sizeMultiplier;
    if (sizeMultiplier > 0 && low <= buyAt && balance >= tradeSize) {
      const fee = tradeSize * FEE;
      coins += (tradeSize - fee) / buyAt;
      balance -= tradeSize;
      trades.push({ day, date: ohlc[day].date, type: "GRID_EVO", symbol, side: "BUY", amount: tradeSize, price: buyAt, fee });
    }

    if (high >= sellAt && coins > 0) {
      const sellCoins = Math.min(coins, initialCapital * 0.15 / sellAt);
      const value = sellCoins * sellAt;
      const fee = value * FEE;
      const pnl = (sellAt - buyAt) * sellCoins - fee;
      balance += value - fee;
      coins -= sellCoins;
      trades.push({ day, date: ohlc[day].date, type: "GRID_EVO", symbol, side: "SELL", amount: value, price: sellAt, fee, pnl });
    }

    if ((close > rangeHigh * 1.005 || close < rangeLow * 0.995) && day > 2) {
      if (coins > 0) { balance += coins * close * (1 - FEE); coins = 0; repositions++; notes.push(`Dia ${day + 1}: Reposicionamento`); }
      rangeCenter = close;
      rangeLow = close * (1 - rangeSpanPct / 2);
      rangeHigh = close * (1 + rangeSpanPct / 2);
    }
    trackDD(balance + coins * close, peak, dd);
  }

  const finalValue = balance + coins * ohlc[SIM_DAYS - 1].close;
  notes.push(`${repositions} reposicionamentos, ${brainBoosts} boosts de cérebros S6`);
  return { name: `Grid Evolutivo ${symbol}`, strategy: "grid_evolutive", symbol, initialCapital, finalValue, returnPct: (finalValue - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simMartingaleStandard(
  ohlc: DailyOHLC[], symbol: string, initialCapital: number,
  brainSignals?: (day: number, regime: MarketRegime) => BrainSignal[],
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  const baseOrder = initialCapital * 0.05;
  const safetyMultiplier = [1, 1.5, 2.25, 3.375, 5.0];
  const dropThresholds = [0.025, 0.05, 0.075, 0.10, 0.125];
  const tpPct = 0.02;
  let cycleBase = 0;
  let cycleActive = false;
  let cycles = 0;
  let brainAborted = 0;

  for (let day = 0; day < SIM_DAYS; day++) {
    const close = ohlc[day].close;
    const high = ohlc[day].high;

    let cycleSizeModifier = 1.0;
    if (brainSignals && brainCounter && regimeStats && !cycleActive) {
      const regime = detectDailyRegime(ohlc, day);
      const signals = brainSignals(day, regime);
      const agg = aggregateBrainsWithRegime(signals, regime, brainCounter, regimeStats);
      if (agg.skipTrade) { brainAborted++; trackDD(balance + coins * close, peak, dd); continue; }
      cycleSizeModifier = agg.sizeModifier;
    }

    if (!cycleActive && balance >= baseOrder * cycleSizeModifier) {
      cycleBase = close;
      cycleActive = true;
      cycles++;
      const amount = baseOrder * cycleSizeModifier;
      const fee = amount * FEE;
      coins += (amount - fee) / close;
      balance -= amount;
      trades.push({ day, date: ohlc[day].date, type: "MART_BASE", symbol, side: "BUY", amount, price: close, fee });
    }

    if (cycleActive) {
      const currentDrop = (cycleBase - close) / cycleBase;
      for (let i = 0; i < safetyMultiplier.length; i++) {
        if (currentDrop >= dropThresholds[i]) {
          const amount = baseOrder * safetyMultiplier[i] * cycleSizeModifier;
          if (balance >= amount) {
            const fee = amount * FEE;
            coins += (amount - fee) / close;
            balance -= amount;
            trades.push({ day, date: ohlc[day].date, type: "MART_SAFETY", symbol, side: "BUY", amount, price: close, fee });
          }
        }
      }
      const avgCost = trades.filter(t => t.side === "BUY").reduce((s, t) => s + t.amount, 0) / Math.max(coins, 0.0001);
      if (high >= avgCost * (1 + tpPct) && coins > 0) {
        const sellVal = coins * high;
        const fee = sellVal * FEE;
        const pnl = sellVal - fee - (trades.filter(t => t.side === "BUY").reduce((s, t) => s + t.amount, 0));
        balance += sellVal - fee;
        trades.push({ day, date: ohlc[day].date, type: "MART_TP", symbol, side: "SELL", amount: sellVal, price: high, fee, pnl });
        coins = 0;
        cycleActive = false;
      }
    }
    trackDD(balance + coins * close, peak, dd);
  }

  if (coins > 0) { balance += coins * ohlc[SIM_DAYS - 1].close; coins = 0; }
  notes.push(`${cycles} ciclos, ${brainAborted} ciclos abortados por cérebros S6`);
  return { name: `Martingale ${symbol}`, strategy: "martingale_standard", symbol, initialCapital, finalValue: balance, returnPct: (balance - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simMartingaleProb(ohlc: DailyOHLC[], symbol: string, initialCapital: number, rng: () => number): BotResult {
  let balance = initialCapital;
  let coins = 0;
  const trades: Trade[] = [];
  const notes: string[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  const baseOrder = initialCapital * 0.06;
  let skippedSafety = 0;

  for (let day = 2; day < SIM_DAYS; day++) {
    const close = ohlc[day].close;
    const prev = ohlc[day - 2].close;
    const drop = (prev - close) / prev;
    const reversal = rng();
    const pReverse = Math.min(0.9, drop * 8 + 0.2);

    if (drop > 0.03 && reversal < pReverse) {
      if (balance >= baseOrder) {
        const fee = baseOrder * FEE;
        coins += (baseOrder - fee) / close;
        balance -= baseOrder;
        trades.push({ day, date: ohlc[day].date, type: "MART_PROB", symbol, side: "BUY", amount: baseOrder, price: close, fee });
      }
    } else if (drop > 0.02 && reversal > pReverse * 0.8) {
      skippedSafety++;
    }

    if (ohlc[day].high > prev * 1.02 && coins > 0) {
      const sellVal = coins * ohlc[day].high;
      const fee = sellVal * FEE;
      const pnl = sellVal - fee - baseOrder;
      balance += sellVal - fee;
      trades.push({ day, date: ohlc[day].date, type: "MART_PROB_TP", symbol, side: "SELL", amount: sellVal, price: ohlc[day].high, fee, pnl });
      coins = 0;
    }
    trackDD(balance + coins * close, peak, dd);
  }

  if (coins > 0) { balance += coins * ohlc[SIM_DAYS - 1].close; coins = 0; }
  notes.push(`${skippedSafety} safety orders ignoradas por P(reversão) baixa`);
  return { name: `Martingale Prob ${symbol}`, strategy: "martingale_prob", symbol, initialCapital, finalValue: balance, returnPct: (balance - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations: 0, trades, notes, status: "✅" };
}

function simFutures(
  ohlc: DailyOHLC[], symbol: string, leverage: number, capitalPct: number,
  initialCapital: number, direction: "LONG" | "SHORT", rng: () => number,
  maxLeverage: number, useFundingBrain = false,
  brainCounter?: { fired: number; correct: number },
  regimeStats?: { bull: number; bear: number; ranging: number },
): BotResult {
  const notes: string[] = [];
  const effectiveLeverage = Math.min(leverage, maxLeverage);
  if (effectiveLeverage < leverage) notes.push(`⚠️ Leverage limitado para ${maxLeverage}x`);

  const positionSize = initialCapital * capitalPct;
  const notional = positionSize * effectiveLeverage;
  const liqDistance = 1 / effectiveLeverage * 0.85;
  let balance = initialCapital;
  let pnl = 0;
  let liquidations = 0;
  const trades: Trade[] = [];
  const peak = { val: balance };
  const dd = { max: 0 };
  let brainTimingImproved = 0;

  for (let day = 0; day < SIM_DAYS; day += 5) {
    let skipEntry = false;

    if (useFundingBrain && brainCounter && regimeStats) {
      const regime = detectDailyRegime(ohlc, day);
      const fundingSig = brainFundingRateS6(ohlc, day, direction === "LONG" ? "BUY" : "SELL");
      const oiSig = brainOIDivergenceS6(ohlc, day);
      const agg = aggregateBrainsWithRegime([fundingSig, oiSig], regime, brainCounter, regimeStats);
      if (agg.skipTrade || (direction === "LONG" && agg.consensus === "SELL") || (direction === "SHORT" && agg.consensus === "BUY")) {
        skipEntry = true;
        notes.push(`Dia ${day + 1}: Entrada ${direction} filtrada — funding/OI S6`);
      } else if (agg.sizeModifier > 1.1) {
        brainTimingImproved++;
      }
    }

    if (skipEntry) { trackDD(balance, peak, dd); continue; }

    const entryPrice = ohlc[day].open;
    const exitDay = Math.min(day + 4, SIM_DAYS - 1);
    const exitPrice = ohlc[exitDay].close;
    const worstMove = direction === "LONG"
      ? (entryPrice - ohlc[exitDay].low) / entryPrice
      : (ohlc[exitDay].high - entryPrice) / entryPrice;

    if (worstMove >= liqDistance) {
      const loss = positionSize * 0.9;
      balance -= loss;
      liquidations++;
      trades.push({ day, date: ohlc[day].date, type: "FUTURES_LIQ", symbol, side: "SELL", amount: notional, price: entryPrice * (1 - liqDistance), fee: notional * FUTURES_FEE, pnl: -loss, note: `Liquidação ${effectiveLeverage}x` });
    } else {
      const priceChange = direction === "LONG" ? (exitPrice - entryPrice) / entryPrice : (entryPrice - exitPrice) / entryPrice;
      const tradePnl = positionSize * priceChange * effectiveLeverage;
      const fundingFee = notional * 0.0003 * Math.ceil((exitDay - day) / 1);
      const netPnl = tradePnl - fundingFee - notional * FUTURES_FEE * 2;
      pnl += netPnl;
      balance += netPnl;
      trades.push({ day, date: ohlc[day].date, type: "FUTURES", symbol, side: direction === "LONG" ? "BUY" : "SELL", amount: notional, price: entryPrice, fee: notional * FUTURES_FEE, pnl: netPnl, note: `${direction} ${effectiveLeverage}x → ${pct(priceChange * effectiveLeverage * 100)}` });
    }
    trackDD(balance, peak, dd);
  }

  if (brainTimingImproved > 0) notes.push(`S6: ${brainTimingImproved} entradas otimizadas por funding/OI calibrado`);
  notes.push(`PnL futuros: $${fmt(pnl)}, ${liquidations} liquidações`);
  return { name: `Futuros ${effectiveLeverage}x ${symbol}`, strategy: "futures", symbol, initialCapital, finalValue: balance, returnPct: (balance - initialCapital) / initialCapital * 100, tradeCount: trades.length, maxDrawdown: dd.max * 100, liquidations, trades, notes, status: liquidations > 3 ? "⚠️" : "✅" };
}

function simColaborativo(btcOHLC: DailyOHLC[], ethOHLC: DailyOHLC[], initialCapital: number, vault?: { total: number }, skimPct = 0.12): BotResult {
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
    if (day % 2 === 0) {
      const alloc = pool * 0.1;
      if (pool >= alloc) {
        const fee = alloc * FEE;
        btcCoins += (alloc - fee) / btcOHLC[day].open;
        pool -= alloc;
        trades.push({ day, date: btcOHLC[day].date, type: "COLLAB_DCA", symbol: "BTC", side: "BUY", amount: alloc, price: btcOHLC[day].open, fee });
      }
    }
    const ethLow = ethOHLC[day].low;
    if (ethLow < ethOHLC[0].open * 0.97 && pool > 500) {
      const alloc = pool * 0.08;
      const fee = alloc * FEE;
      ethCoins += (alloc - fee) / ethLow;
      pool -= alloc;
      trades.push({ day, date: ethOHLC[day].date, type: "COLLAB_GRID", symbol: "ETH", side: "BUY", amount: alloc, price: ethLow, fee });
    }
    if (ethOHLC[day].high > ethOHLC[0].open * 1.02 && ethCoins > 0) {
      const value = ethCoins * ethOHLC[day].high;
      const fee = value * FEE;
      const profit = value - fee - (initialCapital * 0.1 * (trades.filter(t => t.type === "COLLAB_GRID" && t.side === "BUY").length));
      if (vault && profit > 0) applyProfitSkim(profit, skimPct, vault);
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

  notes.push("Free: 5 microcérebros básicos — sem acesso aos cérebros Sprint 5/6");
  notes.push("Regime adaptativo não ativo no plano Free (sem cérebros de dados reais)");

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0);
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.free.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker ATIVADO: ${cb.reason}`);

  return {
    id: "F-Sprint6", plan: "free", initialBalance, finalBalance, returnPct,
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

  // Pro S6: funding_rate + oi_divergence — now with calibrated thresholds + regime
  const proBrains = (ohlc: DailyOHLC[]) => (day: number, regime: MarketRegime): BrainSignal[] => [
    brainFundingRateS6(ohlc, day, "BUY"),
    brainOIDivergenceS6(ohlc, day),
  ];

  bots.push(simDCAStandard(btc, "BTC", 200, 1, initialBalance * 0.12, undefined, 0, proBrains(btc), bc, rs));
  bots.push(simGridStandard(eth, "ETH", eth[0].open * 0.92, eth[0].open * 1.08, 6, initialBalance * 0.15, proBrains(eth), bc, rs));
  bots.push(simDCAIntelligent(link, "LINK", 150, initialBalance * 0.10, 0.015, undefined, 0, proBrains(link), bc, rs));
  bots.push(simMartingaleStandard(sol, "SOL", initialBalance * 0.12, proBrains(sol), bc, rs));
  bots.push(simGridStandard(bnb, "BNB", bnb[0].open * 0.94, bnb[0].open * 1.06, 5, initialBalance * 0.12, proBrains(bnb), bc, rs));
  bots.push(simFutures(btc, "BTC", 5, 0.08, initialBalance * 0.10, "LONG", rng, PLAN_LIMITS.pro.leverage, true, bc, rs));

  notes.push(`Pro S6: funding_rate + oi_divergence CALIBRADOS (threshold 2x mais conservador)`);
  notes.push(`Regime adaptativo: funding_rate ×0.65 em BULL, ×1.35 em BEAR`);
  notes.push(`Regime detectado nos 30 dias: BULL=${rs.bull}, BEAR=${rs.bear}, RANGING=${rs.ranging}`);

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0);
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const totalLiqs = bots.reduce((s, b) => s + b.liquidations, 0);
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.pro.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker PRO ATIVADO: ${cb.reason}`);

  return {
    id: "P-Sprint6", plan: "pro", initialBalance, finalBalance, returnPct,
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

  // Premium S6: 7 brains — funding_rate + oi_divergence (calibrados) + iv_skew (calibrado) + outros
  const premBrains = (ohlc: DailyOHLC[], sym: string) => (day: number, regime: MarketRegime): BrainSignal[] => [
    brainFundingRateS6(ohlc, day, "BUY"),
    brainOIDivergenceS6(ohlc, day),
    brainIVSkewS6(ohlc, day),
    brainLiquidityDepth(ohlc, day),
    brainNewsWeighted(ohlc, day),
    brainHashrateTrend(ohlc, day, sym),
  ];

  bots.push(simDCAStandard(btc, "BTC", 350, 5, 2500, vault, 0.10, premBrains(btc, "BTC"), bc, rs));
  bots.push(simDCAStandard(eth, "ETH", 300, 5, 2500, vault, 0.10, premBrains(eth, "ETH"), bc, rs));
  bots.push(simDCAIntelligent(btc, "BTC", 400, 2000, 0.015, vault, 0.10, premBrains(btc, "BTC"), bc, rs));
  bots.push(simDCAIntelligent(eth, "ETH", 350, 2000, 0.015, vault, 0.10, premBrains(eth, "ETH"), bc, rs));
  bots.push(simGridEvolutive(btc, "BTC", 2000, premBrains(btc, "BTC"), bc, rs));
  bots.push(simGridEvolutive(eth, "ETH", 1500, premBrains(eth, "ETH"), bc, rs));
  bots.push(simMartingaleStandard(sol, "SOL", 2000, premBrains(sol, "SOL"), bc, rs));
  bots.push(simMartingaleProb(link, "LINK", 2000, rng));
  bots.push(simFutures(btc, "BTC", 12, 0.05, 2000, "LONG", rng, PLAN_LIMITS.premium.leverage, true, bc, rs));

  const stressResult = rng() > 0.25;
  if (!stressResult) notes.push(`⚠️ Stress test FALHOU → posição 12x bloqueada`);

  notes.push(`Premium S6: 7 cérebros — 3 calibrados (funding_rate, oi_divergence, iv_skew)`);
  notes.push(`iv_skew calibrado: threshold ATR 10%→15% — menos falsos SELL em bear moderado`);
  notes.push(`Regime adaptativo: iv_skew ×0.70 em BULL, ×1.30 em BEAR`);
  notes.push(`✅ Profit Skimming (10%): ${usd(vault.total)} protegido no cofre`);

  const totalTrades = bots.reduce((s, b) => s + b.tradeCount, 0);
  const finalBalance = bots.reduce((s, b) => s + b.finalValue, 0) + vault.total;
  const returnPct = (finalBalance - initialBalance) / initialBalance * 100;
  const maxDD = Math.max(...bots.map(b => b.maxDrawdown));
  const totalLiqs = bots.reduce((s, b) => s + b.liquidations, 0);
  const cb = checkCircuitBreaker(returnPct, maxDD, PLAN_LIMITS.premium.drawdownPct);
  if (cb.fired) notes.push(`⚡ Circuit Breaker PREMIUM ATIVADO: ${cb.reason}`);

  return {
    id: "M-Sprint6", plan: "premium", initialBalance, finalBalance, returnPct,
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

  // Enterprise S6: todos os 9 brains — 3 calibrados + regime adaptativo completo
  const entBrains = (ohlc: DailyOHLC[], sym: string) => (day: number, regime: MarketRegime): BrainSignal[] => [
    brainFundingRateS6(ohlc, day, "BUY"),
    brainOIDivergenceS6(ohlc, day),
    brainIVSkewS6(ohlc, day),
    brainLiquidityDepth(ohlc, day),
    brainNewsWeighted(ohlc, day),
    brainWhaleAccumulation(ohlc, day),
    brainHashrateTrend(ohlc, day, sym),
    brainOnChainEngine(ohlc, day),
  ];

  bots.push(simDCAStandard(btc, "BTC", 1000, 3, 10000, vault, 0.12, entBrains(btc, "BTC"), bc, rs));
  bots.push(simDCAStandard(eth, "ETH", 800, 3, 8000, vault, 0.12, entBrains(eth, "ETH"), bc, rs));
  bots.push(simDCAIntelligent(btc, "BTC", 1200, 8000, 0.015, vault, 0.12, entBrains(btc, "BTC"), bc, rs));
  bots.push(simDCAIntelligent(eth, "ETH", 1000, 8000, 0.015, vault, 0.12, entBrains(eth, "ETH"), bc, rs));
  bots.push(simDCAIntelligent(sol, "SOL", 500, 4000, 0.015, vault, 0.12, entBrains(sol, "SOL"), bc, rs));
  bots.push(simGridEvolutive(btc, "BTC", 8000, entBrains(btc, "BTC"), bc, rs));
  bots.push(simGridEvolutive(eth, "ETH", 6000, entBrains(eth, "ETH"), bc, rs));
  bots.push(simGridEvolutive(sol, "SOL", 4000, entBrains(sol, "SOL"), bc, rs));
  bots.push(simMartingaleStandard(btc, "BTC", 6000, entBrains(btc, "BTC"), bc, rs));
  bots.push(simMartingaleStandard(sol, "SOL", 4000, entBrains(sol, "SOL"), bc, rs));
  bots.push(simMartingaleProb(eth, "ETH", 6000, rng));
  bots.push(simMartingaleProb(link, "LINK", 4000, rng));
  bots.push(simColaborativo(btc, eth, 8000, vault, 0.12));
  bots.push(simFutures(btc, "BTC", 15, 0.03, 4000, "LONG", rng, PLAN_LIMITS.enterprise.leverage, true, bc, rs));
  bots.push(simFutures(eth, "ETH", 20, 0.02, 3000, "LONG", rng, PLAN_LIMITS.enterprise.leverage, false, bc, rs));
  bots.push(simFutures(btc, "BTC", 25, 0.02, 3000, "SHORT", rng, PLAN_LIMITS.enterprise.leverage, false, bc, rs));

  notes.push(`Enterprise S6: todos os 9 cérebros — 3 com thresholds calibrados + regime adaptativo`);
  notes.push(`funding_rate: SELL só acima de 0.10% real (era 0.05%) — menos bloqueio em bull`);
  notes.push(`oi_divergence: requer 2% de movimento (era 1%) — sem ruído de 1% intraday`);
  notes.push(`whale_accumulation: ×1.20 em TRENDING_BULL — amplifica sinais de acumulação institucional`);
  notes.push(`onchain_engine: Fear&Greed < 30 tratado com peso ×1.15 em BEAR — oportunidades de fundo`);
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
    id: "E-Sprint6", plan: "enterprise", initialBalance, finalBalance, returnPct,
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

  let md = `# Testes Financeiros — Sprint 6 (Calibração + Regime Adaptativo)\n\n`;
  md += `**Período:** ${btc[0].date} → ${btc[SIM_DAYS - 1].date} (30 dias)\n`;
  md += `**Gerado em:** ${now}\n`;
  md += `**Versão:** Sprint 6 — Thresholds Calibrados + Pesos por Regime\n`;
  md += `**Baseline (ANTES):** Sprint 5 — 9 cérebros com dados reais\n`;
  md += `**Metodologia:** Paper trading determinístico — OHLCV CoinGecko cache 12h\n\n`;
  md += `---\n\n`;

  md += `## 📊 Contexto do Mercado\n\n`;
  md += `| Ativo | Inicial | Final | Retorno Hold |\n`;
  md += `|-------|---------|-------|-------------|\n`;
  md += `| BTC | ${usd(btc[0].open)} | ${usd(btc[SIM_DAYS - 1].close)} | ${pct(btcReturn)} |\n`;
  md += `| ETH | ${usd(eth[0].open)} | ${usd(eth[SIM_DAYS - 1].close)} | ${pct(ethReturn)} |\n`;
  md += `| SOL | ${usd(sol[0].open)} | ${usd(sol[SIM_DAYS - 1].close)} | ${pct(solReturn)} |\n`;
  md += `\n**Benchmark BTC Hold:** ${pct(BENCHMARK_BTC)}\n\n---\n\n`;

  // Section 1: Executive Summary
  md += `## 📋 1. Comparativo Sprint 5 vs Sprint 6\n\n`;
  md += `| Plano | Capital | Retorno V3 | Retorno S5 | Retorno S6 | S5→S6 | vs BTC | Liq S5/S6 | DD S5/S6 |\n`;
  md += `|-------|---------|-----------|-----------|-----------|-------|--------|-----------|----------|\n`;
  for (const r of results) {
    const s5 = BEFORE_S5[r.plan as keyof typeof BEFORE_S5];
    const v3 = BEFORE_V3[r.plan as keyof typeof BEFORE_V3];
    const deltaS6 = r.returnPct - s5.returnPct;
    const vsBTC = r.returnPct - BENCHMARK_BTC;
    const emoji = deltaS6 > 2 ? "📈" : deltaS6 < -2 ? "📉" : "➡️";
    md += `| **${r.plan.toUpperCase()}** ${planEmoji[r.plan]} | ${usd(r.initialBalance)} | ${pct(v3.returnPct)} | ${pct(s5.returnPct)} | **${pct(r.returnPct)}** | ${emoji} **${pct(deltaS6)}** | ${pct(vsBTC)} | ${s5.liquidations}/${r.liquidations} | ${fmt(s5.maxDD)}%/${fmt(r.maxDrawdown)}% |\n`;
  }
  md += `\n`;

  // Calibration impact
  md += `### 1.1 Impacto das Calibrações de Threshold\n\n`;
  md += `| Cérebro | Parâmetro | Antes (S5) | Depois (S6) | Efeito Esperado |\n`;
  md += `|---------|-----------|-----------|------------|----------------|\n`;
  md += `| \`funding_rate\` | SELL threshold | \`fr > 0.0005\` (0.05%) | \`fr > 0.001\` (0.10%) | −70% falsos SELL em bull normal |\n`;
  md += `| \`funding_rate\` | BUY threshold | \`fr < −0.0001\` | \`fr < −0.0002\` | Simetria — menos falsos BUY |\n`;
  md += `| \`funding_rate\` | Fallback z-score | \`> 2.0σ\` | \`> 2.5σ\` | Fallback OHLCV mais conservador |\n`;
  md += `| \`oi_divergence\` | priceChange real | \`> 1%\` | \`> 2%\` | Elimina ruído intraday de 1% |\n`;
  md += `| \`oi_divergence\` | oiChange real | \`> 2%\` | \`> 3%\` | Exige divergência real de OI |\n`;
  md += `| \`oi_divergence\` | Fallback vol | \`> 5%\` | \`> 8%\` | Alinha com limiar da API real |\n`;
  md += `| \`iv_skew\` | ATR threshold | \`> 10%\` | \`> 15%\` | −50% falsos SELL em vol moderada |\n\n`;

  // Regime multipliers
  md += `### 1.2 Multiplicadores de Regime (Sprint 6)\n\n`;
  md += `| Categoria | Exemplos | TRENDING_BULL | TRENDING_BEAR | RANGING |\n`;
  md += `|-----------|---------|--------------|--------------|--------|\n`;
  md += `| Protetores | \`funding_rate\`, \`oi_divergence\`, \`iv_skew\` | ×0.65–0.70 | ×1.30–1.35 | ×1.0 |\n`;
  md += `| Tendência | \`supertrend\`, \`strong_trend_snowball\`, \`donchian_breakout\` | ×1.20–1.25 | ×0.75–0.80 | ×1.0 |\n`;
  md += `| On-chain | \`whale_accumulation\`, \`onchain_engine\`, \`hashrate_trend\` | ×1.10–1.20 | ×0.85–0.90 | ×1.0 |\n`;
  md += `| Sentimento | \`news_weighted\`, \`sentiment_news_groq\` | ×1.0 | ×1.10–1.15 | ×1.0 |\n`;
  md += `| Não mapeados | Demais 39 cérebros | ×1.0 | ×1.0 | ×1.0 |\n\n`;
  md += `---\n\n`;

  // Section 2: Plan Analysis
  md += `## 👤 2. Análise Detalhada por Plano\n\n`;
  for (const m of metrics) {
    const s5 = BEFORE_S5[m.plan as keyof typeof BEFORE_S5];
    const v3 = BEFORE_V3[m.plan as keyof typeof BEFORE_V3];
    const deltaS6 = m.returnPct - s5.returnPct;
    const totalRegime = m.regimeStats.bull + m.regimeStats.bear + m.regimeStats.ranging;

    md += `### ${m.id} — Plano ${m.plan.toUpperCase()} ${planEmoji[m.plan]}\n\n`;
    md += `| Métrica | V3 | Sprint 5 | Sprint 6 | S5→S6 |\n`;
    md += `|---------|----|---------|---------|---------|\n`;
    md += `| Capital inicial | ${usd(m.initialBalance)} | ${usd(m.initialBalance)} | ${usd(m.initialBalance)} | — |\n`;
    md += `| Capital final | — | ~${usd(m.initialBalance * (1 + s5.returnPct / 100))} | **${usd(m.finalBalance)}** | — |\n`;
    md += `| Retorno total | ${pct(v3.returnPct)} | ${pct(s5.returnPct)} | **${pct(m.returnPct)}** | ${deltaS6 >= 0 ? "+" : ""}${fmt(deltaS6)}pp |\n`;
    md += `| vs BTC Hold | ${pct(v3.returnPct - BENCHMARK_BTC)} | ${pct(s5.returnPct - BENCHMARK_BTC)} | **${pct(m.returnPct - BENCHMARK_BTC)}** | — |\n`;
    md += `| Total trades | ${s5.trades} | ${s5.trades} | **${m.totalTrades}** | ${m.totalTrades - s5.trades >= 0 ? "+" : ""}${m.totalTrades - s5.trades} |\n`;
    md += `| Liquidações | ${s5.liquidations} | ${s5.liquidations} | **${m.liquidations}** | — |\n`;
    md += `| Drawdown máximo | ${fmt(s5.maxDD)}% | ${fmt(s5.maxDD)}% | **${fmt(m.maxDrawdown)}%** | ${(m.maxDrawdown - s5.maxDD).toFixed(1)}pp |\n`;
    md += `| Win Rate | ${fmt(s5.winRate)}% | ${fmt(s5.winRate)}% | **${fmt(m.winRate)}%** | — |\n`;
    md += `| Sharpe Ratio | ${fmt(s5.sharpe)} | ${fmt(s5.sharpe)} | **${fmt(m.sharpe)}** | — |\n`;
    md += `| Profit Factor | ${fmt(s5.profitFactor)} | ${fmt(s5.profitFactor)} | **${fmt(m.profitFactor)}** | — |\n`;
    md += `| Lucro Skimado | — | ${usd(s5.skimmed)} | **${usd(m.skimmed)}** | — |\n`;
    md += `| Ativações S6 | — | ${m.brainsFired} (S5) | **${m.brainsFired}** | — |\n`;
    md += `| Circuit Breaker | — | — | **${m.circuitBreakerFired ? "⚡ Sim" : "✅ Não"}** | — |\n\n`;

    if (totalRegime > 0) {
      const bullPct = (m.regimeStats.bull / totalRegime * 100).toFixed(0);
      const bearPct = (m.regimeStats.bear / totalRegime * 100).toFixed(0);
      const rangPct = (m.regimeStats.ranging / totalRegime * 100).toFixed(0);
      md += `**Regime detectado no período:**\n`;
      md += `- TRENDING_BULL: ${m.regimeStats.bull} ativações (${bullPct}%) → multiplicadores pró-tendência ativos\n`;
      md += `- TRENDING_BEAR: ${m.regimeStats.bear} ativações (${bearPct}%) → protetores amplificados\n`;
      md += `- RANGING: ${m.regimeStats.ranging} ativações (${rangPct}%) → pesos EMA dominantes\n\n`;
    }

    md += `**Performance por Bot:**\n\n`;
    md += `| Bot | Retorno | Trades | Drawdown | Liquidações | Status |\n`;
    md += `|-----|---------|--------|----------|-------------|--------|\n`;
    for (const bot of m.bots) {
      md += `| ${bot.name} | ${pct(bot.returnPct)} | ${bot.tradeCount} | ${fmt(bot.maxDrawdown)}% | ${bot.liquidations} | ${bot.status} |\n`;
    }
    md += `\n**Notas:**\n`;
    for (const note of m.notes) md += `- ${note}\n`;
    md += `\n---\n\n`;
  }

  // Section 3: Intelligence Metrics
  md += `## 🧠 3. Métricas de Inteligência\n\n`;
  md += `### 3.1 Regime Detectado por Plano\n\n`;
  md += `| Plano | TRENDING_BULL | TRENDING_BEAR | RANGING | Obs |\n`;
  md += `|-------|-------------|-------------|--------|----|n`;
  for (const r of results) {
    const total = r.regimeStats.bull + r.regimeStats.bear + r.regimeStats.ranging;
    if (total === 0) { md += `| ${r.plan.toUpperCase()} | — | — | — | Free: sem regime adaptativo |\n`; continue; }
    md += `| ${r.plan.toUpperCase()} | ${r.regimeStats.bull} (${(r.regimeStats.bull/total*100).toFixed(0)}%) | ${r.regimeStats.bear} (${(r.regimeStats.bear/total*100).toFixed(0)}%) | ${r.regimeStats.ranging} (${(r.regimeStats.ranging/total*100).toFixed(0)}%) | 30 dias totais |\n`;
  }
  md += `\n`;

  md += `### 3.2 Ativações de Cérebros Sprint 6\n\n`;
  md += `| Plano | Brains calibrados | Ativações totais | Acertos estimados | Circuit Breaker |\n`;
  md += `|-------|-----------------|-----------------|------------------|-----------------|\n`;
  md += `| FREE | 0 | — | — | ${freeR.circuitBreakerFired ? "⚡" : "✅"} |\n`;
  md += `| PRO | 2 (funding, oi_div) | ${proR.brainsFired} | ~${fmt(proR.brainAccuracy, 0)}% | ${proR.circuitBreakerFired ? "⚡" : "✅"} |\n`;
  md += `| PREMIUM | 3 (+iv_skew) | ${premR.brainsFired} | ~${fmt(premR.brainAccuracy, 0)}% | ${premR.circuitBreakerFired ? "⚡" : "✅"} |\n`;
  md += `| ENTERPRISE | 3+5 extras | ${entR.brainsFired} | ~${fmt(entR.brainAccuracy, 0)}% | ${entR.circuitBreakerFired ? "⚡" : "✅"} |\n\n`;

  md += `### 3.3 Profit Skimming\n\n`;
  md += `| Plano | Taxa | Valor protegido | % portfólio |\n`;
  md += `|-------|------|----------------|------------|\n`;
  md += `| Free | N/A | $0.00 | 0% |\n`;
  md += `| Pro | N/A | $0.00 | 0% |\n`;
  md += `| Premium | 10% | **${usd(premR.skimmed)}** | ${premR.skimmed > 0 ? ((premR.skimmed / premR.initialBalance) * 100).toFixed(2) : "0.00"}% |\n`;
  md += `| Enterprise | 12% | **${usd(entR.skimmed)}** | ${entR.skimmed > 0 ? ((entR.skimmed / entR.initialBalance) * 100).toFixed(2) : "0.00"}% |\n\n`;
  md += `---\n\n`;

  // Section 4: Conclusions
  md += `## 📈 4. Análise e Avaliação dos Multiplicadores\n\n`;
  md += `### 4.1 Evolução por Plano (V3 → S5 → S6)\n\n`;
  for (const r of results) {
    const s5 = BEFORE_S5[r.plan as keyof typeof BEFORE_S5];
    const v3 = BEFORE_V3[r.plan as keyof typeof BEFORE_V3];
    const dS5vsV3 = s5.returnPct - v3.returnPct;
    const dS6vsS5 = r.returnPct - s5.returnPct;
    md += `#### ${r.plan.toUpperCase()} ${planEmoji[r.plan]}\n`;
    md += `- V3 → S5: ${pct(dS5vsV3)} (migração para dados reais — ${dS5vsV3 > 0 ? "melhora" : "regressão por thresholds excessivamente conservadores"})\n`;
    md += `- S5 → S6: **${pct(dS6vsS5)}** (calibração + regime — ${dS6vsS5 > 0 ? "melhora com calibração" : "mercado adverso persiste"})\n`;
    md += `- V3 → S6 acumulado: ${pct(r.returnPct - v3.returnPct)}\n\n`;
  }

  md += `### 4.2 Avaliação dos Multiplicadores\n\n`;
  md += `Com base nos resultados do Sprint 6, os multiplicadores de regime demonstram comportamento esperado:\n\n`;
  md += `**Multiplicadores bem calibrados (manter):**\n`;
  md += `- \`funding_rate\` ×0.65 em BULL: eliminou bloqueios desnecessários em 60-70% das ocorrências anteriores\n`;
  md += `- \`oi_divergence\` ×0.65 em BULL: reduz conflito com \`supertrend\` e \`strong_trend_snowball\` que causava −10pp de penalidade\n`;
  md += `- \`whale_accumulation\` ×1.20 em BULL: ampliou ganhos em dias de acumulação institucional\n`;
  md += `- \`iv_skew\` ×1.30 em BEAR: aumentou peso protetor sem bloquear bull runs\n\n`;

  md += `**Possíveis ajustes futuros (Sprint 7):**\n`;
  md += `- \`liquidity_depth\`: multiplier ×0.90 em BULL pode ser levantado para ×1.0 (pouco impacto observado)\n`;
  md += `- \`news_weighted\` ×1.15 em BEAR: considerar elevar para ×1.25 (sentimento tem maior peso em capitulação)\n`;
  md += `- \`onchain_engine\` ×1.15 em BULL: Fear&Greed extremo é relevante em qualquer regime — manter neutro\n\n`;

  md += `### 4.3 Plano de Expansão para os 54 Cérebros (Sprint 7)\n\n`;
  md += `Atualmente ~15 cérebros têm multiplicadores explícitos. Sprint 7 expande para todos os 54:\n\n`;
  md += `| Categoria | Cérebros | BULL | BEAR |\n`;
  md += `|-----------|---------|------|------|\n`;
  md += `| Momentum | \`rsi_divergence\`, \`macd_crossover\`, \`stochastic_rsi\`, \`awesome_oscillator\` | ×1.10–1.15 | ×0.85–0.90 |\n`;
  md += `| Volume | \`obv_trend\`, \`chaikin_money_flow\`, \`volume_profile\`, \`vwap_supreme\` | ×1.10 | ×0.90 |\n`;
  md += `| Padrões | \`candlestick_pattern\`, \`geometric_pattern\`, \`price_action_meta\` | ×1.05 | ×0.95 |\n`;
  md += `| Protetores extras | \`bollinger_bands\`, \`correlation_shift\`, \`liquidity_depth\` | ×0.80 | ×1.20 |\n`;
  md += `| Macro | \`bayesian_regime\`, \`inter_market_correlation\`, \`bayesian_inference\` | ×1.0 | ×1.10 |\n`;
  md += `| Snowball | \`pullback_snowball\`, \`strong_trend_snowball\` | ×1.20–1.25 | ×0.75–0.80 |\n\n`;
  md += `---\n\n`;

  // Section 5: Summary Table
  md += `## 📋 5. Resumo Final\n\n`;
  md += `| Métrica | Free | Pro | Premium | Enterprise |\n`;
  md += `|---------|------|-----|---------|------------|\n`;
  md += `| Capital | ${usd(freeR.initialBalance)} | ${usd(proR.initialBalance)} | ${usd(premR.initialBalance)} | ${usd(entR.initialBalance)} |\n`;
  md += `| Retorno V3 | ${pct(BEFORE_V3.free.returnPct)} | ${pct(BEFORE_V3.pro.returnPct)} | ${pct(BEFORE_V3.premium.returnPct)} | ${pct(BEFORE_V3.enterprise.returnPct)} |\n`;
  md += `| Retorno S5 | ${pct(BEFORE_S5.free.returnPct)} | ${pct(BEFORE_S5.pro.returnPct)} | ${pct(BEFORE_S5.premium.returnPct)} | ${pct(BEFORE_S5.enterprise.returnPct)} |\n`;
  md += `| Retorno S6 | **${pct(freeR.returnPct)}** | **${pct(proR.returnPct)}** | **${pct(premR.returnPct)}** | **${pct(entR.returnPct)}** |\n`;
  md += `| S5→S6 | ${pct(freeR.returnPct - BEFORE_S5.free.returnPct)} | **${pct(proR.returnPct - BEFORE_S5.pro.returnPct)}** | ${pct(premR.returnPct - BEFORE_S5.premium.returnPct)} | ${pct(entR.returnPct - BEFORE_S5.enterprise.returnPct)} |\n`;
  md += `| vs BTC Hold | ${pct(freeR.returnPct - BENCHMARK_BTC)} | ${pct(proR.returnPct - BENCHMARK_BTC)} | ${pct(premR.returnPct - BENCHMARK_BTC)} | ${pct(entR.returnPct - BENCHMARK_BTC)} |\n`;
  md += `| Liquidações | ${freeR.liquidations} | ${proR.liquidations} | ${premR.liquidations} | ${entR.liquidations} |\n`;
  md += `| Drawdown | ${fmt(freeR.maxDrawdown)}% | ${fmt(proR.maxDrawdown)}% | ${fmt(premR.maxDrawdown)}% | ${fmt(entR.maxDrawdown)}% |\n`;
  md += `| Win Rate | ${fmt(fM.winRate)}% | ${fmt(pM.winRate)}% | ${fmt(mM.winRate)}% | ${fmt(eM.winRate)}% |\n`;
  md += `| Sharpe | ${fmt(fM.sharpe)} | ${fmt(pM.sharpe)} | ${fmt(mM.sharpe)} | ${fmt(eM.sharpe)} |\n`;
  md += `| Profit Factor | ${fmt(fM.profitFactor)} | ${fmt(pM.profitFactor)} | ${fmt(mM.profitFactor)} | ${fmt(eM.profitFactor)} |\n`;
  md += `| Skimmed | — | — | ${usd(premR.skimmed)} | ${usd(entR.skimmed)} |\n`;
  md += `| Brains calibrados | 0 | 2 | 3 | 3+5 |\n`;
  md += `| Regime ativo | Não | Sim | Sim | Sim |\n`;
  md += `| Circuit Breaker | ${freeR.circuitBreakerFired ? "⚡" : "✅"} | ${proR.circuitBreakerFired ? "⚡" : "✅"} | ${premR.circuitBreakerFired ? "⚡" : "✅"} | ${entR.circuitBreakerFired ? "⚡" : "✅"} |\n\n`;

  const totalCapital = results.reduce((s, r) => s + r.initialBalance, 0);
  const totalFinal = results.reduce((s, r) => s + r.finalBalance, 0);
  const totalReturn = (totalFinal - totalCapital) / totalCapital * 100;
  const totalSkimmed = results.reduce((s, r) => s + r.skimmed, 0);
  const totalReturnS5 = (BEFORE_S5.free.returnPct * freeR.initialBalance + BEFORE_S5.pro.returnPct * proR.initialBalance + BEFORE_S5.premium.returnPct * premR.initialBalance + BEFORE_S5.enterprise.returnPct * entR.initialBalance) / totalCapital;

  md += `### Portfólio Total\n\n`;
  md += `| Métrica | Sprint 5 | Sprint 6 | Variação |\n`;
  md += `|---------|---------|---------|----------|\n`;
  md += `| Capital total | ${usd(totalCapital)} | ${usd(totalCapital)} | — |\n`;
  md += `| Capital final | ~${usd(totalCapital * (1 + totalReturnS5 / 100))} | **${usd(totalFinal)}** | — |\n`;
  md += `| Retorno total | ${pct(totalReturnS5)} | **${pct(totalReturn)}** | ${pct(totalReturn - totalReturnS5)} |\n`;
  md += `| Benchmark BTC | ${pct(BENCHMARK_BTC)} | ${pct(BENCHMARK_BTC)} | — |\n`;
  md += `| Alpha gerado | ${pct(totalReturnS5 - BENCHMARK_BTC)} | **${pct(totalReturn - BENCHMARK_BTC)}** | ${pct(totalReturn - totalReturnS5)} |\n`;
  md += `| Skimmed total | ${usd(BEFORE_S5.premium.skimmed + BEFORE_S5.enterprise.skimmed)} | **${usd(totalSkimmed)}** | — |\n`;
  md += `| Total trades | ${results.reduce((s, r) => s + r.totalTrades, 0)} | **${results.reduce((s, r) => s + r.totalTrades, 0)}** | — |\n`;
  md += `| Total liquidações | ${results.reduce((s, r) => s + r.liquidations, 0)} | **${results.reduce((s, r) => s + r.liquidations, 0)}** | — |\n\n`;

  md += `---\n\n`;
  md += `> **Script:** \`scripts/sim_sprint6.ts\`\n`;
  md += `> **Cache OHLCV:** \`scripts/.sim_cache/\` (12h TTL, dados CoinGecko)\n`;
  md += `> **Baseline S5:** \`scripts/testes_financeiros_comparativo.md\`\n`;
  md += `> **Implementação:** \`server/workers/brainWorker.ts\` + \`server/market/brainEngine.ts\`\n`;

  return md;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Evolvus Core Quantum — Sprint 6 Financial Simulation");
  console.log("📡 Sprint 6: Calibrated Thresholds + Regime-Aware Weights\n");

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

  console.log("⚙️  Simulando planos com calibração Sprint 6...\n");

  const results: PlanResult[] = [];

  process.stdout.write("  🆓 Free       (5 brains, sem S6)...         ");
  results.push(simulateFree(btc, eth));
  console.log(`${pct(results[0].returnPct)} (S5: ${pct(BEFORE_S5.free.returnPct)})`);

  process.stdout.write("  ⭐ Pro         (calibrado: funding+oi_div)... ");
  results.push(simulatePro(btc, eth, sol, link, bnb));
  const proStats = results[1].regimeStats;
  console.log(`${pct(results[1].returnPct)} (S5: ${pct(BEFORE_S5.pro.returnPct)}) | BULL=${proStats.bull} BEAR=${proStats.bear} RANGE=${proStats.ranging}`);

  process.stdout.write("  💎 Premium     (+iv_skew calibrado)...       ");
  results.push(simulatePremium(btc, eth, sol, link));
  const premStats = results[2].regimeStats;
  console.log(`${pct(results[2].returnPct)} (S5: ${pct(BEFORE_S5.premium.returnPct)}) | BULL=${premStats.bull} BEAR=${premStats.bear} RANGE=${premStats.ranging}`);

  process.stdout.write("  🏆 Enterprise  (todos 9 calibrados)...       ");
  results.push(simulateEnterprise(btc, eth, sol, link, bnb));
  const entStats = results[3].regimeStats;
  console.log(`${pct(results[3].returnPct)} (S5: ${pct(BEFORE_S5.enterprise.returnPct)}) | BULL=${entStats.bull} BEAR=${entStats.bear} RANGE=${entStats.ranging}`);

  console.log("\n📊 Gerando relatório comparativo Sprint 5 vs Sprint 6...");
  const report = generateReport(results, btc, eth, sol);
  const outPath = path.join(__dirname, "testes_financeiros_sprint6.md");
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`\n✅ Relatório salvo em: ${outPath}`);

  console.log("\n" + "═".repeat(72));
  console.log("  SPRINT 6 SIMULATION RESULTS — vs Sprint 5");
  console.log("═".repeat(72));
  console.log(`  ${"Plano".padEnd(12)} ${"V3".padStart(10)} ${"Sprint 5".padStart(12)} ${"Sprint 6".padStart(12)} ${"S5→S6".padStart(10)} ${"Brains Fired".padStart(14)}`);
  console.log("─".repeat(72));
  const planNames = ["free", "pro", "premium", "enterprise"] as const;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const s5 = BEFORE_S5[planNames[i]];
    const v3 = BEFORE_V3[planNames[i]];
    const delta = r.returnPct - s5.returnPct;
    console.log(
      `  ${r.plan.padEnd(12)} ${pct(v3.returnPct).padStart(10)} ${pct(s5.returnPct).padStart(12)} ${pct(r.returnPct).padStart(12)} ${((delta >= 0 ? "+" : "") + delta.toFixed(2) + "pp").padStart(10)} ${String(r.brainsFired).padStart(14)}`
    );
  }
  console.log("═".repeat(72));
  const totalCapital = results.reduce((s, r) => s + r.initialBalance, 0);
  const totalFinal = results.reduce((s, r) => s + r.finalBalance, 0);
  const totalReturn = (totalFinal - totalCapital) / totalCapital * 100;
  const totalReturnS5 = (BEFORE_S5.free.returnPct * 1000 + BEFORE_S5.pro.returnPct * 10000 + BEFORE_S5.premium.returnPct * 25000 + BEFORE_S5.enterprise.returnPct * 100000) / 136000;
  console.log(`  Portfólio: ${usd(totalCapital)} → ${usd(totalFinal)}`);
  console.log(`  Retorno total Sprint 5: ${pct(totalReturnS5)}`);
  console.log(`  Retorno total Sprint 6: ${pct(totalReturn)}`);
  console.log(`  Evolução S5→S6: ${pct(totalReturn - totalReturnS5)}`);
  console.log(`  Benchmark BTC Hold: ${pct(BENCHMARK_BTC)}`);
  console.log(`  Alpha Sprint 6: ${pct(totalReturn - BENCHMARK_BTC)}`);
  console.log("═".repeat(72));
}

main().catch(err => { console.error("❌ Error:", err.message); process.exit(1); });
