// Sandbox-side content for the Preferences → Accounts page (Task 3.2b).
//
// Replaces the old per-service MuseHubAccountSection with a UNIFIED Muse
// identity surface: one Muse ID card (name/email/avatar + global sign-out)
// plus a "Linked services" section listing MuseHub and audio.com with their
// linked/unlinked state and Link/Unlink actions.
//
// Link/Unlink call MuseIdContext.linkService/unlinkService (Task 3.1) —
// this is the first UI to exercise them. linkService is session-proof only
// (it needs a live legacy access token); when no legacy session exists for
// a service, this page explains that and offers the legacy sign-in button
// as the linking mechanism itself (NOT gated by the debug toggle — a live
// legacy session is the actual precondition for session-proof linking, see
// docs/superpowers/specs/2026-07-13-muse-id-sso-design.md's linking ladder).
//
// When signed out of Muse ID, "Continue with Muse ID" is the primary CTA.
// The legacy MuseHubAccountSection stays reachable behind the Debug panel's
// "Show legacy sign-in dialogs" toggle (regression path + demo contrast).

import React from 'react';
import { useMuseId } from '../../contexts/MuseIdContext';
import { useMuseHub } from '../../contexts/MuseHubContext';
import { useAdieu } from '../../contexts/AdieuContext';
import { getAccessToken as getMuseHubAccessToken } from '../../lib/musehub-client';
import { getAccessToken as getAdieuAccessToken } from '../../lib/adieu-client';
import type { ServiceName } from '../../lib/muse-id-client';
import { MuseHubAccountSection } from '../wallet/MuseHubAccountSection';
import './MuseIdAccountsPage.css';

const SERVICE_LABELS: Record<ServiceName, string> = {
  'moose-hub': 'MuseHub',
  adieu: 'audio.com',
};

function formatUSD(amount: number): string {
  const isWhole = Math.abs(amount - Math.round(amount)) < 0.005;
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const MuseIdAccountsPage: React.FC = () => {
  const museId = useMuseId();
  const museHub = useMuseHub();
  const adieu = useAdieu();
  const [linkingService, setLinkingService] = React.useState<ServiceName | null>(null);
  const [linkError, setLinkError] = React.useState<string | null>(null);

  const hasLegacySession = (service: ServiceName): boolean =>
    service === 'moose-hub' ? museHub.signedIn : adieu.signedIn;

  const legacyAccessToken = (service: ServiceName): string | null =>
    service === 'moose-hub' ? getMuseHubAccessToken() : getAdieuAccessToken();

  const handleLink = async (service: ServiceName) => {
    const token = legacyAccessToken(service);
    if (!token) return;
    setLinkError(null);
    setLinkingService(service);
    try {
      await museId.linkService(service, token);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : `Failed to link ${SERVICE_LABELS[service]}.`);
    } finally {
      setLinkingService(null);
    }
  };

  const handleUnlink = async (service: ServiceName) => {
    setLinkError(null);
    setLinkingService(service);
    try {
      await museId.unlinkService(service);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : `Failed to unlink ${SERVICE_LABELS[service]}.`);
    } finally {
      setLinkingService(null);
    }
  };

  const openLegacySignIn = (service: ServiceName) => {
    if (service === 'moose-hub') museHub.openAuthDialog('sign-in');
    else adieu.openAuthDialog('sign-in');
  };

  return (
    <div className="museid-accounts">
      <header className="museid-accounts__header">
        <h3>Muse ID</h3>
        <p className="museid-accounts__lead">
          One account for MuseHub and audio.com. Sign in once, then link or
          unlink each service below.
        </p>
      </header>

      {museId.signedIn && museId.profile ? (
        <div className="museid-accounts__card">
          <div className="museid-accounts__identity">
            <span
              className="museid-accounts__avatar"
              aria-hidden="true"
              style={{
                backgroundImage: museId.profile.avatarUrl ? `url(${museId.profile.avatarUrl})` : undefined,
              }}
            >
              {!museId.profile.avatarUrl && initials(museId.profile.name)}
            </span>
            <div className="museid-accounts__identity-meta">
              <div className="museid-accounts__name">{museId.profile.name}</div>
              <div className="museid-accounts__email">{museId.profile.email}</div>
            </div>
            <button
              type="button"
              className="museid-accounts__btn museid-accounts__btn--ghost"
              onClick={() => { void museId.signOutEverywhere(); }}
            >
              Sign out everywhere
            </button>
          </div>
        </div>
      ) : (
        <div className="museid-accounts__card museid-accounts__card--signed-out">
          <p className="museid-accounts__signed-out-text">
            You're not signed in. Continue with Muse ID for one identity
            across MuseHub and audio.com.
          </p>
          <div className="museid-accounts__actions">
            <button
              type="button"
              className="museid-accounts__btn museid-accounts__btn--primary"
              onClick={() => museId.openAuthDialog('sign-up')}
            >
              Continue with Muse ID
            </button>
            <button
              type="button"
              className="museid-accounts__btn museid-accounts__btn--ghost"
              onClick={() => museId.openAuthDialog('sign-in')}
            >
              Sign in
            </button>
          </div>
        </div>
      )}

      {/* Linked services — always visible (even signed out) so the page
          previews what Muse ID unlocks; actions are disabled until signed
          in. Service labels ("MuseHub"/"audio.com") are plain text so this
          section doubles as the Accounts page's distinguishing content. */}
      <div className="museid-accounts__services">
        <h4 className="museid-accounts__services-title">Linked services</h4>

        {(['moose-hub', 'adieu'] as ServiceName[]).map((service) => {
          const linked = museId.signedIn && museId.linkedServices.includes(service);
          const busy = linkingService === service;
          return (
            <div key={service} className="museid-accounts__service-row">
              <div className="museid-accounts__service-meta">
                <span className="museid-accounts__service-name">{SERVICE_LABELS[service]}</span>
                {!museId.signedIn ? (
                  <span className="museid-accounts__service-summary">
                    Sign in with Muse ID to link this service.
                  </span>
                ) : linked ? (
                  <span className="museid-accounts__service-summary">
                    {service === 'moose-hub'
                      ? `${formatUSD(museHub.balance)} · ${museHub.purchasedEffects.length} plugin${museHub.purchasedEffects.length === 1 ? '' : 's'}`
                      : `${adieu.cloudProjects.length} cloud project${adieu.cloudProjects.length === 1 ? '' : 's'}`}
                  </span>
                ) : hasLegacySession(service) ? (
                  <span className="museid-accounts__service-summary">
                    Signed in to {SERVICE_LABELS[service]} as{' '}
                    {service === 'moose-hub' ? museHub.user.email : adieu.user.email} — ready to link.
                  </span>
                ) : (
                  <span className="museid-accounts__service-summary">
                    Not linked. Sign in to {SERVICE_LABELS[service]} to link it here.
                  </span>
                )}
              </div>
              <div className="museid-accounts__service-actions">
                {!museId.signedIn ? null : linked ? (
                  <button
                    type="button"
                    className="museid-accounts__btn museid-accounts__btn--ghost"
                    onClick={() => { void handleUnlink(service); }}
                    disabled={busy}
                  >
                    {busy ? 'Unlinking…' : 'Unlink'}
                  </button>
                ) : hasLegacySession(service) ? (
                  <button
                    type="button"
                    className="museid-accounts__btn museid-accounts__btn--primary"
                    onClick={() => { void handleLink(service); }}
                    disabled={busy}
                  >
                    {busy ? 'Linking…' : 'Link'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="museid-accounts__btn museid-accounts__btn--ghost"
                    onClick={() => openLegacySignIn(service)}
                  >
                    Sign in to link
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {linkError && <p className="museid-accounts__error" role="alert">{linkError}</p>}
      </div>

      {museId.legacyAuthDialogsEnabled && !museId.signedIn && (
        <div className="museid-accounts__legacy">
          <p className="museid-accounts__legacy-label">Legacy sign-in (debug)</p>
          <MuseHubAccountSection />
        </div>
      )}
    </div>
  );
};

export default MuseIdAccountsPage;
