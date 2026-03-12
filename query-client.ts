import { fetch } from "expo/fetch";
import { Platform } from "react-native";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// ────────────────────────────────────────────────────────────
// Token storage — SecureStore on native, localStorage on web
// ────────────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = "evolvus_access_token";
const REFRESH_TOKEN_KEY = "evolvus_refresh_token";

export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
    }
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof window !== "undefined"
        ? window.localStorage.getItem(REFRESH_TOKEN_KEY)
        : null;
    }
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    return;
  }
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch((e) =>
      console.warn("Failed to clear access token:", e),
    ),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch((e) =>
      console.warn("Failed to clear refresh token:", e),
    ),
  ]);
}

// ────────────────────────────────────────────────────────────
// Language header helpers
// ────────────────────────────────────────────────────────────

const LANGUAGE_STORAGE_KEY = "@evolvus_language";

// Cache the AsyncStorage module to avoid repeated dynamic imports on native.
let _asyncStorage: { getItem(key: string): Promise<string | null> } | null = null;
async function getAsyncStorage() {
  if (!_asyncStorage) {
    const mod = await import("@react-native-async-storage/async-storage");
    _asyncStorage = mod.default;
  }
  return _asyncStorage;
}

/**
 * Reads the user's current language code from AsyncStorage (native) or
 * localStorage (web).  Returns "en" as the fallback when nothing is stored.
 */
export async function getApiLang(): Promise<string> {
  try {
    if (Platform.OS === "web") {
      return (
        (typeof window !== "undefined" &&
          window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ||
        "en"
      );
    }
    const storage = await getAsyncStorage();
    return (await storage.getItem(LANGUAGE_STORAGE_KEY)) ?? "en";
  } catch {
    return "en";
  }
}



/**
 * Returns the backend API base URL.
 * On web, returns "" so relative paths are used (proxied via Metro to localhost:3001).
 * On native in dev mode, dynamically reads the Metro server host from expo-constants so
 * requests pass through Metro's proxy middleware (which forwards /api/* to localhost:3001).
 * Falls back to EXPO_PUBLIC_API_URL or localhost:3001.
 */
export function getApiUrl(): string {
  if (Platform.OS === "web") {
    return "";
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (__DEV__) {
    const hostUri =
      (Constants.expoConfig as any)?.hostUri ??
      (Constants as any).manifest?.debuggerHost ??
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const isTunnel = hostUri.includes(".exp.direct") || hostUri.includes("ngrok");
      const protocol = isTunnel ? "https" : "http";
      return `${protocol}://${hostUri}`;
    }
  }
  return "http://localhost:3001";
}

// ────────────────────────────────────────────────────────────
// Core request helpers
// ────────────────────────────────────────────────────────────

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = route.startsWith("http") ? route : `${baseUrl}${route}`;

  const token = await getStoredToken();
  const lang = await getApiLang();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  headers["Accept-Language"] = lang;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const route = queryKey.join("/") as string;
    const url = route.startsWith("http") ? route : `${baseUrl}${route}`;

    const token = await getStoredToken();
    const lang = await getApiLang();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    headers["Accept-Language"] = lang;

    const res = await fetch(url, { headers });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
