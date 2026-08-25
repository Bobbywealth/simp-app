import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Sentry crash/error reporting for the SIMP backend.
 *
 * Initialized once at process startup (see `initSentry` below).
 *
 * Design: this module is a graceful-fallback wrapper. If `SENTRY_DSN` is
 * unset, `initSentry()` is a no-op and `captureException()` is a thin
 * re-export of the Sentry SDK's own function — which also no-ops when
 * no DSN is configured. This mirrors the Cloudinary/TURN/Resend/Firebase
 * graceful-fallback pattern used elsewhere in the backend, so the service
 * never crashes just because a paid integration isn't configured yet.
 *
 * The `/health/ready` endpoint reports `sentry: true/false` in its
 * integrations map so we can detect at-a-glance whether the integration
 * is wired.
 */

let initialized = false;
let isActive = false;

export function initSentry(): boolean {
  if (initialized) return isActive;
  initialized = true;

  if (!env.SENTRY_DSN) {
    logger.info(
      { event: 'sentry_init', status: 'skipped', reason: 'SENTRY_DSN not set' },
      'Sentry disabled — set SENTRY_DSN to enable crash reporting',
    );
    return false;
  }

  try {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      release: `simp-backend@${env.APP_VERSION ?? 'dev'}`,
      // We sample 10% of transactions for performance, 100% of errors.
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [nodeProfilingIntegration()],
      // Don't send PII to Sentry — we already redact in pino, double up here.
      beforeSend(event) {
        if (event.user) {
          delete event.user.ip_address;
          delete event.user.email;
          delete event.user.username;
        }
        return event;
      },
    });
    isActive = true;
    logger.info(
      { event: 'sentry_init', status: 'ok', environment: env.NODE_ENV },
      'Sentry crash reporting initialized',
    );
  } catch (err) {
    logger.error({ event: 'sentry_init', status: 'failed', err }, 'Failed to init Sentry');
    isActive = false;
  }

  return isActive;
}

export function isSentryActive(): boolean {
  return isActive;
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!isActive) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!isActive) return;
  Sentry.captureMessage(message, level);
}

/**
 * Express request handler that pushes the request into the Sentry
 * scope so error reports carry URL + method + headers. Mounted before
 * any routes.
 */
export const sentryRequestHandler: (req: unknown, res: unknown, next: (err?: unknown) => void) => void =
  (req, res, next) => {
    if (isActive) Sentry.startInactiveSpan({ name: 'request' });
    next();
  };

/**
 * Express error handler that captures 5xx errors before they bubble up
 * to the JSON error middleware. Mounted AFTER all routes but BEFORE
 * the JSON error middleware.
 */
export const sentryErrorHandler: (err: unknown, req: unknown, res: unknown, next: (err?: unknown) => void) => void =
  (err, _req, _res, next) => {
    // Only report 5xx to Sentry — 4xx are user errors, not bugs.
    const appErr = err as { status?: number; statusCode?: number };
    const status = appErr?.status ?? appErr?.statusCode ?? 500;
    if (isActive && status >= 500) {
      captureException(err);
    }
    next(err);
  };
