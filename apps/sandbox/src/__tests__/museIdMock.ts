// Network-boundary mock for muse-id + the two relying parties' Muse-related
// routes (moose-hub, adieu). Mirrors audioMock.ts's spirit — a small,
// self-contained fake standing in for infrastructure this repo doesn't own
// — but the boundary here is `fetch()` itself, not a package import: unlike
// '@audacity-ui/audio', muse-id-client.ts/musehub-client.ts/adieu-client.ts
// call `fetch` directly against hardcoded base URLs (localhost:3002/3000/
// 3001, the same defaults the real services use), so stubbing global fetch
// IS the network boundary for this module.
//
// Deliberately NOT a faithful re-implementation of the three real Next.js
// route handlers — just enough state (users, tokens, links) and enough of
// their request/response shapes to drive the flows MuseIdContext exercises:
// start -> verify -> complete, signin, muse-exchange (+ JIT-provision /
// email-match), userinfo, link/unlink, revoke.
//
// Usage: call `createMuseIdMock()` once per test file, `vi.stubGlobal
// ('fetch', mock.fetchMock)` in a beforeEach, and `mock.reset()` in
// afterEach (clears all in-memory state AND the spy's call history — do NOT
// reuse a mock instance's state across tests).
import { vi, type Mock } from 'vitest';
// Base URLs are re-exported from the real client modules (NOT hardcoded
// localhost defaults) so this mock stays correct even when
// apps/sandbox/.env pins VITE_MUSEHUB_BASE_URL/VITE_ADIEU_BASE_URL to the
// deployed Railway origins (as it does today) — the clients read those env
// vars at import time, so the mock must route to whatever they actually
// resolved to, not what a fresh checkout's defaults would be.
import { MUSEID_BASE } from '../lib/muse-id-client';
import { MUSEHUB_BASE } from '../lib/musehub-client';
import { ADIEU_BASE } from '../lib/adieu-client';

export type ServiceName = 'moose-hub' | 'adieu';

export { MUSEID_BASE, MUSEHUB_BASE as MOOSEHUB_BASE, ADIEU_BASE };

const FIXED_CODE = '000000';

interface MuseUserRecord {
  id: string;
  email: string;
  name: string;
  password: string;
  avatarUrl?: string;
  linkedServices: Set<ServiceName>;
}

interface ServiceUserRecord {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

interface TokenOwner {
  kind: 'muse' | ServiceName;
  email: string;
}

interface MockState {
  museUsers: Map<string, MuseUserRecord>;
  serviceUsers: Record<ServiceName, Map<string, ServiceUserRecord>>;
  accessTokens: Map<string, TokenOwner>;
  refreshTokens: Map<string, TokenOwner>;
  pendingVerification: Map<string, { verified: boolean }>;
  /** One-shot: the next request whose URL contains this substring 500s. */
  failing: Set<string>;
}

function freshState(): MockState {
  return {
    museUsers: new Map(),
    serviceUsers: { 'moose-hub': new Map(), adieu: new Map() },
    accessTokens: new Map(),
    refreshTokens: new Map(),
    pendingVerification: new Map(),
    failing: new Set(),
  };
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getHeader(init: RequestInit | undefined, name: string): string | undefined {
  const headers = init?.headers;
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const rec = headers as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? rec[key] : undefined;
}

function bearerEmail(state: MockState, kind: TokenOwner['kind'], init: RequestInit | undefined): string | null {
  const auth = getHeader(init, 'authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const owner = state.accessTokens.get(auth.slice('Bearer '.length));
  if (!owner || owner.kind !== kind) return null;
  return owner.email;
}

export interface MuseIdMockControls {
  fetchMock: Mock;
  /** Pre-seeds an existing Muse ID (for sign-in / password-reset tests). */
  seedMuseUser(input: {
    email: string;
    password: string;
    name: string;
    avatarUrl?: string;
    linkedServices?: ServiceName[];
  }): void;
  /** Pre-seeds an existing service account so discovery/email-match linking
   *  has something to find. */
  seedServiceUser(service: ServiceName, input: { email: string; id?: string; name: string }): void;
  /** Forces the NEXT request whose URL contains `urlIncludes` to 500. One-
   *  shot — consumed on first match. */
  failNext(urlIncludes: string): void;
  /** Test-side lookup of the Muse access token most recently minted for an
   *  email (signIn/verify/complete all mint one) — lets a test call the
   *  client directly without threading the token through context state. */
  museAccessTokenFor(email: string): string | undefined;
  /** Clears ALL in-memory state and the spy's call history. */
  reset(): void;
}

export function createMuseIdMock(): MuseIdMockControls {
  let state = freshState();

  function mintTokens(kind: TokenOwner['kind'], email: string) {
    const access_token = nextId(`${kind}-access`);
    const refresh_token = nextId(`${kind}-refresh`);
    state.accessTokens.set(access_token, { kind, email });
    state.refreshTokens.set(refresh_token, { kind, email });
    return { access_token, refresh_token, expires_in: 3600 };
  }

  function jsonBody<T>(init: RequestInit | undefined): T {
    return typeof init?.body === 'string' ? (JSON.parse(init.body) as T) : ({} as T);
  }

  function formBody(init: RequestInit | undefined): URLSearchParams {
    return new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
  }

  async function router(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();

    for (const substr of state.failing) {
      if (url.includes(substr)) {
        state.failing.delete(substr);
        return jsonResponse({ error: 'mock_forced_failure' }, 500);
      }
    }

    const { pathname: path } = new URL(url);

    // ---- muse-id ------------------------------------------------------
    if (url.startsWith(MUSEID_BASE)) {
      if (path === '/api/auth/start' && method === 'POST') {
        const { email } = jsonBody<{ email: string }>(init);
        state.pendingVerification.set(email.toLowerCase(), { verified: false });
        return jsonResponse({ ok: true });
      }

      if (path === '/api/auth/verify' && method === 'POST') {
        const body = jsonBody<{ email: string; code: string; purpose?: string; password?: string }>(init);
        const email = body.email.toLowerCase();
        const pending = state.pendingVerification.get(email);
        if (!pending || body.code !== FIXED_CODE) return jsonResponse({ error: 'code_invalid' }, 400);

        const existing = state.museUsers.get(email);
        if (existing) {
          if (body.purpose !== 'reset') return jsonResponse({ error: 'password_required' }, 400);
          if (!body.password) return jsonResponse({ error: 'invalid_request' }, 400);
          existing.password = body.password;
          state.pendingVerification.delete(email);
          return jsonResponse({
            status: 'reset',
            ...mintTokens('muse', email),
            token_type: 'Bearer',
            scope: 'profile',
            user: { id: existing.id, email, name: existing.name, avatarUrl: existing.avatarUrl },
          });
        }

        pending.verified = true;
        const discovery = (['moose-hub', 'adieu'] as ServiceName[])
          .map((service) => {
            const su = state.serviceUsers[service].get(email);
            return su
              ? { service, userId: su.id, display: { name: su.name, summary: `${service} account` } }
              : null;
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        return jsonResponse({ status: 'new', discovery });
      }

      if (path === '/api/auth/complete' && method === 'POST') {
        const body = jsonBody<{
          email: string;
          name: string;
          password: string;
          avatarChoice?: string;
          links?: { service: ServiceName; method: string }[];
        }>(init);
        const email = body.email.toLowerCase();
        const pending = state.pendingVerification.get(email);
        if (!pending || !pending.verified) return jsonResponse({ error: 'not_verified' }, 400);
        if (state.museUsers.has(email)) return jsonResponse({ error: 'email_taken' }, 409);

        const user: MuseUserRecord = {
          id: nextId('muse-user'),
          email,
          name: body.name,
          password: body.password,
          avatarUrl: body.avatarChoice,
          linkedServices: new Set(),
        };
        const linkedServices: ServiceName[] = [];
        for (const l of body.links ?? []) {
          if (l.method === 'email-match' && state.serviceUsers[l.service].has(email)) {
            user.linkedServices.add(l.service);
            linkedServices.push(l.service);
          }
        }
        state.museUsers.set(email, user);
        state.pendingVerification.delete(email);
        return jsonResponse({
          ...mintTokens('muse', email),
          token_type: 'Bearer',
          scope: 'profile',
          user: { id: user.id, email, name: user.name, avatarUrl: user.avatarUrl },
          linkedServices,
        });
      }

      if (path === '/api/auth/signin' && method === 'POST') {
        const body = jsonBody<{ email: string; password: string; client_id: string }>(init);
        const email = body.email.toLowerCase();
        const user = state.museUsers.get(email);
        if (!user || user.password !== body.password) return jsonResponse({ error: 'invalid_credentials' }, 401);
        return jsonResponse({
          ...mintTokens('muse', email),
          token_type: 'Bearer',
          scope: 'profile',
          user: { id: user.id, email, name: user.name, avatarUrl: user.avatarUrl },
        });
      }

      if (path === '/api/oauth/userinfo' && method === 'GET') {
        const email = bearerEmail(state, 'muse', init);
        const user = email ? state.museUsers.get(email) : undefined;
        if (!email || !user) return jsonResponse({ error: 'invalid_token' }, 401);
        return jsonResponse({
          sub: user.id,
          email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          linkedServices: Array.from(user.linkedServices),
        });
      }

      if (path === '/api/link' && method === 'POST') {
        const email = bearerEmail(state, 'muse', init);
        const user = email ? state.museUsers.get(email) : undefined;
        if (!email || !user) return jsonResponse({ error: 'invalid_token' }, 401);
        const { service } = jsonBody<{ service: ServiceName }>(init);
        user.linkedServices.add(service);
        return jsonResponse({ ok: true, linked: true, service });
      }

      if (path === '/api/unlink' && method === 'POST') {
        const email = bearerEmail(state, 'muse', init);
        const user = email ? state.museUsers.get(email) : undefined;
        if (!email || !user) return jsonResponse({ error: 'invalid_token' }, 401);
        const { service } = jsonBody<{ service: ServiceName }>(init);
        user.linkedServices.delete(service);
        return jsonResponse({ ok: true });
      }

      if (path === '/api/oauth/revoke' && method === 'POST') {
        const contentType = getHeader(init, 'content-type') ?? '';
        const token = contentType.includes('application/json')
          ? jsonBody<{ token?: string }>(init).token
          : formBody(init).get('token');
        if (token) state.refreshTokens.delete(token);
        return jsonResponse({ ok: true });
      }

      if (path === '/api/oauth/token' && method === 'POST') {
        const form = formBody(init);
        const owner = state.refreshTokens.get(form.get('refresh_token') ?? '');
        if (!owner) return jsonResponse({ error: 'invalid_grant' }, 400);
        return jsonResponse({ ...mintTokens(owner.kind, owner.email), token_type: 'Bearer', scope: 'profile' });
      }
    }

    // ---- moose-hub / adieu (shared route shapes) -----------------------
    for (const [base, service] of [
      [MUSEHUB_BASE, 'moose-hub'],
      [ADIEU_BASE, 'adieu'],
    ] as [string, ServiceName][]) {
      if (!url.startsWith(base)) continue;

      if (path === '/api/auth/muse-exchange' && method === 'POST') {
        const body = jsonBody<{ muse_access_token: string; legacy_access_token?: string }>(init);
        const museOwner = state.accessTokens.get(body.muse_access_token);
        const museUser = museOwner && museOwner.kind === 'muse' ? state.museUsers.get(museOwner.email) : undefined;
        if (!museOwner || !museUser) return jsonResponse({ error: 'invalid_muse_token' }, 401);

        let su = state.serviceUsers[service].get(museOwner.email);
        if (!su && body.legacy_access_token) {
          const legacyOwner = state.accessTokens.get(body.legacy_access_token);
          if (legacyOwner && legacyOwner.kind === service) {
            su = state.serviceUsers[service].get(legacyOwner.email);
          }
        }
        if (!su) {
          su = { id: nextId(`${service}-user`), email: museOwner.email, name: museUser.name, avatarUrl: museUser.avatarUrl };
          state.serviceUsers[service].set(museOwner.email, su);
        }
        museUser.linkedServices.add(service);

        return jsonResponse({
          ...mintTokens(service, museOwner.email),
          token_type: 'Bearer',
          scope: service === 'moose-hub' ? 'profile library:read wallet:write' : 'profile projects:write',
          user: { id: su.id, email: su.email, name: su.name },
        });
      }

      if (path === '/api/oauth/userinfo' && method === 'GET') {
        const email = bearerEmail(state, service, init);
        const su = email ? state.serviceUsers[service].get(email) : undefined;
        if (!email || !su) return jsonResponse({ error: 'invalid_token' }, 401);
        return jsonResponse({ id: su.id, email: su.email, name: su.name, avatarUrl: su.avatarUrl });
      }

      if (path === '/api/me/wallet' && method === 'GET' && service === 'moose-hub') {
        const email = bearerEmail(state, service, init);
        if (!email) return jsonResponse({ error: 'invalid_token' }, 401);
        return jsonResponse({ balanceCents: 0 });
      }

      if (path === '/api/me/library' && method === 'GET' && service === 'moose-hub') {
        const email = bearerEmail(state, service, init);
        if (!email) return jsonResponse({ error: 'invalid_token' }, 401);
        return jsonResponse({ entitlements: [] });
      }

      if (path === '/api/projects' && method === 'GET' && service === 'adieu') {
        const email = bearerEmail(state, service, init);
        if (!email) return jsonResponse({ error: 'invalid_token' }, 401);
        return jsonResponse({ projects: [] });
      }

      if (path === '/api/auth/muse-unlink' && method === 'POST') {
        const email = bearerEmail(state, service, init);
        if (!email) return jsonResponse({ error: 'invalid_token' }, 401);
        return jsonResponse({ ok: true });
      }

      if (path === '/api/oauth/revoke' && method === 'POST') {
        return jsonResponse({ ok: true });
      }
    }

    throw new Error(`museIdMock: unhandled request ${method} ${url}`);
  }

  const fetchMock = vi.fn(router);

  return {
    fetchMock,
    seedMuseUser(input) {
      const email = input.email.toLowerCase();
      state.museUsers.set(email, {
        id: nextId('muse-user'),
        email,
        name: input.name,
        password: input.password,
        avatarUrl: input.avatarUrl,
        linkedServices: new Set(input.linkedServices ?? []),
      });
    },
    seedServiceUser(service, input) {
      const email = input.email.toLowerCase();
      state.serviceUsers[service].set(email, { id: input.id ?? nextId(`${service}-user`), email, name: input.name });
    },
    failNext(urlIncludes) {
      state.failing.add(urlIncludes);
    },
    museAccessTokenFor(email) {
      const target = email.toLowerCase();
      for (const [token, owner] of state.accessTokens) {
        if (owner.kind === 'muse' && owner.email === target) return token;
      }
      return undefined;
    },
    reset() {
      state = freshState();
      fetchMock.mockClear();
    },
  };
}
