import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '@/lib/query-client';

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

const STORAGE_KEY = '@evolvus_user_level';

interface UserLevelContextValue {
  level: UserLevel;
  isBeginner: boolean;
  isIntermediate: boolean;
  isAdvanced: boolean;
  setLevel: (l: UserLevel) => void;
  canAccess: (minLevel: UserLevel) => boolean;
}

const LEVEL_ORDER: Record<UserLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const UserLevelContext = createContext<UserLevelContextValue>({
  level: 'beginner',
  isBeginner: true,
  isIntermediate: false,
  isAdvanced: false,
  setLevel: () => {},
  canAccess: () => true,
});

export function UserLevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<UserLevel>('beginner');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'beginner' || stored === 'intermediate' || stored === 'advanced') {
        setLevelState(stored);
      }
    });
  }, []);

  const setLevel = useCallback((l: UserLevel) => {
    setLevelState(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
    apiRequest('PATCH', '/api/user/level', { level: l }).catch(() => {});
  }, []);

  const syncFromBackend = useCallback((userLevel: UserLevel | undefined) => {
    if (userLevel === 'beginner' || userLevel === 'intermediate' || userLevel === 'advanced') {
      setLevelState(userLevel);
      AsyncStorage.setItem(STORAGE_KEY, userLevel);
    }
  }, []);

  const canAccess = useCallback((minLevel: UserLevel) => {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
  }, [level]);

  return (
    <UserLevelContext.Provider value={{
      level,
      isBeginner: level === 'beginner',
      isIntermediate: level === 'intermediate',
      isAdvanced: level === 'advanced',
      setLevel,
      canAccess,
      syncFromBackend,
    } as UserLevelContextValue & { syncFromBackend: (l: UserLevel | undefined) => void }}>
      {children}
    </UserLevelContext.Provider>
  );
}

export function useUserLevel() {
  return useContext(UserLevelContext);
}
