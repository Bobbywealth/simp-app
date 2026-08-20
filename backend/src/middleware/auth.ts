import type { AccountStatus, UserRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthedRequest extends Request {
  userId?: string;
  userRole?: UserRole;
  accountStatus?: AccountStatus;
  sessionFamilyId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'missing_token',
      message: 'Sign in to continue.',
      fieldErrors: {},
      requestId: res.locals.requestId,
    });
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const claims = verifyAccessToken(token);
    if (claims.typ !== 'access') {
      return res.status(401).json({
        error: 'invalid_token_type',
        message: 'Your session is invalid. Please sign in again.',
        fieldErrors: {},
        requestId: res.locals.requestId,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, status: true, suspendedUntil: true },
    });
    if (!user) {
      return res.status(401).json({
        error: 'invalid_token',
        message: 'Your session is no longer valid.',
        fieldErrors: {},
        requestId: res.locals.requestId,
      });
    }

    if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE', suspendedUntil: null, statusReason: null },
      });
      user.status = 'ACTIVE';
    }

    if (user.status !== 'ACTIVE') {
      const code = user.status === 'BANNED' ? 'account_banned' : 'account_suspended';
      return res.status(403).json({
        error: code,
        message:
          user.status === 'BANNED'
            ? 'This account has been banned.'
            : 'This account is currently suspended.',
        fieldErrors: {},
        requestId: res.locals.requestId,
      });
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.accountStatus = user.status;
    req.sessionFamilyId = claims.sid;
    return next();
  } catch {
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Your session expired. Please sign in again.',
      fieldErrors: {},
      requestId: res.locals.requestId,
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'insufficient_role',
        message: 'You do not have permission to access this resource.',
        fieldErrors: {},
        requestId: res.locals.requestId,
      });
    }
    return next();
  };
}

export async function requireVerifiedEmail(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { emailVerified: true },
  });
  if (!user?.emailVerified) {
    return res.status(403).json({
      error: 'email_verification_required',
      message: 'Verify your email to use this feature.',
      fieldErrors: {},
      requestId: res.locals.requestId,
    });
  }
  return next();
}
