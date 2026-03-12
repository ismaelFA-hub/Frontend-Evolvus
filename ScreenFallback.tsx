/**
 * ScreenFallback — Suspense / Loading boundary for lazily-loaded screens.
 *
 * Shown by Expo Router's file-based lazy loading while a secondary screen
 * (admin, AI tools, advanced settings) is being loaded/parsed.
 *
 * Used as:
 *   • The default export in `app/loading.tsx` (Expo Router convention).
 *   • Directly as `<React.Suspense fallback={<ScreenFallback />}>` in layouts.
 */

import { useRef, useEffect } from 'react';
import { Animated, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SkeletonProps = { width: number | string; height: number; radius?: number };

function Skeleton({ width, height, radius = 6 }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as number | string, height, borderRadius: radius, opacity },
      ]}
      accessibilityElementsHidden
    />
  );
}

export function ScreenFallback() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const bg = colorScheme === 'light' ? '#F0F2F5' : '#0A0E17';

  return (
    <View
      style={[styles.container, { backgroundColor: bg, paddingTop: insets.top + 16 }]}
      testID="screen-fallback"
      accessible={false}
    >
      {/* Header bar skeleton */}
      <View style={styles.headerRow}>
        <Skeleton width={32} height={32} radius={16} />
        <Skeleton width={120} height={20} />
        <Skeleton width={32} height={32} radius={16} />
      </View>

      {/* Summary card skeleton */}
      <View style={styles.card}>
        <Skeleton width="100%" height={16} />
        <View style={styles.gap8} />
        <Skeleton width="70%" height={12} />
        <View style={styles.gap8} />
        <Skeleton width="85%" height={12} />
      </View>

      {/* List items skeleton */}
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.listItem}>
          <Skeleton width={44} height={44} radius={10} />
          <View style={styles.listTexts}>
            <Skeleton width="60%" height={14} />
            <View style={styles.gap6} />
            <Skeleton width="40%" height={10} />
          </View>
          <Skeleton width={56} height={28} radius={8} />
        </View>
      ))}
    </View>
  );
}

const SKELETON_COLOR = '#888888';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  skeleton: {
    backgroundColor: SKELETON_COLOR,
  },
  card: {
    backgroundColor: SKELETON_COLOR + '22',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SKELETON_COLOR + '22',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  listTexts: {
    flex: 1,
  },
  gap8: { height: 8 },
  gap6: { height: 6 },
});

export default ScreenFallback;
