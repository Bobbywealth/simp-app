import { apiFetch } from './client';

/**
 * Analytics event names — keep in sync with
 * `backend/src/services/analytics.ts` → `ANALYTICS_EVENTS`.
 *
 * Grouped by lifecycle stage:
 *   signup_*    onboarding milestones
 *   discovery_* swipe actions + first-swipe milestone
 *   match_*    match created + first-match milestone
 *   message_*  messaging actions + first-message milestone
 *   live_*     live stream broadcast/view/react
 *   session_*  session/page auto-trackers
 *
 * SIMP is fully free — there are no premium / billing events.
 */
export type AnalyticsEvent =
  // Signup funnel
  | 'signup_started'
  | 'signup_completed'
  | 'email_verified'
  | 'onboarding_completed'
  | 'profile_completed'
  // Discovery
  | 'discovery_swipe'
  | 'first_swipe'
  | 'discovery_pass'
  | 'discovery_like'
  | 'discovery_super_like'
  | 'discovery_convince_me'
  // Matching
  | 'match_created'
  | 'first_match'
  // Messaging
  | 'message_sent'
  | 'first_message'
  | 'conversation_opened'
  // Live streaming
  | 'live_started'
  | 'live_ended'
  | 'live_viewed'
  | 'live_reacted'
  // Session / page auto-tracking
  | 'session_started'
  | 'page_viewed'
  | 'app_backgrounded'
  | 'app_foregrounded';

/**
 * Properties that are NEVER allowed to be sent — the backend rejects
 * these in Zod validation, but we strip client-side too so they never
 * even hit the wire.
 */
const SENSITIVE_KEY_RE = /message|body|bio|email|name|phone|photo|token|password|address|ip/i;

function sanitizeProperties(
  properties: Record<string, string | number | boolean | null> = {},
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (SENSITIVE_KEY_RE.test(k)) continue;
    out[k] = typeof v === 'string' && v.length > 200 ? v.slice(0, 200) : v;
  }
  return out;
}

/**
 * Per-tab session id. Stored in sessionStorage so it's fresh per browser
 * tab but persists across page navigations. Anonymous funnel events
 * (signup_started before the user exists) tie to this id so we can
 * stitch together the post-signup session for funnel computation.
 */
function getOrCreateSessionId(): string {
  const KEY = 'simp_session_id';
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // sessionStorage may be unavailable in private modes / WebView
    return `s_fallback_${Date.now().toString(36)}`;
  }
}

/**
 * Once-per-session-session-start flag so we don't spam session_started
 * on every page navigation.
 */
let SESSION_STARTED = false;

/**
 * Track an analytics event. Returns the fetch promise — callers
 * usually don't await it (fire-and-forget). Errors are swallowed
 * by apiFetch (which always resolves to undefined on failure).
 */
export function track(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<{ ok: boolean } | undefined> {
  if (!SESSION_STARTED) {
    SESSION_STARTED = true;
    // Fire the session_started exactly once per tab.
    void track('session_started', { sessionStartAt: new Date().toISOString() });
  }

  const payload = {
    event,
    sessionId: getOrCreateSessionId(),
    source: 'client' as const,
    appVersion: import.meta.env.VITE_APP_VERSION,
    properties: sanitizeProperties(properties),
  };
  return apiFetch<{ ok: boolean }>('/analytics/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

/**
 * Fire a one-shot milestone event the FIRST time it happens for the
 * current user. Stored in localStorage so it survives across visits.
 * Used for things like first_swipe, first_match, first_message —
 * counting these per-user-per-lifetime.
 */
export async function trackMilestone(
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<boolean> {
  const KEY = `simp_milestone_${event}`;
  try {
    if (localStorage.getItem(KEY) === '1') return false;
    localStorage.setItem(KEY, '1');
    await track(event, properties);
    return true;
  } catch {
    // localStorage unavailable — fall back to always-firing so we
    // don't lose the milestone entirely.
    await track(event, properties);
    return false;
  }
}

export function getSessionId(): string {
  return getOrCreateSessionId();
}
