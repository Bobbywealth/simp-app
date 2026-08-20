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

function firebaseReady(): boolean {
  if (env.PUSH_PROVIDER !== 'firebase' || !env.FIREBASE_SERVICE_ACCOUNT_JSON) return false;
  if (!getApps().length) {
    let raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw.trim().startsWith('{')) raw = Buffer.from(raw, 'base64').toString('utf8');
    const credentials = JSON.parse(raw) as ServiceAccount;
    initializeApp({ credential: cert(credentials) });
  }
  return true;
}

function configureWebPush(): boolean {
  if (webpushConfigured) return true;
  if (env.PUSH_PROVIDER !== 'webpush') return false;
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

export function pushProvider(): 'firebase' | 'webpush' | 'disabled' {
  if (env.PUSH_PROVIDER === 'firebase' && firebaseReady()) return 'firebase';
  if (env.PUSH_PROVIDER === 'webpush' && configureWebPush()) return 'webpush';
  return 'disabled';
}

export function vapidPublicKey(): string | null {
  if (env.PUSH_PROVIDER !== 'webpush') return null;
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

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ configured: boolean; sent: number }> {
  const provider = pushProvider();
  if (provider === 'disabled') return { configured: false, sent: 0 };

  const tokens = await loadTokens(userId);
  if (!tokens.length) return { configured: true, sent: 0 };

  let sent = 0;
  const gone: string[] = [];
  for (const item of tokens) {
    const result =
      provider === 'firebase' ? await sendFirebase(item, payload) : await sendWebPush(item, payload);
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
