export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  icon: string;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

export interface TradeHistoryEntry {
  id: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  time: string;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  amount: number;
  avgBuyPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
}

export interface BotConfig {
  id: string;
  name: string;
  type: 'grid' | 'dca' | 'arbitrage' | 'martingale' | 'custom';
  status: 'running' | 'paused' | 'stopped' | 'error';
  pair: string;
  exchange: string;
  profit: number;
  profitPercent: number;
  trades: number;
  runtime: string;
  createdAt: string;
}

const CRYPTO_DATA: CryptoAsset[] = [
  { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 104250.80, change24h: 2150.30, changePercent24h: 2.11, volume24h: 38500000000, marketCap: 2050000000000, high24h: 105100, low24h: 101800, icon: 'bitcoin' },
  { id: '2', symbol: 'ETH', name: 'Ethereum', price: 3842.15, change24h: -48.20, changePercent24h: -1.24, volume24h: 18200000000, marketCap: 462000000000, high24h: 3920, low24h: 3780, icon: 'ethereum' },
  { id: '3', symbol: 'SOL', name: 'Solana', price: 178.45, change24h: 8.72, changePercent24h: 5.14, volume24h: 4800000000, marketCap: 82000000000, high24h: 182.30, low24h: 168.90, icon: 'solana' },
  { id: '4', symbol: 'BNB', name: 'BNB', price: 712.30, change24h: 15.40, changePercent24h: 2.21, volume24h: 2100000000, marketCap: 106000000000, high24h: 718.50, low24h: 694.20, icon: 'bnb' },
  { id: '5', symbol: 'XRP', name: 'XRP', price: 2.48, change24h: 0.12, changePercent24h: 5.08, volume24h: 3200000000, marketCap: 142000000000, high24h: 2.55, low24h: 2.34, icon: 'xrp' },
  { id: '6', symbol: 'ADA', name: 'Cardano', price: 0.782, change24h: -0.015, changePercent24h: -1.88, volume24h: 890000000, marketCap: 27800000000, high24h: 0.81, low24h: 0.76, icon: 'cardano' },
  { id: '7', symbol: 'AVAX', name: 'Avalanche', price: 42.15, change24h: 1.85, changePercent24h: 4.59, volume24h: 1200000000, marketCap: 17200000000, high24h: 43.80, low24h: 39.90, icon: 'avalanche' },
  { id: '8', symbol: 'DOT', name: 'Polkadot', price: 8.92, change24h: -0.18, changePercent24h: -1.98, volume24h: 680000000, marketCap: 12800000000, high24h: 9.25, low24h: 8.70, icon: 'polkadot' },
  { id: '9', symbol: 'LINK', name: 'Chainlink', price: 18.45, change24h: 0.92, changePercent24h: 5.24, volume24h: 950000000, marketCap: 11200000000, high24h: 19.10, low24h: 17.40, icon: 'chainlink' },
  { id: '10', symbol: 'MATIC', name: 'Polygon', price: 0.685, change24h: 0.032, changePercent24h: 4.90, volume24h: 520000000, marketCap: 6800000000, high24h: 0.71, low24h: 0.65, icon: 'polygon' },
  { id: '11', symbol: 'UNI', name: 'Uniswap', price: 12.85, change24h: -0.35, changePercent24h: -2.65, volume24h: 380000000, marketCap: 7700000000, high24h: 13.40, low24h: 12.50, icon: 'uniswap' },
  { id: '12', symbol: 'ATOM', name: 'Cosmos', price: 11.20, change24h: 0.48, changePercent24h: 4.48, volume24h: 420000000, marketCap: 4200000000, high24h: 11.80, low24h: 10.65, icon: 'cosmos' },
];

const PORTFOLIO_DATA: PortfolioHolding[] = [
  { symbol: 'BTC', name: 'Bitcoin', amount: 0.5420, avgBuyPrice: 95200, currentPrice: 104250.80, value: 56503.93, pnl: 4903.45, pnlPercent: 9.50, allocation: 45.2 },
  { symbol: 'ETH', name: 'Ethereum', amount: 8.250, avgBuyPrice: 3520, currentPrice: 3842.15, value: 31697.74, pnl: 2657.74, pnlPercent: 9.15, allocation: 25.3 },
  { symbol: 'SOL', name: 'Solana', amount: 85.00, avgBuyPrice: 142, currentPrice: 178.45, value: 15168.25, pnl: 3098.25, pnlPercent: 25.67, allocation: 12.1 },
  { symbol: 'BNB', name: 'BNB', amount: 12.50, avgBuyPrice: 680, currentPrice: 712.30, value: 8903.75, pnl: 403.75, pnlPercent: 4.75, allocation: 7.1 },
  { symbol: 'XRP', name: 'XRP', amount: 4200, avgBuyPrice: 1.95, currentPrice: 2.48, value: 10416.00, pnl: 2226.00, pnlPercent: 27.18, allocation: 8.3 },
  { symbol: 'LINK', name: 'Chainlink', amount: 135, avgBuyPrice: 16.20, currentPrice: 18.45, value: 2490.75, pnl: 303.75, pnlPercent: 13.89, allocation: 2.0 },
];

const BOT_DATA: BotConfig[] = [
  { id: '1', name: 'BTC Grid Master', type: 'grid', status: 'running', pair: 'BTC/USDT', exchange: 'Binance', profit: 2840.50, profitPercent: 12.4, trades: 342, runtime: '45d 12h', createdAt: '2026-01-05' },
  { id: '2', name: 'ETH DCA Strategy', type: 'dca', status: 'running', pair: 'ETH/USDT', exchange: 'Binance', profit: 1250.80, profitPercent: 8.7, trades: 28, runtime: '30d 8h', createdAt: '2026-01-20' },
  { id: '3', name: 'SOL-BNB Arbitrage', type: 'arbitrage', status: 'paused', pair: 'SOL/BNB', exchange: 'Multi', profit: 580.20, profitPercent: 4.2, trades: 156, runtime: '15d 3h', createdAt: '2026-02-01' },
  { id: '4', name: 'ADA Martingale', type: 'martingale', status: 'stopped', pair: 'ADA/USDT', exchange: 'Bybit', profit: -120.40, profitPercent: -2.1, trades: 45, runtime: '7d 18h', createdAt: '2026-02-10' },
];

function addRandomVariation(value: number, percentRange: number): number {
  const variation = (Math.random() - 0.5) * 2 * percentRange / 100;
  return value * (1 + variation);
}

export function getMarketData(): CryptoAsset[] {
  return CRYPTO_DATA.map(asset => ({
    ...asset,
    price: addRandomVariation(asset.price, 0.3),
    change24h: addRandomVariation(asset.change24h, 5),
    changePercent24h: addRandomVariation(asset.changePercent24h, 5),
  }));
}

export function getAssetById(id: string): CryptoAsset | undefined {
  return CRYPTO_DATA.find(a => a.id === id);
}

export function getAssetBySymbol(symbol: string): CryptoAsset | undefined {
  return CRYPTO_DATA.find(a => a.symbol === symbol);
}

export function getPortfolioData(): PortfolioHolding[] {
  return PORTFOLIO_DATA;
}

export function getPortfolioSummary() {
  const holdings = PORTFOLIO_DATA;
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalPnl = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalInvested = totalValue - totalPnl;
  const pnlPercent = (totalPnl / totalInvested) * 100;
  return { totalValue, totalPnl, pnlPercent, totalInvested, holdingsCount: holdings.length };
}

export function getBotData(): BotConfig[] {
  return BOT_DATA;
}

export function getOrderBook(): { bids: OrderBookEntry[]; asks: OrderBookEntry[] } {
  const basePrice = 104250;
  const bids: OrderBookEntry[] = [];
  const asks: OrderBookEntry[] = [];

  for (let i = 0; i < 12; i++) {
    const bidPrice = basePrice - (i * 15) - Math.random() * 10;
    const askPrice = basePrice + (i * 15) + Math.random() * 10;
    const bidAmount = 0.1 + Math.random() * 2.5;
    const askAmount = 0.1 + Math.random() * 2.5;
    bids.push({ price: bidPrice, amount: bidAmount, total: bidPrice * bidAmount });
    asks.push({ price: askPrice, amount: askAmount, total: askPrice * askAmount });
  }
  return { bids, asks: asks.reverse() };
}

export function getRecentTrades(): TradeHistoryEntry[] {
  const trades: TradeHistoryEntry[] = [];
  const basePrice = 104250;
  for (let i = 0; i < 20; i++) {
    trades.push({
      id: i.toString(),
      price: basePrice + (Math.random() - 0.5) * 200,
      amount: 0.001 + Math.random() * 0.5,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      time: new Date(Date.now() - i * 30000).toLocaleTimeString(),
    });
  }
  return trades;
}

export function formatCurrency(value: number, decimals?: number): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${value.toLocaleString('en-US', { minimumFractionDigits: decimals ?? 2, maximumFractionDigits: decimals ?? 2 })}`;
  if (value >= 1) return `$${value.toFixed(decimals ?? 2)}`;
  return `$${value.toFixed(decimals ?? 4)}`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(decimals);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export const PLAN_FEATURES = {
  free: {
    name: 'Free',
    price: 'R$ 0',
    color: '#8A94A6',
    features: [
      '1 robô ativo',
      '1 exchange conectada',
      '5 microcérebros de IA',
      'Backtest: 30 dias',
      'Dashboard básico',
      'Paper trading (simulação)',
      'Regime básico (EMA 20)',
      'Audit Logger pessoal',
    ],
    featureKeys: [
      'planFeat1Bot',
      'planFeat1Ex',
      'planFeat5AI',
      'planFeatBacktest30',
      'planFeatBasicDash',
      'planFeatPaperTrade',
      'planFeatEMA20Regime',
      'planFeatAuditPersonal',
    ] as string[],
    maxExchanges: 1,
    maxAlerts: 5,
    hasBots: false,
    hasAI: false,
    hasBacktest: false,
  },
  pro: {
    name: 'Pro',
    price: 'R$ 197/mês',
    color: '#00D4AA',
    features: [
      '10 robôs simultâneos',
      '20 exchanges integradas',
      '29 microcérebros de IA',
      'Backtest: 365 dias',
      'BIM – Orquestrador de bots',
      'Detector de Regime de Mercado',
      'XAI – Explicador de decisões',
      'Todos os tipos de robôs',
      'SIA+IA com alavancagem até 5x',
      'Telegram Alerts (básico)',
      'Risk Budget 40%',
      'Kelly Allocator',
      'Circuit Breaker (30% DD)',
      'DCA Inteligente threshold 1,5%',
      'Suporte por e-mail (72h)',
      'Retorno médio histórico: +275%',
    ],
    featureKeys: [
      'planFeat10Bots',
      'planFeat20Ex',
      'planFeat29AI',
      'planFeatBacktest365',
      'planFeatBIM',
      'planFeatRegime',
      'planFeatXAI',
      'planFeatAllBotTypes',
      'planFeatSIA5x',
      'planFeatTelegramBasic',
      'planFeatRiskBudget40',
      'planFeatKelly',
      'planFeatCircuitBreaker30',
      'planFeatDCA15',
      'planFeatEmailSupport72h',
      'planFeatRoi275',
    ] as string[],
    maxExchanges: 20,
    maxAlerts: -1,
    hasBots: true,
    hasAI: true,
    hasBacktest: true,
  },
  premium: {
    name: 'Premium',
    price: 'R$ 497/mês',
    color: '#7B61FF',
    features: [
      '35 robôs simultâneos',
      '30 exchanges integradas',
      '40 microcérebros de IA',
      'Backtest: 1825 dias (5 anos)',
      'Tudo do plano Pro',
      'EMH – Explosive Momentum Hunter',
      'SIA+IA com alavancagem até 15x',
      'Reinvestimento automático',
      'Gêmeo Digital (Monte Carlo, VaR)',
      'Meta-Aprendizado e HPO',
      'IA Criativa – Gerador de estratégias',
      '30 estratégias Arsenal',
      'Anti-Viés e Inteligência de Mercado',
      'Profit Skimming (Cofre/Dízimo)',
      'Telegram Alerts completo',
      'Decision DNA (perfil aggressive)',
      'Volume Profile VPVR',
      'Sentiment Engine (Groq AI)',
      'Macro Factors Engine',
      'Options Oracle (Deribit)',
      'On-Chain Data Engine',
      'Reflexion Engine completo',
      'Historical Analog Engine',
      'Hydra Scanner (5 filosofias)',
      'Risk Budget 70%',
      'Suporte prioritário (24h)',
      'Retorno médio histórico: +340%',
    ],
    featureKeys: [
      'planFeat35Bots',
      'planFeat30Ex',
      'planFeat40AI',
      'planFeatBacktest5y',
      'planFeatAllPro',
      'planFeatEMH',
      'planFeatSIA15x',
      'planFeatAutoReinvest',
      'planFeatDigitalTwin',
      'planFeatMetaLearn',
      'planFeatCreativeAI',
      'planFeat30Arsenal',
      'planFeatAntiBias',
      'planFeatProfitSkim',
      'planFeatTelegramFull',
      'planFeatDNAAggressive',
      'planFeatVPVR',
      'planFeatSentiment',
      'planFeatMacro',
      'planFeatOptions',
      'planFeatOnChain',
      'planFeatReflexion',
      'planFeatAnalog',
      'planFeatHydra',
      'planFeatRiskBudget70',
      'planFeatPriority24h',
      'planFeatRoi340',
    ] as string[],
    maxExchanges: 30,
    maxAlerts: -1,
    hasBots: true,
    hasAI: true,
    hasBacktest: true,
  },
  enterprise: {
    name: 'Enterprise',
    price: 'R$ 3.997/mês',
    color: '#FFB74D',
    features: [
      'Robôs ilimitados',
      '30 exchanges integradas',
      '66 microcérebros de IA',
      'Backtest ilimitado',
      'Tudo do plano Premium',
      'Multi-usuários e sub-contas',
      'API dedicada (sob contrato)',
      'Detector de Anomalias (spoofing/pump)',
      'Arsenal ilimitado de estratégias',
      'Relatórios fiscais e de performance',
      'Alavancagem até 20x',
      'Probabilistic Cloud (Monte Carlo)',
      'Genetic Strategy Composer',
      'Stress test obrigatório >10x',
      'Relatório de risco diário por email',
      'Audit Logger admin (sistema completo)',
      'Decision DNA (perfil kamikaze)',
      'Risk Budget 100%',
      'Capital gerenciado: até R$ 300k (acima, sob consulta)',
      'Suporte executivo ≤1h',
      'SLA garantido: 99,9% de uptime',
      'Garantia de 15 dias de devolução',
    ],
    featureKeys: [
      'planFeatUnlimitedBots',
      'planFeat30Ex',
      'planFeat66AI',
      'planFeatUnlimitedBacktest',
      'planFeatAllPremium',
      'planFeatMultiUser',
      'planFeatDedicatedAPIContract',
      'planFeatAnomalyDetect',
      'planFeatUnlimitedArsenal',
      'planFeatFiscalReports',
      'planFeatLeverage20x',
      'planFeatProbabilistic',
      'planFeatGenetic',
      'planFeatStressTest',
      'planFeatDailyRiskReport',
      'planFeatAuditAdmin',
      'planFeatDNAKamikaze',
      'planFeatRiskBudget100',
      'planFeatCapital300k',
      'planFeatExecSupport1h',
      'planFeatSLAUptime',
      'planFeat15DayGuarantee',
    ] as string[],
    maxExchanges: 30,
    maxAlerts: -1,
    hasBots: true,
    hasAI: true,
    hasBacktest: true,
  },
};
