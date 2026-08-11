import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const swipesRouter = Router();

const swipeSchema = z.object({
  swipedId: z.string().min(1),
  action: z.enum(['PASS', 'LIKE', 'SUPERLIKE']),
  note: z.string().max(280).optional().nullable(),
});

/**
 * POST /swipes — record a swipe action
 *
 * Body: { swipedId, action: 'PASS' | 'LIKE' | 'SUPERLIKE', note?: string (max 280 chars) }
 *
 * If action is LIKE/SUPERLIKE and the swiped user has already liked/superliked the
 * swiper, a Match is created automatically (with userAId = alphabetically smaller).
 *
 * Returns: { swipeId, matched: bool, matchId?: string }
 */
swipesRouter.post('/swipes', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const swiperId = req.userId!;
    const data = swipeSchema.parse(req.body);

    if (data.swipedId === swiperId) {
      return res.status(400).json({ error: 'cannot_swipe_self' });
    }

    const swiped = await prisma.user.findUnique({
      where: { id: data.swipedId },
      select: { id: true, profile: { select: { id: true } } },
    });

    if (!swiped?.profile) {
      return res.status(404).json({ error: 'swiped_user_not_found' });
    }

    // Record the swipe (handle duplicate gracefully)
    let swipe: { id: string; action: 'PASS' | 'LIKE' | 'SUPERLIKE' };
    try {
      swipe = await prisma.swipe.create({
        data: {
          swiperId,
          swipedId: data.swipedId,
          action: data.action,
          note: data.note ?? null,
        },
        select: { id: true, action: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await prisma.swipe.findUnique({
          where: { swiperId_swipedId: { swiperId, swipedId: data.swipedId } },
          select: { id: true, action: true },
        });
        if (!existing) throw e;
        swipe = existing;
      } else {
        throw e;
      }
    }

    // If it's a like/superlike, check for mutual like → create Match
    if (data.action === 'LIKE' || data.action === 'SUPERLIKE') {
      const reciprocal = await prisma.swipe.findFirst({
        where: {
          swiperId: data.swipedId,
          swipedId: swiperId,
          action: { in: ['LIKE', 'SUPERLIKE'] },
        },
      });

      if (reciprocal) {
        const userAId = swiperId < data.swipedId ? swiperId : data.swipedId;
        const userBId = swiperId < data.swipedId ? data.swipedId : swiperId;

        const match = await prisma.match.upsert({
          where: { userAId_userBId: { userAId, userBId } },
          update: {},
          create: { userAId, userBId },
        });

        return res.json({
          swipeId: swipe.id,
          matched: true,
          matchId: match.id,
        });
      }
    }

    res.json({
      swipeId: swipe.id,
      matched: false,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /swipes/received-notes — get the "Convince Me" notes from users who liked you
 */
swipesRouter.get('/swipes/received-notes', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const notes = await prisma.swipe.findMany({
      where: {
        swipedId: userId,
        action: { in: ['LIKE', 'SUPERLIKE'] },
        note: { not: null },
      },
      include: {
        swiper: {
          select: {
            id: true,
            profile: { select: { displayName: true } },
            photos: { take: 1, orderBy: { position: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      notes: notes.map((n) => ({
        swipeId: n.id,
        fromUserId: n.swiperId,
        fromName: n.swiper.profile?.displayName ?? 'Someone',
        fromPhotoUrl: n.swiper.photos[0]?.url ?? null,
        note: n.note,
        createdAt: n.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /swipes/:id — undo/retract a swipe you made
 *
 * If this swipe created a match (mutual like), the match is also deactivated.
 * Returns the swiped userId so the client can re-insert the profile into the deck.
 */
swipesRouter.delete('/swipes/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const swipeId = req.params.id!;

    const swipe = await prisma.swipe.findUnique({ where: { id: swipeId } });
    if (!swipe) return res.status(404).json({ error: 'swipe_not_found' });
    if (swipe.swiperId !== userId) return res.status(403).json({ error: 'not_your_swipe' });

    const swipedId = swipe.swipedId;

    const userAId = userId < swipedId ? userId : swipedId;
    const userBId = userId < swipedId ? swipedId : userId;
    await prisma.match
      .update({
        where: { userAId_userBId: { userAId, userBId } },
        data: { isActive: false },
      })
      .catch(() => null);

    await prisma.swipe.delete({ where: { id: swipeId } });

    res.json({ ok: true, swipedId });
  } catch (e) {
    next(e);
  }
});
