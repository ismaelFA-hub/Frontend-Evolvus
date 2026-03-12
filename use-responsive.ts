import { useWindowDimensions } from "react-native";

/**
 * Breakpoints for the Evolvus cross-platform layout system.
 *
 * Mobile  : width < 768  (phones)
 * Tablet  : 768 ≤ width < 1024  (tablets, iPads)
 * Desktop : width ≥ 1024  (notebooks, PCs, web browsers)
 */
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

/** Maximum readable content width — mirrors Tailwind's "max-w-7xl". */
export const MAX_CONTENT_WIDTH = 1280;

/** Horizontal padding at each breakpoint (in pixels). */
export const CONTENT_PADDING: Record<ScreenSize, number> = {
  mobile: 16,
  tablet: 24,
  desktop: 32,
};

export type ScreenSize = "mobile" | "tablet" | "desktop";

export interface ResponsiveInfo {
  width: number;
  height: number;
  screenSize: ScreenSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** Number of grid columns appropriate for the current screen size */
  columns: number;
  /** Horizontal content padding for the current screen size */
  contentPadding: number;
}

/**
 * Returns responsive layout information based on the current window size.
 * Works on iOS, Android, and Web (React Native + Expo).
 *
 * @example
 * const { isMobile, columns } = useResponsive();
 * <View style={{ flexDirection: isMobile ? "column" : "row" }} />
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = !isDesktop && width >= BREAKPOINTS.tablet;
  const isMobile = !isDesktop && !isTablet;

  const screenSize: ScreenSize = isDesktop ? "desktop" : isTablet ? "tablet" : "mobile";

  // Sensible column grid defaults: 1 (mobile) / 2 (tablet) / 3 (desktop)
  const columns = isDesktop ? 3 : isTablet ? 2 : 1;
  const contentPadding = CONTENT_PADDING[screenSize];

  return { width, height, screenSize, isMobile, isTablet, isDesktop, columns, contentPadding };
}

/**
 * Returns one of three values depending on the current screen size.
 * Useful for choosing between layout values without a hook.
 *
 * @example
 * const fontSize = getResponsiveValue(width, { mobile: 14, tablet: 16, desktop: 18 });
 */
export function getResponsiveValue<T>(
  width: number,
  values: { mobile: T; tablet: T; desktop: T }
): T {
  if (width >= BREAKPOINTS.desktop) return values.desktop;
  if (width >= BREAKPOINTS.tablet) return values.tablet;
  return values.mobile;
}
