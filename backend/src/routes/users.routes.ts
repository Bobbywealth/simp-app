import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const usersRouter = Router();

const profileSchema = z.object({
  displayName: z.string().min(2).max(40),
  bio: z.string().max(500).optional().nullable(),
  birthDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  gender: z.enum(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY']),
  lookingFor: z.enum(['WOMEN', 'MEN', 'EVERYONE']),
  city: z.string().max(80).optional().nullable(),
  occupation: z.string().max(80).optional().nullable(),
  heightCm: z.number().int().min(80).max(260).optional().nullable(),
  interestSlugs: z.array(z.string().min(1)).max(20).optional(),
});

// Get or create profile for current user
usersRouter.get('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId! },
      include: { interests: { include: { interest: true } } },
    });
    res.json(profile);
  } catch (e) {
    next(e);
  }
});

usersRouter.put('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const data = profileSchema.parse(req.body);
    const userId = req.userId!;

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.displayName,
        bio: data.bio ?? null,
        birthDate: new Date(data.birthDate),
        gender: data.gender,
        lookingFor: data.lookingFor,
        city: data.city ?? null,
        occupation: data.occupation ?? null,
        heightCm: data.heightCm ?? null,
      },
      update: {
        displayName: data.displayName,
        bio: data.bio ?? null,
        birthDate: new Date(data.birthDate),
        gender: data.gender,
        lookingFor: data.lookingFor,
        city: data.city ?? null,
        occupation: data.occupation ?? null,
        heightCm: data.heightCm ?? null,
      },
    });

    if (data.interestSlugs) {
      // Make sure all interest slugs exist; create missing ones.
      const interests = await Promise.all(
        data.interestSlugs.map(async (slug) => {
          const label = slug
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return prisma.interest.upsert({
            where: { slug },
            create: { slug, label },
            update: {},
          });
        })
      );

      await prisma.userInterest.deleteMany({ where: { userId } });
      await prisma.userInterest.createMany({
        data: interests.map((i) => ({ userId, interestId: i.id })),
        skipDuplicates: true,
      });
    }

    res.json(profile);
  } catch (e) {
    next(e);
  }
});

usersRouter.get('/interests', async (_req, res, next) => {
  try {
    const interests = await prisma.interest.findMany({ orderBy: { label: 'asc' } });
    res.json(interests);
  } catch (e) {
    next(e);
  }
});
