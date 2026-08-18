import { Router } from 'express';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'simp-backend', version: env.APP_VERSION });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const integrations = {
      persistentStorage:
        env.STORAGE_PROVIDER === 'cloudinary' &&
        Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      email:
        (env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)) ||
        (env.EMAIL_PROVIDER === 'webhook' && Boolean(env.EMAIL_WEBHOOK_URL && env.EMAIL_FROM)),
      push: env.PUSH_PROVIDER === 'firebase' && Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON),
      turn: Boolean(env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL),
      billingApple: Boolean(env.APPLE_IAP_ISSUER_ID && env.APPLE_IAP_KEY_ID && env.APPLE_IAP_PRIVATE_KEY),
      billingGoogle: Boolean(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON),
    };
    const ready = env.NODE_ENV !== 'production' ||
      (integrations.persistentStorage && integrations.email && integrations.push && integrations.turn);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'degraded', database: true, integrations });
  } catch {
    res.status(503).json({ status: 'unavailable', database: false });
  }
});
