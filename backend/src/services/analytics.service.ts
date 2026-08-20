import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const ANALYTICS_EVENTS = [
  'signup_started',
  'signup_completed',
  'onboarding_completed',
  'profile_completed',
  'swipe_like',
  'match_created',
  'message_sent',
  'stream_started',
  'stream_viewed',
  'premium_screen_viewed',
  'subscription_started',
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export async function trackAnalytics(input: {
  event: AnalyticsEvent;
  userId?: string;
  properties?: Record<string, string | number | boolean | null>;
}) {
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
        distinctId: input.userId,
        properties: input.properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    logger.warn({ event: 'analytics_delivery_failed', name: input.event });
  }
}
