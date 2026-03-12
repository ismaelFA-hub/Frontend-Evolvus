/**
 * Evolvus Core Quantum — useWsPrices hook
 *
 * Connects to the backend WebSocket at /ws/prices for bidirectional
 * real-time price updates. Clients can subscribe to specific symbols.
 *
 * Falls back to the SSE hook (useMarketPrices) on platforms where
 * WebSocket is unavailable or the connection fails.
 *
 * Usage:
 *   const { prices, isConnected, subscribe, unsubscribe } = useWsPrices();
 *   subscribe(["BTC", "ETH"]);
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { LivePriceMap } from "./use-market-prices";
import { useMarketPrices } from "./use-market-prices";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

/** Delay in ms before attempting to reconnect after a WebSocket close/error. */
const RECONNECT_DELAY_MS = 5_000;

// Build WebSocket URL — on web uses window.location to proxy correctly (dev & prod)
function buildWsUrl(): string {
  if (typeof window !== "undefined" && window.location?.host) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/prices`;
  }
  try {
    const url = new URL(API_URL);
    const proto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${url.host}/ws/prices`;
  } catch {
    return "ws://localhost:3001/ws/prices";
  }
}

interface WsPriceState {
  prices: LivePriceMap;
  isConnected: boolean;
  isLive: boolean;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

/** Bidirectional WebSocket hook for real-time prices. */
export function useWsPrices(): WsPriceState {
  const [prices, setPrices] = useState<LivePriceMap>({});
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingSubscriptions = useRef<string[]>([]);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // SSE fallback for when WS is unavailable (e.g. RN native)
  const { prices: ssePrices, isLive: sseIsLive } = useMarketPrices();

  const sendWs = useCallback((msg: object) => {
    if (wsRef.current?.readyState === 1 /* OPEN */) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback((symbols: string[]) => {
    pendingSubscriptions.current = [...new Set([...pendingSubscriptions.current, ...symbols.map((s) => s.toUpperCase())])];
    sendWs({ type: "subscribe", symbols });
  }, [sendWs]);

  const unsubscribe = useCallback((symbols: string[]) => {
    const up = symbols.map((s) => s.toUpperCase());
    pendingSubscriptions.current = pendingSubscriptions.current.filter((s) => !up.includes(s));
    sendWs({ type: "unsubscribe", symbols: up });
  }, [sendWs]);

  useEffect(() => {
    mountedRef.current = true;
    const hasWS = typeof WebSocket !== "undefined";
    if (!hasWS) return; // Native RN without polyfill — use SSE fallback

    function connect() {
      if (!mountedRef.current) return;
      const url = buildWsUrl();

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        return; // WS constructor threw — use SSE fallback
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return ws.close();
        setIsConnected(true);
        // Re-subscribe to any pending symbols
        if (pendingSubscriptions.current.length > 0) {
          ws.send(JSON.stringify({ type: "subscribe", symbols: pendingSubscriptions.current }));
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data) as { type: string; data?: LivePriceMap };
          if (msg.type === "prices" && msg.data) {
            setPrices((prev) => ({ ...prev, ...msg.data }));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setIsConnected(false);
        // Auto-reconnect in 5 s
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        // onclose will fire next and trigger reconnect
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Merge WS prices with SSE fallback prices
  const activePrices = isConnected ? prices : ssePrices;
  const isLive = isConnected || sseIsLive;

  return { prices: activePrices, isConnected, isLive, subscribe, unsubscribe };
}
