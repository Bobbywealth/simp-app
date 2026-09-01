import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

let webpushConfigured = false;

/**
 * Initialize the Firebase Admin SDK if the service account JSON is present.
 * Independent of `PUSH_PROVIDER` — Firebase is enabled when its config exists,
 * regardless of the env-level toggle, so admins can run hybrid
 * (FCM for native + VAPID for web) by setting both config blocks.
 */
function firebaseReady(): boolean {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) return false;
  if (!getApps().length) {
    let raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
    const credentials = JSON.parse(raw) as ServiceAccount;
    initializeApp({ credential: cert(credentials) });
  }
  return true;
}

/**
 * Configure VAPID web-push if the public/private key pair is present.
 * Independent of `PUSH_PROVIDER` — same rationale as `firebaseReady()`.
 */
function configureWebPush(): boolean {
  if (webpushConfigured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    webpushConfigured = true;
    return true;
  } catch (error) {
    logger.error({
      event: 'webpush_configuration_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Reports which providers are actually initialized for the running
 * process. `PUSH_PROVIDER` is a legacy hint that's no longer the gate —
 * we initialize a provider when its config is present so admins can
 * run hybrid (FCM for iOS/Android tokens + VAPID for WEB tokens) by
 * leaving both config blocks in place.
 *
 * Returns one of:
 *   - 'firebase'  → FCM configured, VAPID not
 *   - 'webpush'   → VAPID configured, FCM not
 *   - 'hybrid'    → both configured (the SIMP prod mode)
 *   - 'disabled'  → neither configured
 */
export function pushProvider(): 'firebase' | 'webpush' | 'hybrid' | 'disabled' {
  const hasFirebase = firebaseReady();
  const hasWebPush = configureWebPush();
  if (hasFirebase && hasWebPush) return 'hybrid';
  if (hasFirebase) return 'firebase';
  if (hasWebPush) return 'webpush';
  return 'disabled';
}

export function vapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

type StoredToken = {
  id: string;
  token: string;
  subscription: unknown;
  endpoint: string | null;
  platform: 'IOS' | 'ANDROID' | 'WEB';
};

async function loadTokens(userId: string): Promise<StoredToken[]> {
  return prisma.pushToken.findMany({
    where: { userId, active: true },
    select: { id: true, token: true, subscription: true, endpoint: true, platform: true },
  });
}

async function sendFirebase(token: StoredToken, payload: PushPayload): Promise<'ok' | 'gone'> {
  try {
    await getMessaging().send({
      token: token.token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high', notification: { channelId: 'simp-social' } },
      apns: {
        payload: { aps: { sound: 'default', badge: 1, 'mutable-content': 1 } },
      },
    });
    return 'ok';
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      return 'gone';
    }
    logger.warn({ event: 'push_delivery_failed', provider: 'firebase', code });
    return 'gone';
  }
}

async function sendWebPush(token: StoredToken, payload: PushPayload): Promise<'ok' | 'gone'> {
  if (!token.subscription || !token.endpoint) return 'gone';
  try {
    await webpush.sendNotification(
      token.subscription as WebPushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      }),
      { TTL: 60 * 60 },
    );
    return 'ok';
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return 'gone';
    logger.warn({
      event: 'push_delivery_failed',
      provider: 'webpush',
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'gone';
  }
}

/**
 * Per-token dispatch: WEB tokens go through VAPID, IOS/ANDROID tokens go
 * through Firebase. Tokens whose platform doesn't have a configured
 * provider are marked `active=false` so they stop being tried (e.g. an
 * old WEB token from before VAPID was enabled). Tokens that the provider
 * reports as gone (404/410/registration-token-not-registered) are also
 * deactivated in the same pass.
 *
 * This is what makes the hybrid mode work — a single user can have a
 * WEB subscription token, an iOS FCM token, and an Android FCM token
 * all registered, and each one is delivered via the right provider.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ configured: boolean; sent: number }> {
  const tokens = await loadTokens(userId);
  if (!tokens.length) return { configured: true, sent: 0 };

  const firebaseEnabled = firebaseReady();
  const webPushEnabled = configureWebPush();
  if (!firebaseEnabled && !webPushEnabled) {
    return { configured: false, sent: 0 };
  }

  let sent = 0;
  const gone: string[] = [];
  for (const item of tokens) {
    let result: 'ok' | 'gone';
    if (item.platform === 'WEB') {
      if (!webPushEnabled) {
        // VAPID config was removed; deactivate the stale token.
        gone.push(item.id);
        continue;
      }
      result = await sendWebPush(item, payload);
    } else {
      // IOS or ANDROID
      if (!firebaseEnabled) {
        gone.push(item.id);
        continue;
      }
      result = await sendFirebase(item, payload);
    }
    if (result === 'ok') sent += 1;
    else gone.push(item.id);
  }

  if (gone.length) {
    await prisma.pushToken.updateMany({
      where: { id: { in: gone } },
      data: { active: false },
    });
  }

  return { configured: true, sent };
}
