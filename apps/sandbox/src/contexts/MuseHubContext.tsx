// Single source of truth for the MuseHub data layer.
//
// Authentication, wallet, and library entitlements are owned by the moose-hub
// backend (http://localhost:3000). On mount we hydrate from the server if a
// token is present. signIn redirects to moose-hub's OAuth /authorize page;
// the demo never sees the user's password.
//
// Local-only state (kept client-side):
//   - installingIds   — transient install animations
//   - uninstalledIds  — locally-uninstalled (but still entitled) plugins
//   - disabledPluginIds — Plugin Manager toggles
//
// Lives alongside the other app-level providers in App.tsx. Components use
// the granular hooks (useWalletBalance, useSignedIn, useUser,
// usePurchasedEffects, useDisabledPlugins) when they only need one slice,
// or useMuseHub() for the full surface (actions + state).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  hasToken,
  login as museHubLogin,
  logout as museHubLogout,
  getUserInfo,
  getWallet,
  getLibrary,
  spendWallet,
  buyPlugin,
  type MuseHubEntitlement,
} from '../lib/musehub-client';

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
  /** Wallet balance in USD (the server stores cents; this is dollars). */
  balance: number;
  signedIn: boolean;
  user: UserProfile;
  /** Kick off OAuth — navigates to moose-hub /authorize and never returns
   *  locally. Resolution happens on the /oauth/callback page. */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Charge the wallet for an arbitrary amount in USD. Returns once the
   *  server confirms. Optimistic local update is reconciled to the server
   *  response. */
  spend: (amountUsd: number, pluginId: string) => Promise<void>;

  // ---- Library --------------------------------------------------------
  /** Everything the user has bought — the full set of entitlements,
   *  regardless of whether the local copy is currently installed. */
  purchasedEffects: PurchasedEffect[];
  /** Effects the user has uninstalled locally — the entitlement remains so
   *  they can reinstall without paying again. Client-only state. */
  uninstalledIds: Set<string>;
  /** Effects currently being installed locally (purchase complete, install
   *  pending). Transient and client-only. */
  installingIds: Set<string>;
  /** Effects currently installed locally (purchased AND not uninstalled
   *  AND not still installing). */
  installedEffects: PurchasedEffect[];
  /** Purchase a plugin: atomic debit + entitlement on the server. */
  addToLibrary: (effect: PurchasedEffect) => Promise<void>;
  /** Drop the entitlement locally. The server does not yet expose a
   *  DELETE-entitlement endpoint, so this is client-only. */
  removeFromLibrary: (id: string) => void;
  /** Mark a previously-installed effect as uninstalled locally. */
  uninstallEffect: (id: string) => void;
  /** Re-install a previously-uninstalled effect (the entitlement is
   *  preserved either way, so this is free). */
  reinstallEffect: (id: string) => void;

  // ---- Plugin manager -------------------------------------------------
  disabledPluginIds: Set<string>;
  setPluginDisabled: (id: string, disabled: boolean) => void;
  /** Replace the disabled set wholesale from a full plugins list. The
   *  Plugin Manager dialog calls this when its enabled flags change. */
  syncDisabledFromList: (list: { id: string; enabled: boolean }[]) => void;
}

const MuseHubContext = createContext<MuseHubContextValue | null>(null);

const GUEST_USER: UserProfile = { name: 'Guest', email: '' };

// Client-only state still gets persisted across reloads. Wallet, user, and
// library state used to live here too — those now come from the server, so
// only the local-install toggles remain.
const STORAGE_KEY = 'musehub-local-v1';

interface PersistedLocal {
  uninstalledIds: string[];
  disabledPluginIds: string[];
}

function loadPersisted(): PersistedLocal {
  const empty: PersistedLocal = { uninstalledIds: [], disabledPluginIds: [] };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedLocal>;
    return {
      uninstalledIds: Array.isArray(parsed?.uninstalledIds)
        ? parsed.uninstalledIds.filter((s): s is string => typeof s === 'string')
        : [],
      disabledPluginIds: Array.isArray(parsed?.disabledPluginIds)
        ? parsed.disabledPluginIds.filter((s): s is string => typeof s === 'string')
        : [],
    };
  } catch {
    return empty;
  }
}

function entitlementToEffect(e: MuseHubEntitlement): PurchasedEffect {
  return { id: e.pluginId, name: e.pluginName, vendor: e.vendor };
}

export const MuseHubProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const persisted = useMemo(loadPersisted, []);

  // Server-backed state — populated by hydration after sign-in.
  const [signedIn, setSignedIn] = useState<boolean>(() => hasToken());
  const [user, setUser] = useState<UserProfile>(GUEST_USER);
  const [balance, setBalanceState] = useState<number>(0);
  const [purchasedEffects, setPurchasedEffects] = useState<PurchasedEffect[]>([]);

  // Local-only state.
  const [uninstalledIds, setUninstalledIds] = useState<Set<string>>(
    () => new Set(persisted.uninstalledIds),
  );
  const [installingIds, setInstallingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [disabledPluginIds, setDisabledPluginIds] = useState<Set<string>>(
    () => new Set(persisted.disabledPluginIds),
  );

  // Hydrate from the server when we have a token. If any call returns 401
  // after the client's transparent refresh, the client will throw and we
  // fall back to signed-out. Other errors leave us in a stale-but-signed-in
  // state, which the user can recover from by reloading.
  useEffect(() => {
    if (!hasToken()) {
      setSignedIn(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [info, wallet, library] = await Promise.all([
          getUserInfo(),
          getWallet(),
          getLibrary(),
        ]);
        if (cancelled) return;
        setUser({
          name: info.name,
          email: info.email,
          avatarUrl: info.avatarUrl,
        });
        setBalanceState(wallet.balanceCents / 100);
        setPurchasedEffects(library.entitlements.map(entitlementToEffect));
        setSignedIn(true);
      } catch {
        if (cancelled) return;
        setSignedIn(false);
        setUser(GUEST_USER);
        setBalanceState(0);
        setPurchasedEffects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist local-only fields (install / disabled toggles).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const snapshot: PersistedLocal = {
      uninstalledIds: Array.from(uninstalledIds),
      disabledPluginIds: Array.from(disabledPluginIds),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota / serialisation failures are non-fatal — local toggles
      // re-derive on the next session.
    }
  }, [uninstalledIds, disabledPluginIds]);

  // Helper to drive a simulated install: flag the id as installing, then
  // clear it after a short delay so callers can render a progress state.
  const simulateInstall = useCallback((id: string, durationMs = 1600) => {
    setInstallingIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setInstallingIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, durationMs);
  }, []);

  const signIn = useCallback(async () => {
    // Navigates away — returns a never-resolving Promise so callers can
    // still `await` it without blocking the page transition.
    await museHubLogin();
  }, []);

  const signOut = useCallback(async () => {
    await museHubLogout();
    setSignedIn(false);
    setUser(GUEST_USER);
    setBalanceState(0);
    setPurchasedEffects([]);
  }, []);

  const spend = useCallback(
    async (amountUsd: number, pluginId: string) => {
      const previousBalance = balance;
      // Optimistic update first so the wallet chip moves immediately.
      setBalanceState((b) => Math.max(0, b - amountUsd));
      try {
        const wallet = await spendWallet(Math.round(amountUsd * 100), pluginId);
        setBalanceState(wallet.balanceCents / 100);
      } catch (err) {
        // Server rejected — revert the optimistic update.
        setBalanceState(previousBalance);
        throw err;
      }
    },
    [balance],
  );

  const addToLibrary = useCallback(
    async (effect: PurchasedEffect) => {
      // Server atomically debits the wallet and creates the entitlement.
      // Local copy: append the effect (using the input shape we already
      // have, since the server entitlement may not include UX details)
      // and reconcile the balance to what the server reports.
      const result = await buyPlugin(effect.id);
      setBalanceState(result.balanceCents / 100);
      setPurchasedEffects((prev) =>
        prev.some((e) => e.id === effect.id) ? prev : [...prev, effect],
      );
      // Kick off the local install animation. The effect is visible in the
      // Owned page but absent from picker menus until this completes.
      simulateInstall(effect.id);
    },
    [simulateInstall],
  );

  const removeFromLibrary = useCallback((id: string) => {
    setPurchasedEffects((prev) => prev.filter((e) => e.id !== id));
    setUninstalledIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const uninstallEffect = useCallback((id: string) => {
    setUninstalledIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const reinstallEffect = useCallback(
    (id: string) => {
      setUninstalledIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      simulateInstall(id);
    },
    [simulateInstall],
  );

  const installedEffects = useMemo(
    () =>
      purchasedEffects.filter(
        (e) => !uninstalledIds.has(e.id) && !installingIds.has(e.id),
      ),
    [purchasedEffects, uninstalledIds, installingIds],
  );

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
        if (
          next.size === prev.size &&
          Array.from(next).every((id) => prev.has(id))
        ) {
          return prev;
        }
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
      purchasedEffects,
      uninstalledIds,
      installingIds,
      installedEffects,
      addToLibrary,
      removeFromLibrary,
      uninstallEffect,
      reinstallEffect,
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
      purchasedEffects,
      uninstalledIds,
      installingIds,
      installedEffects,
      addToLibrary,
      removeFromLibrary,
      uninstallEffect,
      reinstallEffect,
      disabledPluginIds,
      setPluginDisabled,
      syncDisabledFromList,
    ],
  );

  return (
    <MuseHubContext.Provider value={value}>{children}</MuseHubContext.Provider>
  );
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
export const usePurchasedEffects = (): PurchasedEffect[] =>
  useMuseHub().purchasedEffects;
export const useInstalledEffects = (): PurchasedEffect[] =>
  useMuseHub().installedEffects;
export const useUninstalledIds = (): Set<string> => useMuseHub().uninstalledIds;
export const useInstallingIds = (): Set<string> => useMuseHub().installingIds;
export const useDisabledPlugins = (): Set<string> =>
  useMuseHub().disabledPluginIds;
