import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanTheme } from '@/lib/theme-context';
import { useI18n } from '@/lib/i18n-context';
import { formatCurrency, formatPercent } from '@/lib/market-data';

const C = Colors.dark;

export interface TradeCardData {
  pair: string;           // e.g. 'BTC/USDT'
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  takeProfit?: number;
  stopLoss?: number;
  exchange?: string;
  timestamp?: number;
  estimatedRoi?: number;  // in percent
}

interface Props {
  visible: boolean;
  data: TradeCardData;
  onClose: () => void;
}

export default function TradeCard({ visible, data, onClose }: Props) {
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const isBuy = data.side === 'buy';
  const sideColor = isBuy ? C.success : C.danger;
  const sideLabel = isBuy ? t('buy') : t('sell');
  const ts = data.timestamp ? new Date(data.timestamp) : new Date();
  const dateStr = ts.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  const handleShare = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const roiLine = data.estimatedRoi !== undefined ? `ROI: ${data.estimatedRoi >= 0 ? '+' : ''}${data.estimatedRoi.toFixed(2)}%` : '';
    const tpLine = data.takeProfit ? `TP: ${formatCurrency(data.takeProfit)}` : '';
    const slLine = data.stopLoss ? `SL: ${formatCurrency(data.stopLoss)}` : '';
    const extras = [roiLine, tpLine, slLine].filter(Boolean).join('  |  ');
    const message = [
      `📊 Evolvus Trade Card`,
      `${sideLabel.toUpperCase()} ${data.pair}`,
      `Price: ${formatCurrency(data.price)}  |  Amount: ${data.amount}  |  Total: ${formatCurrency(data.total)}`,
      extras,
      `⏱️ ${dateStr} ${timeStr}`,
      `⚡ Powered by Evolvus — https://evolvus.io`,
    ].filter(Boolean).join('\n');
    try {
      await Share.share({ message, title: `Evolvus Trade — ${data.pair}` });
    } catch {
      // user dismissed
    }
  }, [data, sideLabel, dateStr, timeStr]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* handle */}
          <View style={styles.handle} />

          {/* header */}
          <View style={styles.cardHeader}>
            <View style={[styles.sideTag, { backgroundColor: sideColor + '22', borderColor: sideColor }]}>
              <Ionicons name={isBuy ? 'arrow-up-circle' : 'arrow-down-circle'} size={16} color={sideColor} />
              <Text style={[styles.sideTagText, { color: sideColor }]}>{sideLabel.toUpperCase()}</Text>
            </View>
            <Text style={styles.pairText}>{data.pair}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.textTertiary} />
            </Pressable>
          </View>

          {/* main price */}
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: C.textSecondary }]}>{t('price')}</Text>
            <Text style={[styles.priceValue, { color: planTheme.primary }]}>{formatCurrency(data.price)}</Text>
          </View>

          {/* details grid */}
          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>{t('amount')}</Text>
              <Text style={styles.gridValue}>{data.amount.toFixed(4)} {data.pair.split('/')[0]}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.gridLabel}>{t('total')}</Text>
              <Text style={styles.gridValue}>{formatCurrency(data.total)}</Text>
            </View>
            {data.estimatedRoi !== undefined && (
              <View style={styles.gridCell}>
                <Text style={styles.gridLabel}>{t('roi')}</Text>
                <Text style={[styles.gridValue, { color: data.estimatedRoi >= 0 ? C.success : C.danger }]}>
                  {data.estimatedRoi >= 0 ? '+' : ''}{data.estimatedRoi.toFixed(2)}%
                </Text>
              </View>
            )}
            {data.exchange && (
              <View style={styles.gridCell}>
                <Text style={styles.gridLabel}>{t('exchange')}</Text>
                <Text style={styles.gridValue}>{data.exchange}</Text>
              </View>
            )}
          </View>

          {/* TP/SL row */}
          {(data.takeProfit || data.stopLoss) && (
            <View style={styles.tpslRow}>
              {data.takeProfit && (
                <View style={[styles.tpslChip, { backgroundColor: C.success + '18', borderColor: C.success + '44' }]}>
                  <Ionicons name="trending-up" size={13} color={C.success} />
                  <Text style={[styles.tpslChipText, { color: C.success }]}>
                    {t('takeProfit')}: {formatCurrency(data.takeProfit)}
                  </Text>
                </View>
              )}
              {data.stopLoss && (
                <View style={[styles.tpslChip, { backgroundColor: C.danger + '18', borderColor: C.danger + '44' }]}>
                  <Ionicons name="trending-down" size={13} color={C.danger} />
                  <Text style={[styles.tpslChipText, { color: C.danger }]}>
                    {t('stopLoss')}: {formatCurrency(data.stopLoss)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* timestamp */}
          <Text style={styles.timestamp}>{dateStr} {timeStr}</Text>

          {/* footer brand */}
          <View style={styles.brand}>
            <Ionicons name="flash" size={14} color={planTheme.primary} />
            <Text style={[styles.brandText, { color: planTheme.primary }]}>Evolvus</Text>
          </View>

          {/* share button */}
          <Pressable style={[styles.shareBtn, { backgroundColor: planTheme.primary }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="#000" />
            <Text style={styles.shareBtnText}>{t('shareResult')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  card: {
    backgroundColor: C.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    borderWidth: 1,
    borderColor: C.border,
    gap: 16,
  },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sideTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  sideTagText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  pairText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, color: C.text },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.border },
  priceLabel: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  priceValue: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridCell: { flex: 1, minWidth: '45%', backgroundColor: C.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, gap: 4 },
  gridLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: C.textTertiary },
  gridValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.text },
  tpslRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tpslChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  tpslChipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  timestamp: { fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textTertiary, textAlign: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  brandText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  shareBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#000' },
});
