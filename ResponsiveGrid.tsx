/**
 * ResponsiveGrid — auto-adapting card grid (Sprint LVI / Responsiveness)
 *
 * Renders children in a flex-wrap row that automatically adjusts the number
 * of columns based on the current screen width:
 *
 *   Mobile  (< 768 px)  → `mobileColumns` columns  (default 1)
 *   Tablet  (≥ 768 px)  → `tabletColumns` columns  (default 2)
 *   Desktop (≥ 1024 px) → `desktopColumns` columns (default 3)
 *
 * Each child is wrapped in a View that calculates its width as a percentage,
 * minus a gutter gap — no third-party dependencies required.
 *
 * Usage:
 *   <ResponsiveGrid>
 *     <BotCard />
 *     <BotCard />
 *     <BotCard />
 *   </ResponsiveGrid>
 *
 *   // Custom columns:
 *   <ResponsiveGrid mobileColumns={1} tabletColumns={3} desktopColumns={4}>
 *     ...
 *   </ResponsiveGrid>
 */

import { View, ViewStyle, StyleSheet } from "react-native";
import { type ReactNode, Children } from "react";
import { useResponsive } from "@/lib/use-responsive";

export interface ResponsiveGridProps {
  children: ReactNode;
  /** Columns on phones (width < 768 px). Default: 1 */
  mobileColumns?: number;
  /** Columns on tablets (768–1023 px). Default: 2 */
  tabletColumns?: number;
  /** Columns on desktops (≥ 1024 px). Default: 3 */
  desktopColumns?: number;
  /** Gap between items in pixels. Default: 12 */
  gap?: number;
  style?: ViewStyle;
  testID?: string;
}

export function ResponsiveGrid({
  children,
  mobileColumns = 1,
  tabletColumns = 2,
  desktopColumns = 3,
  gap = 12,
  style,
  testID,
}: ResponsiveGridProps) {
  const { isMobile, isTablet } = useResponsive();

  const numColumns = isMobile
    ? mobileColumns
    : isTablet
    ? tabletColumns
    : desktopColumns;

  // Width percentage per item: account for (numColumns - 1) gaps distributed
  // across numColumns items.
  const itemWidthPercent = `${(100 / numColumns).toFixed(2)}%` as `${number}%`;

  const items = Children.toArray(children);

  return (
    <View
      style={[styles.grid, { gap }, style]}
      testID={testID}
      accessibilityRole="list"
    >
      {items.map((child, index) => (
        <View
          key={index}
          // Note: index keys are acceptable here because the grid is a purely
          // layout wrapper — consumers should not reorder or remove individual
          // children at runtime. If dynamic lists are needed, wrap items in a
          // component with a stable key before passing to ResponsiveGrid.
          style={[
            styles.item,
            {
              // Each cell grows to fill its column share minus adjacent gaps.
              // Using flexBasis with a percentage is the most reliable cross-
              // platform approach (avoids Dimensions calls).
              flexBasis: itemWidthPercent,
              maxWidth: itemWidthPercent,
            },
          ]}
          accessibilityRole="listitem"
        >
          {child}
        </View>
      ))}
    </View>
  );
}

export default ResponsiveGrid;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
  } as ViewStyle,
  item: {
    flexGrow: 1,
  } as ViewStyle,
});
