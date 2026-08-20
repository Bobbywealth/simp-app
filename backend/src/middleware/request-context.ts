import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface ContextRequest extends Request {
  requestId?: string;
  userId?: string;
}

function safeIdentifier(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const secret = env.IP_HASH_SECRET ?? env.JWT_ACCESS_SECRET;
  return crypto.createHmac('sha256', secret).update(value).digest('hex').slice(0, 16);
}

export function requestContext(req: ContextRequest, res: Response, next: NextFunction) {
  const incoming = req.header('x-request-id');
  const requestId = incoming && /^[A-Za-z0-9._-]{8,100}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
  const startedAt = performance.now();

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    logger.info({
      event: 'http_request',
      requestId,
      method: req.method,
      endpoint: req.originalUrl.split('?')[0],
      status: res.statusCode,
      latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
      user: safeIdentifier(req.userId),
      ip: safeIdentifier(req.ip),
    });
  });

  next();
}
