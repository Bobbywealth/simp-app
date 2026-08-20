import { apiFetch } from './client';

export type AnalyticsEvent =
  | 'signup_started'
  | 'signup_completed'
  | 'onboarding_completed'
  | 'profile_completed'
  | 'swipe_like'
  | 'match_created'
  | 'message_sent'
  | 'stream_started'
  | 'stream_viewed'
  | 'premium_screen_viewed'
  | 'subscription_started';

export const track = (
  event: AnalyticsEvent,
  properties: Record<string, string | number | boolean | null> = {},
) =>
  apiFetch<{ ok: boolean }>('/analytics/events', {
    method: 'POST',
    body: JSON.stringify({ event, properties }),
  }).catch(() => undefined);
