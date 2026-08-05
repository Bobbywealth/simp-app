import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = verifyAccessToken(token);
    if (claims.typ !== 'access') {
      return res.status(401).json({ error: 'invalid_token_type' });
    }
    req.userId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
