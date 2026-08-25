import * as Sentry from '@sentry/react';

/**
 * Sentry crash/error reporting for the SIMP frontend (PWA + Capacitor
 * iOS/Android webviews).
 *
 * `initSentry()` must be called BEFORE React renders. It is a no-op
 * if `VITE_SENTRY_DSN` is unset — the app boots normally without
 * crash reporting.
 *
 * Includes:
 * - Browser tracing (page load + navigation + fetch performance)
 * - Session Replay (10% of sessions, 100% on error — helps reproduce
 *   crashes for App Store review feedback)
 * - sensitive-data redaction (PII scrubbed beforeSend)
 * - user-controlled opt-out via Sentry's beforeSend hook
 */

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN ?? '').trim();

let initialized = false;
let isActive = false;

export function initSentry(): boolean {
  if (initialized) return isActive;
  initialized = true;

  if (!SENTRY_DSN) {
    if (typeof console !== 'undefined') {
      console.info('[sentry] disabled — set VITE_SENTRY_DSN to enable crash reporting');
    }
    return false;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: `simp-frontend@${(import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev'}`,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      // 10% performance, 100% errors
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      // 10% of sessions get a replay, 100% of sessions get one on error
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      // Strip PII before sending to Sentry
      beforeSend(event) {
        if (event.user) {
          delete event.user.ip_address;
          delete event.user.email;
          delete event.user.username;
        }
        // Strip URL query params that may contain tokens / codes
        if (event.request?.url) {
          try {
            const u = new URL(event.request.url, window.location.origin);
            u.search = '';
            event.request.url = u.toString();
          } catch {
            /* not a URL we control */
          }
        }
        return event;
      },
    });
    isActive = true;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.error('[sentry] init failed', err);
    }
    isActive = false;
  }

  return isActive;
}

export function isSentryActive(): boolean {
  return isActive;
}

/**
 * Returns a Sentry ErrorBoundary component if Sentry is active,
 * otherwise a passthrough that just rethrows. Use as a `<ErrorBoundary>`
 * wrapper near the top of the React tree.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * Manually capture an exception from outside React (e.g., inside an
 * async function or setTimeout).
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!isActive) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

/**
 * Set the currently authenticated user's id for Sentry breadcrumbs.
 * Call after login, clear on logout. We never send email or name —
 * only the user id (which is opaque to Sentry without a join).
 */
export function setSentryUser(userId: string | null): void {
  if (!isActive) return;
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}
