// Tier-gated middleware. Use after requireAuth so req.userId is set.
// Throws a 402 payment_required AppError so the client can show the
// paywall rather than a generic 403.

import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { AuthedRequest } from './auth.js';

export type TierGate = 'SIMP_PLUS' | 'SIMP_ELITE';

/** Numeric rank so we can use >= when comparing tier requirements. */
const TIER_RANK: Record<'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE', number> = {
  FREE: 0,
  SIMP_PLUS: 1,
  SIMP_ELITE: 2,
};

export async function getActiveTier(userId: string): Promise<'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE'> {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ tier: 'desc' }, { createdAt: 'desc' }],
    select: { tier: true },
  });
  return entitlement ? (entitlement.tier as 'SIMP_PLUS' | 'SIMP_ELITE') : 'FREE';
}

/**
 * Build a middleware that requires the caller's effective tier to be
 * >= `minTier` (Elite > Plus > Free).
 *
 *  requireTier('SIMP_PLUS')  → Plus or Elite
 *  requireTier('SIMP_ELITE') → Elite only
 */
export function requireTier(minTier: TierGate) {
  return async function tierGate(req: Request, _res: Response, next: NextFunction) {
    const userId = (req as AuthedRequest).userId;
    if (!userId) return next(new AppError('unauthorized', 401, 'Sign in to continue.'));
    try {
      const tier = await getActiveTier(userId);
      if (TIER_RANK[tier] >= TIER_RANK[minTier]) return next();
      return next(
        new AppError(
          'payment_required',
          402,
          `${minTier.replace('_', ' ')} is required for this action.`,
          { details: { requiredTier: minTier, currentTier: tier } },
        ),
      );
    } catch (error) {
      return next(error);
    }
  };
}
