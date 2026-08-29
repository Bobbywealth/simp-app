// Free-tier swipe rate limiter. SIMP is now an entirely free app; this
// module replaces the old entitlement-gated version with a simple,
// per-day DailyUsage counter so users can't bypass the daily likes cap
// and super-likes cap. Rewinds are also tracked here so future caps on
// free rewind volume land in one place.
//
// The caps are controlled via the FREE_DAILY_LIKES and
// FREE_DAILY_SUPER_LIKES env vars (validated in src/config/env.ts).

import type { Prisma, SwipeAction } from '@prisma/client';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function utcUsageDay(date = new Date()): Date {
  // Strip to UTC midnight so all clients (web, iOS, Android) hit the
  // same per-day boundary regardless of timezone.
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export type SwipeUsageRow = {
  likes: number;
  superLikes: number;
  rewinds: number;
};

export async function getTodayUsage(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<SwipeUsageRow> {
  const row = await tx.dailyUsage.findUnique({
    where: { userId_day: { userId, day: utcUsageDay() } },
    select: { likes: true, superLikes: true, rewinds: true },
  });
  return {
    likes: row?.likes ?? 0,
    superLikes: row?.superLikes ?? 0,
    rewinds: row?.rewinds ?? 0,
  };
}

/**
 * Enforce the per-day free swipe cap. Throws `daily_swipe_limit_reached`
 * when the user has hit the likes or super-likes cap for the day; the
 * caller must surface this as a 429 to the client.
 *
 * PASS actions never consume allowance.
 */
export async function consumeSwipeAllowance(
  tx: Prisma.TransactionClient,
  userId: string,
  action: SwipeAction,
): Promise<void> {
  if (action === 'PASS') return;

  const day = utcUsageDay();
  const existing = await tx.dailyUsage.findUnique({
    where: { userId_day: { userId, day } },
    select: { likes: true, superLikes: true },
  });

  if (action === 'LIKE') {
    const used = existing?.likes ?? 0;
    if (used >= env.FREE_DAILY_LIKES) {
      throw new AppError(
        'daily_swipe_limit_reached',
        429,
        `You've reached today's free like limit (${env.FREE_DAILY_LIKES}). Limits reset at 00:00 UTC.`,
        {
          details: {
            limit: env.FREE_DAILY_LIKES,
            used,
            resetsAt: new Date(day.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      );
    }
    await tx.dailyUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, likes: 1 },
      update: { likes: { increment: 1 } },
    });
    return;
  }

  if (action === 'SUPERLIKE') {
    const used = existing?.superLikes ?? 0;
    if (used >= env.FREE_DAILY_SUPER_LIKES) {
      throw new AppError(
        'daily_super_like_limit_reached',
        429,
        `You've reached today's free super-like limit (${env.FREE_DAILY_SUPER_LIKES}).`,
        {
          details: {
            limit: env.FREE_DAILY_SUPER_LIKES,
            used,
          },
        },
      );
    }
    await tx.dailyUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day, superLikes: 1 },
      update: { superLikes: { increment: 1 } },
    });
    return;
  }
}
