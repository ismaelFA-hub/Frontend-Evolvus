import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18n } from '@/lib/i18n-context';
import { usePlanTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
import { useWsPrices } from '@/lib/use-ws-prices';
import { ALL_EXCHANGES, getExchangeFavicon } from '@/lib/exchanges';

const C = Colors.dark;
const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_H * 0.85, 680);

const ALL_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
  'ADA/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT', 'DOT/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'FIL/USDT',
  'APT/USDT', 'ARB/USDT', 'OP/USDT', 'INJ/USDT', 'TIA/USDT',
  'SUI/USDT', 'SEI/USDT', 'WLD/USDT', 'NEAR/USDT', 'ICP/USDT',
];

const EXCHANGE_OFFSETS: Record<string, number> = {
  binance: 0.0000, bybit: 0.0012, okx: -0.0008, coinbase: 0.0018,
  kraken: 0.0005, kucoin: -0.0015, gateio: 0.0009, mexc: -0.0003,
  htx: 0.0007, bitget: -0.0010, phemex: 0.0014, bingx: -0.0006,
};

const EXCHANGES = ALL_EXCHANGES.map((ex, i) => ({
  ...ex,
  offset: EXCHANGE_OFFSETS[ex.id] ?? (i % 2 === 0 ? 1 : -1) * 0.0004 * ((i % 5) + 1),
}));

const PRESETS = [25, 50, 75, 100];

const RECENT_TRADES = [
  { id: '1', pair: 'BTC/USDT', side: 'Buy' as const, amount: '0.012', price: '97,420', time: '2m ago' },
  { id: '2', pair: 'ETH/USDT', side: 'Sell' as const, amount: '0.45', price: '3,680', time: '18m ago' },
  { id: '3', pair: 'SOL/USDT', side: 'Buy' as const, amount: '3.2', price: '183.40', time: '1h ago' },
  { id: '4', pair: 'BNB/USDT', side: 'Sell' as const, amount: '1.8', price: '624.80', time: '3h ago' },
  { id: '5', pair: 'ADA/USDT', side: 'Buy' as const, amount: '120', price: '1.05', time: '5h ago' },
];

function getPairSymbol(pair: string): string {
  return pair.split('/')[0].toUpperCase();
}

function formatPrice(price: number | undefined): string {
  if (!price) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export interface QuickTradeWidgetRef {
  open: () => void;
  close: () => void;
}

const QuickTradeWidget = forwardRef<QuickTradeWidgetRef>((_, ref) => {
  const { t } = useI18n();
  const { planTheme } = usePlanTheme();
  const { user } = useAuth();
  const plan = (user?.plan ?? 'free') as string;

  const { prices, subscribe } = useWsPrices();

  const [visible, setVisible] = useState(false);
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [side, setSide] = useState<'Buy' | 'Sell'>('Buy');
  const [orderType, setOrderType] = useState<'Market' | 'Limit'>('Market');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('binance');
  const [confirmed, setConfirmed] = useState(false);
  const [pairSearch, setPairSearch] = useState('');

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      subscribe(ALL_PAIRS.map(getPairSymbol));
    }
  }, [visible]);

  const getPrice = useCallback((pair: string, exchangeId: string): number | undefined => {
    const sym = getPairSymbol(pair);
    const base = prices[sym]?.price;
    if (!base) return undefined;
    const ex = EXCHANGES.find(e => e.id === exchangeId);
    const offset = ex?.offset ?? 0;
    return base * (1 + offset);
  }, [prices]);

  const currentPrice = useMemo(() => getPrice(selectedPair, selectedExchange), [getPrice, selectedPair, selectedExchange]);

  const filteredPairs = useMemo(() => {
    if (!pairSearch.trim()) return ALL_PAIRS;
    const q = pairSearch.trim().toUpperCase();
    return ALL_PAIRS.filter(p => p.includes(q));
  }, [pairSearch]);

  const open = useCallback(() => {
    setVisible(true);
    setConfirmed(false);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = useCallback(() => {
    Haptics.selectionAsync();
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 280, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, []);

  useImperativeHandle(ref, () => ({ open, close }));

  const canUseLimit = plan !== 'free';
  const canAiSuggestion = plan === 'premium' || plan === 'enterprise';
  const canBatch = plan === 'enterprise';

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirmed(true);
    setTimeout(() => {
      setConfirmed(false);
      setAmount('');
      setLimitPrice('');
    }, 1500);
  }, []);

  const handlePreset = useCallback((pct: number) => {
    Haptics.selectionAsync();
    setAmount((pct / 100 * 1000).toFixed(2));
  }, []);

  const availableBalance = useMemo(() => '1,000.00 USDT', []);

  if (!visible) return null;

  const selectedExchangeData = EXCHANGES.find(e => e.id === selectedExchange);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: C.border }]} />
          </View>

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t('quickTradeTitle')}</Text>
              <Text style={styles.sheetSub}>{availableBalance} {t('availableBalance')}</Text>
            </View>
            <View style={styles.headerRight}>
              {currentPrice !== undefined && (
                <View style={styles.livePrice}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePriceText}>${formatPrice(currentPrice)}</Text>
                </View>
              )}
              <Pressable onPress={close} style={styles.closeBtn} testID="quick-trade-close">
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Exchange Selector */}
            <Text style={styles.sectionLabel}>{t('selectExchange')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pairScroll}>
              {EXCHANGES.map((ex) => (
                <Pressable
                  key={ex.id}
                  style={[
                    styles.exChip,
                    selectedExchange === ex.id && { backgroundColor: ex.color + '22', borderColor: ex.color + '66' },
                  ]}
                  onPress={() => { setSelectedExchange(ex.id); Haptics.selectionAsync(); }}
                >
                  <Image
                    source={{ uri: getExchangeFavicon(ex.domain, 32) }}
                    style={styles.exLogo}
                    defaultSource={{ uri: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='10' fill='${encodeURIComponent(ex.color)}'/></svg>` }}
                  />
                  <Text style={[styles.pairChipText, selectedExchange === ex.id && { color: ex.color }]}>{ex.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Pair Search + Selector */}
            <Text style={styles.sectionLabel}>{t('selectPair')}</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={15} color={C.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={pairSearch}
                onChangeText={setPairSearch}
                placeholder="Buscar par (ex: BTC, SOL...)"
                placeholderTextColor={C.textTertiary}
                autoCapitalize="characters"
              />
              {pairSearch.length > 0 && (
                <Pressable onPress={() => setPairSearch('')}>
                  <Ionicons name="close-circle" size={16} color={C.textTertiary} />
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pairScroll}>
              {filteredPairs.map((p) => {
                const liveP = getPrice(p, selectedExchange);
                return (
                  <Pressable
                    key={p}
                    style={[styles.pairChip, selectedPair === p && { backgroundColor: planTheme.primary + '22', borderColor: planTheme.primary }]}
                    onPress={() => { setSide('Buy'); setSelectedPair(p); Haptics.selectionAsync(); }}
                    testID={`pair-chip-${p}`}
                  >
                    <Text style={[styles.pairChipText, selectedPair === p && { color: planTheme.primary }]}>{p}</Text>
                    {liveP !== undefined && (
                      <Text style={[styles.pairChipPrice, selectedPair === p && { color: planTheme.primary + 'AA' }]}>
                        ${formatPrice(liveP)}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
              {filteredPairs.length === 0 && (
                <Text style={styles.noPairsText}>Nenhum par encontrado</Text>
              )}
            </ScrollView>

            {/* Exchange price info row */}
            {currentPrice !== undefined && (
              <View style={[styles.priceInfoRow, { backgroundColor: selectedExchangeData?.color + '12', borderColor: selectedExchangeData?.color + '30' }]}>
                <Ionicons name="pricetag-outline" size={14} color={selectedExchangeData?.color} />
                <Text style={[styles.priceInfoText, { color: selectedExchangeData?.color }]}>
                  {selectedExchangeData?.label}: ${formatPrice(currentPrice)} USDT
                </Text>
                <View style={styles.liveTag}>
                  <View style={[styles.liveDotSmall, { backgroundColor: '#00D4AA' }]} />
                  <Text style={styles.liveTagText}>ao vivo</Text>
                </View>
              </View>
            )}

            {/* Buy / Sell Toggle */}
            <View style={styles.sideRow}>
              <Pressable
                style={[styles.sideBtn, side === 'Buy' && styles.sideBtnBuy]}
                onPress={() => { setSide('Buy'); Haptics.selectionAsync(); }}
                testID="side-buy"
              >
                <Ionicons name="trending-up" size={16} color={side === 'Buy' ? '#fff' : C.textSecondary} />
                <Text style={[styles.sideBtnText, side === 'Buy' && { color: '#fff' }]}>{t('quickBuy')}</Text>
              </Pressable>
              <Pressable
                style={[styles.sideBtn, side === 'Sell' && styles.sideBtnSell]}
                onPress={() => { setSide('Sell'); Haptics.selectionAsync(); }}
                testID="side-sell"
              >
                <Ionicons name="trending-down" size={16} color={side === 'Sell' ? '#fff' : C.textSecondary} />
                <Text style={[styles.sideBtnText, side === 'Sell' && { color: '#fff' }]}>{t('quickSell')}</Text>
              </Pressable>
            </View>

            {/* Order Type */}
            <View style={styles.orderTypeRow}>
              {(['Market', 'Limit'] as const).map((ot) => {
                const disabled = ot === 'Limit' && !canUseLimit;
                return (
                  <Pressable
                    key={ot}
                    style={[
                      styles.orderTypeBtn,
                      orderType === ot && { borderColor: planTheme.primary },
                      disabled && { opacity: 0.45 },
                    ]}
                    onPress={() => {
                      if (disabled) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
                      setOrderType(ot); Haptics.selectionAsync();
                    }}
                    testID={`order-type-${ot.toLowerCase()}`}
                  >
                    <Text style={[styles.orderTypeBtnText, orderType === ot && { color: planTheme.primary }]}>
                      {ot === 'Market' ? t('marketOrder') : t('limitOrder')}
                    </Text>
                    {disabled && <Ionicons name="lock-closed" size={11} color={C.textTertiary} style={{ marginLeft: 4 }} />}
                  </Pressable>
                );
              })}
            </View>
            {orderType === 'Limit' && !canUseLimit && (
              <Text style={styles.upgradeHint}>{t('upgradeForLimit')}</Text>
            )}

            {/* Amount */}
            <Text style={styles.sectionLabel}>{t('orderAmount')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={C.textTertiary}
                keyboardType="decimal-pad"
                testID="amount-input"
              />
              <Text style={styles.inputSuffix}>USDT</Text>
            </View>

            {/* Preset % */}
            <View style={styles.presetRow}>
              {PRESETS.map((pct) => (
                <Pressable key={pct} style={styles.presetBtn} onPress={() => handlePreset(pct)} testID={`preset-${pct}`}>
                  <Text style={[styles.presetBtnText, { color: planTheme.primary }]}>{pct}%</Text>
                </Pressable>
              ))}
            </View>

            {/* Limit Price */}
            {orderType === 'Limit' && canUseLimit && (
              <>
                <Text style={styles.sectionLabel}>{t('limitPriceLabel')}</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={limitPrice || (currentPrice ? formatPrice(currentPrice) : '')}
                    onChangeText={setLimitPrice}
                    placeholder={currentPrice ? formatPrice(currentPrice) : '0.00'}
                    placeholderTextColor={C.textTertiary}
                    keyboardType="decimal-pad"
                    testID="limit-price-input"
                  />
                  <Text style={styles.inputSuffix}>USDT</Text>
                </View>
              </>
            )}

            {/* AI Suggestion */}
            {canAiSuggestion && (
              <View style={[styles.aiSuggestionRow, { borderColor: planTheme.primary + '44', backgroundColor: planTheme.primary + '12' }]}>
                <Ionicons name="hardware-chip-outline" size={16} color={planTheme.primary} />
                <Text style={[styles.aiSuggestionText, { color: planTheme.primary }]}>
                  {t('aiSuggestion')}: {side === 'Buy' ? 'Buy' : 'Sell'} {selectedPair} @ market — momentum bullish
                </Text>
              </View>
            )}

            {/* Batch toggle */}
            {canBatch && (
              <View style={styles.batchRow}>
                <Ionicons name="layers-outline" size={16} color={C.textSecondary} />
                <Text style={styles.batchText}>{t('batchOrders')}</Text>
              </View>
            )}

            {/* Confirm */}
            {confirmed ? (
              <View style={[styles.confirmBtn, { backgroundColor: C.success }]}>
                <Ionicons name="checkmark-circle" size={20} color="#000" />
                <Text style={styles.confirmBtnText}>Ordem Enviada!</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.confirmBtn, { backgroundColor: side === 'Buy' ? C.success : C.danger }]}
                onPress={handleConfirm}
                testID="confirm-trade"
              >
                <Text style={styles.confirmBtnText}>
                  {side === 'Buy' ? t('quickBuy') : t('quickSell')} {selectedPair}
                  {currentPrice ? ` @ $${formatPrice(currentPrice)}` : ''}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={styles.fullViewLink}
              onPress={() => { close(); setTimeout(() => router.navigate('/(tabs)/trading'), 300); }}
              testID="open-full-trade"
            >
              <Text style={[styles.fullViewLinkText, { color: planTheme.primary }]}>{t('openFullTradeView')}</Text>
              <Ionicons name="open-outline" size={14} color={planTheme.primary} />
            </Pressable>

            {/* Recent Trades */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{t('recentQuickTrades')}</Text>
            {RECENT_TRADES.map((tr) => (
              <View key={tr.id} style={styles.recentRow}>
                <View style={[styles.recentSideDot, { backgroundColor: tr.side === 'Buy' ? C.success : C.danger }]} />
                <Text style={styles.recentPair}>{tr.pair}</Text>
                <Text style={[styles.recentSide, { color: tr.side === 'Buy' ? C.success : C.danger }]}>{tr.side}</Text>
                <Text style={styles.recentAmount}>{tr.amount}</Text>
                <Text style={styles.recentTime}>{tr.time}</Text>
              </View>
            ))}

            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

QuickTradeWidget.displayName = 'QuickTradeWidget';
export default QuickTradeWidget;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: C.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: C.text,
  },
  sheetSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#00D4AA15',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#00D4AA30',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D4AA',
  },
  livePriceText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#00D4AA',
  },
  closeBtn: {
    padding: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pairScroll: {
    marginBottom: 2,
  },
  exChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  exLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.text,
    paddingVertical: 0,
  },
  pairChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  pairChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: C.textSecondary,
  },
  pairChipPrice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: C.textTertiary,
    marginTop: 1,
  },
  noPairsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.textTertiary,
    paddingVertical: 8,
  },
  priceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  priceInfoText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  liveTagText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: '#00D4AA',
  },
  sideRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  sideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  sideBtnBuy: {
    backgroundColor: Colors.dark.success + 'BB',
    borderColor: Colors.dark.success,
  },
  sideBtnSell: {
    backgroundColor: Colors.dark.danger + 'BB',
    borderColor: Colors.dark.danger,
  },
  sideBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: C.textSecondary,
  },
  orderTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  orderTypeBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: C.textSecondary,
  },
  upgradeHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.warning,
    marginTop: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    color: C.text,
    paddingVertical: 12,
  },
  inputSuffix: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: C.textSecondary,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  presetBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  aiSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  aiSuggestionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    flex: 1,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  batchText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: C.textSecondary,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 16,
  },
  confirmBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#000',
  },
  fullViewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  fullViewLinkText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  recentSideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recentPair: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: C.text,
    flex: 1,
  },
  recentSide: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    width: 34,
  },
  recentAmount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: C.textSecondary,
    width: 50,
    textAlign: 'right',
  },
  recentTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: C.textTertiary,
    width: 44,
    textAlign: 'right',
  },
});
