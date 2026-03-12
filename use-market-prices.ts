/**
 * Evolvus Core Quantum — useMarketPrices hook
 *
 * Subscribes to the backend's Server-Sent Events (SSE) stream at
 * /api/market/stream for real-time crypto prices.
 *
 * Falls back to the static mock data in lib/market-data.ts when
 * the backend is unavailable (dev without server, or network error).
 *
 * Returns a PriceMap keyed by symbol (BTC, ETH, SOL, ...).
 */

import { useState, useEffect, useRef } from "react";
import { getMarketData } from "./market-data";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export interface LivePrice {
  symbol: string;
  price: number;
  source: "coincap" | "coingecko" | "mock";
  timestamp: number;
}

export type LivePriceMap = Record<string, LivePrice>;

/** Hook: subscribes to real-time backend prices via SSE, falls back to mock. */
export function useMarketPrices(): {
  prices: LivePriceMap;
  isLive: boolean;
  lastUpdated: number;
} {
  const [prices, setPrices] = useState<LivePriceMap>({});
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    function loadFallback() {
      if (!mounted) return;
      const mockAssets = getMarketData();
      const map: LivePriceMap = {};
      for (const asset of mockAssets) {
        map[asset.symbol] = {
          symbol: asset.symbol,
          price: asset.price,
          source: "mock",
          timestamp: Date.now(),
        };
      }
      setPrices(map);
      setLastUpdated(Date.now());
    }

    function connectSSE() {
      // EventSource is available in browsers and React Native Web.
      // On native it falls back to mock via the catch below.
      try {
        // @ts-ignore — may be undefined in RN native
        if (typeof EventSource === "undefined") {
          loadFallback();
          // Poll mock every 5 s to simulate live updates
          fallbackIntervalRef.current = setInterval(loadFallback, 5_000);
          return;
        }

        const es = new EventSource(`${API_URL}/api/market/stream`);
        esRef.current = es;

        es.onmessage = (event) => {
          if (!mounted) return;
          try {
            const data = JSON.parse(event.data) as LivePriceMap;
            if (Object.keys(data).length > 0) {
              setPrices(data);
              setIsLive(true);
              setLastUpdated(Date.now());
            }
          } catch {
            // ignore parse errors
          }
        };

        es.onerror = () => {
          if (!mounted) return;
          es.close();
          esRef.current = null;
          setIsLive(false);
          // Fallback to mock while reconnecting
          loadFallback();
          // Try to reconnect after 5 s
          fallbackTimerRef.current = setTimeout(() => {
            if (mounted) connectSSE();
          }, 5_000);
        };
      } catch {
        loadFallback();
        fallbackIntervalRef.current = setInterval(loadFallback, 5_000);
      }
    }

    // Load mock immediately so the UI is never empty
    loadFallback();
    connectSSE();

    return () => {
      mounted = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, []);

  return { prices, isLive, lastUpdated };
}

/**
 * Helper: merge live prices into a CryptoAsset list from market-data.ts.
 * Used by screens that want a full asset object but with updated prices.
 */
export function mergeLivePrices<T extends { symbol: string; price: number }>(
  assets: T[],
  livePrices: LivePriceMap,
): T[] {
  return assets.map((asset) => {
    const live = livePrices[asset.symbol];
    if (live && live.price > 0) {
      return { ...asset, price: live.price };
    }
    return asset;
  });
}
