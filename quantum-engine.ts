// ============================================================================
// QUANTUM ENGINE - Evolvus Core Python Ecosystem (8 Pillars)
// Self-contained TypeScript data layer for the Evolvus trading platform
// ============================================================================

// ============================================================================
// SECTION 1: TYPE DEFINITIONS
// ============================================================================

export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL_SIGNAL';
export type MarketRegime = 'TRENDING_BULL' | 'TRENDING_BEAR' | 'RANGING' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'UNKNOWN';
export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type BrainCategory = 'trend' | 'momentum' | 'volatility' | 'volume' | 'pattern' | 'confluence' | 'quantitative';

export type ConvictionLevel = 'normal' | 'strong' | 'very_strong' | 'stratospheric';
export type TradeCategory = 'scalp' | 'swing' | 'position';

export type GovernanceGateStatus = 'passed' | 'blocked' | 'skipped';

export interface GovernanceGate {
  id: string;
  name: string;
  status: GovernanceGateStatus;
  checkedAt: string;
  reason?: string;
}

export interface ConvictionData {
  level: ConvictionLevel;
  brainsAgreeing: number;
  totalBrains: number;
  sentimentAligned: boolean;
  monteCarloConfirms: boolean;
  positionSizePercent: number;
}

export interface InviolableDirective {
  id: string;
  name: string;
  description: string;
  currentValue: number;
  maxAllowed: number;
  unit: string;
  isViolated: boolean;
  canBeLoosened: false;
}

export interface ShadowTrade {
  id: string;
  strategyId: string;
  strategyName: string;
  pair: string;
  direction: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  paperPnl: number;
  paperPnlPercent: number;
  isActive: boolean;
  openedAt: string;
  category: TradeCategory;
}

// ============================================================================
// SECTION 2: INTERFACES
// ============================================================================

export interface BrainConfig {
  id: string;
  name: string;
  version: string;
  category: BrainCategory;
  description: string;
  descriptionPt: string;
  parameters: Record<string, number | string | boolean>;
  signalTypes: SignalType[];
  bestRegimes: MarketRegime[];
  confidence: number;
  icon: string;
}

export interface StrategyDNA {
  id: string;
  name: string;
  description: string;
  descriptionPt: string;
  brains: string[];
  riskManagement: {
    stopLoss: number;
    takeProfit: number;
    maxPositionSize: number;
    maxDailyTrades: number;
    maxLeverage: number;
  };
  marketConditions: {
    bestRegimes: MarketRegime[];
    minVolatility: number;
    maxVolatility: number;
  };
  backtestResults: {
    winRate: number;
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    trades: number;
    profitFactor: number;
  };
  quantumAnalysisMode: 'historical_standard' | 'predictive_synthetic' | 'quantum_full_spectrum';
}

export interface RiskBudgetConfig {
  totalCapital: number;
  maxRiskPerTradePct: number;
  maxExposurePct: number;
  maxLeverage: number;
  maxCorrelatedPositions: number;
  currentExposure: number;
  marginAvailable: number;
  riskScore: number;
  liquidationDistance: number;
}

export interface RiskAlert {
  id: string;
  type: 'exposure' | 'leverage' | 'correlation' | 'drawdown' | 'concentration';
  severity: RiskLevel;
  message: string;
  messagePt: string;
  asset?: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
}

export interface ExchangeConnection {
  id: string;
  exchange: string;
  status: 'connected' | 'disconnected' | 'degraded' | 'syncing';
  latencyMs: number;
  lastSuccessfulCall: string;
  errorCount24h: number;
  rateLimitUsed: number;
  rateLimitMax: number;
  uptime: number;
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  apiKeyMasked: string;
  permissions: ('read' | 'trade' | 'withdraw')[];
}

export interface OrderExecution {
  id: string;
  pair: string;
  exchange: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP';
  status: 'pending' | 'acknowledged' | 'partial_fill' | 'filled' | 'cancelled' | 'rejected';
  expectedPrice: number;
  actualPrice: number;
  slippage: number;
  size: number;
  fee: number;
  latencyMs: number;
  timestamp: string;
}

export interface ApiCallLog {
  id: string;
  exchange: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: string;
}

export interface SentimentData {
  fearGreedIndex: number;
  fearGreedLabel: string;
  sources: {
    twitter: number;
    reddit: number;
    telegram: number;
    news: number;
    onChain: number;
  };
  assetSentiment: {
    symbol: string;
    score: number;
    mentions: number;
    change24h: number;
  }[];
  trendingTopics: string[];
  whaleTransactions: {
    id: string;
    token: string;
    amount: number;
    from: string;
    to: string;
    type: 'exchange_inflow' | 'exchange_outflow' | 'whale_transfer';
    timestamp: string;
  }[];
}

export interface GeopoliticalRisk {
  exchange: string;
  riskLevel: RiskLevel;
  riskScore: number;
  advisory: string;
  advisoryPt: string;
  components: {
    regulatory: number;
    sanctions: number;
    politicalStability: number;
    economicIndicators: number;
  };
}

export interface FundingRateData {
  symbol: string;
  binanceRate: number;
  bybitRate: number;
  okxRate: number;
  predictedNext: number;
  annualizedYield: number;
}

export interface ConfluenceAnalysis {
  symbol: string;
  timestamp: string;
  activeBrains: {
    brainId: string;
    brainName: string;
    signal: SignalType;
    confidence: number;
    evidence: string;
    category: BrainCategory;
  }[];
  synergies: { brain1: string; brain2: string; bonus: number }[];
  conflicts: { brain1: string; brain2: string; penalty: number }[];
  finalScore: number;
  finalSignal: SignalType;
  marketRegime: MarketRegime;
  volatilityRegime: string;
  adjustedThreshold: number;
  consciousnessLevel: number;
}

export interface MonteCarloResult {
  symbol: string;
  simulationCount: number;
  forecastDays: number;
  probUp: number;
  probDown: number;
  medianPrice: number;
  percentile5: number;
  percentile95: number;
  expectedReturn: number;
  model: 'merton_jump_diffusion';
  jumpIntensity: number;
  driftRate: number;
  volatility: number;
}

export interface TradeJournalEntry {
  id: string;
  date: string;
  pair: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  exchange: string;
  strategy: string;
  notes: string;
  tags: string[];
  mood: 'confident' | 'neutral' | 'anxious' | 'fomo' | 'disciplined';
  duration: string;
}

export interface NotificationItem {
  id: string;
  type: 'trade_executed' | 'alert_triggered' | 'bot_action' | 'risk_warning' | 'system_update' | 'price_target';
  title: string;
  titlePt: string;
  description: string;
  descriptionPt: string;
  timestamp: string;
  read: boolean;
  actionLabel?: string;
  actionLabelPt?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  titlePt: string;
  category: 'crypto' | 'macro' | 'earnings' | 'token_unlock' | 'airdrop';
  impact: 'low' | 'medium' | 'high';
  description: string;
  descriptionPt: string;
  affectedAssets: string[];
}

// ============================================================================
// SECTION 3: BRAIN CATALOG (P3 MENTE - 29 Analyzers)
// ============================================================================

export const BRAIN_CATALOG: BrainConfig[] = [
  {
    id: 'rsi_divergence',
    name: 'RSI Divergence',
    version: '2.1.0',
    category: 'momentum',
    description: 'Detects bullish and bearish divergences between price and RSI oscillator',
    descriptionPt: 'Detecta divergencias altistas e baixistas entre preco e oscilador RSI',
    parameters: { rsi_period: 14, lookback_period: 20, overbought: 70, oversold: 30 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'TRENDING_BEAR'],
    confidence: 72,
    icon: 'trending-up',
  },
  {
    id: 'bollinger_bands',
    name: 'Bollinger Bands',
    version: '1.8.0',
    category: 'volatility',
    description: 'Measures volatility using standard deviation bands around a moving average',
    descriptionPt: 'Mede volatilidade usando bandas de desvio padrao em torno de uma media movel',
    parameters: { period: 20, std_dev: 2.0, lookback: 1 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'HIGH_VOLATILITY'],
    confidence: 68,
    icon: 'analytics',
  },
  {
    id: 'macd_crossover',
    name: 'MACD Crossover',
    version: '2.0.0',
    category: 'momentum',
    description: 'Identifies trend changes via MACD line crossing the signal line',
    descriptionPt: 'Identifica mudancas de tendencia via cruzamento da linha MACD com a linha de sinal',
    parameters: { fast_period: 12, slow_period: 26, signal_period: 9 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 74,
    icon: 'git-compare',
  },
  {
    id: 'adx_analyzer',
    name: 'ADX Analyzer',
    version: '1.5.0',
    category: 'trend',
    description: 'Measures trend strength using the Average Directional Index',
    descriptionPt: 'Mede a forca da tendencia usando o Indice Direcional Medio',
    parameters: { adx_period: 14, adx_threshold: 25.0 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 70,
    icon: 'speedometer',
  },
  {
    id: 'aroon_indicator',
    name: 'Aroon Indicator',
    version: '1.3.0',
    category: 'trend',
    description: 'Identifies trend direction and strength using Aroon Up/Down lines',
    descriptionPt: 'Identifica direcao e forca da tendencia usando linhas Aroon Up/Down',
    parameters: { period: 25, crossover_threshold: 50 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 65,
    icon: 'arrow-up-circle',
  },
  {
    id: 'awesome_oscillator',
    name: 'Awesome Oscillator',
    version: '1.4.0',
    category: 'momentum',
    description: 'Measures market momentum using difference between fast and slow SMAs of median price',
    descriptionPt: 'Mede o momentum do mercado usando a diferenca entre SMAs rapida e lenta do preco mediano',
    parameters: { fast_period: 5, slow_period: 34 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'RANGING'],
    confidence: 62,
    icon: 'pulse',
  },
  {
    id: 'candlestick_pattern',
    name: 'Candlestick Pattern',
    version: '2.2.0',
    category: 'pattern',
    description: 'Recognizes Japanese candlestick reversal and continuation patterns',
    descriptionPt: 'Reconhece padroes de reversao e continuacao de candlestick japones',
    parameters: { patterns: 'doji,hammer,engulfing,harami,morning_star,evening_star', min_pattern_strength: 0.5 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'TRENDING_BEAR', 'TRENDING_BULL'],
    confidence: 60,
    icon: 'bar-chart',
  },
  {
    id: 'chaikin_money_flow',
    name: 'Chaikin Money Flow',
    version: '1.6.0',
    category: 'volume',
    description: 'Measures buying and selling pressure using volume-weighted price accumulation',
    descriptionPt: 'Mede a pressao de compra e venda usando acumulacao de preco ponderada por volume',
    parameters: { period: 20, threshold: 0.05 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 66,
    icon: 'water',
  },
  {
    id: 'fibonacci_retracement',
    name: 'Fibonacci Retracement',
    version: '1.7.0',
    category: 'pattern',
    description: 'Identifies key support and resistance levels using Fibonacci ratios',
    descriptionPt: 'Identifica niveis-chave de suporte e resistencia usando proporcoes de Fibonacci',
    parameters: { lookback_period: 20, levels: '0.382,0.5,0.618', tolerance: 0.01 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING'],
    confidence: 64,
    icon: 'layers',
  },
  {
    id: 'ichimoku_cloud',
    name: 'Ichimoku Cloud',
    version: '2.0.0',
    category: 'trend',
    description: 'Comprehensive trend analysis using the Ichimoku Kinko Hyo system',
    descriptionPt: 'Analise abrangente de tendencia usando o sistema Ichimoku Kinko Hyo',
    parameters: { tenkan_period: 9, kijun_period: 26 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 76,
    icon: 'cloud',
  },
  {
    id: 'obv_trend',
    name: 'OBV Trend',
    version: '1.2.0',
    category: 'volume',
    description: 'Tracks cumulative buying/selling pressure via On-Balance Volume',
    descriptionPt: 'Rastreia a pressao cumulativa de compra/venda via Volume On-Balance',
    parameters: { smoothing: true },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 63,
    icon: 'stats-chart',
  },
  {
    id: 'parabolic_sar',
    name: 'Parabolic SAR',
    version: '1.4.0',
    category: 'trend',
    description: 'Identifies potential reversals using the Parabolic Stop and Reverse system',
    descriptionPt: 'Identifica reversoes potenciais usando o sistema Parabolic Stop and Reverse',
    parameters: { af_start: 0.02, af_increment: 0.02, af_max: 0.2 },
    signalTypes: ['BUY', 'SELL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 67,
    icon: 'radio-button-on',
  },
  {
    id: 'stochastic_oscillator',
    name: 'Stochastic Oscillator',
    version: '1.9.0',
    category: 'momentum',
    description: 'Compares closing price to its range over a given period for overbought/oversold signals',
    descriptionPt: 'Compara o preco de fechamento com sua faixa em um periodo para sinais de sobrecompra/sobrevenda',
    parameters: { k_period: 14, d_period: 3, overbought: 80, oversold: 20 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
    confidence: 69,
    icon: 'swap-vertical',
  },
  {
    id: 'stochastic_rsi',
    name: 'Stochastic RSI',
    version: '2.1.0',
    category: 'momentum',
    description: 'Applies Stochastic formula to RSI values for more sensitive momentum signals',
    descriptionPt: 'Aplica a formula Estocastica aos valores RSI para sinais de momentum mais sensiveis',
    parameters: { rsi_length: 14, stoch_length: 14, k: 3, d: 3, overbought: 0.8, oversold: 0.2 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'HIGH_VOLATILITY'],
    confidence: 71,
    icon: 'flash',
  },
  {
    id: 'supertrend',
    name: 'Supertrend',
    version: '1.6.0',
    category: 'trend',
    description: 'Trend-following indicator based on ATR that provides clear buy/sell signals',
    descriptionPt: 'Indicador seguidor de tendencia baseado em ATR que fornece sinais claros de compra/venda',
    parameters: { period: 10, multiplier: 3.0 },
    signalTypes: ['BUY', 'SELL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 73,
    icon: 'rocket',
  },
  {
    id: 'volume_profile',
    name: 'Volume Profile',
    version: '1.8.0',
    category: 'volume',
    description: 'Analyzes volume distribution at different price levels to find value areas',
    descriptionPt: 'Analisa distribuicao de volume em diferentes niveis de preco para encontrar areas de valor',
    parameters: { bin_size: 0.01, value_area_percentage: 0.7 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'HIGH_VOLATILITY'],
    confidence: 70,
    icon: 'cellular',
  },
  {
    id: 'vortex_indicator',
    name: 'Vortex Indicator',
    version: '1.2.0',
    category: 'trend',
    description: 'Identifies the start of new trends using positive and negative vortex lines',
    descriptionPt: 'Identifica o inicio de novas tendencias usando linhas vortex positivas e negativas',
    parameters: { period: 14 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 61,
    icon: 'sync',
  },
  {
    id: 'vwap_supreme',
    name: 'VWAP Supreme',
    version: '2.3.0',
    category: 'volume',
    description: 'Advanced VWAP with rejection detection and microstructure analysis',
    descriptionPt: 'VWAP avancado com deteccao de rejeicao e analise de microestrutura',
    parameters: { rejection_threshold: 0.8, microstructure_lookback: 15 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'TRENDING_BULL'],
    confidence: 75,
    icon: 'diamond',
  },
  {
    id: 'williams_r',
    name: 'Williams %R',
    version: '1.5.0',
    category: 'momentum',
    description: 'Momentum indicator measuring overbought/oversold levels relative to high-low range',
    descriptionPt: 'Indicador de momentum medindo niveis de sobrecompra/sobrevenda relativos a faixa alta-baixa',
    parameters: { period: 14, overbought: -20, oversold: -80 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
    confidence: 64,
    icon: 'thermometer',
  },
  {
    id: 'ichimoku_adx_fusion',
    name: 'Ichimoku + ADX Fusion',
    version: '3.0.0',
    category: 'confluence',
    description: 'Fuses Ichimoku Cloud trend direction with ADX trend strength for high-confidence signals',
    descriptionPt: 'Fusao da direcao de tendencia Ichimoku com a forca ADX para sinais de alta confianca',
    parameters: { tenkan_period: 9, kijun_period: 26, adx_period: 14, adx_threshold: 25.0 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 82,
    icon: 'git-merge',
  },
  {
    id: 'macd_stochastic_combo',
    name: 'MACD + Stochastic Combo',
    version: '3.0.0',
    category: 'confluence',
    description: 'Combines MACD momentum with Stochastic overbought/oversold for filtered entries',
    descriptionPt: 'Combina momentum MACD com sobrecompra/sobrevenda Estocastico para entradas filtradas',
    parameters: { fast_period: 12, slow_period: 26, signal_period: 9, k_period: 14, d_period: 3 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'RANGING'],
    confidence: 79,
    icon: 'link',
  },
  {
    id: 'rsi_bollinger_bands',
    name: 'RSI + Bollinger Bands',
    version: '3.0.0',
    category: 'confluence',
    description: 'RSI momentum confirmation with Bollinger Band volatility squeeze and breakout detection',
    descriptionPt: 'Confirmacao de momentum RSI com squeeze de volatilidade Bollinger e deteccao de rompimento',
    parameters: { rsi_period: 14, bb_period: 20, bb_std_dev: 2.0, overbought: 70, oversold: 30 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['RANGING', 'HIGH_VOLATILITY'],
    confidence: 77,
    icon: 'git-network',
  },
  {
    id: 'supertrend_ma_tracker',
    name: 'Supertrend + MA Tracker',
    version: '3.0.0',
    category: 'confluence',
    description: 'Supertrend direction validated by multiple moving average alignment',
    descriptionPt: 'Direcao Supertrend validada pelo alinhamento de multiplas medias moveis',
    parameters: { st_period: 10, st_multiplier: 3.0, ma_fast: 20, ma_slow: 50 },
    signalTypes: ['BUY', 'SELL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 80,
    icon: 'trail-sign',
  },
  {
    id: 'monte_carlo_forecaster',
    name: 'Monte Carlo Path Forecaster',
    version: '4.0.0',
    category: 'quantitative',
    description: 'Probabilistic price forecasting using Merton Jump-Diffusion Monte Carlo simulations',
    descriptionPt: 'Previsao probabilistica de preco usando simulacoes Monte Carlo com modelo Merton Jump-Diffusion',
    parameters: { n_simulations: 10000, forecast_days: 20, lookback_period: 252, prob_threshold: 0.70, up_target_pct: 1.05, down_target_pct: 0.95 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING', 'HIGH_VOLATILITY', 'LOW_VOLATILITY'],
    confidence: 78,
    icon: 'dice',
  },
  {
    id: 'kalman_filter_tracker',
    name: 'Kalman Filter Tracker',
    version: '3.5.0',
    category: 'quantitative',
    description: 'Adaptive state estimation using Kalman filtering for noise-reduced trend tracking',
    descriptionPt: 'Estimativa de estado adaptativa usando filtragem de Kalman para rastreamento de tendencia sem ruido',
    parameters: { process_noise: 0.01, measurement_noise: 0.1, initial_estimate: 0 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING'],
    confidence: 74,
    icon: 'navigate',
  },
  {
    id: 'bayesian_inference',
    name: 'Bayesian Inference Engine',
    version: '3.2.0',
    category: 'quantitative',
    description: 'Updates probability estimates using Bayesian posterior distributions for market regime detection',
    descriptionPt: 'Atualiza estimativas de probabilidade usando distribuicoes posteriores Bayesianas para deteccao de regime de mercado',
    parameters: { prior_alpha: 1.0, prior_beta: 1.0, window_size: 100, regime_threshold: 0.65 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING', 'HIGH_VOLATILITY'],
    confidence: 76,
    icon: 'calculator',
  },
  {
    id: 'pattern_recognition',
    name: 'Pattern Recognition Engine',
    version: '4.1.0',
    category: 'quantitative',
    description: 'Deep learning-based pattern recognition for complex chart formations and price structures',
    descriptionPt: 'Reconhecimento de padroes baseado em deep learning para formacoes de grafico e estruturas de preco complexas',
    parameters: { model_type: 'cnn_lstm', sequence_length: 60, confidence_threshold: 0.7, patterns_enabled: true },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING'],
    confidence: 72,
    icon: 'eye',
  },
  {
    id: 'order_flow_imbalance',
    name: 'Order Flow Imbalance Detector',
    version: '2.8.0',
    category: 'quantitative',
    description: 'Detects institutional order flow imbalances from exchange order book microstructure',
    descriptionPt: 'Detecta desequilibrios no fluxo de ordens institucionais a partir da microestrutura do livro de ordens',
    parameters: { imbalance_threshold: 0.6, depth_levels: 20, aggregation_window: 5, min_volume_usd: 50000 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['HIGH_VOLATILITY', 'TRENDING_BULL', 'TRENDING_BEAR'],
    confidence: 71,
    icon: 'podium',
  },
  {
    id: 'volatility_breakout',
    name: 'Volatility Breakout Analyzer',
    version: '2.5.0',
    category: 'quantitative',
    description: 'Identifies volatility compression zones and predicts breakout direction and magnitude',
    descriptionPt: 'Identifica zonas de compressao de volatilidade e preve direcao e magnitude do rompimento',
    parameters: { atr_period: 14, squeeze_threshold: 0.5, breakout_multiplier: 1.5, confirmation_bars: 2 },
    signalTypes: ['BUY', 'SELL', 'NEUTRAL_SIGNAL'],
    bestRegimes: ['LOW_VOLATILITY', 'RANGING'],
    confidence: 69,
    icon: 'thunderstorm',
  },
];

// ============================================================================
// SECTION 4: STRATEGY DNA CATALOG (P6 LABORATORIO)
// ============================================================================

export const STRATEGY_DNA_CATALOG: StrategyDNA[] = [
  {
    id: 'quantum_momentum',
    name: 'Quantum Momentum',
    description: 'High-frequency momentum strategy combining RSI divergence, MACD crossovers, volume profile value areas, and Supertrend confirmation for strong trend entries',
    descriptionPt: 'Estrategia de momentum de alta frequencia combinando divergencia RSI, cruzamentos MACD, areas de valor do perfil de volume e confirmacao Supertrend para entradas em tendencias fortes',
    brains: ['rsi_divergence', 'macd_crossover', 'volume_profile', 'supertrend'],
    riskManagement: {
      stopLoss: 2.5,
      takeProfit: 5.0,
      maxPositionSize: 15,
      maxDailyTrades: 8,
      maxLeverage: 10,
    },
    marketConditions: {
      bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
      minVolatility: 0.015,
      maxVolatility: 0.08,
    },
    backtestResults: {
      winRate: 64.2,
      totalReturn: 187.5,
      maxDrawdown: 12.8,
      sharpeRatio: 2.14,
      trades: 1842,
      profitFactor: 1.89,
    },
    quantumAnalysisMode: 'quantum_full_spectrum',
  },
  {
    id: 'mean_reversion_alpha',
    name: 'Mean Reversion Alpha',
    description: 'Statistical mean reversion strategy using Bollinger Band extremes, Stochastic RSI oversold/overbought zones, and VWAP as dynamic equilibrium anchor',
    descriptionPt: 'Estrategia de reversao a media estatistica usando extremos de Bandas de Bollinger, zonas de sobrecompra/sobrevenda Estocastico RSI e VWAP como ancora de equilibrio dinamico',
    brains: ['bollinger_bands', 'stochastic_rsi', 'vwap_supreme'],
    riskManagement: {
      stopLoss: 1.8,
      takeProfit: 3.5,
      maxPositionSize: 12,
      maxDailyTrades: 12,
      maxLeverage: 5,
    },
    marketConditions: {
      bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
      minVolatility: 0.005,
      maxVolatility: 0.04,
    },
    backtestResults: {
      winRate: 71.8,
      totalReturn: 142.3,
      maxDrawdown: 8.5,
      sharpeRatio: 2.45,
      trades: 2456,
      profitFactor: 2.12,
    },
    quantumAnalysisMode: 'historical_standard',
  },
  {
    id: 'breakout_hunter',
    name: 'Breakout Hunter',
    description: 'Breakout detection system using ADX trend strength, Aroon direction, Awesome Oscillator momentum confirmation, and Fibonacci extension targets',
    descriptionPt: 'Sistema de deteccao de rompimento usando forca de tendencia ADX, direcao Aroon, confirmacao de momentum Awesome Oscillator e alvos de extensao Fibonacci',
    brains: ['adx_analyzer', 'aroon_indicator', 'awesome_oscillator', 'fibonacci_retracement'],
    riskManagement: {
      stopLoss: 3.0,
      takeProfit: 7.5,
      maxPositionSize: 10,
      maxDailyTrades: 5,
      maxLeverage: 8,
    },
    marketConditions: {
      bestRegimes: ['TRENDING_BULL', 'HIGH_VOLATILITY'],
      minVolatility: 0.02,
      maxVolatility: 0.10,
    },
    backtestResults: {
      winRate: 52.6,
      totalReturn: 215.8,
      maxDrawdown: 18.2,
      sharpeRatio: 1.87,
      trades: 986,
      profitFactor: 1.76,
    },
    quantumAnalysisMode: 'predictive_synthetic',
  },
  {
    id: 'trend_follower',
    name: 'Trend Follower',
    description: 'Multi-layer trend following using Ichimoku + ADX fusion for regime identification, Supertrend for entries, and MA alignment for trend persistence',
    descriptionPt: 'Seguidor de tendencia multicamada usando fusao Ichimoku + ADX para identificacao de regime, Supertrend para entradas e alinhamento de MAs para persistencia da tendencia',
    brains: ['ichimoku_adx_fusion', 'supertrend', 'supertrend_ma_tracker'],
    riskManagement: {
      stopLoss: 2.0,
      takeProfit: 6.0,
      maxPositionSize: 20,
      maxDailyTrades: 4,
      maxLeverage: 5,
    },
    marketConditions: {
      bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR'],
      minVolatility: 0.01,
      maxVolatility: 0.06,
    },
    backtestResults: {
      winRate: 58.4,
      totalReturn: 256.7,
      maxDrawdown: 14.6,
      sharpeRatio: 2.31,
      trades: 724,
      profitFactor: 2.05,
    },
    quantumAnalysisMode: 'quantum_full_spectrum',
  },
  {
    id: 'scalper_matrix',
    name: 'Scalper Matrix',
    description: 'Ultra-fast scalping system with Stochastic and Williams %R oscillator convergence, Volume Profile POC zones, and VWAP deviation scalps',
    descriptionPt: 'Sistema de scalping ultra-rapido com convergencia dos osciladores Estocastico e Williams %R, zonas POC do Perfil de Volume e scalps de desvio VWAP',
    brains: ['stochastic_oscillator', 'williams_r', 'volume_profile', 'vwap_supreme'],
    riskManagement: {
      stopLoss: 0.8,
      takeProfit: 1.5,
      maxPositionSize: 25,
      maxDailyTrades: 30,
      maxLeverage: 15,
    },
    marketConditions: {
      bestRegimes: ['RANGING', 'LOW_VOLATILITY'],
      minVolatility: 0.003,
      maxVolatility: 0.025,
    },
    backtestResults: {
      winRate: 68.9,
      totalReturn: 98.4,
      maxDrawdown: 6.2,
      sharpeRatio: 3.12,
      trades: 8742,
      profitFactor: 2.34,
    },
    quantumAnalysisMode: 'historical_standard',
  },
  {
    id: 'whale_shadow',
    name: 'Whale Shadow',
    description: 'Institutional flow tracking using OBV trend, Chaikin Money Flow accumulation/distribution, Volume Profile value areas, and Order Flow imbalance detection',
    descriptionPt: 'Rastreamento de fluxo institucional usando tendencia OBV, acumulacao/distribuicao Chaikin Money Flow, areas de valor do Perfil de Volume e deteccao de desequilibrio de Fluxo de Ordens',
    brains: ['obv_trend', 'chaikin_money_flow', 'volume_profile', 'order_flow_imbalance'],
    riskManagement: {
      stopLoss: 2.2,
      takeProfit: 5.5,
      maxPositionSize: 18,
      maxDailyTrades: 6,
      maxLeverage: 7,
    },
    marketConditions: {
      bestRegimes: ['TRENDING_BULL', 'HIGH_VOLATILITY'],
      minVolatility: 0.012,
      maxVolatility: 0.07,
    },
    backtestResults: {
      winRate: 61.3,
      totalReturn: 178.9,
      maxDrawdown: 11.4,
      sharpeRatio: 2.08,
      trades: 1354,
      profitFactor: 1.92,
    },
    quantumAnalysisMode: 'predictive_synthetic',
  },
  {
    id: 'monte_carlo_predictor',
    name: 'Monte Carlo Predictor',
    description: 'Quantitative forecasting engine combining Monte Carlo path simulation, Kalman Filter state estimation, and Bayesian regime inference for probabilistic trade decisions',
    descriptionPt: 'Motor de previsao quantitativa combinando simulacao de caminho Monte Carlo, estimativa de estado por Filtro de Kalman e inferencia de regime Bayesiana para decisoes de trade probabilisticas',
    brains: ['monte_carlo_forecaster', 'kalman_filter_tracker', 'bayesian_inference'],
    riskManagement: {
      stopLoss: 3.5,
      takeProfit: 8.0,
      maxPositionSize: 10,
      maxDailyTrades: 3,
      maxLeverage: 3,
    },
    marketConditions: {
      bestRegimes: ['TRENDING_BULL', 'TRENDING_BEAR', 'HIGH_VOLATILITY'],
      minVolatility: 0.01,
      maxVolatility: 0.12,
    },
    backtestResults: {
      winRate: 59.1,
      totalReturn: 312.4,
      maxDrawdown: 16.8,
      sharpeRatio: 2.67,
      trades: 428,
      profitFactor: 2.41,
    },
    quantumAnalysisMode: 'quantum_full_spectrum',
  },
];

// ============================================================================
// SECTION 5: RISK BUDGET DATA (P3 Risk Budget Manager)
// ============================================================================

export function getRiskBudgetData(): RiskBudgetConfig {
  return {
    totalCapital: 125180.42,
    maxRiskPerTradePct: 2.0,
    maxExposurePct: 75.0,
    maxLeverage: 10,
    maxCorrelatedPositions: 5,
    currentExposure: 62.4,
    marginAvailable: 47068.16,
    riskScore: 38,
    liquidationDistance: 34.2,
  };
}

export function getRiskAlerts(): RiskAlert[] {
  return [
    {
      id: 'ra_001',
      type: 'exposure',
      severity: 'medium',
      message: 'Portfolio exposure at 62.4% - approaching 75% limit',
      messagePt: 'Exposicao do portfolio em 62.4% - aproximando-se do limite de 75%',
      currentValue: 62.4,
      threshold: 75.0,
      timestamp: '2026-02-22T14:30:00Z',
    },
    {
      id: 'ra_002',
      type: 'correlation',
      severity: 'high',
      message: 'High correlation detected between BTC/USDT and ETH/USDT positions (0.92)',
      messagePt: 'Alta correlacao detectada entre posicoes BTC/USDT e ETH/USDT (0.92)',
      asset: 'BTC-ETH',
      currentValue: 0.92,
      threshold: 0.80,
      timestamp: '2026-02-22T14:15:00Z',
    },
    {
      id: 'ra_003',
      type: 'leverage',
      severity: 'low',
      message: 'Current effective leverage at 3.2x - within safe parameters',
      messagePt: 'Alavancagem efetiva atual em 3.2x - dentro de parametros seguros',
      currentValue: 3.2,
      threshold: 10.0,
      timestamp: '2026-02-22T14:00:00Z',
    },
    {
      id: 'ra_004',
      type: 'drawdown',
      severity: 'very_low',
      message: 'Current drawdown at 2.1% from peak - portfolio healthy',
      messagePt: 'Drawdown atual em 2.1% do pico - portfolio saudavel',
      currentValue: 2.1,
      threshold: 15.0,
      timestamp: '2026-02-22T13:45:00Z',
    },
    {
      id: 'ra_005',
      type: 'concentration',
      severity: 'medium',
      message: 'BTC allocation at 45.2% exceeds 40% single-asset concentration limit',
      messagePt: 'Alocacao BTC em 45.2% excede o limite de concentracao de 40% para um unico ativo',
      asset: 'BTC',
      currentValue: 45.2,
      threshold: 40.0,
      timestamp: '2026-02-22T13:30:00Z',
    },
    {
      id: 'ra_006',
      type: 'drawdown',
      severity: 'high',
      message: 'SOL/USDT position drawdown at 8.4% - approaching stop loss trigger',
      messagePt: 'Drawdown da posicao SOL/USDT em 8.4% - aproximando-se do gatilho de stop loss',
      asset: 'SOL',
      currentValue: 8.4,
      threshold: 10.0,
      timestamp: '2026-02-22T13:15:00Z',
    },
  ];
}

// ============================================================================
// SECTION 6: EXCHANGE API HEALTH (P2 MEDULA Execution Gateway)
// ============================================================================

export function getExchangeConnections(): ExchangeConnection[] {
  return [
    {
      id: 'exc_binance',
      exchange: 'Binance',
      status: 'connected',
      latencyMs: 42,
      lastSuccessfulCall: '2026-02-22T14:29:58Z',
      errorCount24h: 3,
      rateLimitUsed: 34,
      rateLimitMax: 1200,
      uptime: 99.97,
      wsStatus: 'connected',
      apiKeyMasked: '****...7kQ2',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_bybit',
      exchange: 'Bybit',
      status: 'connected',
      latencyMs: 58,
      lastSuccessfulCall: '2026-02-22T14:29:55Z',
      errorCount24h: 7,
      rateLimitUsed: 22,
      rateLimitMax: 600,
      uptime: 99.89,
      wsStatus: 'connected',
      apiKeyMasked: '****...mX9p',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_okx',
      exchange: 'OKX',
      status: 'connected',
      latencyMs: 65,
      lastSuccessfulCall: '2026-02-22T14:29:52Z',
      errorCount24h: 5,
      rateLimitUsed: 18,
      rateLimitMax: 600,
      uptime: 99.92,
      wsStatus: 'connected',
      apiKeyMasked: '****...nL4w',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_coinbase',
      exchange: 'Coinbase Pro',
      status: 'degraded',
      latencyMs: 185,
      lastSuccessfulCall: '2026-02-22T14:28:30Z',
      errorCount24h: 24,
      rateLimitUsed: 45,
      rateLimitMax: 300,
      uptime: 98.45,
      wsStatus: 'reconnecting',
      apiKeyMasked: '****...rT8z',
      permissions: ['read', 'trade', 'withdraw'],
    },
    {
      id: 'exc_kraken',
      exchange: 'Kraken',
      status: 'connected',
      latencyMs: 78,
      lastSuccessfulCall: '2026-02-22T14:29:50Z',
      errorCount24h: 2,
      rateLimitUsed: 12,
      rateLimitMax: 500,
      uptime: 99.95,
      wsStatus: 'connected',
      apiKeyMasked: '****...bK3m',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_kucoin',
      exchange: 'KuCoin',
      status: 'connected',
      latencyMs: 92,
      lastSuccessfulCall: '2026-02-22T14:29:48Z',
      errorCount24h: 8,
      rateLimitUsed: 28,
      rateLimitMax: 500,
      uptime: 99.82,
      wsStatus: 'connected',
      apiKeyMasked: '****...jH6v',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_gateio',
      exchange: 'Gate.io',
      status: 'syncing',
      latencyMs: 120,
      lastSuccessfulCall: '2026-02-22T14:27:15Z',
      errorCount24h: 15,
      rateLimitUsed: 52,
      rateLimitMax: 400,
      uptime: 99.34,
      wsStatus: 'reconnecting',
      apiKeyMasked: '****...wP2s',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_mexc',
      exchange: 'MEXC',
      status: 'disconnected',
      latencyMs: 0,
      lastSuccessfulCall: '2026-02-22T12:45:00Z',
      errorCount24h: 142,
      rateLimitUsed: 0,
      rateLimitMax: 400,
      uptime: 94.21,
      wsStatus: 'disconnected',
      apiKeyMasked: '****...eN5t',
      permissions: ['read'],
    },
    {
      id: 'exc_bitget',
      exchange: 'Bitget',
      status: 'connected',
      latencyMs: 88,
      lastSuccessfulCall: '2026-02-22T14:29:44Z',
      errorCount24h: 6,
      rateLimitUsed: 31,
      rateLimitMax: 600,
      uptime: 99.78,
      wsStatus: 'connected',
      apiKeyMasked: '****...qA7b',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_htx',
      exchange: 'HTX',
      status: 'connected',
      latencyMs: 105,
      lastSuccessfulCall: '2026-02-22T14:29:40Z',
      errorCount24h: 9,
      rateLimitUsed: 26,
      rateLimitMax: 500,
      uptime: 99.65,
      wsStatus: 'connected',
      apiKeyMasked: '****...dZ3x',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_cryptocom',
      exchange: 'Crypto.com',
      status: 'syncing',
      latencyMs: 134,
      lastSuccessfulCall: '2026-02-22T14:27:50Z',
      errorCount24h: 18,
      rateLimitUsed: 44,
      rateLimitMax: 300,
      uptime: 99.12,
      wsStatus: 'reconnecting',
      apiKeyMasked: '****...yC9n',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_bingx',
      exchange: 'BingX',
      status: 'connected',
      latencyMs: 96,
      lastSuccessfulCall: '2026-02-22T14:29:38Z',
      errorCount24h: 11,
      rateLimitUsed: 38,
      rateLimitMax: 500,
      uptime: 99.51,
      wsStatus: 'connected',
      apiKeyMasked: '****...vF2k',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_bitfinex',
      exchange: 'Bitfinex',
      status: 'connected',
      latencyMs: 73,
      lastSuccessfulCall: '2026-02-22T14:29:35Z',
      errorCount24h: 4,
      rateLimitUsed: 20,
      rateLimitMax: 600,
      uptime: 99.88,
      wsStatus: 'connected',
      apiKeyMasked: '****...hR5j',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_phemex',
      exchange: 'Phemex',
      status: 'connected',
      latencyMs: 112,
      lastSuccessfulCall: '2026-02-22T14:29:30Z',
      errorCount24h: 7,
      rateLimitUsed: 29,
      rateLimitMax: 400,
      uptime: 99.74,
      wsStatus: 'connected',
      apiKeyMasked: '****...wL8m',
      permissions: ['read', 'trade'],
    },
    {
      id: 'exc_gemini',
      exchange: 'Gemini',
      status: 'connected',
      latencyMs: 82,
      lastSuccessfulCall: '2026-02-22T14:29:25Z',
      errorCount24h: 5,
      rateLimitUsed: 16,
      rateLimitMax: 600,
      uptime: 99.91,
      wsStatus: 'connected',
      apiKeyMasked: '****...pN4s',
      permissions: ['read', 'trade'],
    },
  ];
}

export function getOrderExecutions(): OrderExecution[] {
  return [
    {
      id: 'ord_001',
      pair: 'BTC/USDT',
      exchange: 'Binance',
      side: 'BUY',
      type: 'LIMIT',
      status: 'filled',
      expectedPrice: 104100.00,
      actualPrice: 104098.50,
      slippage: -0.0014,
      size: 0.125,
      fee: 13.01,
      latencyMs: 38,
      timestamp: '2026-02-22T14:25:12Z',
    },
    {
      id: 'ord_002',
      pair: 'ETH/USDT',
      exchange: 'Binance',
      side: 'SELL',
      type: 'MARKET',
      status: 'filled',
      expectedPrice: 3842.00,
      actualPrice: 3840.15,
      slippage: -0.0481,
      size: 2.5,
      fee: 9.60,
      latencyMs: 22,
      timestamp: '2026-02-22T14:20:45Z',
    },
    {
      id: 'ord_003',
      pair: 'SOL/USDT',
      exchange: 'Bybit',
      side: 'BUY',
      type: 'LIMIT',
      status: 'partial_fill',
      expectedPrice: 178.20,
      actualPrice: 178.18,
      slippage: -0.0011,
      size: 50,
      fee: 4.45,
      latencyMs: 55,
      timestamp: '2026-02-22T14:15:30Z',
    },
    {
      id: 'ord_004',
      pair: 'BTC/USDT',
      exchange: 'OKX',
      side: 'SELL',
      type: 'STOP',
      status: 'pending',
      expectedPrice: 102500.00,
      actualPrice: 0,
      slippage: 0,
      size: 0.05,
      fee: 0,
      latencyMs: 0,
      timestamp: '2026-02-22T14:10:00Z',
    },
    {
      id: 'ord_005',
      pair: 'XRP/USDT',
      exchange: 'Kraken',
      side: 'BUY',
      type: 'MARKET',
      status: 'filled',
      expectedPrice: 2.48,
      actualPrice: 2.485,
      slippage: 0.002,
      size: 1000,
      fee: 2.49,
      latencyMs: 75,
      timestamp: '2026-02-22T14:05:20Z',
    },
    {
      id: 'ord_006',
      pair: 'AVAX/USDT',
      exchange: 'KuCoin',
      side: 'BUY',
      type: 'LIMIT',
      status: 'cancelled',
      expectedPrice: 41.50,
      actualPrice: 0,
      slippage: 0,
      size: 25,
      fee: 0,
      latencyMs: 0,
      timestamp: '2026-02-22T13:55:10Z',
    },
    {
      id: 'ord_007',
      pair: 'BNB/USDT',
      exchange: 'Binance',
      side: 'SELL',
      type: 'LIMIT',
      status: 'filled',
      expectedPrice: 715.00,
      actualPrice: 714.85,
      slippage: -0.021,
      size: 3,
      fee: 2.14,
      latencyMs: 31,
      timestamp: '2026-02-22T13:45:00Z',
    },
    {
      id: 'ord_008',
      pair: 'LINK/USDT',
      exchange: 'Coinbase Pro',
      side: 'BUY',
      type: 'MARKET',
      status: 'rejected',
      expectedPrice: 18.45,
      actualPrice: 0,
      slippage: 0,
      size: 100,
      fee: 0,
      latencyMs: 180,
      timestamp: '2026-02-22T13:40:15Z',
    },
  ];
}

export function getApiCallLogs(): ApiCallLog[] {
  return [
    { id: 'log_001', exchange: 'Binance', method: 'GET', endpoint: '/api/v3/ticker/24hr', statusCode: 200, responseTimeMs: 38, timestamp: '2026-02-22T14:29:58Z' },
    { id: 'log_002', exchange: 'Binance', method: 'POST', endpoint: '/api/v3/order', statusCode: 200, responseTimeMs: 42, timestamp: '2026-02-22T14:25:12Z' },
    { id: 'log_003', exchange: 'Bybit', method: 'GET', endpoint: '/v5/market/tickers', statusCode: 200, responseTimeMs: 55, timestamp: '2026-02-22T14:29:55Z' },
    { id: 'log_004', exchange: 'OKX', method: 'GET', endpoint: '/api/v5/market/ticker', statusCode: 200, responseTimeMs: 62, timestamp: '2026-02-22T14:29:52Z' },
    { id: 'log_005', exchange: 'Coinbase Pro', method: 'GET', endpoint: '/products/BTC-USD/ticker', statusCode: 503, responseTimeMs: 5000, timestamp: '2026-02-22T14:28:30Z' },
    { id: 'log_006', exchange: 'Kraken', method: 'POST', endpoint: '/0/private/AddOrder', statusCode: 200, responseTimeMs: 78, timestamp: '2026-02-22T14:05:20Z' },
    { id: 'log_007', exchange: 'KuCoin', method: 'DELETE', endpoint: '/api/v1/orders', statusCode: 200, responseTimeMs: 85, timestamp: '2026-02-22T13:55:10Z' },
    { id: 'log_008', exchange: 'Gate.io', method: 'GET', endpoint: '/api/v4/spot/tickers', statusCode: 429, responseTimeMs: 120, timestamp: '2026-02-22T14:27:15Z' },
    { id: 'log_009', exchange: 'MEXC', method: 'GET', endpoint: '/api/v3/ping', statusCode: 502, responseTimeMs: 8000, timestamp: '2026-02-22T12:45:00Z' },
    { id: 'log_010', exchange: 'Binance', method: 'GET', endpoint: '/api/v3/depth', statusCode: 200, responseTimeMs: 35, timestamp: '2026-02-22T14:29:50Z' },
    { id: 'log_011', exchange: 'Bybit', method: 'POST', endpoint: '/v5/order/create', statusCode: 200, responseTimeMs: 48, timestamp: '2026-02-22T14:15:30Z' },
    { id: 'log_012', exchange: 'OKX', method: 'POST', endpoint: '/api/v5/trade/order', statusCode: 200, responseTimeMs: 58, timestamp: '2026-02-22T14:10:00Z' },
    { id: 'log_013', exchange: 'Coinbase Pro', method: 'POST', endpoint: '/orders', statusCode: 400, responseTimeMs: 185, timestamp: '2026-02-22T13:40:15Z' },
    { id: 'log_014', exchange: 'Binance', method: 'GET', endpoint: '/api/v3/klines', statusCode: 200, responseTimeMs: 45, timestamp: '2026-02-22T14:29:45Z' },
    { id: 'log_015', exchange: 'Kraken', method: 'GET', endpoint: '/0/public/Ticker', statusCode: 200, responseTimeMs: 72, timestamp: '2026-02-22T14:29:40Z' },
  ];
}

// ============================================================================
// SECTION 7: MARKET SENTIMENT (P4 FUNDACAO)
// ============================================================================

export function getSentimentData(): SentimentData {
  return {
    fearGreedIndex: 68,
    fearGreedLabel: 'Greed',
    sources: {
      twitter: 72,
      reddit: 65,
      telegram: 71,
      news: 62,
      onChain: 74,
    },
    assetSentiment: [
      { symbol: 'BTC', score: 74, mentions: 128450, change24h: 5.2 },
      { symbol: 'ETH', score: 58, mentions: 84200, change24h: -3.1 },
      { symbol: 'SOL', score: 82, mentions: 62100, change24h: 12.8 },
      { symbol: 'XRP', score: 71, mentions: 45800, change24h: 8.4 },
      { symbol: 'BNB', score: 55, mentions: 28400, change24h: 1.2 },
      { symbol: 'ADA', score: 42, mentions: 22100, change24h: -6.5 },
      { symbol: 'AVAX', score: 67, mentions: 18900, change24h: 7.3 },
      { symbol: 'DOT', score: 48, mentions: 15200, change24h: -2.8 },
      { symbol: 'LINK', score: 76, mentions: 21500, change24h: 9.1 },
      { symbol: 'MATIC', score: 63, mentions: 17800, change24h: 4.6 },
    ],
    trendingTopics: [
      'Bitcoin ETF inflows surge',
      'Ethereum Pectra upgrade',
      'Solana memecoin season',
      'SEC crypto regulation framework',
      'Institutional DeFi adoption',
      'Layer 2 scaling wars',
      'Bitcoin halving aftermath',
      'Stablecoin regulation MiCA',
    ],
    whaleTransactions: [
      {
        id: 'wt_001',
        token: 'BTC',
        amount: 1250.5,
        from: '0x1a2b...8f9e',
        to: 'Binance Hot Wallet',
        type: 'exchange_inflow',
        timestamp: '2026-02-22T14:20:00Z',
      },
      {
        id: 'wt_002',
        token: 'ETH',
        amount: 15420.0,
        from: 'Coinbase Custody',
        to: '0x3c4d...2a1b',
        type: 'exchange_outflow',
        timestamp: '2026-02-22T14:05:00Z',
      },
      {
        id: 'wt_003',
        token: 'BTC',
        amount: 820.0,
        from: '0x5e6f...4c3d',
        to: '0x7a8b...6e5f',
        type: 'whale_transfer',
        timestamp: '2026-02-22T13:50:00Z',
      },
      {
        id: 'wt_004',
        token: 'SOL',
        amount: 285000.0,
        from: '0x9c0d...8a7b',
        to: 'Kraken Deposit',
        type: 'exchange_inflow',
        timestamp: '2026-02-22T13:35:00Z',
      },
      {
        id: 'wt_005',
        token: 'ETH',
        amount: 8200.0,
        from: 'OKX Withdrawal',
        to: '0xb2c3...0e9d',
        type: 'exchange_outflow',
        timestamp: '2026-02-22T13:15:00Z',
      },
      {
        id: 'wt_006',
        token: 'BTC',
        amount: 450.0,
        from: '0xd4e5...2g1f',
        to: '0xf6a7...4i3h',
        type: 'whale_transfer',
        timestamp: '2026-02-22T12:55:00Z',
      },
    ],
  };
}

export function getGeopoliticalRisk(): GeopoliticalRisk[] {
  return [
    {
      exchange: 'Binance',
      riskLevel: 'medium',
      riskScore: 42,
      advisory: 'Regulatory scrutiny continues in multiple jurisdictions. Monitor compliance updates.',
      advisoryPt: 'Escrutinio regulatorio continua em multiplas jurisdicoes. Monitore atualizacoes de conformidade.',
      components: { regulatory: 55, sanctions: 20, politicalStability: 45, economicIndicators: 48 },
    },
    {
      exchange: 'Bybit',
      riskLevel: 'low',
      riskScore: 28,
      advisory: 'Stable operational environment. Dubai VASP license active.',
      advisoryPt: 'Ambiente operacional estavel. Licenca VASP de Dubai ativa.',
      components: { regulatory: 30, sanctions: 15, politicalStability: 35, economicIndicators: 32 },
    },
    {
      exchange: 'OKX',
      riskLevel: 'low',
      riskScore: 32,
      advisory: 'Well-positioned with global licenses. Continued expansion in regulated markets.',
      advisoryPt: 'Bem posicionada com licencas globais. Expansao continua em mercados regulados.',
      components: { regulatory: 35, sanctions: 18, politicalStability: 38, economicIndicators: 37 },
    },
    {
      exchange: 'Coinbase Pro',
      riskLevel: 'very_low',
      riskScore: 15,
      advisory: 'US-regulated publicly traded company. Strong compliance framework.',
      advisoryPt: 'Empresa de capital aberto regulamentada nos EUA. Forte estrutura de conformidade.',
      components: { regulatory: 10, sanctions: 5, politicalStability: 20, economicIndicators: 25 },
    },
    {
      exchange: 'Kraken',
      riskLevel: 'very_low',
      riskScore: 18,
      advisory: 'Strong regulatory standing. Multiple global licenses. SOC 2 compliant.',
      advisoryPt: 'Forte posicao regulatoria. Multiplas licencas globais. Conforme SOC 2.',
      components: { regulatory: 15, sanctions: 8, politicalStability: 22, economicIndicators: 27 },
    },
    {
      exchange: 'KuCoin',
      riskLevel: 'medium',
      riskScore: 45,
      advisory: 'DOJ settlement completed. Rebuilding compliance infrastructure.',
      advisoryPt: 'Acordo com DOJ concluido. Reconstruindo infraestrutura de conformidade.',
      components: { regulatory: 52, sanctions: 30, politicalStability: 48, economicIndicators: 50 },
    },
    {
      exchange: 'Gate.io',
      riskLevel: 'high',
      riskScore: 62,
      advisory: 'Limited regulatory licenses. Restricted in several major markets.',
      advisoryPt: 'Licencas regulatorias limitadas. Restrita em varios mercados importantes.',
      components: { regulatory: 70, sanctions: 45, politicalStability: 65, economicIndicators: 68 },
    },
    {
      exchange: 'MEXC',
      riskLevel: 'high',
      riskScore: 68,
      advisory: 'No major regulatory licenses. High counterparty risk. Monitor closely.',
      advisoryPt: 'Sem licencas regulatorias importantes. Alto risco de contraparte. Monitorar de perto.',
      components: { regulatory: 75, sanctions: 50, politicalStability: 70, economicIndicators: 77 },
    },
  ];
}

export function getFundingRates(): FundingRateData[] {
  return [
    { symbol: 'BTC/USDT', binanceRate: 0.0085, bybitRate: 0.0078, okxRate: 0.0082, predictedNext: 0.0079, annualizedYield: 31.2 },
    { symbol: 'ETH/USDT', binanceRate: 0.0042, bybitRate: 0.0038, okxRate: 0.0045, predictedNext: 0.0040, annualizedYield: 15.3 },
    { symbol: 'SOL/USDT', binanceRate: 0.0125, bybitRate: 0.0118, okxRate: 0.0130, predictedNext: 0.0115, annualizedYield: 45.6 },
    { symbol: 'BNB/USDT', binanceRate: 0.0035, bybitRate: 0.0032, okxRate: 0.0038, predictedNext: 0.0033, annualizedYield: 12.8 },
    { symbol: 'XRP/USDT', binanceRate: 0.0095, bybitRate: 0.0088, okxRate: 0.0092, predictedNext: 0.0085, annualizedYield: 34.7 },
    { symbol: 'AVAX/USDT', binanceRate: 0.0072, bybitRate: 0.0068, okxRate: 0.0075, predictedNext: 0.0065, annualizedYield: 26.3 },
    { symbol: 'LINK/USDT', binanceRate: 0.0088, bybitRate: 0.0082, okxRate: 0.0090, predictedNext: 0.0080, annualizedYield: 32.1 },
    { symbol: 'DOT/USDT', binanceRate: -0.0015, bybitRate: -0.0020, okxRate: -0.0012, predictedNext: -0.0018, annualizedYield: -5.8 },
    { symbol: 'ADA/USDT', binanceRate: -0.0028, bybitRate: -0.0032, okxRate: -0.0025, predictedNext: -0.0030, annualizedYield: -10.2 },
    { symbol: 'MATIC/USDT', binanceRate: 0.0055, bybitRate: 0.0050, okxRate: 0.0058, predictedNext: 0.0048, annualizedYield: 20.1 },
  ];
}

// ============================================================================
// SECTION 8: CONFLUENCE BRAIN SYSTEM (P3 ConfluenceBrainV2)
// ============================================================================

const CONFLUENCE_DATA: Record<string, ConfluenceAnalysis> = {
  BTC: {
    symbol: 'BTC',
    timestamp: '2026-02-22T14:30:00Z',
    activeBrains: [
      { brainId: 'rsi_divergence', brainName: 'RSI Divergence', signal: 'BUY', confidence: 72, evidence: 'Bullish divergence on 4H RSI (price lower low, RSI higher low)', category: 'momentum' },
      { brainId: 'macd_crossover', brainName: 'MACD Crossover', signal: 'BUY', confidence: 78, evidence: 'MACD line crossed above signal line with positive histogram expansion', category: 'momentum' },
      { brainId: 'supertrend', brainName: 'Supertrend', signal: 'BUY', confidence: 81, evidence: 'Price above Supertrend line at $102,840, trend confirmed bullish', category: 'trend' },
      { brainId: 'volume_profile', brainName: 'Volume Profile', signal: 'NEUTRAL_SIGNAL', confidence: 65, evidence: 'Price in Value Area between $103,200-$105,800, fair value zone', category: 'volume' },
      { brainId: 'ichimoku_cloud', brainName: 'Ichimoku Cloud', signal: 'BUY', confidence: 76, evidence: 'Price above Kumo cloud, Tenkan above Kijun, bullish Chikou Span', category: 'trend' },
      { brainId: 'bollinger_bands', brainName: 'Bollinger Bands', signal: 'NEUTRAL_SIGNAL', confidence: 58, evidence: 'Price in upper half of bands, no squeeze detected', category: 'volatility' },
      { brainId: 'monte_carlo_forecaster', brainName: 'Monte Carlo Forecaster', signal: 'BUY', confidence: 74, evidence: '72.3% probability of price above $109,462 in 20 days (10000 simulations)', category: 'quantitative' },
    ],
    synergies: [
      { brain1: 'rsi_divergence', brain2: 'macd_crossover', bonus: 12 },
      { brain1: 'supertrend', brain2: 'ichimoku_cloud', bonus: 15 },
      { brain1: 'macd_crossover', brain2: 'volume_profile', bonus: 8 },
    ],
    conflicts: [
      { brain1: 'bollinger_bands', brain2: 'supertrend', penalty: 5 },
    ],
    finalScore: 78.4,
    finalSignal: 'BUY',
    marketRegime: 'TRENDING_BULL',
    volatilityRegime: 'moderate',
    adjustedThreshold: 65.0,
    consciousnessLevel: 0.82,
  },
  ETH: {
    symbol: 'ETH',
    timestamp: '2026-02-22T14:30:00Z',
    activeBrains: [
      { brainId: 'rsi_divergence', brainName: 'RSI Divergence', signal: 'SELL', confidence: 68, evidence: 'Bearish divergence on 4H RSI (price higher high, RSI lower high)', category: 'momentum' },
      { brainId: 'macd_crossover', brainName: 'MACD Crossover', signal: 'SELL', confidence: 64, evidence: 'MACD histogram declining, signal line approaching crossover down', category: 'momentum' },
      { brainId: 'stochastic_rsi', brainName: 'Stochastic RSI', signal: 'SELL', confidence: 72, evidence: 'StochRSI at 0.85, entering overbought territory with K crossing below D', category: 'momentum' },
      { brainId: 'vwap_supreme', brainName: 'VWAP Supreme', signal: 'NEUTRAL_SIGNAL', confidence: 60, evidence: 'Price hovering around VWAP at $3,838, no clear rejection', category: 'volume' },
      { brainId: 'adx_analyzer', brainName: 'ADX Analyzer', signal: 'NEUTRAL_SIGNAL', confidence: 55, evidence: 'ADX at 22.5, below threshold indicating weak trend', category: 'trend' },
      { brainId: 'kalman_filter_tracker', brainName: 'Kalman Filter Tracker', signal: 'SELL', confidence: 66, evidence: 'Kalman estimate declining, state prediction below current price', category: 'quantitative' },
    ],
    synergies: [
      { brain1: 'rsi_divergence', brain2: 'stochastic_rsi', bonus: 10 },
      { brain1: 'macd_crossover', brain2: 'kalman_filter_tracker', bonus: 8 },
    ],
    conflicts: [
      { brain1: 'vwap_supreme', brain2: 'rsi_divergence', penalty: 6 },
      { brain1: 'adx_analyzer', brain2: 'macd_crossover', penalty: 4 },
    ],
    finalScore: 35.2,
    finalSignal: 'SELL',
    marketRegime: 'RANGING',
    volatilityRegime: 'low',
    adjustedThreshold: 60.0,
    consciousnessLevel: 0.64,
  },
  SOL: {
    symbol: 'SOL',
    timestamp: '2026-02-22T14:30:00Z',
    activeBrains: [
      { brainId: 'supertrend', brainName: 'Supertrend', signal: 'BUY', confidence: 85, evidence: 'Strong uptrend with Supertrend at $168.40, price well above', category: 'trend' },
      { brainId: 'aroon_indicator', brainName: 'Aroon Indicator', signal: 'BUY', confidence: 78, evidence: 'Aroon Up at 92, Aroon Down at 8, strong bullish trend', category: 'trend' },
      { brainId: 'awesome_oscillator', brainName: 'Awesome Oscillator', signal: 'BUY', confidence: 74, evidence: 'Positive and expanding AO histogram, twin peaks formation', category: 'momentum' },
      { brainId: 'obv_trend', brainName: 'OBV Trend', signal: 'BUY', confidence: 80, evidence: 'OBV making new highs, confirming price breakout with volume', category: 'volume' },
      { brainId: 'chaikin_money_flow', brainName: 'Chaikin Money Flow', signal: 'BUY', confidence: 76, evidence: 'CMF at +0.18, strong accumulation phase detected', category: 'volume' },
      { brainId: 'order_flow_imbalance', brainName: 'Order Flow Imbalance', signal: 'BUY', confidence: 71, evidence: 'Aggressive buy-side imbalance at 68% bid ratio on top 20 levels', category: 'quantitative' },
      { brainId: 'bayesian_inference', brainName: 'Bayesian Inference', signal: 'BUY', confidence: 73, evidence: 'Posterior probability 0.78 for TRENDING_BULL regime continuation', category: 'quantitative' },
    ],
    synergies: [
      { brain1: 'supertrend', brain2: 'aroon_indicator', bonus: 14 },
      { brain1: 'obv_trend', brain2: 'chaikin_money_flow', bonus: 12 },
      { brain1: 'awesome_oscillator', brain2: 'order_flow_imbalance', bonus: 9 },
    ],
    conflicts: [],
    finalScore: 86.7,
    finalSignal: 'BUY',
    marketRegime: 'TRENDING_BULL',
    volatilityRegime: 'high',
    adjustedThreshold: 60.0,
    consciousnessLevel: 0.91,
  },
};

export function getConfluenceAnalysis(symbol: string): ConfluenceAnalysis {
  const data = CONFLUENCE_DATA[symbol.toUpperCase()];
  if (data) return data;
  return {
    symbol: symbol.toUpperCase(),
    timestamp: '2026-02-22T14:30:00Z',
    activeBrains: [
      { brainId: 'rsi_divergence', brainName: 'RSI Divergence', signal: 'NEUTRAL_SIGNAL', confidence: 50, evidence: 'Insufficient data for analysis', category: 'momentum' },
    ],
    synergies: [],
    conflicts: [],
    finalScore: 50.0,
    finalSignal: 'NEUTRAL_SIGNAL',
    marketRegime: 'UNKNOWN',
    volatilityRegime: 'unknown',
    adjustedThreshold: 60.0,
    consciousnessLevel: 0.30,
  };
}

// ============================================================================
// SECTION 9: QUANTUM SIMULATION DATA (P5 MEMORIA + P7 VANGUARDA)
// ============================================================================

export function getMonteCarloResults(): MonteCarloResult[] {
  return [
    {
      symbol: 'BTC',
      simulationCount: 10000,
      forecastDays: 20,
      probUp: 0.723,
      probDown: 0.277,
      medianPrice: 109462,
      percentile5: 96850,
      percentile95: 124380,
      expectedReturn: 0.05,
      model: 'merton_jump_diffusion',
      jumpIntensity: 0.12,
      driftRate: 0.0025,
      volatility: 0.042,
    },
    {
      symbol: 'ETH',
      simulationCount: 10000,
      forecastDays: 20,
      probUp: 0.481,
      probDown: 0.519,
      medianPrice: 3795,
      percentile5: 3280,
      percentile95: 4420,
      expectedReturn: -0.012,
      model: 'merton_jump_diffusion',
      jumpIntensity: 0.15,
      driftRate: -0.0006,
      volatility: 0.055,
    },
    {
      symbol: 'SOL',
      simulationCount: 10000,
      forecastDays: 20,
      probUp: 0.782,
      probDown: 0.218,
      medianPrice: 198.40,
      percentile5: 148.20,
      percentile95: 262.50,
      expectedReturn: 0.112,
      model: 'merton_jump_diffusion',
      jumpIntensity: 0.22,
      driftRate: 0.0056,
      volatility: 0.078,
    },
  ];
}

// ============================================================================
// SECTION 10: TRADE JOURNAL DATA
// ============================================================================

export function getTradeJournal(): TradeJournalEntry[] {
  return [
    {
      id: 'tj_001',
      date: '2026-02-22',
      pair: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 103200,
      exitPrice: 104850,
      size: 0.15,
      pnl: 247.50,
      pnlPercent: 1.60,
      exchange: 'Binance',
      strategy: 'Quantum Momentum',
      notes: 'Strong MACD crossover with RSI divergence confirmation. Clean entry at support.',
      tags: ['momentum', 'confluence', 'A+_setup'],
      mood: 'confident',
      duration: '4h 22m',
    },
    {
      id: 'tj_002',
      date: '2026-02-21',
      pair: 'ETH/USDT',
      side: 'SHORT',
      entryPrice: 3890,
      exitPrice: 3842,
      size: 3.0,
      pnl: 144.00,
      pnlPercent: 1.23,
      exchange: 'Bybit',
      strategy: 'Mean Reversion Alpha',
      notes: 'Stochastic RSI overbought rejection at upper Bollinger Band. VWAP acting as magnet.',
      tags: ['mean_reversion', 'overbought', 'precision'],
      mood: 'disciplined',
      duration: '2h 15m',
    },
    {
      id: 'tj_003',
      date: '2026-02-21',
      pair: 'SOL/USDT',
      side: 'LONG',
      entryPrice: 165.80,
      exitPrice: 178.45,
      size: 40,
      pnl: 506.00,
      pnlPercent: 7.63,
      exchange: 'Binance',
      strategy: 'Breakout Hunter',
      notes: 'ADX breakout above 30 with Aroon Up at 100. Fibonacci 1.618 extension target hit.',
      tags: ['breakout', 'high_conviction', 'trend_follow'],
      mood: 'confident',
      duration: '1d 6h',
    },
    {
      id: 'tj_004',
      date: '2026-02-20',
      pair: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 105200,
      exitPrice: 103800,
      size: 0.10,
      pnl: -140.00,
      pnlPercent: -1.33,
      exchange: 'OKX',
      strategy: 'Trend Follower',
      notes: 'False breakout above resistance. Ichimoku cloud was thin, should have waited for thicker cloud.',
      tags: ['false_breakout', 'lesson_learned'],
      mood: 'anxious',
      duration: '5h 40m',
    },
    {
      id: 'tj_005',
      date: '2026-02-20',
      pair: 'XRP/USDT',
      side: 'LONG',
      entryPrice: 2.32,
      exitPrice: 2.48,
      size: 2000,
      pnl: 320.00,
      pnlPercent: 6.90,
      exchange: 'Kraken',
      strategy: 'Whale Shadow',
      notes: 'Large OBV spike detected with Chaikin Money Flow turning positive. Whale accumulation confirmed on-chain.',
      tags: ['whale_tracking', 'volume_surge', 'on_chain'],
      mood: 'confident',
      duration: '2d 3h',
    },
    {
      id: 'tj_006',
      date: '2026-02-19',
      pair: 'BNB/USDT',
      side: 'LONG',
      entryPrice: 698.50,
      exitPrice: 712.30,
      size: 5,
      pnl: 69.00,
      pnlPercent: 1.98,
      exchange: 'Binance',
      strategy: 'Scalper Matrix',
      notes: 'Quick scalp at VWAP support with Stochastic and Williams %R both oversold.',
      tags: ['scalp', 'vwap_bounce', 'quick_trade'],
      mood: 'disciplined',
      duration: '45m',
    },
    {
      id: 'tj_007',
      date: '2026-02-19',
      pair: 'AVAX/USDT',
      side: 'SHORT',
      entryPrice: 44.20,
      exitPrice: 42.15,
      size: 50,
      pnl: 102.50,
      pnlPercent: 4.64,
      exchange: 'Bybit',
      strategy: 'Mean Reversion Alpha',
      notes: 'Perfect rejection at +2 std dev Bollinger with StochRSI K crossing below D in overbought zone.',
      tags: ['mean_reversion', 'textbook_setup'],
      mood: 'confident',
      duration: '8h 10m',
    },
    {
      id: 'tj_008',
      date: '2026-02-18',
      pair: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 101500,
      exitPrice: 102100,
      size: 0.20,
      pnl: 120.00,
      pnlPercent: 0.59,
      exchange: 'Binance',
      strategy: 'Monte Carlo Predictor',
      notes: 'Monte Carlo showed 74% up probability. Kalman filter confirmed upward state. Small position due to lower confidence.',
      tags: ['quantitative', 'probabilistic', 'conservative'],
      mood: 'neutral',
      duration: '12h 30m',
    },
    {
      id: 'tj_009',
      date: '2026-02-18',
      pair: 'LINK/USDT',
      side: 'LONG',
      entryPrice: 17.20,
      exitPrice: 18.45,
      size: 100,
      pnl: 125.00,
      pnlPercent: 7.27,
      exchange: 'KuCoin',
      strategy: 'Breakout Hunter',
      notes: 'Fibonacci 0.618 retracement bounce with ADX rising above 25. Strong Aroon Up crossover.',
      tags: ['fibonacci', 'retracement_bounce', 'trend_start'],
      mood: 'confident',
      duration: '1d 14h',
    },
    {
      id: 'tj_010',
      date: '2026-02-17',
      pair: 'ETH/USDT',
      side: 'LONG',
      entryPrice: 3720,
      exitPrice: 3680,
      size: 2.0,
      pnl: -80.00,
      pnlPercent: -1.08,
      exchange: 'OKX',
      strategy: 'Quantum Momentum',
      notes: 'Entered on MACD signal but RSI divergence was weak. Volume profile showed selling pressure above.',
      tags: ['weak_signal', 'forced_entry', 'lesson_learned'],
      mood: 'fomo',
      duration: '3h 20m',
    },
    {
      id: 'tj_011',
      date: '2026-02-17',
      pair: 'SOL/USDT',
      side: 'LONG',
      entryPrice: 158.40,
      exitPrice: 165.80,
      size: 30,
      pnl: 222.00,
      pnlPercent: 4.67,
      exchange: 'Binance',
      strategy: 'Trend Follower',
      notes: 'Supertrend flip with Ichimoku + ADX fusion confirming strong uptrend. MA alignment bullish.',
      tags: ['trend_following', 'multi_confirmation', 'swing'],
      mood: 'disciplined',
      duration: '1d 20h',
    },
    {
      id: 'tj_012',
      date: '2026-02-16',
      pair: 'DOT/USDT',
      side: 'SHORT',
      entryPrice: 9.45,
      exitPrice: 9.62,
      size: 500,
      pnl: -85.00,
      pnlPercent: -1.80,
      exchange: 'Bybit',
      strategy: 'Mean Reversion Alpha',
      notes: 'Shorted at assumed resistance but buyers stepped in. Stochastic RSI gave false signal in low volume.',
      tags: ['false_signal', 'low_volume', 'stop_loss_hit'],
      mood: 'anxious',
      duration: '1h 45m',
    },
    {
      id: 'tj_013',
      date: '2026-02-16',
      pair: 'BTC/USDT',
      side: 'SHORT',
      entryPrice: 104800,
      exitPrice: 103500,
      size: 0.08,
      pnl: 104.00,
      pnlPercent: 1.24,
      exchange: 'Binance',
      strategy: 'Scalper Matrix',
      notes: 'Williams %R at -5 with Stochastic K above 90. Quick scalp on rejection from round number resistance.',
      tags: ['scalp', 'overbought', 'round_number'],
      mood: 'disciplined',
      duration: '30m',
    },
    {
      id: 'tj_014',
      date: '2026-02-15',
      pair: 'ADA/USDT',
      side: 'LONG',
      entryPrice: 0.755,
      exitPrice: 0.782,
      size: 5000,
      pnl: 135.00,
      pnlPercent: 3.58,
      exchange: 'Kraken',
      strategy: 'Whale Shadow',
      notes: 'Large whale outflow from exchanges detected. OBV divergence and Chaikin turning positive.',
      tags: ['whale_signal', 'accumulation', 'patient_entry'],
      mood: 'neutral',
      duration: '3d 8h',
    },
    {
      id: 'tj_015',
      date: '2026-02-15',
      pair: 'MATIC/USDT',
      side: 'LONG',
      entryPrice: 0.648,
      exitPrice: 0.685,
      size: 3000,
      pnl: 111.00,
      pnlPercent: 5.71,
      exchange: 'Binance',
      strategy: 'Quantum Momentum',
      notes: 'RSI bullish divergence with MACD golden cross. Supertrend confirmed flip. Volume Profile POC held as support.',
      tags: ['multi_signal', 'momentum_shift', 'strong_entry'],
      mood: 'confident',
      duration: '2d 12h',
    },
  ];
}

// ============================================================================
// SECTION 11: NOTIFICATION DATA
// ============================================================================

export function getNotifications(): NotificationItem[] {
  return [
    {
      id: 'ntf_001',
      type: 'trade_executed',
      title: 'BTC/USDT Long Filled',
      titlePt: 'BTC/USDT Long Executado',
      description: 'Buy order filled at $104,098.50 for 0.125 BTC on Binance',
      descriptionPt: 'Ordem de compra executada a $104.098,50 por 0,125 BTC na Binance',
      timestamp: '2026-02-22T14:25:12Z',
      read: false,
      actionLabel: 'View Trade',
      actionLabelPt: 'Ver Trade',
    },
    {
      id: 'ntf_002',
      type: 'alert_triggered',
      title: 'SOL Price Above $178',
      titlePt: 'Preco SOL Acima de $178',
      description: 'SOL/USDT crossed above your alert price of $178.00',
      descriptionPt: 'SOL/USDT cruzou acima do preco de alerta de $178,00',
      timestamp: '2026-02-22T14:18:45Z',
      read: false,
      actionLabel: 'View Chart',
      actionLabelPt: 'Ver Grafico',
    },
    {
      id: 'ntf_003',
      type: 'bot_action',
      title: 'Grid Bot Placed Buy Order',
      titlePt: 'Bot Grid Colocou Ordem de Compra',
      description: 'BTC Grid Master placed buy at $103,450 - Grid level 7/12',
      descriptionPt: 'BTC Grid Master colocou compra em $103.450 - Nivel de grid 7/12',
      timestamp: '2026-02-22T14:10:30Z',
      read: false,
    },
    {
      id: 'ntf_004',
      type: 'risk_warning',
      title: 'High Correlation Alert',
      titlePt: 'Alerta de Alta Correlacao',
      description: 'BTC and ETH positions show 0.92 correlation - consider hedging',
      descriptionPt: 'Posicoes BTC e ETH mostram correlacao de 0,92 - considere hedge',
      timestamp: '2026-02-22T14:15:00Z',
      read: false,
      actionLabel: 'Review Risk',
      actionLabelPt: 'Revisar Risco',
    },
    {
      id: 'ntf_005',
      type: 'system_update',
      title: 'MEXC Connection Lost',
      titlePt: 'Conexao MEXC Perdida',
      description: 'MEXC API connection lost. Attempting reconnection every 60s.',
      descriptionPt: 'Conexao API MEXC perdida. Tentando reconexao a cada 60s.',
      timestamp: '2026-02-22T12:45:00Z',
      read: true,
    },
    {
      id: 'ntf_006',
      type: 'trade_executed',
      title: 'ETH/USDT Short Filled',
      titlePt: 'ETH/USDT Short Executado',
      description: 'Sell order filled at $3,840.15 for 2.5 ETH on Binance',
      descriptionPt: 'Ordem de venda executada a $3.840,15 por 2,5 ETH na Binance',
      timestamp: '2026-02-22T14:20:45Z',
      read: false,
      actionLabel: 'View Trade',
      actionLabelPt: 'Ver Trade',
    },
    {
      id: 'ntf_007',
      type: 'price_target',
      title: 'BTC Approaching Resistance',
      titlePt: 'BTC Aproximando da Resistencia',
      description: 'BTC/USDT at $104,250 - Key resistance at $105,100',
      descriptionPt: 'BTC/USDT em $104.250 - Resistencia chave em $105.100',
      timestamp: '2026-02-22T13:55:00Z',
      read: false,
      actionLabel: 'Set Alert',
      actionLabelPt: 'Criar Alerta',
    },
    {
      id: 'ntf_008',
      type: 'bot_action',
      title: 'DCA Bot Executed Purchase',
      titlePt: 'Bot DCA Executou Compra',
      description: 'ETH DCA Strategy purchased 0.5 ETH at $3,842.15',
      descriptionPt: 'Estrategia DCA ETH comprou 0,5 ETH a $3.842,15',
      timestamp: '2026-02-22T12:00:00Z',
      read: true,
    },
    {
      id: 'ntf_009',
      type: 'alert_triggered',
      title: 'XRP Volume Spike Detected',
      titlePt: 'Pico de Volume XRP Detectado',
      description: 'XRP/USDT volume 3.2x above 24h average - unusual activity',
      descriptionPt: 'Volume XRP/USDT 3,2x acima da media 24h - atividade incomum',
      timestamp: '2026-02-22T11:30:00Z',
      read: true,
      actionLabel: 'Analyze',
      actionLabelPt: 'Analisar',
    },
    {
      id: 'ntf_010',
      type: 'risk_warning',
      title: 'Concentration Limit Exceeded',
      titlePt: 'Limite de Concentracao Excedido',
      description: 'BTC allocation at 45.2% exceeds the 40% single-asset limit',
      descriptionPt: 'Alocacao BTC em 45,2% excede o limite de 40% para um unico ativo',
      timestamp: '2026-02-22T10:45:00Z',
      read: true,
      actionLabel: 'Rebalance',
      actionLabelPt: 'Rebalancear',
    },
    {
      id: 'ntf_011',
      type: 'system_update',
      title: 'Quantum Engine Updated',
      titlePt: 'Motor Quantico Atualizado',
      description: 'Monte Carlo Forecaster v4.0 deployed with improved jump-diffusion model',
      descriptionPt: 'Monte Carlo Forecaster v4.0 implantado com modelo de jump-diffusion melhorado',
      timestamp: '2026-02-22T08:00:00Z',
      read: true,
    },
    {
      id: 'ntf_012',
      type: 'trade_executed',
      title: 'XRP/USDT Long Filled',
      titlePt: 'XRP/USDT Long Executado',
      description: 'Buy order filled at $2.485 for 1,000 XRP on Kraken',
      descriptionPt: 'Ordem de compra executada a $2,485 por 1.000 XRP na Kraken',
      timestamp: '2026-02-22T14:05:20Z',
      read: false,
      actionLabel: 'View Trade',
      actionLabelPt: 'Ver Trade',
    },
    {
      id: 'ntf_013',
      type: 'bot_action',
      title: 'Grid Bot Sell Triggered',
      titlePt: 'Venda Bot Grid Acionada',
      description: 'BTC Grid Master sold at $104,650 - Taking profit on grid level 5',
      descriptionPt: 'BTC Grid Master vendeu a $104.650 - Realizando lucro no nivel de grid 5',
      timestamp: '2026-02-22T09:30:00Z',
      read: true,
    },
    {
      id: 'ntf_014',
      type: 'price_target',
      title: 'ETH Support Test',
      titlePt: 'Teste de Suporte ETH',
      description: 'ETH/USDT testing support at $3,780 - Watch for bounce or breakdown',
      descriptionPt: 'ETH/USDT testando suporte em $3.780 - Observe bounce ou rompimento',
      timestamp: '2026-02-22T07:15:00Z',
      read: true,
      actionLabel: 'View Chart',
      actionLabelPt: 'Ver Grafico',
    },
    {
      id: 'ntf_015',
      type: 'alert_triggered',
      title: 'Whale Alert: 1,250 BTC Moved',
      titlePt: 'Alerta Baleia: 1.250 BTC Movidos',
      description: '1,250 BTC ($130M) transferred to Binance hot wallet from unknown address',
      descriptionPt: '1.250 BTC ($130M) transferidos para carteira quente da Binance de endereco desconhecido',
      timestamp: '2026-02-22T14:20:00Z',
      read: false,
      actionLabel: 'Track Whale',
      actionLabelPt: 'Rastrear Baleia',
    },
    {
      id: 'ntf_016',
      type: 'system_update',
      title: 'Coinbase Pro Degraded',
      titlePt: 'Coinbase Pro Degradada',
      description: 'Coinbase Pro API experiencing high latency (185ms). Orders may be delayed.',
      descriptionPt: 'API Coinbase Pro experimentando alta latencia (185ms). Ordens podem sofrer atraso.',
      timestamp: '2026-02-22T13:00:00Z',
      read: true,
    },
    {
      id: 'ntf_017',
      type: 'risk_warning',
      title: 'Portfolio Exposure Warning',
      titlePt: 'Aviso de Exposicao do Portfolio',
      description: 'Total exposure at 62.4% approaching the 75% maximum limit',
      descriptionPt: 'Exposicao total em 62,4% aproximando-se do limite maximo de 75%',
      timestamp: '2026-02-22T14:30:00Z',
      read: false,
      actionLabel: 'View Risk',
      actionLabelPt: 'Ver Risco',
    },
    {
      id: 'ntf_018',
      type: 'trade_executed',
      title: 'BNB/USDT Sell Filled',
      titlePt: 'BNB/USDT Venda Executada',
      description: 'Sell order filled at $714.85 for 3 BNB on Binance',
      descriptionPt: 'Ordem de venda executada a $714,85 por 3 BNB na Binance',
      timestamp: '2026-02-22T13:45:00Z',
      read: true,
      actionLabel: 'View Trade',
      actionLabelPt: 'Ver Trade',
    },
    {
      id: 'ntf_019',
      type: 'bot_action',
      title: 'Arbitrage Opportunity Found',
      titlePt: 'Oportunidade de Arbitragem Encontrada',
      description: 'SOL price spread of 0.32% between Binance and KuCoin detected',
      descriptionPt: 'Spread de preco SOL de 0,32% entre Binance e KuCoin detectado',
      timestamp: '2026-02-22T11:00:00Z',
      read: true,
    },
    {
      id: 'ntf_020',
      type: 'price_target',
      title: 'AVAX Fibonacci Level Hit',
      titlePt: 'Nivel Fibonacci AVAX Atingido',
      description: 'AVAX/USDT reached 0.618 Fibonacci retracement at $42.15',
      descriptionPt: 'AVAX/USDT atingiu retracamento Fibonacci 0,618 em $42,15',
      timestamp: '2026-02-22T06:30:00Z',
      read: true,
      actionLabel: 'View Analysis',
      actionLabelPt: 'Ver Analise',
    },
  ];
}

// ============================================================================
// SECTION 12: ECONOMIC CALENDAR DATA
// ============================================================================

export function getCalendarEvents(): CalendarEvent[] {
  return [
    {
      id: 'cal_001',
      date: '2026-02-23',
      time: '14:30',
      title: 'US Core PCE Price Index',
      titlePt: 'Indice de Precos PCE Core dos EUA',
      category: 'macro',
      impact: 'high',
      description: 'Federal Reserve preferred inflation measure. Expected 2.6% YoY.',
      descriptionPt: 'Medida de inflacao preferida do Federal Reserve. Esperado 2,6% YoY.',
      affectedAssets: ['BTC', 'ETH', 'SOL'],
    },
    {
      id: 'cal_002',
      date: '2026-02-24',
      time: '09:00',
      title: 'Ethereum Pectra Hard Fork',
      titlePt: 'Hard Fork Pectra do Ethereum',
      category: 'crypto',
      impact: 'high',
      description: 'Major Ethereum network upgrade introducing EIP-7702 and account abstraction improvements.',
      descriptionPt: 'Atualizacao major da rede Ethereum introduzindo EIP-7702 e melhorias de abstracao de conta.',
      affectedAssets: ['ETH', 'MATIC', 'UNI'],
    },
    {
      id: 'cal_003',
      date: '2026-02-25',
      time: '16:00',
      title: 'SEC Crypto Roundtable',
      titlePt: 'Mesa Redonda Crypto da SEC',
      category: 'macro',
      impact: 'high',
      description: 'SEC roundtable on crypto custody rules and exchange regulation framework.',
      descriptionPt: 'Mesa redonda da SEC sobre regras de custodia crypto e estrutura de regulacao de exchanges.',
      affectedAssets: ['BTC', 'ETH', 'SOL', 'XRP'],
    },
    {
      id: 'cal_004',
      date: '2026-02-25',
      time: '12:00',
      title: 'ARB Token Unlock',
      titlePt: 'Desbloqueio de Token ARB',
      category: 'token_unlock',
      impact: 'medium',
      description: '92.6M ARB tokens ($115M) unlocking for team and investors.',
      descriptionPt: '92,6M tokens ARB ($115M) sendo desbloqueados para equipe e investidores.',
      affectedAssets: ['ARB'],
    },
    {
      id: 'cal_005',
      date: '2026-02-26',
      time: '20:00',
      title: 'FOMC Minutes Release',
      titlePt: 'Divulgacao das Atas do FOMC',
      category: 'macro',
      impact: 'high',
      description: 'Federal Reserve meeting minutes revealing policy discussions on rate decisions.',
      descriptionPt: 'Atas da reuniao do Federal Reserve revelando discussoes de politica sobre decisoes de taxa.',
      affectedAssets: ['BTC', 'ETH', 'SOL', 'XRP'],
    },
    {
      id: 'cal_006',
      date: '2026-02-26',
      time: '10:00',
      title: 'Solana Firedancer Launch',
      titlePt: 'Lancamento Solana Firedancer',
      category: 'crypto',
      impact: 'high',
      description: 'Jump Crypto Firedancer validator client mainnet launch for Solana network.',
      descriptionPt: 'Lancamento do cliente validador Firedancer da Jump Crypto na mainnet da rede Solana.',
      affectedAssets: ['SOL'],
    },
    {
      id: 'cal_007',
      date: '2026-02-27',
      time: '08:30',
      title: 'US GDP Q4 Final',
      titlePt: 'PIB EUA Q4 Final',
      category: 'macro',
      impact: 'medium',
      description: 'Final revision of Q4 2025 US GDP. Expected 2.3% annualized.',
      descriptionPt: 'Revisao final do PIB dos EUA Q4 2025. Esperado 2,3% anualizado.',
      affectedAssets: ['BTC', 'ETH'],
    },
    {
      id: 'cal_008',
      date: '2026-02-27',
      time: '15:00',
      title: 'MicroStrategy Earnings Report',
      titlePt: 'Relatorio de Resultados MicroStrategy',
      category: 'earnings',
      impact: 'medium',
      description: 'MicroStrategy Q4 earnings with updated Bitcoin treasury holdings report.',
      descriptionPt: 'Resultados Q4 da MicroStrategy com relatorio atualizado de holdings de Bitcoin.',
      affectedAssets: ['BTC'],
    },
    {
      id: 'cal_009',
      date: '2026-02-28',
      time: '12:00',
      title: 'OP Token Unlock',
      titlePt: 'Desbloqueio de Token OP',
      category: 'token_unlock',
      impact: 'medium',
      description: '31.3M OP tokens ($62M) unlocking for core contributors and investors.',
      descriptionPt: '31,3M tokens OP ($62M) sendo desbloqueados para contribuidores e investidores.',
      affectedAssets: ['OP'],
    },
    {
      id: 'cal_010',
      date: '2026-03-01',
      time: '00:00',
      title: 'LayerZero ZRO Airdrop',
      titlePt: 'Airdrop LayerZero ZRO',
      category: 'airdrop',
      impact: 'low',
      description: 'Second phase of LayerZero ZRO token airdrop for protocol users.',
      descriptionPt: 'Segunda fase do airdrop de token ZRO da LayerZero para usuarios do protocolo.',
      affectedAssets: ['ZRO'],
    },
    {
      id: 'cal_011',
      date: '2026-03-02',
      time: '14:00',
      title: 'EU MiCA Enforcement Date',
      titlePt: 'Data de Aplicacao MiCA da UE',
      category: 'macro',
      impact: 'high',
      description: 'Full enforcement of EU Markets in Crypto-Assets regulation for all service providers.',
      descriptionPt: 'Aplicacao completa da regulacao MiCA da UE para todos os provedores de servicos.',
      affectedAssets: ['BTC', 'ETH', 'SOL', 'BNB', 'XRP'],
    },
    {
      id: 'cal_012',
      date: '2026-03-03',
      time: '10:00',
      title: 'ISM Manufacturing PMI',
      titlePt: 'PMI Manufatura ISM',
      category: 'macro',
      impact: 'medium',
      description: 'US manufacturing sector activity index. Key indicator of economic expansion or contraction.',
      descriptionPt: 'Indice de atividade do setor manufatureiro dos EUA. Indicador chave de expansao ou contracao economica.',
      affectedAssets: ['BTC', 'ETH'],
    },
    {
      id: 'cal_013',
      date: '2026-03-04',
      time: '12:00',
      title: 'Coinbase Earnings Q4',
      titlePt: 'Resultados Coinbase Q4',
      category: 'earnings',
      impact: 'medium',
      description: 'Coinbase Global Q4 earnings with trading volume and revenue insights.',
      descriptionPt: 'Resultados Q4 da Coinbase Global com insights de volume de trading e receita.',
      affectedAssets: ['BTC', 'ETH'],
    },
    {
      id: 'cal_014',
      date: '2026-03-05',
      time: '08:00',
      title: 'DYDX Token Unlock',
      titlePt: 'Desbloqueio de Token DYDX',
      category: 'token_unlock',
      impact: 'low',
      description: '15.2M DYDX tokens ($23M) unlocking for team vesting schedule.',
      descriptionPt: '15,2M tokens DYDX ($23M) sendo desbloqueados no cronograma de vesting da equipe.',
      affectedAssets: ['DYDX'],
    },
    {
      id: 'cal_015',
      date: '2026-03-06',
      time: '14:30',
      title: 'US Non-Farm Payrolls',
      titlePt: 'Folha de Pagamento Nao-Agricola EUA',
      category: 'macro',
      impact: 'high',
      description: 'Monthly US employment report. Major market-moving event for all risk assets.',
      descriptionPt: 'Relatorio mensal de emprego dos EUA. Evento major de movimentacao de mercado para todos os ativos de risco.',
      affectedAssets: ['BTC', 'ETH', 'SOL', 'XRP'],
    },
  ];
}

// ============================================================================
// SECTION: Phase 2 Helper Functions
// ============================================================================

export function getConvictionData(symbol: string): ConvictionData {
  const levels: ConvictionLevel[] = ['normal', 'strong', 'very_strong', 'stratospheric'];
  const hash = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const level = levels[hash % levels.length];

  const brainsAgreeing = {
    normal: 12,
    strong: 18,
    very_strong: 23,
    stratospheric: 28,
  }[level];

  const positionSizePercent = {
    normal: 5,
    strong: 8,
    very_strong: 12,
    stratospheric: 20,
  }[level];

  return {
    level,
    brainsAgreeing,
    totalBrains: 29,
    sentimentAligned: hash % 3 !== 0,
    monteCarloConfirms: hash % 4 !== 0,
    positionSizePercent,
  };
}

export function getGovernanceGates(tradeId: string): GovernanceGate[] {
  const gates = [
    { id: 'risk', name: 'Risk Check' },
    { id: 'confluence', name: 'Confluence Check' },
    { id: 'directives', name: 'Directives Check' },
    { id: 'sentiment', name: 'Sentiment Check' },
    { id: 'regime', name: 'Regime Check' },
  ];

  const hash = tradeId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  return gates.map((g, i) => ({
    id: g.id,
    name: g.name,
    status: ((hash + i) % 9 === 0 ? 'blocked' : 'passed') as GovernanceGateStatus,
    reason: (hash + i) % 9 === 0 ? 'Threshold não atingido' : undefined,
    checkedAt: new Date().toISOString(),
  }));
}

export function getInviolableDirectives(): InviolableDirective[] {
  return [
    {
      id: 'max-single-trade',
      name: 'Max Single Trade Risk',
      description: 'Risco máximo por operação individual',
      currentValue: 2.5,
      maxAllowed: 5,
      unit: '%',
      isViolated: false,
      canBeLoosened: false,
    },
    {
      id: 'max-exposure',
      name: 'Max Portfolio Exposure',
      description: 'Exposição máxima total do portfólio',
      currentValue: 65,
      maxAllowed: 80,
      unit: '%',
      isViolated: false,
      canBeLoosened: false,
    },
    {
      id: 'max-leverage',
      name: 'Max Leverage',
      description: 'Alavancagem máxima permitida',
      currentValue: 5,
      maxAllowed: 10,
      unit: 'x',
      isViolated: false,
      canBeLoosened: false,
    },
    {
      id: 'stop-loss',
      name: 'Stop Loss Obrigatório',
      description: 'Stop loss deve estar sempre ativo',
      currentValue: 1,
      maxAllowed: 1,
      unit: 'bool',
      isViolated: false,
      canBeLoosened: false,
    },
    {
      id: 'daily-loss',
      name: 'Daily Loss Limit',
      description: 'Limite máximo de perda diária',
      currentValue: -3.2,
      maxAllowed: -10,
      unit: '%',
      isViolated: false,
      canBeLoosened: false,
    },
    {
      id: 'drawdown-circuit',
      name: 'Drawdown Circuit Breaker',
      description: 'Circuit breaker de drawdown máximo',
      currentValue: -8.5,
      maxAllowed: -20,
      unit: '%',
      isViolated: false,
      canBeLoosened: false,
    },
  ];
}

// ============================================================================
// SECTION 10: ON-CHAIN ANALYTICS DATA
// ============================================================================

export interface OnChainNetworkMetric {
  label: string;
  value: string;
  change24h: number;
  description: string;
}

export interface OnChainWhaleTransaction {
  id: string;
  token: string;
  amount: number;
  amountUsd: number;
  from: string;
  to: string;
  type: 'exchange_inflow' | 'exchange_outflow' | 'whale_transfer';
  timestamp: string;
}

export interface OnChainExchangeFlow {
  label: string;
  inflow: number;
  outflow: number;
}

export interface OnChainDefiProtocol {
  name: string;
  tvl: number;
  change24h: number;
  category: string;
  apy: number;
}

export interface OnChainData {
  networkMetrics: OnChainNetworkMetric[];
  indicators: { mvrv: number; nvt: number; stablecoinSupply: number; ethGasGwei: number };
  exchangeFlows: OnChainExchangeFlow[];
  whaleTransactions: OnChainWhaleTransaction[];
  defiProtocols: OnChainDefiProtocol[];
}

export function getOnChainData(): OnChainData {
  return {
    networkMetrics: [
      { label: 'Active Addresses', value: '1,243,882', change24h: 3.2, description: 'Unique addresses active in last 24h' },
      { label: 'Transaction Count', value: '842,104', change24h: -1.8, description: 'On-chain transactions in 24h' },
      { label: 'Hash Rate (BTC)', value: '682.4 EH/s', change24h: 0.9, description: 'Bitcoin network hash rate' },
      { label: 'Total TVL (DeFi)', value: '$118.7B', change24h: 2.4, description: 'Total Value Locked in DeFi protocols' },
    ],
    indicators: {
      mvrv: 2.41,
      nvt: 68.5,
      stablecoinSupply: 168.4,
      ethGasGwei: 12.8,
    },
    exchangeFlows: [
      { label: 'Mon', inflow: 1820, outflow: 2140 },
      { label: 'Tue', inflow: 2450, outflow: 1980 },
      { label: 'Wed', inflow: 1650, outflow: 2380 },
      { label: 'Thu', inflow: 3200, outflow: 2100 },
      { label: 'Fri', inflow: 2100, outflow: 3450 },
      { label: 'Sat', inflow: 1420, outflow: 2680 },
      { label: 'Sun', inflow: 1980, outflow: 2350 },
    ],
    whaleTransactions: [
      { id: 'wt_001', token: 'BTC', amount: 1250.5, amountUsd: 130177250, from: '0x1a2b...8f9e', to: 'Binance Hot Wallet', type: 'exchange_inflow', timestamp: '2026-02-22T14:20:00Z' },
      { id: 'wt_002', token: 'ETH', amount: 15420.0, amountUsd: 59270400, from: 'Coinbase Custody', to: '0x3c4d...2a1b', type: 'exchange_outflow', timestamp: '2026-02-22T14:05:00Z' },
      { id: 'wt_003', token: 'BTC', amount: 820.0, amountUsd: 85328000, from: '0x5e6f...4c3d', to: '0x7a8b...6e5f', type: 'whale_transfer', timestamp: '2026-02-22T13:50:00Z' },
      { id: 'wt_004', token: 'SOL', amount: 285000.0, amountUsd: 54150000, from: '0x9c0d...8a7b', to: 'Kraken Deposit', type: 'exchange_inflow', timestamp: '2026-02-22T13:35:00Z' },
      { id: 'wt_005', token: 'ETH', amount: 8200.0, amountUsd: 31528000, from: 'OKX Withdrawal', to: '0xb2c3...0e9d', type: 'exchange_outflow', timestamp: '2026-02-22T13:15:00Z' },
      { id: 'wt_006', token: 'BTC', amount: 450.0, amountUsd: 46818000, from: '0xd4e5...2g1f', to: '0xf6a7...4i3h', type: 'whale_transfer', timestamp: '2026-02-22T12:55:00Z' },
      { id: 'wt_007', token: 'XRP', amount: 48000000, amountUsd: 115200000, from: 'Ripple Treasury', to: '0xe8a9...5j4i', type: 'exchange_inflow', timestamp: '2026-02-22T12:30:00Z' },
    ],
    defiProtocols: [
      { name: 'Lido', tvl: 38.2, change24h: 1.4, category: 'Liquid Staking', apy: 3.8 },
      { name: 'AAVE', tvl: 21.5, change24h: 2.1, category: 'Lending', apy: 5.2 },
      { name: 'Uniswap', tvl: 8.9, change24h: -0.8, category: 'DEX', apy: 12.4 },
      { name: 'MakerDAO', tvl: 7.4, change24h: 0.3, category: 'Stablecoin', apy: 6.8 },
      { name: 'Curve', tvl: 6.1, change24h: -1.2, category: 'DEX', apy: 8.1 },
      { name: 'EigenLayer', tvl: 18.3, change24h: 4.5, category: 'Restaking', apy: 4.2 },
    ],
  };
}

export function getShadowTrades(): ShadowTrade[] {
  const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ARB/USDT'];
  const strategies = [
    { id: 'strat-1', name: 'Quantum Momentum' },
    { id: 'strat-2', name: 'Neural Breakout' },
    { id: 'strat-3', name: 'Adaptive Mean Rev' },
  ];
  const categories: TradeCategory[] = ['scalp', 'swing', 'position'];

  return pairs.map((pair, i) => {
    const entry = 40000 + i * 3000 + Math.random() * 500;
    const current = entry * (1 + (Math.random() * 0.1 - 0.05));
    const pnl = current - entry;
    const pnlPct = (pnl / entry) * 100;
    const strategy = strategies[i % strategies.length];

    return {
      id: `shadow-${i}`,
      strategyId: strategy.id,
      strategyName: strategy.name,
      pair,
      direction: (i % 2 === 0 ? 'long' : 'short') as 'long' | 'short',
      entryPrice: parseFloat(entry.toFixed(2)),
      currentPrice: parseFloat(current.toFixed(2)),
      paperPnl: parseFloat(pnl.toFixed(2)),
      paperPnlPercent: parseFloat(pnlPct.toFixed(2)),
      isActive: true,
      openedAt: new Date(Date.now() - 1000 * 60 * 60 * (i + 1) * 3).toISOString(),
      category: categories[i % categories.length],
    };
  });
}
