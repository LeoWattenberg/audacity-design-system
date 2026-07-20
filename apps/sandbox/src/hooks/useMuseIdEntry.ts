// Task 5.3: shared "Continue with Muse ID" state machine for the two
// service sign-in dialogs (wallet/AuthDialog.tsx for MuseHub,
// adieu/AdieuAuthDialog.tsx for audio.com) — the design spec's five-state
// behaviour table (docs/superpowers/specs/2026-07-13-muse-id-sso-design.md,
// "Using Muse ID to enter a service + the linking ladder").
//
// Extracted into one hook (rather than duplicated per dialog) because the
// state machine itself doesn't depend on which service it's entering —
// only the token-adoption/sign-out target and copy differ, and those are
// passed in by the caller. A shared hook can't call BOTH useMuseHub() and
// useAdieu() itself (conditional hook calls are illegal), so each dialog
// still owns its own service-context hook call and passes `adoptTokens`/
// `signOut` through.
//
// ---- How each state is detected --------------------------------------
//
// State 1 (linked, zero prompts), state 2 (same-email match, confirm
// before claiming), and state 3 (no match, create — stated plainly) all
// hinge on knowing, AT CLICK TIME, whether the target service already had
// an account under the Muse profile's email. moose-hub/adieu's
// `/api/auth/muse-exchange` routes resolve this server-side (museId link
// -> legacy token -> verified email -> JIT-provision, see each RP's
// route.ts) AND report which rung fired via `accountStatus` (fixed in the
// 5.3 review follow-up, 2026-07-20 — previously the RPs resolved the rung
// but never returned it, so every already-linked returning user fell
// through to an extra "Continue" click; see ServiceExchangeResult's doc
// comment in muse-id-client.ts).
//
// This hook reads that discriminator via an "optimistic exchange,
// confirm-to-keep, decline-to-revert" flow:
//
//   1. Call exchange. This is the SAME real, atomic resolve-or-create call
//      either way — nothing here makes it any more or less committed than
//      the endpoint already is.
//   2. If `accountStatus === 'matched-by-email'` (a match, not yet linked
//      before this call), hold the tokens WITHOUT adopting them and show
//      the recognition card. Confirming adopts them (state 2, satisfied);
//      declining reverses the just-established link (see declineClaim)
//      instead of leaving a silently-claimed account behind.
//   3. If `accountStatus === 'linked'`, the caller was already linked
//      before this call — adopt and finish with ZERO prompts (state 1).
//   4. Otherwise (`'created'`, `'linked-by-session'`, or absent) there is
//      nothing to confirm: adopt immediately and state the outcome
//      (state 3). `'linked-by-session'` isn't reachable from this hook's
//      CTA today (continueWithMuseId never sends a legacy_access_token —
//      only MuseIdContext's signup-time session-proof links do, and that
//      path doesn't consult accountStatus at all), but is handled the
//      same neutral way as an absent value for forward-safety.
//
// `accountStatus`/`display` remain optional in the type (museIdMock.ts
// and any RP-shape drift shouldn't be a hard client-side assumption) —
// an absent value still degrades to the same neutral "settled, not
// verified-new" copy it always has.
//
// State 4 (different email) is NOT server-detected — the spec frames it as
// user-initiated ("Have an account under a different email? Add it"), so
// it's simply an escape hatch offered alongside states 2 and 3's UI
// (declineClaim / useDifferentEmail) rather than something this hook tries
// to predict.
//
// Task 5.4: rung 3 itself (email B -> code -> linked/no_account) is wired
// here as four more phases (`different-email`, `different-email-code`,
// `different-email-result`, reusing `error` for anything unexpected) plus
// three actions (startLinkByEmail/verifyLinkByEmail/backToEmailStep). By
// the time `declineClaim` lands on `different-email`, `museId.signedIn` is
// still true (declineClaim only signs the caller out of THIS service, see
// its own comment below) — so a Muse Bearer token exists, which is exactly
// what `/api/link/start`/`/api/link/verify` (task 5.1) require. That's WHY
// this lives here rather than in MuseIdAuthDialog's pre-account-creation
// 'discovery' signup step: rung 3 is Bearer-gated (it's a post-creation
// linking rung, same family as `/api/link`), and no Muse token exists yet
// at that earlier point in signup — see muse-id-client.ts's linkStart doc
// comment. This hook's 'different-email' phase is the first point in
// either flow where a Muse session is guaranteed to already exist.
//
// Delegates to MuseIdContext.linkByEmailStart/linkByEmailVerify (not the
// muse-id-client functions directly) so MuseIdAccountsPage's own rung-3 UI
// (task 5.4, same task) shares one implementation of the hydrate-on-
// 'linked' behavior instead of duplicating it.
//
// State 5 (no Muse session) is handled by MuseIdContext.ensureSignedIn —
// opens MuseIdAuthDialog and resolves once sign-up/sign-in completes (or
// rejects on cancel), at which point this hook re-enters the table exactly
// as if a session had existed all along.

import { useCallback, useRef, useState } from 'react';
import {
  exchangeAdieu,
  exchangeMooseHub,
  exchangeResultToTokens,
  getAccessToken as getMuseAccessToken,
  MuseIdAuthError,
  type ServiceExchangeResult,
  type ServiceName,
} from '../lib/muse-id-client';
import { MuseIdSignInCancelledError, useMuseId } from '../contexts/MuseIdContext';

export interface MuseIdEntryTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface MuseIdEntryDisplay {
  name: string;
  maskedEmail: string;
  summary: string;
}

export type MuseIdEntryPhase =
  | { kind: 'idle' }
  | { kind: 'exchanging' }
  /** State 2: recognition card, confirm before claiming. */
  | { kind: 'confirm'; display: MuseIdEntryDisplay }
  /** State 1/3: nothing to confirm — `wasKnownNew` distinguishes the
   *  mock-verified "we just created this" copy from the real backend's
   *  ambiguous (accountStatus absent) case, where the copy stays neutral
   *  rather than asserting an outcome it can't actually verify. */
  | { kind: 'settled'; wasKnownNew: boolean }
  /** State 4, step 1: enter the candidate "email B". `error` renders
   *  inline (e.g. a transient failure sending the code) without losing the
   *  step — see file header. */
  | { kind: 'different-email'; error?: string }
  /** State 4, step 2: enter the code sent to `email`. `error` covers a bad/
   *  expired/exhausted code AND the two already-linked conflicts — all
   *  recoverable in place (retry the code, or go back and use another
   *  email), so none of them bounce out to the generic `error` phase. */
  | { kind: 'different-email-code'; email: string; error?: string }
  /** State 4, step 3 (terminal): `'linked'` — the service account at
   *  `email` is now linked; `'no_account'` — ownership was proven but
   *  there was nothing to link (nothing created, per the design's "rung 3
   *  only links existing accounts" rule). */
  | { kind: 'different-email-result'; status: 'linked' | 'no_account' }
  | { kind: 'error'; message: string };

export interface UseMuseIdEntryArgs {
  service: ServiceName;
  /** Adopts tokens into this service's own context (MuseHubContext.
   *  adoptTokens / AdieuContext.adoptTokens) — the caller passes its own
   *  service-context hook result through since this shared hook can't call
   *  useMuseHub()/useAdieu() itself (see file header). */
  adoptTokens: (tokens: MuseIdEntryTokens) => Promise<void>;
  /** Fully signs the caller out of this service — used by declineClaim to
   *  reverse an adopted session after a "not me" / "different email"
   *  decline. */
  signOut: () => Promise<void>;
  /** Called once the flow reaches a finalized sign-in (state 1's silent
   *  exchange, or confirmClaim). The dialog closes itself. */
  onDone: () => void;
}

export interface UseMuseIdEntryResult {
  phase: MuseIdEntryPhase;
  /** The CTA handler — call from the "Continue with Muse ID" button. */
  continueWithMuseId: () => Promise<void>;
  /** State 2's "Yes, that's me" action. */
  confirmClaim: () => Promise<void>;
  /** State 2's "Not me" action, and state 3/1's after-the-fact "actually,
   *  different email" link — both reverse whatever was just claimed/
   *  created and land on state 4's first step (`different-email`). */
  declineClaim: () => Promise<void>;
  /** Resets to idle (e.g. a "back"/"try again" affordance on the error
   *  phase). */
  reset: () => void;
  /** State 4 step 1 -> 2: sends the link-by-email code to `email`. Always
   *  succeeds from the caller's perspective (anti-enumeration) unless the
   *  request itself fails, in which case the `different-email` phase's
   *  `error` is set and the phase doesn't advance. */
  startLinkByEmail: (email: string) => Promise<void>;
  /** State 4 step 2 -> 3: checks `code` against `email`. Advances to
   *  `different-email-result` on success; on a bad code or an already-
   *  linked conflict, sets `different-email-code`'s `error` and stays put
   *  so the user can retry the code without re-entering the email. */
  verifyLinkByEmail: (email: string, code: string) => Promise<void>;
  /** State 4 step 2 -> 1: "use a different email" — back to the email
   *  field, discarding the in-flight code attempt. */
  backToEmailStep: () => void;
}

export function useMuseIdEntry({
  service,
  adoptTokens,
  signOut,
  onDone,
}: UseMuseIdEntryArgs): UseMuseIdEntryResult {
  const museId = useMuseId();
  const [phase, setPhase] = useState<MuseIdEntryPhase>({ kind: 'idle' });

  // Held between exchange and confirmClaim/declineClaim for state 2 — NOT
  // adopted until the user confirms. Cleared once consumed either way.
  const pendingTokensRef = useRef<MuseIdEntryTokens | null>(null);

  const runExchange = useCallback(
    (museAccessToken: string): Promise<ServiceExchangeResult> =>
      service === 'moose-hub' ? exchangeMooseHub(museAccessToken) : exchangeAdieu(museAccessToken),
    [service],
  );

  const continueWithMuseId = useCallback(async () => {
    try {
      if (!museId.signedIn) {
        try {
          await museId.ensureSignedIn('sign-in');
        } catch (err) {
          if (err instanceof MuseIdSignInCancelledError) {
            setPhase({ kind: 'idle' });
            return;
          }
          throw err;
        }
      }

      setPhase({ kind: 'exchanging' });
      const museAccessToken = getMuseAccessToken();
      if (!museAccessToken) throw new Error('Not signed in to Muse ID');
      const result = await runExchange(museAccessToken);
      const tokens = exchangeResultToTokens(result);

      if (result.accountStatus === 'matched-by-email' && result.display) {
        pendingTokensRef.current = tokens;
        setPhase({ kind: 'confirm', display: result.display });
        return;
      }

      await adoptTokens(tokens);
      await museId.hydrate();
      if (result.accountStatus === 'linked') {
        onDone();
        return;
      }
      setPhase({ kind: 'settled', wasKnownNew: result.accountStatus === 'created' });
    } catch (err) {
      const message =
        err instanceof MuseIdAuthError || err instanceof Error ? err.message : 'Something went wrong.';
      setPhase({ kind: 'error', message });
    }
  }, [museId, runExchange, adoptTokens, onDone]);

  const confirmClaim = useCallback(async () => {
    const tokens = pendingTokensRef.current;
    if (!tokens) return;
    pendingTokensRef.current = null;
    try {
      await adoptTokens(tokens);
      await museId.hydrate();
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setPhase({ kind: 'error', message });
    }
  }, [adoptTokens, museId, onDone]);

  const declineClaim = useCallback(async () => {
    const heldTokens = pendingTokensRef.current;
    pendingTokensRef.current = null;
    try {
      // Get a live session adopted first (if not already) so unlinkService's
      // RP-side clear has a token to act on, then fully sign back out —
      // net result is "not linked, not signed in", as if exchange had
      // never run. See file header ("optimistic exchange, confirm-to-keep,
      // decline-to-revert").
      if (heldTokens) await adoptTokens(heldTokens);
      try {
        await museId.unlinkService(service);
      } catch {
        // Best-effort — MuseIdContext.unlinkService already tolerates a
        // failed RP-side clear.
      }
      await signOut();
      setPhase({ kind: 'different-email' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setPhase({ kind: 'error', message });
    }
  }, [adoptTokens, signOut, museId, service]);

  const reset = useCallback(() => setPhase({ kind: 'idle' }), []);

  const startLinkByEmail = useCallback(
    async (email: string) => {
      const trimmed = email.trim();
      try {
        await museId.linkByEmailStart(service, trimmed);
        setPhase({ kind: 'different-email-code', email: trimmed });
      } catch (err) {
        const message =
          err instanceof MuseIdAuthError || err instanceof Error ? err.message : 'Something went wrong.';
        setPhase({ kind: 'different-email', error: message });
      }
    },
    [museId, service],
  );

  const verifyLinkByEmail = useCallback(
    async (email: string, code: string) => {
      try {
        const status = await museId.linkByEmailVerify(service, email, code.trim());
        setPhase({ kind: 'different-email-result', status });
      } catch (err) {
        setPhase({ kind: 'different-email-code', email, error: friendlyLinkByEmailError(err) });
      }
    },
    [museId, service],
  );

  const backToEmailStep = useCallback(() => setPhase({ kind: 'different-email' }), []);

  return {
    phase,
    continueWithMuseId,
    confirmClaim,
    declineClaim,
    reset,
    startLinkByEmail,
    verifyLinkByEmail,
    backToEmailStep,
  };
}

// Friendly copy for the rung-3 codes muse-id's `/api/link/verify` defines
// (see muse-id-client.ts's `linkVerify` doc comment) — kept service-neutral
// since this hook is shared between MuseHub and audio.com. Exported so
// MuseIdAccountsPage's own rung-3 UI (task 5.4, same task — Preferences ->
// Accounts, which drives MuseIdContext.linkByEmailStart/linkByEmailVerify
// directly rather than through this hook) doesn't need a second copy of
// the same mapping.
export function friendlyLinkByEmailError(err: unknown): string {
  const code = err instanceof MuseIdAuthError ? err.code : '';
  switch (code) {
    case 'code_invalid':
      return 'That code doesn’t match. Check your email and try again.';
    case 'code_expired':
      return 'That code has expired. Request a new one.';
    case 'too_many_attempts':
      return 'Too many wrong attempts. Request a new code to try again.';
    case 'user_already_linked':
      return 'Your Muse ID already has a different account linked for this service.';
    case 'service_account_already_linked':
      return 'That account is already linked to a different Muse ID.';
    default:
      return err instanceof Error ? err.message : 'Something went wrong.';
  }
}
