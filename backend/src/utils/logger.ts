import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL ?? 'info',
  base: { service: 'simp-backend', version: env.APP_VERSION },
  redact: {
    paths: [
      'password',
      '*.password',
      'accessToken',
      'refreshToken',
      '*.accessToken',
      '*.refreshToken',
      'authorization',
      '*.authorization',
      'token',
      '*.token',
      'body',
      '*.body',
    ],
    censor: '[REDACTED]',
  },
});
