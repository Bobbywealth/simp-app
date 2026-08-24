import { Router } from 'express';
import { prisma } from '../config/db.js';
import { env, productionWarnings } from '../config/env.js';

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
      emailWebhook:
        env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_WEBHOOK_SECRET),
      push:
        (env.PUSH_PROVIDER === 'firebase' && Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON)) ||
        (env.PUSH_PROVIDER === 'webpush' && Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)),
      turn:
        (env.TURN_PROVIDER === 'twilio' && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN)) ||
        Boolean(env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL),
      billingApple: Boolean(env.APPLE_IAP_ISSUER_ID && env.APPLE_IAP_KEY_ID && env.APPLE_IAP_PRIVATE_KEY),
      billingGoogle: Boolean(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON),
    };
    // The service is considered live in production as long as the
    // database and HTTP layer are healthy. Missing third-party
    // integrations are reported as degraded features so the rest of
    // the app can be smoke-tested before paid services are connected.
    res.status(200).json({
      status: 'ready',
      database: true,
      integrations,
      degradedFeatures: productionWarnings,
    });
  } catch {
    res.status(503).json({ status: 'unavailable', database: false });
  }
});
