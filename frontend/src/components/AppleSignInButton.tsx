// Sign in with Apple — renders the official Apple button on the web and
// forwards the identity token to POST /auth/apple. Loads Apple's JS SDK
// lazily so users who don't click it never download the script.
//
// Reference: https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_js

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope?: string;
          redirectURI?: string;
          state?: string;
          nonce?: string;
          usePopup?: boolean;
        }) => Promise<void>;
        signIn: (config?: { scope?: string; nonce?: string }) => Promise<{
          authorization: {
            code: string;
            id_token: string;
            state: string | null;
          };
          user?: {
            name?: { firstName?: string | null; lastName?: string | null; middleName?: string | null };
            email?: string;
          };
        }>;
      };
    };
  }
}

const APPLE_SCRIPT_ID = 'appleid-signin-js';
const APPLE_SCRIPT_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

let scriptPromise: Promise<void> | null = null;

function loadAppleScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.AppleID?.auth) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(APPLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Apple ID SDK failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.id = APPLE_SCRIPT_ID;
    script.src = APPLE_SCRIPT_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Apple ID SDK failed to load')));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type AppleCredential = {
  identityToken: string;
  authorizationCode: string;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  rawUser: unknown;
};

export type AppleSignInButtonProps = {
  clientId: string;
  redirectURI?: string;
  /** Called with the Apple credential after a successful sign-in. */
  onSuccess: (credential: AppleCredential) => void | Promise<void>;
  /** Optional callback for SDK / user errors. */
  onError?: (error: unknown) => void;
  /** Render-mode override for the Apple button. */
  mode?: 'sign-in' | 'continue';
  /** Disable the button while a sign-in is in flight. */
  disabled?: boolean;
};

export default function AppleSignInButton({
  clientId,
  redirectURI,
  onSuccess,
  onError,
  mode = 'sign-in',
  disabled = false,
}: AppleSignInButtonProps) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const initRef = useRef(false);

  // Initialise AppleID.auth once the SDK loads. The redirect URI is
  // optional — Apple's web flow accepts a relative path that the SDK
  // resolves against the current origin.
  useEffect(() => {
    let cancelled = false;
    if (initRef.current) return;
    initRef.current = true;
    loadAppleScript()
      .then(() => {
        if (cancelled || !window.AppleID?.auth) return;
        return window.AppleID.auth.init({
          clientId,
          scope: 'name email',
          redirectURI: redirectURI ?? `${window.location.origin}/auth/apple/callback`,
          usePopup: true,
        });
      })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((error) => {
        if (!cancelled) onError?.(error);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, redirectURI, onError]);

  const handleClick = useCallback(async () => {
    if (!window.AppleID?.auth) {
      onError?.(new Error('Apple ID SDK not loaded'));
      return;
    }
    setLoading(true);
    try {
      const result = await window.AppleID.auth.signIn();
      const identityToken = result.authorization.id_token;
      if (!identityToken) {
        throw new Error('Apple did not return an identity token');
      }
      const nameParts = result.user?.name ?? {};
      const firstName = nameParts.firstName ?? null;
      const lastName = nameParts.lastName ?? null;
      const fullName =
        [nameParts.firstName, nameParts.middleName, nameParts.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() || null;
      await onSuccess({
        identityToken,
        authorizationCode: result.authorization.code,
        fullName,
        firstName,
        lastName,
        email: result.user?.email ?? null,
        rawUser: result.user ?? null,
      });
    } catch (error) {
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onError]);

  const label = loading ? 'Signing in…' : mode === 'continue' ? 'Continue with Apple' : 'Sign in with Apple';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading || !ready}
      aria-label={label}
      data-testid="apple-signin"
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-black text-white px-4 py-3 font-medium border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition hover:bg-black/90"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M13.5 9.3c0-2 1.6-2.9 1.6-2.9-.9-1.3-2.2-1.5-2.7-1.5-1.2-.1-2.2.7-2.8.7-.6 0-1.5-.7-2.4-.7-1.2 0-2.4.7-3 1.9-1.3 2.2-.3 5.4.9 7.2.6.9 1.4 1.9 2.4 1.9.9 0 1.3-.6 2.5-.6s1.4.6 2.4.6c1 0 1.7-.9 2.3-1.8.7-1 1-2 1-2.1-.1 0-2-.7-2-2.7zM11.4 4.1c.5-.6.8-1.5.7-2.3-.7.1-1.5.5-2 1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.3 2.1-.9z"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
