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

const profilePatchSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  bio: z.string().max(500).optional().nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['WOMAN', 'MAN', 'NONBINARY', 'PREFER_NOT_TO_SAY']).optional(),
  lookingFor: z.enum(['WOMEN', 'MEN', 'EVERYONE']).optional(),
  city: z.string().max(80).optional().nullable(),
  occupation: z.string().max(80).optional().nullable(),
  heightCm: z.number().int().min(80).max(260).optional().nullable(),
  interestSlugs: z.array(z.string().min(1)).max(20).optional(),
});

const promptCreateSchema = z.object({
  question: z.string().min(2).max(120),
  answer: z.string().min(1).max(280),
  position: z.number().int().min(0).max(20).optional(),
});

usersRouter.get('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        interests: { include: { interest: true } },
        user: {
          select: {
            id: true,
            email: true,
            photos: { orderBy: { position: 'asc' } },
            prompts: { orderBy: { position: 'asc' } },
          },
        },
      },
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

usersRouter.patch('/me/profile', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const data = profilePatchSchema.parse(req.body);
    const userId = req.userId!;

    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.bio !== undefined) updateData.bio = data.bio ?? null;
    if (data.birthDate !== undefined) updateData.birthDate = new Date(data.birthDate);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.lookingFor !== undefined) updateData.lookingFor = data.lookingFor;
    if (data.city !== undefined) updateData.city = data.city ?? null;
    if (data.occupation !== undefined) updateData.occupation = data.occupation ?? null;
    if (data.heightCm !== undefined) updateData.heightCm = data.heightCm ?? null;

    if (Object.keys(updateData).length > 0) {
      await prisma.profile.update({ where: { userId }, data: updateData });
    }

    if (data.interestSlugs) {
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

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

usersRouter.get('/me/prompts', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const prompts = await prisma.prompt.findMany({
      where: { userId: req.userId! },
      orderBy: { position: 'asc' },
    });
    res.json({ prompts });
  } catch (e) {
    next(e);
  }
});

usersRouter.post('/me/prompts', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const data = promptCreateSchema.parse(req.body);

    const existing = await prisma.prompt.count({ where: { userId } });
    if (existing >= 3) {
      return res.status(400).json({ error: 'max_prompts_reached' });
    }

    const last = await prisma.prompt.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
    });
    const position = data.position ?? (last?.position ?? -1) + 1;

    const prompt = await prisma.prompt.create({
      data: {
        userId,
        question: data.question,
        answer: data.answer,
        position,
      },
    });

    res.status(201).json(prompt);
  } catch (e) {
    next(e);
  }
});

usersRouter.delete('/me/prompts/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const promptId = req.params.id;

    const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
    if (!prompt) return res.status(404).json({ error: 'prompt_not_found' });
    if (prompt.userId !== userId) return res.status(403).json({ error: 'not_your_prompt' });

    await prisma.prompt.delete({ where: { id: promptId } });
    res.json({ ok: true });
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

usersRouter.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        profile: true,
        photos: { orderBy: { position: 'asc' } },
        prompts: { orderBy: { position: 'asc' } },
        interests: { include: { interest: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    res.json(user);
  } catch (e) {
    next(e);
  }
});
