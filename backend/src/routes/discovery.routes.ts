import { Router } from 'express';
import { type Gender } from '@prisma/client';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const discoveryRouter = Router();

/**
 * GET /discovery — swipe deck for the current user
 *
 * Query params:
 *  - minAge:    minimum age (default 18)
 *  - maxAge:    maximum age (default 99)
 *  - cursor:    pagination token (last userId from previous page)
 *  - limit:     page size (default 20, max 50)
 *
 * Filters:
 *  - Excludes self, already-swiped, blocked-by-me, blocked-of-me
 *  - Matches user's lookingFor against candidate gender
 *  - Excludes users with no profile or no photos
 *  - Age range (computed from birthDate)
 */
discoveryRouter.get('/discovery', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;

    const minAge = Math.max(18, Math.min(99, parseInt(String(req.query.minAge ?? '18'), 10) || 18));
    const maxAge = Math.max(minAge, Math.min(99, parseInt(String(req.query.maxAge ?? '99'), 10) || 99));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!me?.profile) {
      return res.status(400).json({ error: 'profile_required' });
    }

    const genderFilter: Gender[] =
      me.profile.lookingFor === 'WOMEN'
        ? ['WOMAN']
        : me.profile.lookingFor === 'MEN'
        ? ['MAN']
        : ['WOMAN', 'MAN', 'NONBINARY'];

    const swiped = await prisma.swipe.findMany({
      where: { swiperId: userId },
      select: { swipedId: true },
    });
    const swipedIds = swiped.map((s) => s.swipedId);

    const blocked = await prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = new Set<string>();
    blocked.forEach((b) => {
      if (b.blockerId === userId) blockedIds.add(b.blockedId);
      else blockedIds.add(b.blockerId);
    });

    const excludeIds = new Set<string>([userId, ...swipedIds, ...blockedIds]);

    const now = new Date();
    const maxBirth = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());
    const minBirth = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate() + 1);

    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) },
        profile: {
          gender: { in: genderFilter },
          birthDate: { gte: minBirth, lte: maxBirth },
        },
        photos: { some: {} },
      },
      include: {
        profile: true,
        photos: { orderBy: { position: 'asc' } },
        prompts: { orderBy: { position: 'asc' } },
        interests: { include: { interest: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = candidates.length > limit;
    const page = hasMore ? candidates.slice(0, limit) : candidates;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    const payload = page.flatMap((u) => {
      if (!u.profile) return [];
      const ageMs = Date.now() - u.profile.birthDate.getTime();
      const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
      return [
        {
          profileId: u.profile.id,
          userId: u.id,
          displayName: u.profile.displayName,
          bio: u.profile.bio,
          age,
          gender: u.profile.gender,
          city: u.profile.city,
          occupation: u.profile.occupation,
          heightCm: u.profile.heightCm,
          isVerified: u.profile.isVerified,
          isPremium: u.profile.isPremium,
          photos: u.photos.map((ph) => ({ id: ph.id, url: ph.url, position: ph.position })),
          prompts: u.prompts.map((pr) => ({
            id: pr.id,
            question: pr.question,
            answer: pr.answer,
          })),
          interests: u.interests.map((i) => ({
            slug: i.interest.slug,
            label: i.interest.label,
          })),
        },
      ];
    });

    res.json({
      profiles: payload,
      nextCursor,
      hasMore,
    });
  } catch (e) {
    next(e);
  }
});
