import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { apiRequest, storeTokens, clearTokens, getStoredToken, getStoredRefreshToken } from './query-client';

export type PlanType = 'free' | 'pro' | 'premium' | 'enterprise' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  plan: PlanType;
  emailVerified?: boolean;
  avatar?: string | null;
  createdAt: string;
  connectedExchanges: string[];
  totpEnabled?: boolean;
  settings: {
    currency: string;
    notifications: boolean;
    biometricAuth: boolean;
    theme: string;
  };
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** The plan actually used for UI checks. Admin can override this for preview. */
  effectivePlan: PlanType;
  planPreview: PlanType | null;
  setPlanPreview: (plan: PlanType | null) => void;
  login: (email: string, password: string, masterKey?: string) => Promise<boolean>;
  register: (email: string, username: string, password: string, plan: PlanType) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  /** Re-fetch the current user from /api/auth/me (e.g. after plan upgrade). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planPreview, setPlanPreviewState] = useState<PlanType | null>(null);

  const setPlanPreview = useCallback((plan: PlanType | null) => {
    if (user?.plan !== 'admin') return;
    setPlanPreviewState(plan);
  }, [user?.plan]);

  useEffect(() => {
    loadUser();
  }, []);

  // ────────────────────────────────────────────────────────
  // Session restoration on app start
  // ────────────────────────────────────────────────────────

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const accessToken = await getStoredToken();
      if (accessToken) {
        // Try to fetch current user with stored access token
        try {
          const res = await apiRequest('GET', '/api/auth/me');
          const data = await res.json() as { user: UserProfile };
          setUser(data.user);
          return;
        } catch {
          // Access token expired or invalid — fall through to refresh
        }
      }

      // Try refresh token
      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) { setUser(null); return; }

      const refreshRes = await apiRequest('POST', '/api/auth/refresh', { refreshToken });
      const refreshData = await refreshRes.json() as { accessToken: string; refreshToken: string };
      await storeTokens(refreshData.accessToken, refreshData.refreshToken);

      const meRes = await apiRequest('GET', '/api/auth/me');
      const meData = await meRes.json() as { user: UserProfile };
      setUser(meData.user);
    } catch {
      // All token attempts failed — clear and stay logged out
      await clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  // setIsLoading and setUser are stable setState references — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────────────────────
  // Auth actions
  // ────────────────────────────────────────────────────────

  async function login(email: string, password: string, masterKey?: string): Promise<boolean> {
    try {
      const body: Record<string, string> = { email, password };
      if (masterKey) body.masterKey = masterKey;
      const res = await apiRequest('POST', '/api/auth/login', body);
      const data = await res.json() as { user: UserProfile; accessToken: string; refreshToken: string };
      await storeTokens(data.accessToken, data.refreshToken ?? "");
      setUser(data.user);
      return true;
    } catch {
      return false;
    }
  }

  async function register(
    email: string,
    username: string,
    password: string,
    plan: PlanType,
  ): Promise<boolean> {
    try {
      const res = await apiRequest('POST', '/api/auth/register', { email, username, password, plan });
      const data = await res.json() as { user: UserProfile; accessToken: string; refreshToken: string };
      await storeTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return true;
    } catch {
      return false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await apiRequest('POST', '/api/auth/logout');
    } catch {
      // Best-effort — always clear local tokens even if server call fails
    }
    await clearTokens();
    setUser(null);
  }

  async function updateProfile(updates: Partial<UserProfile>): Promise<void> {
    try {
      const res = await apiRequest('PATCH', '/api/auth/profile', updates);
      const data = await res.json() as { user: UserProfile };
      setUser(data.user);
    } catch {
      // On failure keep local state unchanged
    }
  }

  const effectivePlan: PlanType = (user?.plan === 'admin' && planPreview) ? planPreview : (user?.plan ?? 'free');

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      effectivePlan,
      planPreview,
      setPlanPreview,
      login,
      register,
      logout,
      updateProfile,
      refreshUser: loadUser,
    }),
    [user, isLoading, effectivePlan, planPreview, setPlanPreview, login, register, logout, updateProfile, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
