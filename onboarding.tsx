import React, { useRef, useState, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, Dimensions,
  Animated, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { usePlanTheme } from '@/lib/theme-context';
import { useI18n } from '@/lib/i18n-context';
import analytics from '@/lib/analytics';

const C = Colors.dark;
const { width: SCREEN_W } = Dimensions.get('window');
export const ONBOARDING_KEY = 'onboarding_completed';

// ─── Slide 1: Dashboard ──────────────────────────────────────────────────────
function Slide1({ primary }: { primary: string }) {
  return (
    <View style={slide.container}>
      <Text style={slide.slideTag}>Painel Principal</Text>
      <Text style={slide.title}>Seu portfólio em{'\n'}tempo real</Text>
      <Text style={slide.subtitle}>Acompanhe saldo, lucros e ativos num único lugar.</Text>

      <View style={slide.mockCard}>
        <View style={slide.mockHeader}>
          <Text style={slide.mockLabel}>Valor Total do Portfólio</Text>
          <View style={[slide.mockBadge, { backgroundColor: '#00D4AA22', borderColor: '#00D4AA44' }]}>
            <Ionicons name="trending-up" size={11} color="#00D4AA" />
            <Text style={[slide.mockBadgeText, { color: '#00D4AA' }]}>+12.18%</Text>
          </View>
        </View>
        <Text style={slide.mockBalance}>$125,180.42</Text>
        <View style={slide.mockRow}>
          <View style={slide.mockStat}>
            <Text style={slide.mockStatLabel}>L&P (24h)</Text>
            <Text style={[slide.mockStatValue, { color: '#00D4AA' }]}>+$13,592</Text>
          </View>
          <View style={slide.mockStatDivider} />
          <View style={slide.mockStat}>
            <Text style={slide.mockStatLabel}>Investido</Text>
            <Text style={slide.mockStatValue}>$111,587</Text>
          </View>
          <View style={slide.mockStatDivider} />
          <View style={slide.mockStat}>
            <Text style={slide.mockStatLabel}>Ativos</Text>
            <Text style={slide.mockStatValue}>6</Text>
          </View>
        </View>
        <View style={slide.mockActions}>
          {[
            { icon: 'swap-horizontal' as const, label: 'Negociar', color: '#7B61FF' },
            { icon: 'people' as const, label: 'Copy', color: '#00B4D8' },
            { icon: 'bar-chart' as const, label: 'Mercados', color: primary },
            { icon: 'wallet' as const, label: 'Carteira', color: '#F59E0B' },
          ].map((a) => (
            <View key={a.label} style={slide.mockAction}>
              <View style={[slide.mockActionIcon, { backgroundColor: a.color + '22' }]}>
                <Ionicons name={a.icon} size={18} color={a.color} />
              </View>
              <Text style={slide.mockActionLabel}>{a.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Slide 2: IA & Automação ─────────────────────────────────────────────────
function Slide2({ primary }: { primary: string }) {
  return (
    <View style={slide.container}>
      <Text style={slide.slideTag}>IA & Automação</Text>
      <Text style={slide.title}>54 cérebros{'\n'}trabalhando por você</Text>
      <Text style={slide.subtitle}>Detecção de regime, bots adaptativos e análise 24/7.</Text>

      <View style={slide.mockCard}>
        <View style={slide.mockMetrics}>
          <View style={[slide.mockMetric, { borderColor: '#00D4AA33' }]}>
            <View style={[slide.mockMetricDot, { backgroundColor: '#00D4AA' }]} />
            <Text style={[slide.mockMetricNum, { color: '#00D4AA' }]}>59</Text>
            <Text style={slide.mockMetricLabel}>Cérebros Ativos</Text>
          </View>
          <View style={[slide.mockMetric, { borderColor: primary + '33' }]}>
            <Text style={[slide.mockMetricNum, { color: primary }]}>82%</Text>
            <Text style={slide.mockMetricLabel}>Confiança Geral</Text>
          </View>
          <View style={[slide.mockMetric, { borderColor: '#F59E0B33' }]}>
            <Text style={[slide.mockMetricNum, { color: '#F59E0B' }]}>2</Text>
            <Text style={slide.mockMetricLabel}>Bots Rodando</Text>
          </View>
        </View>
        <View style={[slide.mockRegime, { backgroundColor: '#00D4AA12', borderColor: '#00D4AA30' }]}>
          <Ionicons name="radio-button-on" size={10} color="#00D4AA" />
          <Text style={[slide.mockRegimeText, { color: '#00D4AA' }]}>Regime: Tendência de Alta</Text>
        </View>
        {[
          { name: 'DCA Inteligente', sub: 'Compra recorrente em BTC/ETH', icon: 'refresh-circle' as const, color: '#7B61FF' },
          { name: 'IA Explicável', sub: 'Análise dos 54 cérebros', icon: 'hardware-chip-outline' as const, color: primary },
        ].map((bot) => (
          <View key={bot.name} style={slide.mockBotRow}>
            <View style={[slide.mockBotIcon, { backgroundColor: bot.color + '22' }]}>
              <Ionicons name={bot.icon} size={18} color={bot.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={slide.mockBotName}>{bot.name}</Text>
              <Text style={slide.mockBotSub}>{bot.sub}</Text>
            </View>
            <View style={[slide.mockBotStatus, { backgroundColor: '#00D4AA22' }]}>
              <Text style={{ fontSize: 10, color: '#00D4AA', fontFamily: 'Inter_600SemiBold' }}>ATIVO</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Slide 3: Mercados ───────────────────────────────────────────────────────
function Slide3() {
  const ASSETS = [
    { sym: 'BTC', name: 'Bitcoin', price: '$97,420', change: '+2.14%', up: true },
    { sym: 'ETH', name: 'Ethereum', price: '$3,680', change: '+1.87%', up: true },
    { sym: 'SOL', name: 'Solana', price: '$183.40', change: '-0.92%', up: false },
    { sym: 'BNB', name: 'BNB', price: '$624.80', change: '+0.55%', up: true },
  ];
  return (
    <View style={slide.container}>
      <Text style={slide.slideTag}>Mercados</Text>
      <Text style={slide.title}>Preços ao vivo{'\n'}de todas as cripto</Text>
      <Text style={slide.subtitle}>Mini gráficos, tendências e sinais de IA integrados.</Text>

      <View style={slide.mockCard}>
        <View style={slide.mockSearchBar}>
          <Ionicons name="search" size={14} color={C.textTertiary} />
          <Text style={slide.mockSearchText}>Buscar ativo...</Text>
        </View>
        {ASSETS.map((a) => (
          <View key={a.sym} style={slide.mockAssetRow}>
            <View style={[slide.mockAssetIcon, { backgroundColor: a.up ? '#00D4AA22' : '#FF4D4D22' }]}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: a.up ? '#00D4AA' : '#FF4D4D' }}>{a.sym}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={slide.mockAssetName}>{a.name}</Text>
              <Text style={slide.mockAssetSym}>{a.sym}/USDT</Text>
            </View>
            <View style={slide.mockSparkline}>
              {[3, 5, 2, 7, 4, 6, a.up ? 8 : 1].map((h, i) => (
                <View key={i} style={[slide.mockBar, { height: h * 2.5, backgroundColor: a.up ? '#00D4AA' : '#FF4D4D', opacity: 0.4 + (i / 10) }]} />
              ))}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={slide.mockAssetPrice}>{a.price}</Text>
              <Text style={[slide.mockAssetChange, { color: a.up ? '#00D4AA' : '#FF4D4D' }]}>{a.change}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Slide 4: Trade Rápido ───────────────────────────────────────────────────
function Slide4({ primary }: { primary: string }) {
  return (
    <View style={slide.container}>
      <Text style={slide.slideTag}>Negociar</Text>
      <Text style={slide.title}>Trade rápido{'\n'}em qualquer exchange</Text>
      <Text style={slide.subtitle}>Escolha o par, a exchange e execute em segundos.</Text>

      <View style={slide.mockCard}>
        <View style={slide.mockTradeHeader}>
          <View>
            <Text style={slide.mockTradeTitle}>Trade Rápido</Text>
            <Text style={slide.mockTradeSub}>1,000.00 USDT disponível</Text>
          </View>
          <View style={[slide.mockLiveDot, { backgroundColor: '#00D4AA' }]} />
        </View>
        <Text style={slide.mockSectionLabel}>EXCHANGE</Text>
        <View style={slide.mockExchangeRow}>
          {['Binance', 'Bybit', 'OKX'].map((ex, i) => (
            <View key={ex} style={[slide.mockExChip, i === 0 && { backgroundColor: primary + '22', borderColor: primary + '66' }]}>
              <Text style={[slide.mockExChipText, i === 0 && { color: primary }]}>{ex}</Text>
            </View>
          ))}
        </View>
        <Text style={slide.mockSectionLabel}>PAR</Text>
        <View style={slide.mockPairRow}>
          {['BTC/USDT', 'ETH/USDT', 'SOL/USDT'].map((p, i) => (
            <View key={p} style={[slide.mockExChip, i === 0 && { backgroundColor: primary + '22', borderColor: primary + '66' }]}>
              <Text style={[slide.mockExChipText, i === 0 && { color: primary }]}>{p}</Text>
            </View>
          ))}
        </View>
        <View style={slide.mockBuySell}>
          <View style={[slide.mockBuyBtn, { backgroundColor: '#00D4AABB', borderColor: '#00D4AA' }]}>
            <Ionicons name="trending-up" size={14} color="#fff" />
            <Text style={slide.mockBuySellText}>Comprar BTC</Text>
          </View>
          <View style={[slide.mockSellBtn, { backgroundColor: '#FF4D4D44', borderColor: '#FF4D4D88' }]}>
            <Ionicons name="trending-down" size={14} color="#FF4D4D" />
            <Text style={[slide.mockBuySellText, { color: '#FF4D4D' }]}>Vender</Text>
          </View>
        </View>
        <View style={[slide.mockAiBadge, { backgroundColor: primary + '12', borderColor: primary + '33' }]}>
          <Ionicons name="hardware-chip-outline" size={13} color={primary} />
          <Text style={[slide.mockAiText, { color: primary }]}>IA: Momentum bullish — Buy BTC @ market</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Slide 5: Planos + CTA ───────────────────────────────────────────────────
function Slide5({ primary, onFinish }: { primary: string; onFinish: () => void }) {
  const { t } = useI18n();
  const [checkedItems, setCheckedItems] = useState([false, false, false]);

  const toggleCheck = (i: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const doneCount = checkedItems.filter(Boolean).length;
  const allDone = doneCount === 3;

  return (
    <View style={slide.container}>
      <Text style={slide.slideTag}>{t('onboardingSlide5Title') as string}</Text>
      <Text style={slide.title}>{t('exploreAi') as string}</Text>
      <Text style={slide.subtitle}>{t('exploreAiDesc') as string}</Text>

      <View style={slide.progressBg}>
        <View style={[slide.progressFill, { width: `${(doneCount / 3) * 100}%` as any, backgroundColor: primary }]} />
      </View>

      <View style={[slide.checklist, { width: '100%' }]} testID="onboarding-checklist">
        {([
          t('checklistTask1') as string,
          t('checklistTask2') as string,
          t('checklistTask3') as string,
        ]).map((task, i) => (
          <Pressable key={i} style={slide.checklistRow} onPress={() => toggleCheck(i)}>
            <Ionicons
              name={checkedItems[i] ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={checkedItems[i] ? primary : C.textTertiary}
            />
            <Text style={[slide.checklistText, checkedItems[i] && { color: primary }]}>{task}</Text>
          </Pressable>
        ))}
        {allDone && <Text style={[slide.checklistDoneText, { color: primary }]}>{t('checklistDone') as string}</Text>}
      </View>

      <View style={slide.badgeRow}>
        <Text style={[slide.badge, { borderColor: primary + '55' }]}>{t('onboardingBadgeXai') as string}</Text>
        <Text style={[slide.badge, { borderColor: primary + '55' }]}>{t('onboardingBadge30ex') as string}</Text>
        <Text style={[slide.badge, { borderColor: primary + '55' }]}>{t('onboardingBadge59brains') as string}</Text>
      </View>

      <Pressable
        style={[slide.ctaBtn, { backgroundColor: primary }]}
        onPress={onFinish}
        testID="onboarding-go-dashboard"
      >
        <Text style={slide.ctaBtnText}>{t('checklistDone') as string}</Text>
        <Ionicons name="arrow-forward" size={18} color="#000" />
      </Pressable>
    </View>
  );
}

// ─── Main Onboarding Screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { planTheme } = usePlanTheme();
  const primary = planTheme.primary;
  const listRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const dotAnim = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const SLIDES = 5;

  React.useEffect(() => {
    dotAnim.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === currentIndex ? 1 : 0,
        useNativeDriver: false,
        tension: 120,
        friction: 10,
      }).start();
    });
  }, [currentIndex]);

  const finish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    analytics.track('onboarding_completed', { slides_viewed: currentIndex + 1 });
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch (_) {}
    router.replace('/(tabs)');
  }, [currentIndex]);

  const skip = useCallback(async () => {
    Haptics.selectionAsync();
    analytics.track('onboarding_skipped', { at_slide: currentIndex });
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch (_) {}
    router.replace('/(tabs)');
  }, [currentIndex]);

  const goNext = useCallback(() => {
    Haptics.selectionAsync();
    if (currentIndex < SLIDES - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      finish();
    }
  }, [currentIndex, finish]);

  const renderSlide = ({ item: index }: { item: number }) => {
    const slide = [
      <Slide1 key="1" primary={primary} />,
      <Slide2 key="2" primary={primary} />,
      <Slide3 key="3" />,
      <Slide4 key="4" primary={primary} />,
      <Slide5 key="5" primary={primary} onFinish={finish} />,
    ][index];
    return <View style={{ width: SCREEN_W }}>{slide}</View>;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={skip} style={styles.skipBtn} hitSlop={12} testID="onboarding-skip">
          <Text style={styles.skipText}>Pular</Text>
        </Pressable>
        <Text style={styles.stepCount}>{currentIndex + 1} / {SLIDES}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={[0, 1, 2, 3, 4]}
        keyExtractor={(item) => String(item)}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        style={{ flex: 1 }}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {dotAnim.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 24] }),
                  backgroundColor: i === currentIndex ? primary : C.border,
                },
              ]}
            />
          ))}
        </View>

        {currentIndex < SLIDES - 1 && (
          <Pressable
            style={[styles.nextBtn, { backgroundColor: primary }]}
            onPress={goNext}
            testID="onboarding-next"
          >
            <Text style={styles.nextText}>Próximo</Text>
            <Ionicons name="arrow-forward" size={18} color="#000" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Slide Shared Styles ─────────────────────────────────────────────────────
const slide = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  slideTag: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: Colors.dark.text,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  mockCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    gap: 10,
  },
  mockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mockLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mockBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  mockBalance: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.dark.text,
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mockStat: {
    flex: 1,
    alignItems: 'center',
  },
  mockStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.dark.border,
  },
  mockStatLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  mockStatValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.dark.text,
  },
  mockActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  mockAction: {
    alignItems: 'center',
    gap: 6,
  },
  mockActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockActionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  mockMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  mockMetric: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    gap: 2,
    backgroundColor: Colors.dark.surface,
  },
  mockMetricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mockMetricNum: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
  },
  mockMetricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
  },
  mockRegime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mockRegimeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  mockBotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  mockBotIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockBotName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.dark.text,
  },
  mockBotSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  mockBotStatus: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mockSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  mockSearchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.dark.textTertiary,
  },
  mockAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  mockAssetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockAssetName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.text,
  },
  mockAssetSym: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  mockSparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 22,
    flex: 1,
  },
  mockBar: {
    flex: 1,
    borderRadius: 1,
  },
  mockAssetPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.dark.text,
  },
  mockAssetChange: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  mockTradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockTradeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.dark.text,
  },
  mockTradeSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  mockLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockSectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.dark.textTertiary,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  mockExchangeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  mockPairRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  mockExChip: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mockExChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  mockBuySell: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  mockBuyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mockSellBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  mockBuySellText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#fff',
  },
  mockAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mockAiText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    flex: 1,
  },
  mockPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  mockPlanDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mockPlanName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  mockPlanFeats: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  mockPlanPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 12,
  },
  ctaBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#000',
  },
  ctaHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginTop: 8,
  },
  progressBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  checklist: {
    gap: 10,
    marginBottom: 16,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checklistText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  checklistDoneText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.dark.textSecondary,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

// ─── Root Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  skipBtn: {
    minWidth: 50,
  },
  skipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: C.textSecondary,
  },
  stepCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: C.textTertiary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    justifyContent: 'center',
  },
  nextText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#000',
  },
});
