import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TradeMode = 'lite' | 'pro';

const STORAGE_KEY = '@evolvus_trade_mode';

interface LiteProContextValue {
  mode: TradeMode;
  isLite: boolean;
  isPro: boolean;
  toggle: () => void;
  setMode: (m: TradeMode) => void;
}

const LiteProContext = createContext<LiteProContextValue>({
  mode: 'pro',
  isLite: false,
  isPro: true,
  toggle: () => {},
  setMode: () => {},
});

export function LiteProProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TradeMode>('pro');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'lite' || stored === 'pro') setModeState(stored);
    });
  }, []);

  const setMode = useCallback((m: TradeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'lite' ? 'pro' : 'lite');
  }, [mode, setMode]);

  return (
    <LiteProContext.Provider value={{ mode, isLite: mode === 'lite', isPro: mode === 'pro', toggle, setMode }}>
      {children}
    </LiteProContext.Provider>
  );
}

export function useLitePro() {
  return useContext(LiteProContext);
}
