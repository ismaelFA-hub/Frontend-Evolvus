/**
 * app/loading.tsx — Expo Router loading file.
 *
 * This file is the Expo Router convention for defining a loading UI that is
 * shown while a lazily-loaded route segment is being fetched and rendered.
 *
 * Expo Router v6+ uses React Suspense internally. When navigating to any
 * deeply-nested route (admin, AI tools, advanced settings), this component
 * is shown as a Suspense fallback until the target screen bundle is ready.
 *
 * @see https://docs.expo.dev/router/advanced/loading/
 */

export { ScreenFallback as default } from '@/components/ScreenFallback';
