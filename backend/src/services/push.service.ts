import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  if (!firebaseReady()) return { configured: false, sent: 0 };
  const tokens = await prisma.pushToken.findMany({
    where: { userId, active: true },
    select: { id: true, token: true },
  });
  if (!tokens.length) return { configured: true, sent: 0 };

  let sent = 0;
  for (const item of tokens) {
    try {
      await getMessaging().send({
        token: item.token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high', notification: { channelId: 'simp-social' } },
        apns: {
          payload: { aps: { sound: 'default', badge: 1, 'mutable-content': 1 } },
        },
      });
      sent += 1;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await prisma.pushToken.update({ where: { id: item.id }, data: { active: false } });
      } else {
        logger.warn({ event: 'push_delivery_failed', userId, code });
      }
    }
  }
  return { configured: true, sent };
}
