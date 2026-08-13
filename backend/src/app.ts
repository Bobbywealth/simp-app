import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { env, allowedOrigins } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { discoveryRouter } from './routes/discovery.routes.js';
import { swipesRouter } from './routes/swipes.routes.js';
import { matchesRouter } from './routes/matches.routes.js';
import { photosRouter } from './routes/photos.routes.js';
import { moderationRouter } from './routes/moderation.routes.js';
import { liveRouter } from './routes/live.routes.js';
import { legalRouter } from './routes/legal.routes.js';
import { configRouter } from './routes/config.routes.js';
import { errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(express.json({ limit: '10mb' })); // bumped to allow photo upload JSON metadata
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error('CORS: origin not allowed'));
      },
      credentials: true,
    })
  );

  // Static serve uploaded photos at /uploads/{filename}
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
      maxAge: '7d',
      fallthrough: false,
    })
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/auth', authLimiter);

  const swipeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/swipes', swipeLimiter);

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/photos/upload', uploadLimiter);

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use(discoveryRouter);
  app.use(swipesRouter);
  app.use(matchesRouter);
  app.use(photosRouter);
  app.use(moderationRouter);
  app.use(liveRouter);
  app.use(legalRouter);
  app.use(configRouter);

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use(errorHandler);

  return app;
}
