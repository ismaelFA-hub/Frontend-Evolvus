/**
 * Container — responsive centred-content wrapper (Sprint LVI / Responsiveness)
 *
 * Applies horizontal padding based on the current screen size and optionally
 * caps the maximum width at `MAX_CONTENT_WIDTH` (1280 px) so text and cards
 * never stretch uncomfortably wide on large displays.
 *
 * Usage:
 *   <Container>
 *     <Text>Always nicely padded and centred</Text>
 *   </Container>
 *
 *   // Without max-width cap (e.g. full-bleed hero section):
 *   <Container maxWidth={false}>...</Container>
 *
 *   // Override padding:
 *   <Container padding={0}>...</Container>
 */

import { View, ViewStyle, StyleSheet } from "react-native";
import { type ReactNode } from "react";
import { useResponsive, MAX_CONTENT_WIDTH } from "@/lib/use-responsive";

export interface ContainerProps {
  children: ReactNode;
  /**
   * When `true` (default) the content is centred horizontally and capped at
   * `MAX_CONTENT_WIDTH` pixels — useful for desktop readability.
   */
  maxWidth?: boolean;
  /**
   * Override the automatic horizontal padding derived from the current
   * breakpoint.  Pass `0` to remove padding entirely.
   */
  padding?: number;
  style?: ViewStyle;
  testID?: string;
}

export function Container({
  children,
  maxWidth = true,
  padding,
  style,
  testID,
}: ContainerProps) {
  const { contentPadding } = useResponsive();
  const hPadding = padding !== undefined ? padding : contentPadding;

  return (
    <View
      style={[styles.outer, style]}
      testID={testID}
    >
      <View
        style={[
          styles.inner,
          { paddingHorizontal: hPadding },
          maxWidth && styles.maxWidth,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export default Container;

const styles = StyleSheet.create({
  outer: {
    width: "100%",
    alignItems: "center",
  } as ViewStyle,
  inner: {
    width: "100%",
  } as ViewStyle,
  maxWidth: {
    maxWidth: MAX_CONTENT_WIDTH,
  } as ViewStyle,
});
