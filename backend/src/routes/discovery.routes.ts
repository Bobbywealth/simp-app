import { Router } from 'express';
import { type Gender } from '@prisma/client';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const discoveryRouter = Router();

/**
 * Returns the swipe deck for the current user.
 *
 * Filters:
 *  - Excludes the user themselves
 *  - Excludes already-swiped users
 *  - Matches the user's `lookingFor` against the candidate's `gender`
 *  - Excludes users with no profile (incomplete onboarding)
 *  - Excludes users with no photos (looks empty without photos)
 *
 * Returns up to 20 profiles with photo URLs, prompts, and interests.
 */
discoveryRouter.get('/discovery', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;

    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!me?.profile) {
      return res.status(400).json({ error: 'profile_required' });
    }

    // Map user's lookingFor → candidate gender filter
    const genderFilter: Gender[] =
      me.profile.lookingFor === 'WOMEN'
        ? ['WOMAN']
        : me.profile.lookingFor === 'MEN'
        ? ['MAN']
        : ['WOMAN', 'MAN', 'NONBINARY'];

    // Users we've already swiped on
    const swiped = await prisma.swipe.findMany({
      where: { swiperId: userId },
      select: { swipedId: true },
    });
    const swipedIds = swiped.map((s) => s.swipedId);

    // Query through User to get photos/prompts/interests
    const candidates = await prisma.user.findMany({
      where: {
        id: { not: userId, notIn: swipedIds },
        profile: {
          gender: { in: genderFilter },
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
      take: 20,
    });

    const now = Date.now();
    const payload = candidates.flatMap((u) => {
      if (!u.profile) return [];
      const ageMs = now - u.profile.birthDate.getTime();
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

    res.json({ profiles: payload });
  } catch (e) {
    next(e);
  }
});
