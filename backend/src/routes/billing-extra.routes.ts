// Premium-feature endpoints that don't fit cleanly into the existing
// billing routes:
//   - GET /likes/incoming      → SIMP+ reveals who already liked them
//   - POST /me/boost            → SIMP_ELITE daily boost
//   - GET /me/entitlement-events → own audit log (for the in-app receipt view)

import { Router } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireTier } from '../middleware/require-tier.js';
import { AppError } from '../utils/errors.js';
import { utcUsageDay } from '../services/entitlement.service.js';

export const billingExtrasRouter = Router();

const BOOST_HOURS = 6;

billingExtrasRouter.get('/likes/incoming', requireAuth, requireTier('SIMP_PLUS'), async (req: AuthedRequest, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const userId = req.userId!;
    // The Swipe table is keyed by (swiperId → swipedId). Find rows
    // where someone swiped-right on this user.
    const blocked = await prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocked.map((item) => (item.blockerId === userId ? item.blockedId : item.blockerId));
    // Find swipers who already liked me back (mutual = match), so we
    // hide those — they belong in /matches, not in /likes/incoming.
    const mutualSwiperIds = new Set(
      (
        await prisma.swipe.findMany({
          where: { swipedId: userId, action: { in: ['LIKE', 'SUPERLIKE'] } },
          select: { swiperId: true },
        })
      ).map((row) => row.swiperId),
    );
    const swipes = await prisma.swipe.findMany({
      where: {
        swipedId: userId,
        action: { in: ['LIKE', 'SUPERLIKE'] },
        swiperId: { notIn: [...blockedIds, ...mutualSwiperIds] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        swiper: {
          select: {
            id: true,
            status: true,
            profile: { select: { displayName: true, birthDate: true, isVerified: true } },
            photos: { take: 1, orderBy: { position: 'asc' } },
          },
        },
      },
    });
    const visibleSwipes = swipes.filter((s) => s.swiper.status === 'ACTIVE');
    res.json({
      incoming: visibleSwipes.map((swipe) => ({
        swipeId: swipe.id,
        fromUserId: swipe.swiperId,
        displayName: swipe.swiper.profile?.displayName ?? 'Someone',
        age: swipe.swiper.profile?.birthDate
          ? new Date().getUTCFullYear() - new Date(swipe.swiper.profile.birthDate).getUTCFullYear()
          : null,
        isVerified: swipe.swiper.profile?.isVerified ?? false,
        photoUrl: swipe.swiper.photos[0]?.url ?? null,
        note: swipe.note ?? null,
        action: swipe.action,
        createdAt: swipe.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

billingExtrasRouter.post('/me/boost', requireAuth, requireTier('SIMP_ELITE'), async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const day = utcUsageDay();
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new AppError('profile_not_found', 404, 'Create your profile before boosting.');
    }
    if (profile.boostedUntil && profile.boostedUntil > new Date()) {
      throw new AppError('boost_already_active', 409, 'You already have an active boost.', {
        details: { boostedUntil: profile.boostedUntil.toISOString() },
      });
    }
    await prisma.dailyUsage.upsert({
      where: { userId_day: { userId, day } },
      create: { userId, day },
      update: { boosts: { increment: 1 } },
    });
    // Daily cap = 1 boost (Elite). Re-running the same day already
    // blocks via the boostedUntil check above.
    const boostedUntil = new Date(Date.now() + BOOST_HOURS * 60 * 60 * 1000);
    // Boost score decays linearly over the window — fresh boost = 100,
    // expired = 0. Discover query orders by this field, so freshly
    // boosted profiles float to the top.
    await prisma.profile.update({
      where: { userId },
      data: { boostScore: 100, boostedUntil, lastBoostedAt: new Date() },
    });
    res.json({
      ok: true,
      boostedUntil: boostedUntil.toISOString(),
      remainingToday: 0,
    });
  } catch (error) {
    next(error);
  }
});

billingExtrasRouter.get('/me/entitlement-events', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const events = await prisma.entitlementEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        source: true,
        tier: true,
        status: true,
        platform: true,
        productId: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    res.json({ events });
  } catch (error) {
    next(error);
  }
});
