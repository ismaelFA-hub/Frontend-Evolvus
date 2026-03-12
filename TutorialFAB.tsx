import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { usePlanTheme } from '@/lib/theme-context';
import { useI18n } from '@/lib/i18n-context';
import { ONBOARDING_KEY } from '@/app/onboarding';
import analytics from '@/lib/analytics';

const C = Colors.dark;

export const TUTORIAL_FAB_KEY = 'tutorial_fab_dismissals';
const MAX_DISMISSALS = 3;

export default function TutorialFAB() {
  const { planTheme } = usePlanTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TUTORIAL_FAB_KEY);
        const dismissals = raw ? parseInt(raw, 10) : 0;
        if (dismissals < MAX_DISMISSALS) {
          setVisible(true);
          analytics.track('tutorial_viewed', { source: 'fab', dismissals });
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
              Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
          ).start();
        }
      } catch (_) {}
    })();
  }, []);

  const toggleExpanded = useCallback(() => {
    Haptics.selectionAsync();
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(scaleAnim, {
      toValue,
      useNativeDriver: true,
      tension: 180,
      friction: 12,
    }).start();
  }, [expanded]);

  const startTutorial = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    analytics.track('tutorial_started', { source: 'fab' });
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await AsyncStorage.setItem(TUTORIAL_FAB_KEY, String(MAX_DISMISSALS));
    } catch (_) {}
    setVisible(false);
    setExpanded(false);
    router.push('/onboarding');
  }, []);

  const openNexus = useCallback(() => {
    Haptics.selectionAsync();
    setExpanded(false);
    router.push('/support-chat');
  }, []);

  const closeMenu = useCallback(async () => {
    Haptics.selectionAsync();
    try {
      const raw = await AsyncStorage.getItem(TUTORIAL_FAB_KEY);
      const count = (raw ? parseInt(raw, 10) : 0) + 1;
      await AsyncStorage.setItem(TUTORIAL_FAB_KEY, String(count));
      analytics.track('fab_dismissed', { dismissal_count: count, permanent: count >= MAX_DISMISSALS });
      if (count >= MAX_DISMISSALS) setVisible(false);
    } catch (_) {}
    Animated.spring(scaleAnim, { toValue: 0, useNativeDriver: true, tension: 180, friction: 12 }).start(() => setExpanded(false));
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container} testID="tutorial-fab">
      {expanded && (
        <Animated.View
          style={[
            styles.menu,
            { borderColor: C.border, transform: [{ scale: scaleAnim }] },
          ]}
          testID="tutorial-fab-tooltip"
        >
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>{t('helpBadgeLabel')}</Text>
            <Pressable onPress={closeMenu} style={styles.closeBtn} testID="tutorial-fab-dismiss" accessibilityLabel={t('helpBadgeDismiss')}>
              <Ionicons name="close" size={16} color={C.textTertiary} />
            </Pressable>
          </View>

          <Pressable
            style={styles.menuOption}
            onPress={startTutorial}
            testID="tutorial-fab-start"
          >
            <View style={[styles.menuOptionIcon, { backgroundColor: '#00D4AA22' }]}>
              <Ionicons name="play-circle" size={20} color="#00D4AA" />
            </View>
            <View style={styles.menuOptionText}>
              <Text style={styles.menuOptionTitle}>Tutorial do App</Text>
              <Text style={styles.menuOptionSub}>Veja como funciona em 5 passos</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
          </Pressable>

          <View style={styles.menuDivider} />

          <Pressable
            style={styles.menuOption}
            onPress={openNexus}
            testID="tutorial-fab-nexus"
          >
            <View style={[styles.menuOptionIcon, { backgroundColor: '#7B61FF22' }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#7B61FF" />
            </View>
            <View style={styles.menuOptionText}>
              <Text style={styles.menuOptionTitle}>Suporte Nexus</Text>
              <Text style={styles.menuOptionSub}>Fale com a IA de suporte</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.textTertiary} />
          </Pressable>
        </Animated.View>
      )}

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <Pressable
          style={[styles.fab, { backgroundColor: planTheme.primary }]}
          onPress={toggleExpanded}
          testID="tutorial-fab-button"
        >
          <Ionicons name={expanded ? 'close' : 'help'} size={22} color="#000" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 92 : 72,
    right: 16,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menu: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    width: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  menuTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: C.textSecondary,
  },
  closeBtn: {
    padding: 2,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionText: {
    flex: 1,
  },
  menuOptionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: C.text,
  },
  menuOptionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: C.textTertiary,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 14,
  },
});
