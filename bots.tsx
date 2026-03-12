import { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Animated, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { usePlanTheme } from "@/lib/theme-context";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useLitePro } from "@/lib/lite-pro-context";
import { getBotData, formatCurrency, formatPercent, BotConfig } from "@/lib/market-data";
import { apiRequest } from "@/lib/query-client";
import TooltipBadge from "@/components/TooltipBadge";
import { 
  BRAIN_CATALOG, STRATEGY_DNA_CATALOG,
  getConfluenceAnalysis, getSentimentData, getRiskBudgetData,
  getExchangeConnections, getMonteCarloResults,
  type BrainConfig, type ConfluenceAnalysis, type SignalType, type BrainCategory
} from "@/lib/quantum-engine";

const C = Colors.dark;

const BRAIN_CATEGORY_COLORS: Record<BrainCategory, string> = {
  trend: '#00D4AA', momentum: '#7B61FF', volatility: '#FF5252',
  volume: '#F7931A', pattern: '#00D4E8', confluence: '#FFB74D', quantitative: '#E040FB',
};

interface AutonomousOperation {
  id: string;
  pair: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  leverage: string;
  exchange: string;
  pnl: number;
  pnlPercent: number;
  status: 'active' | 'closing' | 'pending';
  openTime: string;
  strategy: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  size: number;
}

interface SystemDecision {
  id: string;
  timestamp: string;
  pair: string;
  action: string;
  reason: string;
  indicators: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  outcome?: string;
}

const MOCK_OPERATIONS: AutonomousOperation[] = [
  { id: '1', pair: 'BTC/USDT', side: 'LONG', entryPrice: 103450, currentPrice: 104820, leverage: '5x', exchange: 'Binance', pnl: 1370, pnlPercent: 2.65, status: 'active', openTime: '14:32', strategy: 'Quantum Momentum', riskLevel: 'medium', confidence: 87, size: 0.5 },
  { id: '2', pair: 'ETH/USDT', side: 'SHORT', entryPrice: 3890, currentPrice: 3842, leverage: '3x', exchange: 'Bybit', pnl: 480, pnlPercent: 3.70, status: 'active', openTime: '11:18', strategy: 'Mean Reversion', riskLevel: 'low', confidence: 92, size: 8.2 },
  { id: '3', pair: 'SOL/USDT', side: 'LONG', entryPrice: 175.20, currentPrice: 178.90, leverage: '10x', exchange: 'Binance', pnl: 925, pnlPercent: 21.12, status: 'active', openTime: '09:45', strategy: 'Breakout Hunter', riskLevel: 'high', confidence: 78, size: 50 },
  { id: '4', pair: 'XRP/USDT', side: 'LONG', entryPrice: 2.42, currentPrice: 2.48, leverage: '7x', exchange: 'OKX', pnl: 252, pnlPercent: 17.36, status: 'active', openTime: '08:12', strategy: 'Trend Follower', riskLevel: 'medium', confidence: 84, size: 4200 },
];

const MOCK_DECISIONS: SystemDecision[] = [
  { id: '1', timestamp: '14:32:18', pair: 'BTC/USDT', action: 'LONG ENTRY', reason: 'RSI(14) crossed above 50 with MACD bullish crossover. Volume spike 2.3x above 20-period average. Order flow analysis shows heavy accumulation at $103,200-$103,500. Fibonacci 0.618 retracement level held as support.', indicators: ['RSI(14): 62.4', 'MACD: Bullish Cross', 'Volume: 2.3x Avg', 'BB: Upper Band Touch', 'EMA(20): Support'], sentiment: 'bullish', confidence: 87, outcome: 'P&L: +$1,370 (+2.65%)' },
  { id: '2', timestamp: '11:18:45', pair: 'ETH/USDT', action: 'SHORT ENTRY', reason: 'ETH/BTC ratio showing weakness. Price rejected at resistance $3,900 with bearish divergence on RSI. On-chain metrics show whale distributions. Funding rates elevated at 0.08% suggesting overleveraged longs.', indicators: ['RSI(14): 71.8 ↓', 'Funding: 0.08%', 'ETH/BTC: -1.2%', 'VWAP: Below', 'Stoch RSI: Overbought'], sentiment: 'bearish', confidence: 92, outcome: 'P&L: +$480 (+3.70%)' },
  { id: '3', timestamp: '09:45:02', pair: 'SOL/USDT', action: 'LONG ENTRY', reason: 'SOL breaking out of 4-hour ascending triangle pattern. Solana TVL increased 8% in 24h. Social sentiment extremely bullish with 85% positive mentions. Price above all major EMAs with increasing momentum.', indicators: ['Pattern: Ascending △', 'TVL: +8%', 'Social: 85% Bull', 'OBV: Rising', 'ATR: Expanding'], sentiment: 'bullish', confidence: 78, outcome: 'P&L: +$925 (+21.12%)' },
  { id: '4', timestamp: '08:12:33', pair: 'XRP/USDT', action: 'LONG ENTRY', reason: 'XRP showing strong trend continuation after SEC news. Accumulation/Distribution line rising. Cross-exchange order book depth shows significant buy walls at $2.40. Ichimoku cloud bullish with Tenkan > Kijun.', indicators: ['A/D Line: ↑', 'Ichimoku: Bullish', 'Order Book: Buy Wall', 'CMF: +0.24', 'SMA(200): Above'], sentiment: 'bullish', confidence: 84 },
];

const BOT_TEMPLATES = [
  { type: 'grid' as const, icon: 'grid-outline' as const, color: '#00D4AA', descKey: 'gridBotDesc' as const },
  { type: 'dca' as const, icon: 'trending-up' as const, color: '#7B61FF', descKey: 'dcaBotDesc' as const },
  { type: 'arbitrage' as const, icon: 'git-compare-outline' as const, color: '#F7931A', descKey: 'arbitrageDesc' as const },
  { type: 'martingale' as const, icon: 'layers-outline' as const, color: '#FF5252', descKey: 'martingaleDesc' as const },
];

function PulsingDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: anim }} />;
}

function BotStatusBadge({ status }: { status: BotConfig['status'] }) {
  const colors: Record<string, string> = { running: C.success, paused: C.warning, stopped: C.textTertiary, error: C.danger };
  const col = colors[status] || C.textTertiary;
  return (
    <View style={[s.botStatusBadge, { backgroundColor: `${col}15` }]}>
      {status === 'running' && <PulsingDot color={col} />}
      <Text style={[s.botStatusText, { color: col }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function BotCard({ bot, primary, t, onToggle }: { bot: BotConfig; primary: string; t: any; onToggle: (id: string, currentStatus: string) => void }) {
  const isProfit = bot.profit >= 0;
  const typeLabels: Record<string, string> = { grid: 'Grid', dca: 'DCA', arbitrage: 'Arbitrage', martingale: 'Martingale', custom: 'Custom' };
  return (
    <Pressable 
      style={s.botCard}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/bot/${bot.id}`);
      }}
    >
      <View style={s.botCardHeader}>
        <View style={s.botCardLeft}>
          <Text style={s.botCardName}>{bot.name}</Text>
          <View style={s.botCardMeta}>
            <View style={[s.typeBadge, { backgroundColor: `${primary}15` }]}>
              <Text style={[s.typeText, { color: primary }]}>{typeLabels[bot.type]}</Text>
            </View>
            <Text style={s.botCardPair}>{bot.pair}</Text>
            <Text style={s.botCardExchange}>{bot.exchange}</Text>
          </View>
        </View>
        <Pressable onPress={(e) => { e.stopPropagation(); onToggle(bot.id, bot.status); }}>
          <BotStatusBadge status={bot.status} />
        </Pressable>
      </View>
      <View style={s.botCardStats}>
        <View style={s.botStat}>
          <Text style={s.botStatLabel}>{t('totalProfit')}</Text>
          <Text style={[s.botStatValue, { color: isProfit ? C.success : C.danger }]}>
            {isProfit ? '+' : ''}{formatCurrency(bot.profit)}
          </Text>
        </View>
        <View style={s.botStat}>
          <Text style={s.botStatLabel}>ROI</Text>
          <Text style={[s.botStatValue, { color: isProfit ? C.success : C.danger }]}>
            {formatPercent(bot.profitPercent)}
          </Text>
        </View>
        <View style={s.botStat}>
          <Text style={s.botStatLabel}>{t('trades')}</Text>
          <Text style={s.botStatValue}>{bot.trades}</Text>
        </View>
        <View style={s.botStat}>
          <Text style={s.botStatLabel}>{t('runtime')}</Text>
          <Text style={s.botStatValue}>{bot.runtime}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function OperationCard({ op, primary, t }: { op: AutonomousOperation; primary: string; t: any }) {
  const isProfit = op.pnl >= 0;
  const riskColors: Record<string, string> = { low: C.success, medium: C.warning, high: C.danger };
  return (
    <View style={s.opCard}>
      <View style={s.opHeader}>
        <View style={s.opPairRow}>
          <Text style={s.opPair}>{op.pair}</Text>
          <View style={[s.sideBadge, { backgroundColor: op.side === 'LONG' ? C.successDim : C.dangerDim }]}>
            <Text style={[s.sideText, { color: op.side === 'LONG' ? C.success : C.danger }]}>{op.side}</Text>
          </View>
          <View style={[s.leverageBadge, { backgroundColor: `${primary}15` }]}>
            <Text style={[s.leverageText, { color: primary }]}>{op.leverage}</Text>
          </View>
        </View>
        <View style={[s.statusBadgeSmall, { backgroundColor: `${C.success}15` }]}>
          <PulsingDot color={C.success} />
          <Text style={[s.statusTextSmall, { color: C.success }]}>{op.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={s.opMetrics}>
        <View style={s.opMetricItem}>
          <Text style={s.opMetricLabel}>{t('entryPrice')}</Text>
          <Text style={s.opMetricValue}>{formatCurrency(op.entryPrice)}</Text>
        </View>
        <View style={s.opMetricItem}>
          <Text style={s.opMetricLabel}>{t('currentPriceLabel')}</Text>
          <Text style={s.opMetricValue}>{formatCurrency(op.currentPrice)}</Text>
        </View>
        <View style={s.opMetricItem}>
          <Text style={s.opMetricLabel}>{t('profitLoss')}</Text>
          <Text style={[s.opMetricValue, { color: isProfit ? C.success : C.danger }]}>
            {isProfit ? '+' : ''}{formatCurrency(op.pnl)} ({formatPercent(op.pnlPercent)})
          </Text>
        </View>
      </View>
      <View style={s.opDetailsRow}>
        <View style={s.opDetailChip}>
          <Ionicons name="business-outline" size={11} color={C.textTertiary} />
          <Text style={s.opDetailText}>{op.exchange}</Text>
        </View>
        <View style={s.opDetailChip}>
          <Ionicons name="flash-outline" size={11} color={C.textTertiary} />
          <Text style={s.opDetailText}>{op.strategy}</Text>
        </View>
        <View style={s.opDetailChip}>
          <Ionicons name="time-outline" size={11} color={C.textTertiary} />
          <Text style={s.opDetailText}>{op.openTime}</Text>
        </View>
      </View>
      <View style={s.opFooter}>
        <View style={s.confidenceBar}>
          <Text style={s.confidenceLabel}>{t('aiConfidence')}: {op.confidence}%</Text>
          <View style={s.confidenceTrack}>
            <View style={[s.confidenceFill, { width: `${op.confidence}%`, backgroundColor: primary }]} />
          </View>
        </View>
        <View style={[s.riskPill, { backgroundColor: `${riskColors[op.riskLevel]}15` }]}>
          <View style={[s.riskDot, { backgroundColor: riskColors[op.riskLevel] }]} />
          <Text style={[s.riskText, { color: riskColors[op.riskLevel] }]}>{t(op.riskLevel as any)}</Text>
        </View>
      </View>
    </View>
  );
}

function DecisionCard({ decision, primary, t }: { decision: SystemDecision; primary: string; t: any }) {
  const [expanded, setExpanded] = useState(false);
  const sentimentColors: Record<string, string> = { bullish: C.success, bearish: C.danger, neutral: C.warning };
  const sentimentColor = sentimentColors[decision.sentiment] || C.textTertiary;
  return (
    <Pressable style={s.decisionCard} onPress={() => { setExpanded(!expanded); Haptics.selectionAsync(); }} testID={`decision-card-${decision.id}`}>
      <View style={s.decisionHeader}>
        <View style={s.decisionTime}>
          <Ionicons name="time-outline" size={13} color={C.textTertiary} />
          <Text style={s.decisionTimestamp}>{decision.timestamp}</Text>
        </View>
        <View style={s.decisionPairAction}>
          <Text style={s.decisionPair}>{decision.pair}</Text>
          <View style={[s.actionBadge, { backgroundColor: `${primary}15` }]}>
            <Text style={[s.actionText, { color: primary }]}>{decision.action}</Text>
          </View>
        </View>
        <View style={s.decisionMeta}>
          <View style={[s.sentimentDot, { backgroundColor: sentimentColor }]} />
          <Text style={[s.sentimentLabelText, { color: sentimentColor }]}>{t(decision.sentiment as any)}</Text>
          <Text style={s.confidenceSmall}>{decision.confidence}%</Text>
        </View>
      </View>
      {expanded && (
        <View style={s.decisionExpanded}>
          <View style={s.decisionSection}>
            <Text style={s.decisionSectionTitle}><Ionicons name="bulb-outline" size={13} color={primary} /> {t('decisionReason')}</Text>
            <Text style={s.decisionReason}>{decision.reason}</Text>
          </View>
          <View style={s.decisionSection}>
            <Text style={s.decisionSectionTitle}><Ionicons name="analytics-outline" size={13} color={primary} /> {t('indicatorsUsed')}</Text>
            <View style={s.indicatorsList}>
              {decision.indicators.map((ind, i) => (
                <View key={i} style={[s.indicatorChip, { borderColor: `${primary}30` }]}>
                  <Text style={s.indicatorText}>{ind}</Text>
                </View>
              ))}
            </View>
          </View>
          {decision.outcome && (
            <View style={[s.outcomeBar, { borderLeftColor: primary }]}>
              <Ionicons name="checkmark-circle" size={15} color={C.success} />
              <Text style={s.outcomeText}>{decision.outcome}</Text>
            </View>
          )}
        </View>
      )}
      <View style={s.expandHint}>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={C.textTertiary} />
      </View>
    </Pressable>
  );
}

function SystemLogEntry({ time, msg, type }: { time: string; msg: string; type: 'info' | 'success' | 'warning' }) {
  const colors: Record<string, string> = { info: '#00D4E8', success: C.success, warning: C.warning };
  const icons: Record<string, string> = { info: 'information-circle', success: 'checkmark-circle', warning: 'alert-circle' };
  return (
    <View style={s.logEntry}>
      <Text style={s.logTime}>{time}</Text>
      <Ionicons name={icons[type] as any} size={13} color={colors[type]} />
      <Text style={[s.logMsg, { color: colors[type] }]}>{msg}</Text>
    </View>
  );
}

export default function BotsScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const { isLite, toggle: toggleMode } = useLitePro();
  const primary = planTheme.primary;
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [preflightVisible, setPreflightVisible] = useState(false);
  const [preflightData, setPreflightData] = useState<any>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [pendingBotActivation, setPendingBotActivation] = useState<string | null>(null);

  const [mainTab, setMainTab] = useState<'bots' | 'autonomous'>('bots');
  const [autoSubTab, setAutoSubTab] = useState<'operations' | 'decisions' | 'signals' | 'confluence'>('operations');

  const [apiBots, setApiBots] = useState<BotConfig[]>([]);
  const [apiOperations, setApiOperations] = useState<AutonomousOperation[]>(MOCK_OPERATIONS);
  const [loadingBots, setLoadingBots] = useState(true);

  const runPreflight = async (botId: string) => {
    setPendingBotActivation(botId);
    setPreflightLoading(true);
    setPreflightVisible(true);
    try {
      const res = await apiRequest("POST", "/api/bot-intelligence/preflight", { botId });
      const data = await res.json();
      setPreflightData(data);
    } catch (err) {
      console.error("Preflight failed", err);
      setPreflightData({
        expectedReturn: 0.05,
        riskScore: 45,
        confidence: 82,
        recommendation: "Condições de mercado favoráveis, mas com volatilidade moderada.",
        warnings: ["Alta volatilidade no par selecionado nas últimas 4 horas."]
      });
    } finally {
      setPreflightLoading(false);
    }
  };

  const confirmActivation = async () => {
    if (!pendingBotActivation) return;
    try {
      await apiRequest("POST", `/api/bots/${pendingBotActivation}/activate`);
      // Refresh bots list (simplified here, in real app would reuse load logic)
      const botsRes = await apiRequest("GET", "/api/bots").then(r => r.json());
      // ... update state
    } catch (err) {
      console.error("Activation failed", err);
    } finally {
      setPreflightVisible(false);
      setPendingBotActivation(null);
      setPreflightData(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [botsRes, dcaRes, gridRes] = await Promise.allSettled([
          apiRequest("GET", "/api/bots").then(r => r.json()),
          apiRequest("GET", "/api/dca").then(r => r.json()),
          apiRequest("GET", "/api/grid").then(r => r.json()),
        ]);
        const combined: BotConfig[] = [];
        const toBot = (item: any, type: string): BotConfig => ({
          id: item.id ?? item.gridId ?? item.dcaId ?? String(Math.random()),
          name: item.name ?? `${type.toUpperCase()} ${item.symbol ?? item.config?.symbol ?? ''}`,
          type: type as BotConfig['type'],
          exchange: item.exchange ?? item.config?.exchange ?? 'Binance',
          pair: item.symbol ?? item.config?.symbol ?? item.pair ?? 'BTC/USDT',
          status: (item.status === 'ACTIVE' || item.status === 'running') ? 'running'
            : (item.status === 'PAUSED' || item.status === 'paused') ? 'paused'
            : item.status === 'error' ? 'error' : 'stopped',
          profit: Number(item.pnl ?? item.realizedPnl ?? item.profit ?? 0),
          profitPercent: Number(item.pnlPercent ?? item.profitPercent ?? 0),
          trades: Number(item.trades ?? item.cyclesCompleted ?? 0),
          runtime: item.runtime ?? '—',
        });
        if (botsRes.status === 'fulfilled') {
          (Array.isArray(botsRes.value) ? botsRes.value : []).forEach((b: any) => combined.push(toBot(b, b.type ?? 'custom')));
        }
        if (dcaRes.status === 'fulfilled') {
          (Array.isArray(dcaRes.value) ? dcaRes.value : []).forEach((b: any) => combined.push(toBot(b, 'dca')));
        }
        if (gridRes.status === 'fulfilled') {
          (Array.isArray(gridRes.value) ? gridRes.value : []).forEach((b: any) => combined.push(toBot(b, 'grid')));
        }
        if (mounted) {
          if (combined.length > 0) setApiBots(combined);
          else setApiBots(getBotData());
          // map active bots to operations
          const ops: AutonomousOperation[] = combined
            .filter(b => b.status === 'running')
            .map((b, i) => ({
              id: b.id,
              pair: b.pair,
              side: 'LONG' as const,
              entryPrice: 0,
              currentPrice: 0,
              leverage: '1x',
              exchange: b.exchange,
              pnl: b.profit,
              pnlPercent: b.profitPercent,
              status: 'active' as const,
              openTime: '—',
              strategy: b.type,
              riskLevel: 'medium' as const,
              confidence: 80,
              size: 0,
            }));
          if (ops.length > 0) setApiOperations(ops);
        }
      } catch {
        if (mounted) setApiBots(getBotData());
      } finally {
        if (mounted) setLoadingBots(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const bots = apiBots;
  const activeBots = bots.filter(b => b.status === 'running');
  const totalBotProfit = bots.reduce((sum, b) => sum + b.profit, 0);
  const totalAutoPnl = apiOperations.reduce((sum, op) => sum + op.pnl, 0);
  const avgConfidence = apiOperations.length > 0
    ? Math.round(apiOperations.reduce((sum, op) => sum + op.confidence, 0) / apiOperations.length)
    : 0;

  const sentimentData = useMemo(() => getSentimentData(), []);
  const riskData = useMemo(() => getRiskBudgetData(), []);
  const confluenceData = useMemo(() => getConfluenceAnalysis('BTC'), []);
  const monteCarloResults = useMemo(() => getMonteCarloResults(), []);
  const btcMonteCarlo = monteCarloResults.find(r => r.symbol === 'BTC');

  const brainsByCategory = useMemo(() => {
    const grouped: Record<string, BrainConfig[]> = {};
    BRAIN_CATALOG.forEach(brain => {
      if (!grouped[brain.category]) grouped[brain.category] = [];
      grouped[brain.category].push(brain);
    });
    return grouped;
  }, []);

  const getBrainSignal = (brainId: string): SignalType => {
    const hash = brainId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const signals: SignalType[] = ['BUY', 'SELL', 'NEUTRAL_SIGNAL'];
    return signals[hash % 3];
  };

  const sentimentScores = useMemo(() => {
    const sources = sentimentData.sources;
    const avg = (sources.twitter + sources.reddit + sources.telegram + sources.news + sources.onChain) / 5;
    const bullish = Math.round(avg);
    const bearish = Math.round(100 - avg) > 30 ? 30 : Math.round(100 - avg);
    const neutral = 100 - bullish - bearish;
    return { bullish: Math.max(0, bullish), neutral: Math.max(0, neutral), bearish: Math.max(0, bearish) };
  }, [sentimentData]);

  const categoryLabelKey: Record<BrainCategory, string> = {
    trend: 'brainCategoryTrend', momentum: 'brainCategoryMomentum', volatility: 'brainCategoryVolatility',
    volume: 'brainCategoryVolume', pattern: 'brainCategoryPattern', confluence: 'brainCategoryConfluence', quantitative: 'brainCategoryQuantitative',
  };

  const userPlan = user?.plan || 'free';
  const hasBotAccess = userPlan !== 'free';

  return (
    <View style={[s.container, { paddingTop: insets.top + webTopInset }]}>
      <Modal
        visible={preflightVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreflightVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Análise Inteligente</Text>
            
            {preflightLoading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={primary} />
                <Text style={s.loadingText}>Consultando Redes Neurais...</Text>
              </View>
            ) : (
              <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={s.metricGrid}>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Retorno Est.</Text>
                    <Text style={[s.metricValue, { color: C.success }]}>{formatPercent(preflightData?.expectedReturn || 0)}</Text>
                  </View>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Risco</Text>
                    <Text style={[s.metricValue, { color: (preflightData?.riskScore || 0) > 70 ? C.danger : C.warning }]}>{preflightData?.riskScore}/100</Text>
                  </View>
                  <View style={s.metricBox}>
                    <Text style={s.metricLabel}>Confiança</Text>
                    <Text style={[s.metricValue, { color: primary }]}>{preflightData?.confidence}%</Text>
                  </View>
                </View>

                <Text style={s.recommendationTitle}>Recomendação do Sistema</Text>
                <Text style={s.recommendationText}>{preflightData?.recommendation}</Text>

                {preflightData?.warnings?.length > 0 && (
                  <View style={s.warningSection}>
                    <Text style={s.warningTitle}>Alertas de Risco</Text>
                    {preflightData.warnings.map((w: string, i: number) => (
                      <View key={i} style={s.warningItem}>
                        <Ionicons name="alert-circle" size={14} color={C.warning} />
                        <Text style={s.warningText}>{w}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            <View style={s.modalActions}>
              <Pressable 
                style={[s.modalBtn, { backgroundColor: C.surfaceLight }]} 
                onPress={() => setPreflightVisible(false)}
              >
                <Text style={s.modalBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable 
                style={[s.modalBtn, { backgroundColor: primary }]} 
                onPress={confirmActivation}
                disabled={preflightLoading}
              >
                <Text style={[s.modalBtnText, { color: '#000' }]}>Ativar Bot</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('botCenter')}</Text>
          <Text style={s.headerSubtitle}>{mainTab === 'bots' ? t('myBots') : t('quantumLab')}</Text>
        </View>
        <View style={s.modeIndicator}>
          <PulsingDot color={C.success} />
          <Text style={s.modeText}>{mainTab === 'bots' ? `${activeBots.length} ${t('running').toLowerCase()}` : t('autonomousMode')}</Text>
        </View>
        {mainTab === 'autonomous' && (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/strategy-builder'); }}
            style={[s.stratBuilderBtn, { borderColor: `${primary}40` }]}
          >
            <Ionicons name="construct-outline" size={20} color={primary} />
          </Pressable>
        )}
        <View style={s.headerTools}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); toggleMode(); }}
            style={[s.modeToggleBtn, { borderColor: primary + '55', backgroundColor: planTheme.primaryDim }]}
          >
            <Ionicons name={isLite ? "leaf-outline" : "rocket-outline"} size={13} color={primary} />
            <Text style={[s.modeToggleTxt, { color: primary }]}>{isLite ? t('liteMode') : t('proMode')}</Text>
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/execution-monitor'); }} style={[s.headerToolBtn, { borderColor: `${primary}30` }]}>
            <Ionicons name="list-outline" size={18} color={C.textSecondary} />
          </Pressable>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/trade-journal'); }} style={[s.headerToolBtn, { borderColor: `${primary}30` }]}>
            <Ionicons name="journal-outline" size={18} color={C.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={s.mainTabBar}>
        <Pressable
          style={[s.mainTabItem, mainTab === 'bots' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
          onPress={() => { setMainTab('bots'); Haptics.selectionAsync(); }}
        >
          <Ionicons name="hardware-chip-outline" size={16} color={mainTab === 'bots' ? primary : C.textTertiary} />
          <Text style={[s.mainTabText, mainTab === 'bots' && { color: primary }]}>{t('myBots')}</Text>
        </Pressable>
        {!isLite && (
          <Pressable
            style={[s.mainTabItem, mainTab === 'autonomous' && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => { setMainTab('autonomous'); Haptics.selectionAsync(); }}
          >
            <Ionicons name="flash-outline" size={16} color={mainTab === 'autonomous' ? primary : C.textTertiary} />
            <Text style={[s.mainTabText, mainTab === 'autonomous' && { color: primary }]}>{t('autonomousSection')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
        {mainTab === 'bots' && (
          <>
            <TooltipBadge screenKey="bots" message={t('tooltipBots')} />
            {!hasBotAccess && (
              <View style={[s.upgradeCard, { borderColor: `${primary}40` }]}>
                <Ionicons name="lock-closed" size={28} color={primary} />
                <Text style={s.upgradeTitle}>{t('upgradeToPro')}</Text>
                <Text style={s.upgradeDesc}>{t('unlockBots')}</Text>
                <Pressable style={[s.upgradeBtn, { backgroundColor: primary }]} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}>
                  <Text style={s.upgradeBtnText}>{t('upgrade')}</Text>
                </Pressable>
              </View>
            )}

            <View style={s.botSummaryRow}>
              <View style={[s.summaryCard, { borderColor: `${primary}30` }]}>
                <Text style={s.summaryLabel}>{t('activeBots')}</Text>
                <Text style={[s.summaryValue, { color: primary }]}>{activeBots.length}</Text>
              </View>
              <View style={[s.summaryCard, { borderColor: totalBotProfit >= 0 ? `${C.success}30` : `${C.danger}30` }]}>
                <Text style={s.summaryLabel}>{t('totalProfit')}</Text>
                <Text style={[s.summaryValue, { color: totalBotProfit >= 0 ? C.success : C.danger }]}>
                  {totalBotProfit >= 0 ? '+' : ''}{formatCurrency(totalBotProfit)}
                </Text>
              </View>
              <View style={[s.summaryCard, { borderColor: `${primary}30` }]}>
                <Text style={s.summaryLabel}>{t('trades')}</Text>
                <Text style={[s.summaryValue, { color: primary }]}>{bots.reduce((sum, b) => sum + b.trades, 0)}</Text>
              </View>
            </View>

            <View style={s.sectionHeader}>
              <Ionicons name="hardware-chip" size={18} color={primary} />
              <Text style={s.sectionTitle}>{t('myBots')}</Text>
            </View>
            {loadingBots ? (
              <ActivityIndicator color={primary} style={{ marginTop: 16 }} />
            ) : bots.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="hardware-chip-outline" size={40} color={C.textTertiary} />
                <Text style={s.emptyText}>{t('noBotsConfigured')}</Text>
                <Text style={s.emptySubtext}>{t('createFirstBot')}</Text>
              </View>
            ) : (
              <View style={s.botList}>
                {bots.map(bot => (
                  <BotCard 
                    key={bot.id} 
                    bot={bot} 
                    primary={primary} 
                    t={t} 
                    onToggle={(id, status) => {
                      if (status !== 'running') {
                        runPreflight(id);
                      } else {
                        apiRequest("POST", `/api/bots/${id}/pause`);
                      }
                    }} 
                  />
                ))}
              </View>
            )}

            <View style={s.sectionHeader}>
              <Ionicons name="apps-outline" size={18} color={primary} />
              <Text style={s.sectionTitle}>{t('templates')}</Text>
            </View>
            <View style={s.templatesGrid}>
              {BOT_TEMPLATES.map((tmpl) => (
                <Pressable key={tmpl.type} style={s.templateCard} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                  <View style={[s.templateIcon, { backgroundColor: `${tmpl.color}18` }]}>
                    <Ionicons name={tmpl.icon} size={24} color={tmpl.color} />
                  </View>
                  <Text style={s.templateName}>{tmpl.type === 'grid' ? t('gridBot') : tmpl.type === 'dca' ? t('dcaBot') : tmpl.type === 'arbitrage' ? t('arbitrage') : t('martingale')}</Text>
                  <Text style={s.templateDesc} numberOfLines={2}>{t(tmpl.descKey)}</Text>
                  <View style={[s.templateCreateBtn, { borderColor: `${tmpl.color}40` }]}>
                    <Ionicons name="add" size={14} color={tmpl.color} />
                    <Text style={[s.templateCreateText, { color: tmpl.color }]}>{t('create')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* ── 🧠 Bots IA Disruptiva ── */}
            <View style={s.sectionHeader}>
              <Ionicons name="flash" size={18} color={primary} />
              <Text style={s.sectionTitle}>🧠 Bots IA Disruptiva</Text>
            </View>
            <View style={s.iaDisruptivaScroll}>
              {[
                { label: "BIM", icon: "hardware-chip-outline" as const, route: "/bot-intelligence", color: "#00D4AA" },
                { label: "Grid Evol.", icon: "git-branch-outline" as const, route: "/grid-evolutivo", color: "#7B61FF" },
                { label: "DCA Intel.", icon: "trending-up-outline" as const, route: "/dca-inteligente", color: "#00B4D8" },
                { label: "Martingale+", icon: "dice-outline" as const, route: "/martingale-prob", color: "#FF5252" },
                { label: "Arb. Pred.", icon: "git-compare-outline" as const, route: "/arbitrage-predictive", color: "#F7931A" },
                { label: "Colaborativo", icon: "people-outline" as const, route: "/bot-collaborative", color: "#E040FB" },
                { label: "Hydra", icon: "layers-outline" as const, route: "/hydra-scanner", color: "#00D4AA" },
                { label: "Genetic Lab", icon: "git-network-outline" as const, route: "/genetic-lab", color: "#7B61FF" },
                { label: "Analog", icon: "git-compare-outline" as const, route: "/analog-engine", color: "#FFB74D" },
              ].map((item) => (
                <Pressable
                  key={item.route}
                  style={[s.iaDisruptivaCard, { borderColor: `${item.color}40` }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(item.route as any); }}
                >
                  <View style={[s.iaDisruptivaIcon, { backgroundColor: `${item.color}18` }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text style={[s.iaDisruptivaLabel, { color: item.color }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {mainTab === 'autonomous' && (
          <>
            <View style={s.autoStatsRow}>
              <View style={[s.summaryCard, { borderColor: `${primary}30` }]}>
                <Text style={s.summaryLabel}>{t('activeOperations')}</Text>
                <Text style={[s.summaryValue, { color: primary }]}>{apiOperations.filter(o => o.status === 'active').length}</Text>
              </View>
              <View style={[s.summaryCard, { borderColor: totalAutoPnl >= 0 ? `${C.success}30` : `${C.danger}30` }]}>
                <Text style={s.summaryLabel}>{t('profitLoss')}</Text>
                <Text style={[s.summaryValue, { color: totalAutoPnl >= 0 ? C.success : C.danger }]}>
                  {totalAutoPnl >= 0 ? '+' : ''}{formatCurrency(totalAutoPnl)}
                </Text>
              </View>
              <View style={[s.summaryCard, { borderColor: `${primary}30` }]}>
                <Text style={s.summaryLabel}>{t('aiConfidence')}</Text>
                <Text style={[s.summaryValue, { color: primary }]}>{avgConfidence}%</Text>
              </View>
            </View>

            <View style={s.sentimentOverview}>
              <View style={s.sentimentHeader}>
                <Ionicons name="pulse" size={17} color={primary} />
                <Text style={s.sentimentTitle}>{t('marketSentiment')}</Text>
              </View>
              <View style={s.fearGreedRow}>
                <Text style={s.fearGreedLabel}>{t('fearGreedIndex')}</Text>
                <View style={[s.fearGreedBadge, { backgroundColor: sentimentData.fearGreedIndex >= 50 ? `${C.success}20` : `${C.danger}20` }]}>
                  <Text style={[s.fearGreedValue, { color: sentimentData.fearGreedIndex >= 50 ? C.success : C.danger }]}>
                    {sentimentData.fearGreedIndex} - {sentimentData.fearGreedLabel}
                  </Text>
                </View>
              </View>
              <View style={s.sentimentBarContainer}>
                <View style={[s.sentimentSegment, { flex: sentimentScores.bullish, backgroundColor: C.success }]} />
                <View style={[s.sentimentSegment, { flex: sentimentScores.neutral, backgroundColor: C.warning }]} />
                <View style={[s.sentimentSegment, { flex: sentimentScores.bearish, backgroundColor: C.danger }]} />
              </View>
              <View style={s.sentimentLabels}>
                <Text style={[s.sentimentLabel, { color: C.success }]}>{t('bullish')} {sentimentScores.bullish}%</Text>
                <Text style={[s.sentimentLabel, { color: C.warning }]}>{t('neutral')} {sentimentScores.neutral}%</Text>
                <Text style={[s.sentimentLabel, { color: C.danger }]}>{t('bearish')} {sentimentScores.bearish}%</Text>
              </View>
            </View>

            <View style={s.riskOverviewCard}>
              <View style={s.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={17} color={primary} />
                <Text style={s.sectionTitle}>{t('riskOverview')}</Text>
              </View>
              <View style={s.riskOverviewContent}>
                <View style={[s.riskScoreBadge, { borderColor: riskData.riskScore < 40 ? C.success : riskData.riskScore < 70 ? C.warning : C.danger }]}>
                  <Text style={[s.riskScoreNumber, { color: riskData.riskScore < 40 ? C.success : riskData.riskScore < 70 ? C.warning : C.danger }]}>{riskData.riskScore}</Text>
                  <Text style={s.riskScoreLabel}>{t('riskScore')}</Text>
                </View>
                <View style={s.riskMetrics}>
                  <View style={s.riskMetricRow}>
                    <Text style={s.riskMetricLabel}>{t('currentExposure')}</Text>
                    <Text style={s.riskMetricValue}>{riskData.currentExposure}%</Text>
                  </View>
                  <View style={s.riskMetricRow}>
                    <Text style={s.riskMetricLabel}>{t('maxExposure')}</Text>
                    <Text style={s.riskMetricValue}>{riskData.maxExposurePct}%</Text>
                  </View>
                  <View style={s.riskMetricRow}>
                    <Text style={s.riskMetricLabel}>{t('marginAvailable')}</Text>
                    <Text style={[s.riskMetricValue, { color: C.success }]}>{formatCurrency(riskData.marginAvailable)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {btcMonteCarlo && (
              <View style={s.monteCarloCard}>
                <View style={s.sectionHeader}>
                  <Ionicons name="dice-outline" size={17} color={primary} />
                  <Text style={s.sectionTitle}>{t('monteCarloPrediction')} (BTC)</Text>
                </View>
                <View style={s.monteCarloGrid}>
                  <View style={s.monteCarloItem}>
                    <Text style={s.monteCarloLabel}>{t('probabilityUp')}</Text>
                    <Text style={[s.monteCarloValue, { color: C.success }]}>{(btcMonteCarlo.probUp * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={s.monteCarloItem}>
                    <Text style={s.monteCarloLabel}>{t('probabilityDown')}</Text>
                    <Text style={[s.monteCarloValue, { color: C.danger }]}>{(btcMonteCarlo.probDown * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={s.monteCarloItem}>
                    <Text style={s.monteCarloLabel}>{t('medianTarget')}</Text>
                    <Text style={[s.monteCarloValue, { color: primary }]}>{formatCurrency(btcMonteCarlo.medianPrice)}</Text>
                  </View>
                  <View style={s.monteCarloItem}>
                    <Text style={s.monteCarloLabel}>{t('priceRange')}</Text>
                    <Text style={s.monteCarloValue}>{formatCurrency(btcMonteCarlo.percentile5)} - {formatCurrency(btcMonteCarlo.percentile95)}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={[s.labHeader, { borderColor: `${primary}30` }]}>
              <View style={s.labHeaderLeft}>
                <Ionicons name="flask-outline" size={20} color={primary} />
                <View>
                  <Text style={[s.labTitle, { color: primary }]}>{t('quantumLab')}</Text>
                  <Text style={s.labSubtitle}>{t('autonomousMode')}</Text>
                </View>
              </View>
              <View style={[s.labActiveBadge, { backgroundColor: `${C.success}15` }]}>
                <PulsingDot color={C.success} />
                <Text style={[s.labActiveText, { color: C.success }]}>LIVE</Text>
              </View>
            </View>

            <View style={s.autoSubTabBar}>
              {([
                { key: 'operations' as const, label: t('activeOperations'), icon: 'pulse-outline' as const },
                { key: 'decisions' as const, label: t('systemDecisions'), icon: 'bulb-outline' as const },
                { key: 'signals' as const, label: t('marketSentiment'), icon: 'analytics-outline' as const },
                { key: 'confluence' as const, label: t('confluenceTab'), icon: 'git-network-outline' as const },
              ]).map((tab) => (
                <Pressable
                  key={tab.key}
                  style={[s.autoSubTabItem, autoSubTab === tab.key && { borderBottomColor: primary, borderBottomWidth: 2 }]}
                  onPress={() => { setAutoSubTab(tab.key); Haptics.selectionAsync(); }}
                >
                  <Ionicons name={tab.icon} size={15} color={autoSubTab === tab.key ? primary : C.textTertiary} />
                  <Text style={[s.autoSubTabText, autoSubTab === tab.key && { color: primary }]}>{tab.label}</Text>
                </Pressable>
              ))}
            </View>

            {autoSubTab === 'operations' && (
              <View style={s.sectionContent}>
                {loadingBots ? (
                  <ActivityIndicator color={primary} style={{ marginTop: 24 }} />
                ) : apiOperations.length === 0 ? (
                  <View style={s.emptyState}>
                    <Ionicons name="pulse-outline" size={36} color={C.textTertiary} />
                    <Text style={s.emptyText}>Nenhum dado disponível</Text>
                  </View>
                ) : (
                  apiOperations.map(op => <OperationCard key={op.id} op={op} primary={primary} t={t} />)
                )}
              </View>
            )}

            {autoSubTab === 'decisions' && (
              <View style={s.sectionContent}>
                {MOCK_DECISIONS.map(d => <DecisionCard key={d.id} decision={d} primary={primary} t={t} />)}
              </View>
            )}

            {autoSubTab === 'signals' && (
              <View style={s.sectionContent}>
                {Object.entries(brainsByCategory).map(([category, brains]) => {
                  const catColor = BRAIN_CATEGORY_COLORS[category as BrainCategory];
                  return (
                    <View key={category} style={s.brainCategorySection}>
                      <View style={s.brainCategoryHeader}>
                        <View style={[s.brainCategoryDot, { backgroundColor: catColor }]} />
                        <Text style={[s.brainCategoryTitle, { color: catColor }]}>{t(categoryLabelKey[category as BrainCategory] as any)}</Text>
                        <Text style={s.brainCategoryCount}>{brains.length}</Text>
                      </View>
                      <View style={s.brainGrid}>
                        {brains.map(brain => {
                          const signal = getBrainSignal(brain.id);
                          const sigColor = signal === 'BUY' ? C.success : signal === 'SELL' ? C.danger : C.warning;
                          return (
                            <View key={brain.id} style={s.brainCard}>
                              <View style={s.brainCardTop}>
                                <View style={[s.brainIconWrap, { backgroundColor: `${catColor}18` }]}>
                                  <Ionicons name={brain.icon as any} size={18} color={catColor} />
                                </View>
                                <View style={[s.signalDot, { backgroundColor: sigColor }]} />
                              </View>
                              <Text style={s.brainCardName} numberOfLines={1}>{brain.name}</Text>
                              <View style={s.brainCardFooter}>
                                <Text style={[s.brainSignalText, { color: sigColor }]}>{signal.replace('_SIGNAL', '')}</Text>
                                <Text style={s.brainConfText}>{brain.confidence}%</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {autoSubTab === 'confluence' && (
              <View style={s.sectionContent}>
                <View style={s.confluenceHeader}>
                  <View style={s.confluenceRegimeRow}>
                    <Text style={s.confluenceLabel}>{t('marketRegimeLabel')}</Text>
                    <View style={[s.regimeBadge, { backgroundColor: `${primary}15` }]}>
                      <Text style={[s.regimeText, { color: primary }]}>{confluenceData.marketRegime.replace(/_/g, ' ')}</Text>
                    </View>
                  </View>
                  <View style={s.consciousnessRow}>
                    <Text style={s.confluenceLabel}>{t('consciousnessLevel')}</Text>
                    <View style={s.consciousnessTrack}>
                      <View style={[s.consciousnessFill, { width: `${confluenceData.consciousnessLevel * 100}%`, backgroundColor: primary }]} />
                    </View>
                    <Text style={[s.consciousnessValue, { color: primary }]}>{(confluenceData.consciousnessLevel * 100).toFixed(0)}%</Text>
                  </View>
                </View>

                <View style={s.confluenceCard}>
                  <View style={s.sectionHeader}>
                    <Ionicons name="git-network-outline" size={16} color={primary} />
                    <Text style={s.sectionTitle}>{t('activeBrainsCount')} ({confluenceData.activeBrains.length})</Text>
                  </View>
                  {confluenceData.activeBrains.map((ab) => {
                    const sigColor = ab.signal === 'BUY' ? C.success : ab.signal === 'SELL' ? C.danger : C.warning;
                    const catColor = BRAIN_CATEGORY_COLORS[ab.category];
                    return (
                      <View key={ab.brainId} style={s.confluenceBrainRow}>
                        <View style={[s.confluenceBrainDot, { backgroundColor: catColor }]} />
                        <Text style={s.confluenceBrainName}>{ab.brainName}</Text>
                        <Text style={[s.confluenceBrainSignal, { color: sigColor }]}>{ab.signal.replace('_SIGNAL', '')}</Text>
                        <Text style={s.confluenceBrainConf}>{ab.confidence}%</Text>
                      </View>
                    );
                  })}
                </View>

                {confluenceData.synergies.length > 0 && (
                  <View style={s.confluenceCard}>
                    <View style={s.sectionHeader}>
                      <Ionicons name="link-outline" size={16} color={C.success} />
                      <Text style={[s.sectionTitle, { color: C.success }]}>{t('synergiesDetected')} ({confluenceData.synergies.length})</Text>
                    </View>
                    {confluenceData.synergies.map((syn, i) => (
                      <View key={i} style={s.synergyRow}>
                        <Text style={s.synergyBrains}>{syn.brain1} + {syn.brain2}</Text>
                        <Text style={[s.synergyBonus, { color: C.success }]}>+{syn.bonus}%</Text>
                      </View>
                    ))}
                  </View>
                )}

                {confluenceData.conflicts.length > 0 && (
                  <View style={s.confluenceCard}>
                    <View style={s.sectionHeader}>
                      <Ionicons name="warning-outline" size={16} color={C.danger} />
                      <Text style={[s.sectionTitle, { color: C.danger }]}>{t('conflictsDetected')} ({confluenceData.conflicts.length})</Text>
                    </View>
                    {confluenceData.conflicts.map((con, i) => (
                      <View key={i} style={s.synergyRow}>
                        <Text style={s.synergyBrains}>{con.brain1} vs {con.brain2}</Text>
                        <Text style={[s.synergyBonus, { color: C.danger }]}>-{con.penalty}%</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={s.confluenceScoreCard}>
                  <View style={s.confluenceScoreRow}>
                    <Text style={s.confluenceScoreLabel}>{t('confluenceScore')}</Text>
                    <Text style={[s.confluenceScoreValue, { color: primary }]}>{confluenceData.finalScore.toFixed(1)}</Text>
                  </View>
                  <View style={s.confluenceScoreRow}>
                    <Text style={s.confluenceScoreLabel}>{t('finalSignal')}</Text>
                    <View style={[s.finalSignalBadge, { backgroundColor: confluenceData.finalSignal === 'BUY' ? `${C.success}20` : confluenceData.finalSignal === 'SELL' ? `${C.danger}20` : `${C.warning}20` }]}>
                      <Text style={[s.finalSignalText, { color: confluenceData.finalSignal === 'BUY' ? C.success : confluenceData.finalSignal === 'SELL' ? C.danger : C.warning }]}>
                        {confluenceData.finalSignal.replace('_SIGNAL', '')}
                      </Text>
                    </View>
                  </View>
                  <View style={s.confluenceScoreRow}>
                    <Text style={s.confluenceScoreLabel}>{t('adjustedThreshold')}</Text>
                    <Text style={s.confluenceThresholdValue}>{confluenceData.adjustedThreshold}%</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={s.systemLogSection}>
              <View style={s.sectionHeader}>
                <Ionicons name="terminal-outline" size={17} color={primary} />
                <Text style={s.sectionTitle}>{t('systemLog')}</Text>
              </View>
              <View style={s.logContainer}>
                <SystemLogEntry time="14:32:18" msg="BTC/USDT LONG @ $103,450 | 5x | Binance" type="success" />
                <SystemLogEntry time="14:30:05" msg="Quantum Momentum breakout signal detected" type="info" />
                <SystemLogEntry time="14:28:12" msg="RSI(14) > 50, MACD bullish cross confirmed" type="info" />
                <SystemLogEntry time="11:18:45" msg="ETH/USDT SHORT @ $3,890 | 3x | Bybit" type="success" />
                <SystemLogEntry time="11:15:22" msg="ETH/BTC weakness, funding rate elevated" type="warning" />
                <SystemLogEntry time="09:45:02" msg="SOL/USDT LONG @ $175.20 | 10x | Binance" type="success" />
                <SystemLogEntry time="09:40:18" msg="Ascending triangle breakout SOL 4H" type="info" />
                <SystemLogEntry time="08:12:33" msg="XRP/USDT LONG @ $2.42 | 7x | OKX" type="success" />
                <SystemLogEntry time="08:05:10" msg="XRP buy walls detected cross-exchange" type="info" />
                <SystemLogEntry time="07:00:00" msg="Quantum Engine v3.2.1 initialized" type="info" />
              </View>
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  headerSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, marginTop: 2 },
  modeIndicator: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.successDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  modeText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.success },
  stratBuilderBtn: { padding: 8, borderRadius: 10, borderWidth: 1 },
  headerTools: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  headerToolBtn: { padding: 8, borderRadius: 10, borderWidth: 1 },
  modeToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, borderWidth: 1 },
  modeToggleTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  mainTabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, marginHorizontal: 20 },
  mainTabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  mainTabText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textTertiary },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  upgradeCard: { backgroundColor: C.surface, borderRadius: 16, padding: 24, alignItems: "center", gap: 10, borderWidth: 1 },
  upgradeTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  upgradeDesc: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center" },
  upgradeBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  upgradeBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#0A0E17" },
  botSummaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 12, borderWidth: 1, alignItems: "center", gap: 4 },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 30 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.textSecondary },
  emptySubtext: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary, textAlign: "center" },
  botList: { gap: 12 },
  botCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border },
  botCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  botCardLeft: { flex: 1, gap: 6 },
  botCardName: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  botCardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  botCardPair: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  botCardExchange: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  botStatusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  botStatusText: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.5 },
  botCardStats: { flexDirection: "row", justifyContent: "space-between" },
  botStat: { gap: 2 },
  botStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  botStatValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  iaDisruptivaScroll: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iaDisruptivaCard: { width: "30%", flexGrow: 1, flexBasis: "28%", backgroundColor: C.surface, borderRadius: 14, padding: 12, alignItems: "center", gap: 8, borderWidth: 1 },
  iaDisruptivaIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  iaDisruptivaLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, textAlign: "center" },
  templatesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  templateCard: { width: "48%", flexGrow: 1, flexBasis: "45%", backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: C.border, alignItems: "center" },
  templateIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  templateName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  templateDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary, textAlign: "center" },
  templateCreateBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  templateCreateText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  autoStatsRow: { flexDirection: "row", gap: 8 },
  sentimentOverview: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 10 },
  sentimentHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sentimentTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text },
  sentimentBarContainer: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 },
  sentimentSegment: { borderRadius: 4 },
  sentimentLabels: { flexDirection: "row", justifyContent: "space-between" },
  sentimentLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  labHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1 },
  labHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  labTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  labSubtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  labActiveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  labActiveText: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1 },
  autoSubTabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border },
  autoSubTabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  autoSubTabText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textTertiary },
  sectionContent: { gap: 12 },
  opCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: C.border },
  opHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  opPairRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  opPair: { fontFamily: "Inter_700Bold", fontSize: 17, color: C.text },
  sideBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sideText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  leverageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  leverageText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  statusBadgeSmall: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTextSmall: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.5 },
  opMetrics: { flexDirection: "row", justifyContent: "space-between" },
  opMetricItem: { gap: 2 },
  opMetricLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  opMetricValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  opDetailsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opDetailChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.card, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  opDetailText: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary },
  opFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confidenceBar: { flex: 1, gap: 4, marginRight: 12 },
  confidenceLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  confidenceTrack: { height: 4, backgroundColor: C.card, borderRadius: 2, overflow: "hidden" },
  confidenceFill: { height: "100%", borderRadius: 2 },
  riskPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  decisionCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  decisionHeader: { gap: 8 },
  decisionTime: { flexDirection: "row", alignItems: "center", gap: 6 },
  decisionTimestamp: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  decisionPairAction: { flexDirection: "row", alignItems: "center", gap: 10 },
  decisionPair: { fontFamily: "Inter_700Bold", fontSize: 17, color: C.text },
  actionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  decisionMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  sentimentDot: { width: 8, height: 8, borderRadius: 4 },
  sentimentLabelText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  confidenceSmall: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  decisionExpanded: { marginTop: 14, gap: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14 },
  decisionSection: { gap: 8 },
  decisionSectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  decisionReason: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  indicatorsList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  indicatorChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.card, borderWidth: 1 },
  indicatorText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.text },
  outcomeBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, padding: 12, borderRadius: 10, borderLeftWidth: 3 },
  outcomeText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.success },
  expandHint: { alignItems: "center", marginTop: 4 },
  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signalItem: { width: "48%", flexGrow: 1, flexBasis: "45%", backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border, gap: 4 },
  signalName: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  signalValue: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  signalDot: { width: 6, height: 6, borderRadius: 3, position: "absolute", top: 14, right: 14 },
  systemLogSection: { gap: 12 },
  logContainer: { backgroundColor: "#0A0E17", borderRadius: 14, padding: 14, gap: 6, borderWidth: 1, borderColor: "#1A2035" },
  logEntry: { flexDirection: "row", alignItems: "center", gap: 8 },
  logTime: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textTertiary, width: 54 },
  logMsg: { fontFamily: "Inter_400Regular", fontSize: 11, flex: 1 },
  fearGreedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fearGreedLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  fearGreedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  fearGreedValue: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  riskOverviewCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 },
  riskOverviewContent: { flexDirection: "row", alignItems: "center", gap: 16 },
  riskScoreBadge: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  riskScoreNumber: { fontFamily: "Inter_700Bold", fontSize: 22 },
  riskScoreLabel: { fontFamily: "Inter_400Regular", fontSize: 9, color: C.textTertiary },
  riskMetrics: { flex: 1, gap: 6 },
  riskMetricRow: { flexDirection: "row", justifyContent: "space-between" },
  riskMetricLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  riskMetricValue: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.text },
  monteCarloCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 },
  monteCarloGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monteCarloItem: { width: "48%" as any, flexGrow: 1, flexBasis: "45%" as any, gap: 2 },
  monteCarloLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textTertiary },
  monteCarloValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  brainCategorySection: { gap: 8 },
  brainCategoryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  brainCategoryDot: { width: 8, height: 8, borderRadius: 4 },
  brainCategoryTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  brainCategoryCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textTertiary },
  brainGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  brainCard: { width: "31%" as any, flexGrow: 1, flexBasis: "29%" as any, backgroundColor: C.surface, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border, gap: 6 },
  brainCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brainIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  brainCardName: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.text },
  brainCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brainSignalText: { fontFamily: "Inter_700Bold", fontSize: 9 },
  brainConfText: { fontFamily: "Inter_500Medium", fontSize: 9, color: C.textTertiary },
  confluenceHeader: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 12 },
  confluenceRegimeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confluenceLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textTertiary },
  regimeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  regimeText: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.5 },
  consciousnessRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  consciousnessTrack: { flex: 1, height: 6, backgroundColor: C.card, borderRadius: 3, overflow: "hidden" },
  consciousnessFill: { height: "100%", borderRadius: 3 },
  consciousnessValue: { fontFamily: "Inter_600SemiBold", fontSize: 12, width: 36, textAlign: "right" as const },
  confluenceCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 10 },
  confluenceBrainRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  confluenceBrainDot: { width: 6, height: 6, borderRadius: 3 },
  confluenceBrainName: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text, flex: 1 },
  confluenceBrainSignal: { fontFamily: "Inter_700Bold", fontSize: 11 },
  confluenceBrainConf: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textTertiary, width: 32, textAlign: "right" as const },
  synergyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  synergyBrains: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 },
  synergyBonus: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  confluenceScoreCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, gap: 10 },
  confluenceScoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confluenceScoreLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textTertiary },
  confluenceScoreValue: { fontFamily: "Inter_700Bold", fontSize: 20 },
  finalSignalBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  finalSignalText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  confluenceThresholdValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: C.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.border, maxHeight: '80%' },
  modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: C.text, marginBottom: 20, textAlign: 'center' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', gap: 16 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: C.textTertiary },
  modalScroll: { marginBottom: 20 },
  metricGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  metricBox: { flex: 1, backgroundColor: C.card, padding: 12, borderRadius: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border },
  metricLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: C.textTertiary, textAlign: 'center' },
  metricValue: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  recommendationTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.text, marginBottom: 8 },
  recommendationText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: C.textSecondary, lineHeight: 20, marginBottom: 20 },
  warningSection: { gap: 10 },
  warningTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: C.warning },
  warningItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${C.warning}10`, padding: 10, borderRadius: 10 },
  warningText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textSecondary, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: C.text },
});
