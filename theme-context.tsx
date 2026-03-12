import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth, PlanType } from './auth-context';

export interface PlanTheme {
  primary: string;
  primaryDim: string;
  accent: string;
  nucleusColor: string;
  orbitColor: string;
  electronColor: string;
  intensity: "low" | "medium" | "high" | "ultra";
  gradientStart: string;
  gradientEnd: string;
  tabActive: string;
  planGlow: string;
}

const PLAN_THEMES: Record<PlanType, PlanTheme> = {
  free: {
    primary: '#6B7A99',
    primaryDim: 'rgba(107, 122, 153, 0.15)',
    accent: '#8A94A6',
    nucleusColor: '#6B7A99',
    orbitColor: '#4A5568',
    electronColor: '#718096',
    intensity: 'low',
    gradientStart: '#131A2A',
    gradientEnd: '#1A2138',
    tabActive: '#6B7A99',
    planGlow: 'rgba(107, 122, 153, 0.08)',
  },
  pro: {
    primary: '#00D4AA',
    primaryDim: 'rgba(0, 212, 170, 0.15)',
    accent: '#00B894',
    nucleusColor: '#00D4AA',
    orbitColor: '#00B894',
    electronColor: '#00D4AA',
    intensity: 'medium',
    gradientStart: '#0A1A1A',
    gradientEnd: '#0D2525',
    tabActive: '#00D4AA',
    planGlow: 'rgba(0, 212, 170, 0.08)',
  },
  premium: {
    primary: '#7B61FF',
    primaryDim: 'rgba(123, 97, 255, 0.15)',
    accent: '#9B59B6',
    nucleusColor: '#7B61FF',
    orbitColor: '#9B59B6',
    electronColor: '#A78BFA',
    intensity: 'high',
    gradientStart: '#120E2A',
    gradientEnd: '#1A1440',
    tabActive: '#7B61FF',
    planGlow: 'rgba(123, 97, 255, 0.08)',
  },
  enterprise: {
    primary: '#FFB74D',
    primaryDim: 'rgba(255, 183, 77, 0.15)',
    accent: '#F59E0B',
    nucleusColor: '#FFB74D',
    orbitColor: '#F59E0B',
    electronColor: '#FBBF24',
    intensity: 'ultra',
    gradientStart: '#1A1508',
    gradientEnd: '#251E0D',
    tabActive: '#FFB74D',
    planGlow: 'rgba(255, 183, 77, 0.08)',
  },
  admin: {
    primary: '#00D4E8',
    primaryDim: 'rgba(0, 212, 232, 0.15)',
    accent: '#00B8CC',
    nucleusColor: '#00D4E8',
    orbitColor: '#00B8CC',
    electronColor: '#67E8F9',
    intensity: 'ultra',
    gradientStart: '#091A1E',
    gradientEnd: '#0D2530',
    tabActive: '#00D4E8',
    planGlow: 'rgba(0, 212, 232, 0.10)',
  },
};

interface ThemeContextValue {
  planTheme: PlanTheme;
  planType: PlanType;
}

const ThemeContext = createContext<ThemeContextValue>({
  planTheme: PLAN_THEMES.free,
  planType: 'free',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { effectivePlan } = useAuth();
  const planType = effectivePlan as PlanType;
  const value = useMemo(() => ({
    planTheme: PLAN_THEMES[planType] ?? PLAN_THEMES.free,
    planType,
  }), [planType]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function usePlanTheme() {
  return useContext(ThemeContext);
}
