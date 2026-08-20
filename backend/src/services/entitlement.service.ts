import type { Prisma, SwipeAction } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export type EffectiveEntitlement = {
  tier: 'FREE' | 'SIMP_PLUS' | 'SIMP_ELITE';
  premium: boolean;
  expiresAt: Date | null;
};

export async function getEffectiveEntitlement(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<EffectiveEntitlement> {
  const entitlement = await client.entitlement.findFirst({
    where: {
      userId,
      status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ tier: 'desc' }, { createdAt: 'desc' }],
  });
  return entitlement
    ? { tier: entitlement.tier, premium: true, expiresAt: entitlement.expiresAt }
    : { tier: 'FREE', premium: false, expiresAt: null };
}

export function utcUsageDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function consumeSwipeAllowance(
  tx: Prisma.TransactionClient,
  userId: string,
  action: SwipeAction,
) {
  if (action === 'PASS') return;
  const entitlement = await getEffectiveEntitlement(tx, userId);
  const limits =
    entitlement.tier === 'SIMP_ELITE'
      ? { likes: null, superLikes: 10 }
      : entitlement.tier === 'SIMP_PLUS'
        ? { likes: null, superLikes: 5 }
        : { likes: env.FREE_DAILY_LIKES, superLikes: env.FREE_DAILY_SUPER_LIKES };
  const day = utcUsageDay();

  await tx.dailyUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day },
    update: {},
  });

  if (action === 'LIKE') {
    if (limits.likes === null) {
      await tx.dailyUsage.update({
        where: { userId_day: { userId, day } },
        data: { likes: { increment: 1 } },
      });
      return;
    }
    const result = await tx.dailyUsage.updateMany({
      where: { userId, day, likes: { lt: limits.likes } },
      data: { likes: { increment: 1 } },
    });
    if (!result.count) {
      throw new AppError('daily_like_limit_reached', 429, 'You have used today’s likes.', {
        details: { resetsAt: new Date(day.getTime() + 86_400_000).toISOString() },
      });
    }
    return;
  }

  const result = await tx.dailyUsage.updateMany({
    where: { userId, day, superLikes: { lt: limits.superLikes } },
    data: { superLikes: { increment: 1 } },
  });
  if (!result.count) {
    throw new AppError('daily_super_like_limit_reached', 429, 'You have used today’s Super Likes.', {
      details: { resetsAt: new Date(day.getTime() + 86_400_000).toISOString() },
    });
  }
}
