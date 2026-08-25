import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Funnel analytics — event names that get persisted to AnalyticsEvent
 * and optionally forwarded to a 3rd-party endpoint (PostHog / Segment /
 * RudderStack) when `ANALYTICS_ENDPOINT` is set.
 *
 * Naming convention: lowercase snake_case. Group by lifecycle stage:
 *   signup_*    onboarding milestones (start → complete → email verified)
 *   discovery_* swipe actions and first-action milestones
 *   match_*    match created + first-match milestone
 *   message_*  messaging actions + first-message milestone
 *   live_*     live stream broadcast/view
 *   premium_*   premium upsell + purchase lifecycle
 *   session_*  session/page auto-trackers
 *
 * Adding a new event? Append to this tuple AND update
 * `frontend/src/api/analytics.ts` to match.
 */
export const ANALYTICS_EVENTS = [
  // Signup funnel
  'signup_started',
  'signup_completed',
  'email_verified',
  'onboarding_completed',
  'profile_completed',

  // Discovery
  'discovery_swipe',
  'first_swipe',
  'discovery_pass',
  'discovery_like',
  'discovery_super_like',
  'discovery_convince_me',

  // Matching
  'match_created',
  'first_match',

  // Messaging
  'message_sent',
  'first_message',
  'conversation_opened',

  // Live streaming
  'live_started',
  'live_ended',
  'live_viewed',
  'live_reacted',

  // Premium / billing
  'premium_screen_viewed',
  'premium_tier_selected',
  'purchase_started',
  'purchase_completed',
  'purchase_failed',
  'purchase_restored',
  'subscription_cancelled',

  // Session / page auto-tracking
  'session_started',
  'page_viewed',
  'app_backgrounded',
  'app_foregrounded',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/**
 * Track an analytics event. Always writes to the local AnalyticsEvent
 * table (so admins can compute funnels without an external provider);
 * additionally forwards to `env.ANALYTICS_ENDPOINT` if configured.
 *
 * Fire-and-forget from the caller's perspective: errors are logged
 * but never bubble. Analytics must never break the user-facing flow.
 */
export async function trackAnalytics(input: {
  event: AnalyticsEvent;
  userId?: string | null;
  sessionId?: string | null;
  source?: 'client' | 'server';
  appVersion?: string;
  properties?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const sanitizedProps = input.properties
    ? sanitizeAnalyticsProperties(input.properties)
    : undefined;

  // Always write locally — gives us the funnel endpoint without a 3rd-party dep.
  try {
    await prisma.analyticsEvent.create({
      data: {
        event: input.event,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        source: input.source ?? 'client',
        appVersion: input.appVersion ?? env.APP_VERSION ?? null,
        properties: sanitizedProps
          ? (sanitizedProps as unknown as object)
          : undefined,
      },
    });
  } catch (err) {
    logger.warn(
      { event: 'analytics_persist_failed', name: input.event, err: (err as Error).message },
      'Failed to persist AnalyticsEvent',
    );
  }

  // Forward to 3rd-party endpoint if configured (skipped silently otherwise).
  if (!env.ANALYTICS_ENDPOINT) return;
  try {
    await fetch(env.ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.ANALYTICS_WRITE_KEY ? { Authorization: `Bearer ${env.ANALYTICS_WRITE_KEY}` } : {}),
      },
      body: JSON.stringify({
        event: input.event,
        distinctId: input.userId ?? input.sessionId,
        properties: sanitizedProps,
        timestamp: new Date().toISOString(),
        appVersion: input.appVersion ?? env.APP_VERSION,
      }),
    });
  } catch (err) {
    logger.warn(
      { event: 'analytics_delivery_failed', name: input.event, err: (err as Error).message },
      'Failed to forward analytics event',
    );
  }
}

/**
 * Defense-in-depth: even though the route validator rejects sensitive
 * keys, this filters again at the service layer so future routes that
 * call `trackAnalytics()` directly can't accidentally bypass it.
 */
const SENSITIVE_KEY_RE = /message|body|bio|email|name|phone|photo|token|password|address|ip/i;

function sanitizeAnalyticsProperties(
  properties: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (SENSITIVE_KEY_RE.test(k)) continue;
    if (typeof v === 'string' && v.length > 200) {
      out[k] = v.slice(0, 200);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Funnel aggregator: counts of each event over a date range. Used by
 * the admin endpoint for at-a-glance conversion visibility.
 */
export async function getFunnelCounts(opts: {
  start: Date;
  end: Date;
  source?: 'client' | 'server';
}): Promise<Record<string, number>> {
  const where = {
    createdAt: { gte: opts.start, lte: opts.end },
    ...(opts.source ? { source: opts.source } : {}),
  };
  const grouped = await prisma.analyticsEvent.groupBy({
    by: ['event'],
    where,
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of grouped) {
    out[row.event] = row._count._all;
  }
  return out;
}
