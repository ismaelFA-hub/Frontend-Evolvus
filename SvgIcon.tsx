/**
 * SvgIcon — Unified icon component with SVG sprite optimization.
 *
 * Strategy:
 *   WEB   → Single HTTP request to /icons.svg (sprite), then <use href="#icon-*">.
 *           The browser caches the sprite; subsequent icons are free (no extra req).
 *   NATIVE → react-native-svg with inline paths extracted from the same sprite map.
 *            Falls back to @expo/vector-icons Ionicons for icons not in the sprite.
 *
 * Usage:
 *   <SvgIcon name="flash" size={24} color={C.primary} />
 *   <SvgIcon name="search" size={20} color={C.textTertiary} />
 *
 * Props mirror Ionicons so the component is a drop-in replacement.
 */

import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
// Lazy-loaded only on native; import at module level avoids repeated require() calls.
// react-native-svg is a peer dep and may not be available in web bundles,
// so we guard with Platform.OS before the import is consumed.
let SvgXml: any;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgXml = require("react-native-svg").SvgXml;
}

// ── Sprite icon names ──────────────────────────────────────────────────────
/**
 * Icons that exist in public/icons.svg.
 * Any icon not listed here falls back to Ionicons on all platforms.
 */
export const SPRITE_ICONS = [
  "stats-chart",
  "trending-up",
  "swap-horizontal",
  "flash",
  "flash-outline",
  "person",
  "chevron-back",
  "chevron-forward",
  "chevron-down",
  "arrow-back",
  "close",
  "close-circle",
  "search",
  "checkmark",
  "checkmark-circle",
  "alert-circle",
  "alert-circle-outline",
  "add",
  "lock-closed",
  "lock-closed-outline",
  "analytics-outline",
  "trash-outline",
  "time-outline",
  "hardware-chip-outline",
  "sparkles-outline",
  "shield-checkmark-outline",
  "mail-outline",
  "warning-outline",
  "refresh-outline",
] as const;

export type SpriteIconName = (typeof SPRITE_ICONS)[number];

/** Union of sprite icon names + any other string (for Ionicons fallback) */
export type SvgIconName = SpriteIconName | string;

export const SPRITE_URL = "/icons.svg";

// ── Native SVG paths (react-native-svg) ───────────────────────────────────
/**
 * Inline path data extracted from the same sprite for native rendering.
 * Each entry: { d?, elements? } — for simple single-path icons use `d`,
 * for multi-element icons use `elements` (rendered via SvgXml fallback).
 * We use the SvgXml approach for all native paths to avoid importing
 * every react-native-svg primitive.
 */
export const NATIVE_PATHS: Record<SpriteIconName, string> = {
  "stats-chart": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect x="32" y="240" width="80" height="240" rx="8" fill="currentColor"/><rect x="152" y="160" width="80" height="320" rx="8" fill="currentColor"/><rect x="272" y="80" width="80" height="400" rx="8" fill="currentColor"/><rect x="392" y="32" width="80" height="448" rx="8" fill="currentColor"/></svg>`,
  "trending-up": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="352 144 448 144 448 240" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><polyline points="48 368 192 224 288 320 448 144" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "swap-horizontal": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="304 48 416 160 304 272" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><line x1="416" y1="160" x2="96" y2="160" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><polyline points="208 464 96 352 208 240" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><line x1="96" y1="352" x2="416" y2="352" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "flash": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M315.27 33L96 292h192l-31.27 187L416 220H224l91.27-187z" fill="currentColor"/></svg>`,
  "flash-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M315.27 33L96 292h192l-31.27 187L416 220H224l91.27-187z" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "person": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 256c52.8 0 96-43.2 96-96s-43.2-96-96-96-96 43.2-96 96 43.2 96 96 96zm0 48c-63.6 0-192 32.1-192 96v48h384v-48c0-63.9-128.4-96-192-96z" fill="currentColor"/></svg>`,
  "chevron-back": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="328 112 184 256 328 400" fill="none" stroke="currentColor" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "chevron-forward": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="184 112 328 256 184 400" fill="none" stroke="currentColor" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "chevron-down": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="112 184 256 328 400 184" fill="none" stroke="currentColor" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "arrow-back": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="244 400 100 256 244 112" fill="none" stroke="currentColor" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/><line x1="120" y1="256" x2="412" y2="256" stroke="currentColor" stroke-width="48" stroke-linecap="round"/></svg>`,
  "close": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><line x1="368" y1="368" x2="144" y2="144" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="368" y1="144" x2="144" y2="368" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "close-circle": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="208" fill="none" stroke="currentColor" stroke-width="32"/><line x1="320" y1="320" x2="192" y2="192" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="192" y1="320" x2="320" y2="192" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "search": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="221" cy="221" r="157" fill="none" stroke="currentColor" stroke-width="32"/><line x1="338" y1="338" x2="464" y2="464" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "checkmark": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="416 128 192 384 96 288" fill="none" stroke="currentColor" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "checkmark-circle": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M448 256c0 106-86 192-192 192S64 362 64 256 150 64 256 64s192 86 192 192z" fill="none" stroke="currentColor" stroke-width="32"/><polyline points="352 176 217.6 336 160 272" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "alert-circle": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="208" fill="none" stroke="currentColor" stroke-width="32"/><line x1="256" y1="137.6" x2="256" y2="265.6" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="256" y1="320" x2="256" y2="361.6" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "alert-circle-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="208" fill="none" stroke="currentColor" stroke-width="32"/><line x1="256" y1="137.6" x2="256" y2="265.6" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="256" y1="320" x2="256" y2="361.6" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "add": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><line x1="256" y1="96" x2="256" y2="416" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="96" y1="256" x2="416" y2="256" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "lock-closed": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect x="96" y="224" width="320" height="256" rx="32" ry="32" fill="currentColor"/><path d="M176 224v-64a80 80 0 01160 0v64" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><circle cx="256" cy="340" r="20" fill="none" stroke="currentColor" stroke-width="8" opacity="0.5"/></svg>`,
  "lock-closed-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect x="96" y="224" width="320" height="256" rx="32" ry="32" fill="none" stroke="currentColor" stroke-width="32"/><path d="M176 224v-64a80 80 0 01160 0v64" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><circle cx="256" cy="340" r="20" fill="currentColor"/></svg>`,
  "analytics-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M344 280l88-88M232 216l64 64M80 320l104-104" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><circle cx="456" cy="168" r="32" fill="none" stroke="currentColor" stroke-width="32"/><circle cx="344" cy="280" r="32" fill="none" stroke="currentColor" stroke-width="32"/><circle cx="232" cy="216" r="32" fill="none" stroke="currentColor" stroke-width="32"/><circle cx="80" cy="320" r="32" fill="none" stroke="currentColor" stroke-width="32"/></svg>`,
  "trash-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polyline points="432 112 80 112" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><path d="M192 112V72a8 8 0 018-8h112a8 8 0 018 8v40M192 400V192M320 400V192" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><path d="M80 112l32 320a16 16 0 0016 16h256a16 16 0 0016-16l32-320" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "time-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="208" fill="none" stroke="currentColor" stroke-width="32"/><polyline points="256 128 256 272 352 272" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "hardware-chip-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect x="128" y="128" width="256" height="256" rx="16" ry="16" fill="none" stroke="currentColor" stroke-width="32"/><rect x="176" y="176" width="160" height="160" rx="8" ry="8" fill="none" stroke="currentColor" stroke-width="32"/><line x1="176" y1="64" x2="176" y2="128" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="256" y1="64" x2="256" y2="128" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="336" y1="64" x2="336" y2="128" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="176" y1="384" x2="176" y2="448" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="256" y1="384" x2="256" y2="448" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="336" y1="384" x2="336" y2="448" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="64" y1="176" x2="128" y2="176" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="64" y1="256" x2="128" y2="256" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="64" y1="336" x2="128" y2="336" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="384" y1="176" x2="448" y2="176" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="384" y1="256" x2="448" y2="256" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="384" y1="336" x2="448" y2="336" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "sparkles-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M259.92 262.91L216.4 120 172.88 262.91 30 306.4l142.88 43.5L216.4 492l43.52-142.1L402.8 306.4l-142.88-43.49z" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><path d="M384 80l-26.56 56.56L300.88 163l56.56 26.44L384 246l26.56-56.56L467.12 163l-56.56-26.44L384 80z" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><path d="M128 28l-17.73 37.73L72.55 83.45l37.72 17.73L128 139l17.73-37.82 37.72-17.73-37.72-17.72L128 28z" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "shield-checkmark-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 32l176 72v112c0 108.8-80 204.8-176 232C160 420.8 80 324.8 80 216V104L256 32z" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><polyline points="176 261.33 215.45 304 336 179" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "mail-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect x="48" y="96" width="416" height="320" rx="40" ry="40" fill="none" stroke="currentColor" stroke-width="32"/><polyline points="112 160 256 272 400 160" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "warning-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M256 80L16 432h480L256 80z" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><line x1="256" y1="208" x2="256" y2="296" stroke="currentColor" stroke-width="32" stroke-linecap="round"/><line x1="256" y1="352" x2="256" y2="384" stroke="currentColor" stroke-width="32" stroke-linecap="round"/></svg>`,
  "refresh-outline": `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="M320 146s24.36-12-64-12a160 160 0 10160 160" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/><polyline points="256 58 336 138 256 218" fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// ── Helper: is the name in the sprite? ────────────────────────────────────
export function isInSprite(name: string): name is SpriteIconName {
  return (SPRITE_ICONS as readonly string[]).includes(name);
}

// ── Props ─────────────────────────────────────────────────────────────────
export type SvgIconProps = {
  /** Icon name — uses sprite if available, falls back to Ionicons */
  name: SvgIconName;
  /** Icon size in dp/px. Default: 24 */
  size?: number;
  /** Icon color. Supports CSS color strings. Default: "currentColor" */
  color?: string;
  /** Optional test ID for E2E */
  testID?: string;
};

// ── Web implementation ────────────────────────────────────────────────────
function SvgIconWeb({ name, size = 24, color = "currentColor", testID }: SvgIconProps) {
  if (isInSprite(name)) {
    return (
      <svg
        width={size}
        height={size}
        style={{ color, display: "inline-block", flexShrink: 0 }}
        aria-hidden="true"
        data-testid={testID}
      >
        <use href={`${SPRITE_URL}#icon-${name}`} />
      </svg>
    );
  }
  // Fallback to Ionicons on web for unmapped icons
  return (
    <Ionicons
      name={name as any}
      size={size}
      color={color}
      testID={testID}
    />
  );
}

// ── Native implementation ─────────────────────────────────────────────────
function SvgIconNative({ name, size = 24, color = "currentColor", testID }: SvgIconProps) {
  if (isInSprite(name)) {
    const xml = NATIVE_PATHS[name as SpriteIconName].replace(/currentColor/g, color);
    return <SvgXml xml={xml} width={size} height={size} testID={testID} />;
  }
  // Fallback to Ionicons for unmapped icons
  return (
    <Ionicons
      name={name as any}
      size={size}
      color={color}
      testID={testID}
    />
  );
}

// ── Exported component ────────────────────────────────────────────────────
/**
 * Platform-aware icon component.
 * - Web: SVG sprite with `<use>` (single cached HTTP request)
 * - Native: react-native-svg inline rendering (no HTTP request)
 * - Unmapped icons: automatic Ionicons fallback on both platforms
 */
export function SvgIcon(props: SvgIconProps) {
  if (Platform.OS === "web") {
    return <SvgIconWeb {...props} />;
  }
  return <SvgIconNative {...props} />;
}

export default SvgIcon;
