/**
 * TooltipBadge – Contextual First-Visit Tooltip
 *
 * Shows a dismissible info card the first time a user visits a screen.
 * The seen-state is tracked per-screen via AsyncStorage using a unique key.
 *
 * Usage:
 *   <TooltipBadge screenKey="dashboard" message={t('tooltipDashboard')} />
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useI18n } from '@/lib/i18n-context';
import { usePlanTheme } from '@/lib/theme-context';
import analytics from '@/lib/analytics';

const C = Colors.dark;

/** Prefix used for per-screen tooltip flags in AsyncStorage */
export const TOOLTIP_KEY_PREFIX = 'tooltip_seen_';

interface TooltipBadgeProps {
  /** Unique identifier for this screen — used to build the AsyncStorage key */
  screenKey: string;
  /** The tooltip message to display (already translated) */
  message: string;
  /** Optional delay before showing (ms, default 600) */
  delay?: number;
}

export default function TooltipBadge({ screenKey, message, delay = 600 }: TooltipBadgeProps) {
  const { t } = useI18n();
  const { planTheme } = usePlanTheme();
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const storageKey = `${TOOLTIP_KEY_PREFIX}${screenKey}`;

  // ─── Check if already seen ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const seen = await AsyncStorage.getItem(storageKey);
        if (!seen) {
          setVisible(true);
          analytics.track('tooltip_viewed', { screen: screenKey });
          Animated.parallel([
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 140, friction: 10 }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]).start();
        }
      } catch (_) {}
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // ─── Dismiss handler ──────────────────────────────────────────────────────
  const dismiss = useCallback(async () => {
    Haptics.selectionAsync();
    analytics.track('tooltip_dismissed', { screen: screenKey });
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -20, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
    try { await AsyncStorage.setItem(storageKey, '1'); } catch (_) {}
  }, [storageKey]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          borderColor: planTheme.primary + '55',
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      testID={`tooltip-badge-${screenKey}`}
      accessible={true}
      accessibilityLabel={message}
      accessibilityRole="alert"
    >
      <View style={styles.iconRow}>
        <View style={[styles.iconDot, { backgroundColor: planTheme.primary + '33', borderColor: planTheme.primary }]}>
          <Ionicons name="information" size={16} color={planTheme.primary} accessibilityElementsHidden={true} />
        </View>
        <Text style={[styles.message]} numberOfLines={3}>{message}</Text>
      </View>
      <Pressable
        style={[styles.gotItBtn, { borderColor: planTheme.primary }]}
        onPress={dismiss}
        testID={`tooltip-badge-dismiss-${screenKey}`}
        accessibilityRole="button"
        accessibilityLabel={t('tooltipGotIt')}
        accessibilityHint={t('tooltipGotIt')}
      >
        <Text style={[styles.gotItText, { color: planTheme.primary }]}>{t('tooltipGotIt')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  iconDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    color: C.text,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  gotItBtn: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  gotItText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
