// MuseHub sign-in / create-account dialog. Opened via
// MuseHubContext.openAuthDialog(); both modes share the same panel and the
// user can toggle between them.
//
// Submit hits moose-hub's first-party /api/auth/direct-token endpoint via
// directLogin / directSignup, which writes tokens to localStorage; the
// dialog then calls hydrate() so the surrounding context picks up the new
// user / wallet / library.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMuseHub } from '../../contexts/MuseHubContext';
import { directLogin, directSignup } from '../../lib/musehub-client';
import './AuthDialog.css';

export const AuthDialog: React.FC = () => {
  const { authDialog, openAuthDialog, closeAuthDialog, hydrate } = useMuseHub();
  const open = authDialog !== 'closed';
  const mode = authDialog === 'create-account' ? 'create-account' : 'sign-in';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the dialog opens or the mode changes.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [open, mode]);

  // Escape to dismiss when nothing's in flight.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        e.preventDefault();
        closeAuthDialog();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, closeAuthDialog]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'sign-in') {
        await directLogin(email.trim(), password);
      } else {
        await directSignup(email.trim(), password, displayName.trim());
      }
      await hydrate();
      closeAuthDialog();
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      const message =
        code === 'invalid_credentials' ? 'Incorrect email or password.' :
        code === 'email_taken'         ? 'That email is already registered. Try signing in.' :
        code === 'password_too_short'  ? 'Password must be at least 8 characters.' :
        code === 'invalid_request'     ? 'Please fill in every field.' :
        err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setSubmitting(false);
    }
  };

  const title = mode === 'sign-in' ? 'Sign in to MuseHub' : 'Create a MuseHub account';
  const submitLabel =
    submitting
      ? mode === 'sign-in'
        ? 'Signing in…'
        : 'Creating account…'
      : mode === 'sign-in'
        ? 'Sign in'
        : 'Create account';

  const content = (
    <div
      className="auth-dialog__backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) closeAuthDialog();
      }}
    >
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
        <header className="auth-dialog__header">
          <h2 id="auth-dialog-title">{title}</h2>
          <button
            type="button"
            className="auth-dialog__close"
            onClick={closeAuthDialog}
            disabled={submitting}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <p className="auth-dialog__subtitle">
          {mode === 'sign-in'
            ? 'Sign in to your MuseHub account to buy and manage effects.'
            : 'Create a free MuseHub account — needed to buy effects from the marketplace.'}
        </p>

        <form className="auth-dialog__form" onSubmit={handleSubmit} noValidate>
          {mode === 'create-account' && (
            <label className="auth-dialog__field">
              <span>Display name</span>
              <input
                ref={firstInputRef}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                disabled={submitting}
                required
              />
            </label>
          )}

          <label className="auth-dialog__field">
            <span>Email</span>
            <input
              ref={mode === 'sign-in' ? firstInputRef : undefined}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
              required
            />
          </label>

          <label className="auth-dialog__field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              disabled={submitting}
              required
              minLength={mode === 'create-account' ? 8 : undefined}
            />
            <span className="auth-dialog__hint">
              {mode === 'create-account' ? 'At least 8 characters.' : null}
            </span>
          </label>

          {error && (
            <p className="auth-dialog__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth-dialog__cta" disabled={submitting}>
            {submitting && <span className="auth-dialog__spinner" aria-hidden="true" />}
            <span>{submitLabel}</span>
          </button>

          {mode === 'sign-in' ? (
            <p className="auth-dialog__switch">
              Don't have an account?{' '}
              <button
                type="button"
                className="auth-dialog__link"
                onClick={() => openAuthDialog('create-account')}
                disabled={submitting}
              >
                Create one
              </button>
            </p>
          ) : (
            <p className="auth-dialog__switch">
              Already have an account?{' '}
              <button
                type="button"
                className="auth-dialog__link"
                onClick={() => openAuthDialog('sign-in')}
                disabled={submitting}
              >
                Sign in
              </button>
            </p>
          )}

          {mode === 'sign-in' && (
            <p className="auth-dialog__forgot">
              <a href="https://musehub.com/forgot-password" target="_blank" rel="noreferrer">
                Forgot password?
              </a>
            </p>
          )}
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default AuthDialog;
