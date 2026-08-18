import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const experiencesRouter = Router();

experiencesRouter.get('/experiences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    if (!env.FEATURE_EXPERIENCES) {
      throw new AppError('feature_disabled', 404, 'Experiences are not available yet.');
    }
    const input = z
      .object({
        cursor: z.string().optional(),
        city: z.string().trim().max(80).optional(),
        category: z.enum(['DINNER', 'DRINKS', 'EVENT', 'CONCERT', 'TRAVEL', 'SHOPPING', 'ADVENTURE', 'VIP', 'OTHER']).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);
    const rows = await prisma.experience.findMany({
      where: {
        isActive: true,
        ...(input.city ? { city: { equals: input.city, mode: 'insensitive' } } : {}),
        ...(input.category ? { category: input.category } : {}),
        OR: [{ startsAt: null }, { startsAt: { gte: new Date() } }],
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const experiences = hasMore ? rows.slice(0, input.limit) : rows;
    res.json({ experiences, nextCursor: hasMore ? experiences.at(-1)?.id ?? null : null, hasMore });
  } catch (error) {
    next(error);
  }
});

experiencesRouter.post('/admin/experiences', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        title: z.string().trim().min(2).max(160),
        description: z.string().trim().max(2_000).optional(),
        category: z.enum(['DINNER', 'DRINKS', 'EVENT', 'CONCERT', 'TRAVEL', 'SHOPPING', 'ADVENTURE', 'VIP', 'OTHER']),
        city: z.string().trim().min(2).max(80),
        startsAt: z.string().datetime().optional(),
        priceCents: z.number().int().min(0).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
        provider: z.string().trim().max(160).optional(),
        capacity: z.number().int().min(1).optional(),
        bookingUrl: z.string().url().optional(),
        imageUrl: z.string().url().optional(),
        isActive: z.boolean().default(false),
      })
      .parse(req.body);
    const experience = await prisma.experience.create({
      data: { ...input, startsAt: input.startsAt ? new Date(input.startsAt) : null },
    });
    res.status(201).json(experience);
  } catch (error) {
    next(error);
  }
});
