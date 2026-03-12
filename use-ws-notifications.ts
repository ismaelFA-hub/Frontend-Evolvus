import { useState, useEffect, useRef } from "react";
import { getStoredToken } from "./query-client";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const RECONNECT_DELAY_MS = 5_000;

function buildWsUrl(): string {
  if (typeof window !== "undefined" && window.location?.host) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws/notifications`;
  }
  try {
    const url = new URL(API_URL);
    const proto = url.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${url.host}/ws/notifications`;
  } catch {
    return "ws://localhost:3001/ws/notifications";
  }
}

export interface WsNotificationEvent {
  type: "trade_executed" | "bot_status_change" | "alert_triggered";
  data: any;
  timestamp: string;
}

interface WsNotificationState {
  notifications: WsNotificationEvent[];
  lastEvent: WsNotificationEvent | null;
  isConnected: boolean;
}

export function useWsNotifications(): WsNotificationState {
  const [notifications, setNotifications] = useState<WsNotificationEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WsNotificationEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function connect() {
      if (!mountedRef.current) return;
      
      const token = await getStoredToken();
      const url = `${buildWsUrl()}${token ? `?token=${token}` : ""}`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        console.error("WS Connection error:", err);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return ws.close();
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data) as WsNotificationEvent;
          setLastEvent(msg);
          setNotifications((prev) => [msg, ...prev].slice(0, 50));
        } catch (err) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setIsConnected(false);
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        // onclose will fire next
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { notifications, lastEvent, isConnected };
}
