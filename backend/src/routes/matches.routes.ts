import { Router } from 'express';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const matchesRouter = Router();

/**
 * GET /matches — list all matches for the current user
 */
matchesRouter.get('/matches', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;

    const matches = await prisma.match.findMany({
      where: {
        isActive: true,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const payload = await Promise.all(
      matches.map(async (m) => {
        const otherUserId = m.userAId === userId ? m.userBId : m.userAId;
        const other = await prisma.user.findUnique({
          where: { id: otherUserId },
          include: {
            profile: true,
            photos: { orderBy: { position: 'asc' }, take: 1 },
          },
        });

        const noteFromOther = await prisma.swipe.findFirst({
          where: {
            swiperId: otherUserId,
            swipedId: userId,
            action: { in: ['LIKE', 'SUPERLIKE'] },
          },
          orderBy: { createdAt: 'desc' },
        });

        const p = other?.profile;
        if (!p) return null;
        const ageMs = Date.now() - p.birthDate.getTime();
        const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));

        return {
          matchId: m.id,
          matchedAt: m.createdAt,
          otherUser: {
            userId: other!.id,
            profileId: p.id,
            displayName: p.displayName,
            age,
            city: p.city,
            occupation: p.occupation,
            isVerified: p.isVerified,
            isPremium: p.isPremium,
            photoUrl: other!.photos[0]?.url ?? null,
          },
          noteFromOther: noteFromOther?.note ?? null,
        };
      })
    );

    res.json({ matches: payload.filter((m) => m !== null) });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /matches/:id — full match detail with unlocked photos
 */
matchesRouter.get('/matches/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const matchId = req.params.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return res.status(404).json({ error: 'match_not_found' });
    }

    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'not_your_match' });
    }

    const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
    const other = await prisma.user.findUnique({
      where: { id: otherUserId },
      include: {
        profile: true,
        photos: { orderBy: { position: 'asc' } },
        prompts: { orderBy: { position: 'asc' } },
        interests: { include: { interest: true } },
      },
    });

    if (!other?.profile) {
      return res.status(404).json({ error: 'other_profile_missing' });
    }

    const p = other.profile;
    const ageMs = Date.now() - p.birthDate.getTime();
    const age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));

    const myNote = await prisma.swipe.findFirst({
      where: {
        swiperId: userId,
        swipedId: otherUserId,
        action: { in: ['LIKE', 'SUPERLIKE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const theirNote = await prisma.swipe.findFirst({
      where: {
        swiperId: otherUserId,
        swipedId: userId,
        action: { in: ['LIKE', 'SUPERLIKE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      matchId: match.id,
      matchedAt: match.createdAt,
      lastMessageAt: match.lastMessageAt,
      otherUser: {
        userId: other.id,
        profileId: p.id,
        displayName: p.displayName,
        bio: p.bio,
        age,
        gender: p.gender,
        city: p.city,
        occupation: p.occupation,
        heightCm: p.heightCm,
        isVerified: p.isVerified,
        isPremium: p.isPremium,
        photos: other.photos.map((ph) => ({ id: ph.id, url: ph.url, position: ph.position })),
        prompts: other.prompts.map((pr) => ({
          id: pr.id,
          question: pr.question,
          answer: pr.answer,
        })),
        interests: other.interests.map((i) => ({
          slug: i.interest.slug,
          label: i.interest.label,
        })),
      },
      myNote: myNote?.note ?? null,
      theirNote: theirNote?.note ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /matches/:id/unmatch — deactivate a match
 */
matchesRouter.post('/matches/:id/unmatch', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const matchId = req.params.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return res.status(404).json({ error: 'match_not_found' });
    }

    if (match.userAId !== userId && match.userBId !== userId) {
      return res.status(403).json({ error: 'not_your_match' });
    }

    await prisma.match.update({
      where: { id: matchId },
      data: { isActive: false },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
