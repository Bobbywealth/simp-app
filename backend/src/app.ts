import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { allowedOrigins, env } from './config/env.js';
import { requestContext } from './middleware/request-context.js';
import { errorHandler } from './middleware/error.js';
import { accountRouter } from './routes/account.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { configRouter } from './routes/config.routes.js';
import { discoveryRouter } from './routes/discovery.routes.js';
import { experiencesRouter } from './routes/experiences.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { legalRouter } from './routes/legal.routes.js';
import { liveRouter } from './routes/live.routes.js';
import { matchesRouter } from './routes/matches.routes.js';
import { messagesRouter } from './routes/messages.routes.js';
import { moderationRouter } from './routes/moderation.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { photosRouter } from './routes/photos.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { swipesRouter } from './routes/swipes.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { webhooksRouter } from './routes/webhooks.routes.js';
import { demoRouter } from './routes/demo.routes.js';

const limiter = (windowMs: number, max: number) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: 'rate_limited',
      message: 'Too many requests. Please wait and try again.',
      fieldErrors: {},
    },
  });

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestContext);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('origin_not_allowed'));
      },
      credentials: true,
      maxAge: 86_400,
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID', 'Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '1mb', strict: true }));
  // /webhooks/* receives signed payloads from upstream providers (Resend,
  // Stripe, etc.) — the signature must be verified against the exact raw
  // bytes the provider sent. Mount express.raw() here BEFORE the global
  // JSON parser consumes the body, and the per-route handler reads
  // req.body as a Buffer.
  app.use(
    '/webhooks',
    express.raw({
      type: () => true,
      limit: '1mb',
    }),
  );
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  if (env.STORAGE_PROVIDER === 'local' && env.NODE_ENV !== 'production') {
    app.use(
      '/uploads',
      express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
        maxAge: '1d',
        fallthrough: false,
        immutable: false,
      }),
    );
  }

  app.use('/auth/signup', limiter(60 * 60_000, 5));
  app.use('/auth/login', limiter(15 * 60_000, 10));
  app.use('/auth/apple', limiter(15 * 60_000, 15));
  app.use('/auth/apple/merge-token', limiter(60 * 60_000, 5));
  app.use('/billing/apple/refresh', limiter(60 * 60_000, 12));
  app.use('/billing/apple/restore', limiter(60 * 60_000, 6));
  // No rate limit on /billing/apple/notifications — it's an Apple-to-us
  // webhook, never user-initiated. Brute-force protection at the firewall.
  app.use('/auth/forgot-password', limiter(60 * 60_000, 5));
  app.use('/auth/resend-verification', limiter(60 * 60_000, 3));
  app.use('/auth/refresh', limiter(5 * 60_000, 30));
  app.use('/account/me', limiter(60 * 60_000, 3));
  app.use('/swipes', limiter(60_000, 60));
  app.use('/photos/upload', limiter(60_000, 6));
  app.use('/reports', limiter(60 * 60_000, 10));
  app.use('/live/streams', limiter(60_000, 60));
  app.use('/conversations', limiter(60_000, 120));
  app.use('/analytics/events', limiter(60_000, 120));

  app.use('/health', healthRouter);
  app.use(webhooksRouter);
  app.use(demoRouter);
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use(discoveryRouter);
  app.use(swipesRouter);
  app.use(matchesRouter);
  app.use(messagesRouter);
  app.use(photosRouter);
  app.use(moderationRouter);
  app.use(liveRouter);
  app.use(notificationsRouter);
  app.use(billingRouter);
  app.use(experiencesRouter);
  app.use(analyticsRouter);
  app.use(adminRouter);
  app.use(legalRouter);
  app.use(configRouter);
  app.use(publicRouter);
  app.use(accountRouter);

  app.use((_req, res) =>
    res.status(404).json({
      error: 'not_found',
      message: 'The requested endpoint does not exist.',
      fieldErrors: {},
      requestId: res.locals.requestId,
    }),
  );
  app.use(errorHandler);
  return app;
}
