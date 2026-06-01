// Single source of truth for the MuseHub data layer:
//   - the user's wallet balance and sign-in state
//   - the library of effects they've purchased this session
//   - which plugin IDs are currently disabled in the Plugin Manager
//
// Lives alongside the other app-level providers in App.tsx. Components use
// the granular hooks (useWalletBalance, useSignedIn, useUser,
// usePurchasedEffects, useDisabledPlugins) when they only need one slice,
// or useMuseHub() for the full surface (actions + state).

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface PurchasedEffect {
  id: string;
  name: string;
  vendor: string;
}

interface MuseHubContextValue {
  // ---- Wallet ---------------------------------------------------------
  balance: number;
  signedIn: boolean;
  user: UserProfile;
  signIn: () => Promise<void>;
  signOut: () => void;
  spend: (amount: number) => void;
  setBalance: (next: number) => void;

  // ---- Library --------------------------------------------------------
  purchasedEffects: PurchasedEffect[];
  addToLibrary: (effect: PurchasedEffect) => void;

  // ---- Plugin manager -------------------------------------------------
  disabledPluginIds: Set<string>;
  setPluginDisabled: (id: string, disabled: boolean) => void;
  /** Replace the disabled set wholesale from a full plugins list. The
   *  Plugin Manager dialog calls this when its enabled flags change. */
  syncDisabledFromList: (list: { id: string; enabled: boolean }[]) => void;
}

const MuseHubContext = createContext<MuseHubContextValue | null>(null);

const DEFAULT_USER: UserProfile = {
  name: 'Alex Dawson',
  email: 'a.dawson@mu.se',
};

export const MuseHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalanceState] = useState(42.5);
  const [signedIn, setSignedIn] = useState(false);
  const [user] = useState<UserProfile>(DEFAULT_USER);
  const [purchasedEffects, setPurchasedEffects] = useState<PurchasedEffect[]>([]);
  const [disabledPluginIds, setDisabledPluginIds] = useState<Set<string>>(() => new Set());

  const signIn = useCallback(() => {
    // Simulated MuseHub OAuth — the UI shows a "Signing in…" spinner during
    // this delay.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setSignedIn(true);
        resolve();
      }, 1500);
    });
  }, []);

  const signOut = useCallback(() => setSignedIn(false), []);

  const spend = useCallback((amount: number) => {
    setBalanceState((b) => Math.max(0, b - amount));
  }, []);

  const setBalance = useCallback((next: number) => {
    setBalanceState(Math.max(0, next));
  }, []);

  const addToLibrary = useCallback((effect: PurchasedEffect) => {
    setPurchasedEffects((prev) =>
      prev.some((e) => e.id === effect.id) ? prev : [...prev, effect],
    );
  }, []);

  const setPluginDisabled = useCallback((id: string, disabled: boolean) => {
    setDisabledPluginIds((prev) => {
      const has = prev.has(id);
      if (disabled === has) return prev;
      const next = new Set(prev);
      if (disabled) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const syncDisabledFromList = useCallback(
    (list: { id: string; enabled: boolean }[]) => {
      setDisabledPluginIds((prev) => {
        const next = new Set<string>();
        for (const p of list) if (!p.enabled) next.add(p.id);
        if (next.size === prev.size && Array.from(next).every((id) => prev.has(id))) return prev;
        return next;
      });
    },
    [],
  );

  const value = useMemo<MuseHubContextValue>(
    () => ({
      balance,
      signedIn,
      user,
      signIn,
      signOut,
      spend,
      setBalance,
      purchasedEffects,
      addToLibrary,
      disabledPluginIds,
      setPluginDisabled,
      syncDisabledFromList,
    }),
    [
      balance,
      signedIn,
      user,
      signIn,
      signOut,
      spend,
      setBalance,
      purchasedEffects,
      addToLibrary,
      disabledPluginIds,
      setPluginDisabled,
      syncDisabledFromList,
    ],
  );

  return <MuseHubContext.Provider value={value}>{children}</MuseHubContext.Provider>;
};

export function useMuseHub(): MuseHubContextValue {
  const ctx = useContext(MuseHubContext);
  if (!ctx) {
    throw new Error('useMuseHub must be used inside <MuseHubProvider>');
  }
  return ctx;
}

// ---- Granular selectors (preserve the previous hook names) -------------

export const useWalletBalance = (): number => useMuseHub().balance;
export const useSignedIn = (): boolean => useMuseHub().signedIn;
export const useUser = (): UserProfile => useMuseHub().user;
export const usePurchasedEffects = (): PurchasedEffect[] => useMuseHub().purchasedEffects;
export const useDisabledPlugins = (): Set<string> => useMuseHub().disabledPluginIds;
