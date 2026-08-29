import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { consumeSwipeAllowance, getTodayUsage, utcUsageDay } from '../services/swipe-rate-limit.js';
import { env } from '../config/env.js';
import { createNotification, dispatchNotification } from '../services/notification.service.js';
import { trackAnalytics } from '../services/analytics.service.js';

export const swipesRouter = Router();

const swipeSchema = z.object({
  swipedId: z.string().min(1),
  action: z.enum(['PASS', 'LIKE', 'SUPERLIKE']),
  note: z.string().trim().max(280).optional().nullable(),
});

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new AppError('transaction_conflict', 409, 'Please try that action again.');
}

swipesRouter.post(
  '/swipes',
  requireAuth,
  requireVerifiedEmail,
  async (req: AuthedRequest, res, next) => {
    try {
      const swiperId = req.userId!;
      const input = swipeSchema.parse(req.body);
      if (input.swipedId === swiperId) {
        throw new AppError('cannot_swipe_self', 400, 'You cannot swipe on yourself.');
      }
      if (input.action === 'PASS' && input.note) {
        throw new AppError('note_requires_like', 400, 'A Convince Me note must accompany a Like.');
      }

      const result = await serializable(async (tx) => {
        const [target, blocked, existing] = await Promise.all([
          tx.user.findFirst({
            where: {
              id: input.swipedId,
              status: 'ACTIVE',
              emailVerified: true,
              profile: { profileCompletedAt: { not: null } },
            },
            select: {
              id: true,
              profile: { select: { displayName: true } },
              photos: { orderBy: { position: 'asc' }, take: 1 },
            },
          }),
          tx.block.findFirst({
            where: {
              OR: [
                { blockerId: swiperId, blockedId: input.swipedId },
                { blockerId: input.swipedId, blockedId: swiperId },
              ],
            },
          }),
          tx.swipe.findUnique({
            where: { swiperId_swipedId: { swiperId, swipedId: input.swipedId } },
          }),
        ]);
        if (!target || blocked) {
          throw new AppError('profile_not_available', 404, 'That profile is no longer available.');
        }
        if (existing) {
          const userAId = swiperId < input.swipedId ? swiperId : input.swipedId;
          const userBId = swiperId < input.swipedId ? input.swipedId : swiperId;
          const match = await tx.match.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
          return {
            swipeId: existing.id,
            matched: Boolean(match?.isActive),
            matchId: match?.isActive ? match.id : undefined,
            alreadySwiped: true,
            notificationIds: [] as string[],
            matchedUser: null,
          };
        }

        await consumeSwipeAllowance(tx, swiperId, input.action);
        const swipe = await tx.swipe.create({
          data: {
            swiperId,
            swipedId: input.swipedId,
            action: input.action,
            note: input.action === 'PASS' ? null : input.note || null,
          },
        });

        const notificationIds: string[] = [];
        if (input.action === 'LIKE' || input.action === 'SUPERLIKE') {
          const reciprocal = await tx.swipe.findFirst({
            where: {
              swiperId: input.swipedId,
              swipedId: swiperId,
              action: { in: ['LIKE', 'SUPERLIKE'] },
            },
          });
          if (reciprocal) {
            const userAId = swiperId < input.swipedId ? swiperId : input.swipedId;
            const userBId = swiperId < input.swipedId ? input.swipedId : swiperId;
            const existingMatch = await tx.match.findUnique({
              where: { userAId_userBId: { userAId, userBId } },
            });
            if (existingMatch && !existingMatch.isActive) {
              return {
                swipeId: swipe.id,
                matched: false,
                alreadySwiped: false,
                notificationIds,
                matchedUser: null,
              };
            }
            const match = existingMatch ??
              (await tx.match.create({
                data: { userAId, userBId, conversation: { create: {} } },
              }));
            // Server-side match_created event (fires after the response
            // so the transaction has committed). Per-user first_match
            // milestone is handled client-side via trackMilestone so we
            // can dedupe with localStorage without a DB lookup.
            setImmediate(() => {
              void trackAnalytics({ event: 'match_created', userId: swiperId });
            });
            if (!existingMatch) {
              const [mine, theirs] = await Promise.all([
                tx.user.findUnique({
                  where: { id: swiperId },
                  select: { profile: { select: { displayName: true } }, photos: { take: 1, orderBy: { position: 'asc' } } },
                }),
                tx.user.findUnique({
                  where: { id: input.swipedId },
                  select: { profile: { select: { displayName: true } }, photos: { take: 1, orderBy: { position: 'asc' } } },
                }),
              ]);
              const forMe = await createNotification(tx, {
                userId: swiperId,
                actorId: input.swipedId,
                type: 'MATCH',
                entityId: match.id,
                title: "It's a Match",
                body: `You and ${theirs?.profile?.displayName ?? 'someone new'} liked each other.`,
                data: { route: `/matches/${match.id}` },
              });
              const forThem = await createNotification(tx, {
                userId: input.swipedId,
                actorId: swiperId,
                type: 'MATCH',
                entityId: match.id,
                title: "It's a Match",
                body: `You and ${mine?.profile?.displayName ?? 'someone new'} liked each other.`,
                data: { route: `/matches/${match.id}` },
              });
              notificationIds.push(forMe.id, forThem.id);
              return {
                swipeId: swipe.id,
                matched: true,
                matchId: match.id,
                alreadySwiped: false,
                notificationIds,
                matchedUser: {
                  displayName: theirs?.profile?.displayName ?? target.profile?.displayName ?? 'Your match',
                  photoUrl: theirs?.photos[0]?.url ?? target.photos[0]?.url ?? null,
                  myPhotoUrl: mine?.photos[0]?.url ?? null,
                },
              };
            }
            return {
              swipeId: swipe.id,
              matched: true,
              matchId: match.id,
              alreadySwiped: false,
              notificationIds,
              matchedUser: null,
            };
          }

          const like = await createNotification(tx, {
            userId: input.swipedId,
            actorId: swiperId,
            type: 'LIKE',
            entityId: swipe.id,
            title: input.action === 'SUPERLIKE' ? 'Someone sent a Super Like' : 'Someone likes you',
            body: 'Open SIMP to see who is interested.',
            data: { route: '/matches?tab=likes' },
          });
          notificationIds.push(like.id);
        }

        return {
          swipeId: swipe.id,
          matched: false,
          alreadySwiped: false,
          notificationIds,
          matchedUser: null,
        };
      });

      await Promise.all(result.notificationIds.map((id) => dispatchNotification(id)));
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

swipesRouter.get('/swipes/usage', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const usage = await getTodayUsage(prisma, req.userId!);
    res.json({
      day: utcUsageDay(),
      likesUsed: usage.likes,
      superLikesUsed: usage.superLikes,
      rewindsUsed: usage.rewinds,
      limits: {
        likes: env.FREE_DAILY_LIKES,
        superLikes: env.FREE_DAILY_SUPER_LIKES,
      },
    });
  } catch (error) {
    next(error);
  }
});

swipesRouter.get('/swipes/received-notes', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const notes = await prisma.swipe.findMany({
      where: {
        swipedId: req.userId!,
        action: { in: ['LIKE', 'SUPERLIKE'] },
        note: { not: null },
        swiper: { status: 'ACTIVE' },
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
      take: limit,
    });
    res.json({
      notes: notes.map((note) => ({
        swipeId: note.id,
        fromUserId: note.swiperId,
        fromName: note.swiper.profile?.displayName ?? 'Someone',
        fromPhotoUrl: note.swiper.photos[0]?.url ?? null,
        note: note.note,
        createdAt: note.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

swipesRouter.delete('/swipes/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.swipe.findFirst({ where: { swiperId: userId }, orderBy: { createdAt: 'desc' } });
      if (!latest || latest.id !== req.params.id) {
        throw new AppError('only_latest_swipe_rewindable', 409, 'Only your latest swipe can be rewound.');
      }
      const userAId = userId < latest.swipedId ? userId : latest.swipedId;
      const userBId = userId < latest.swipedId ? latest.swipedId : userId;
      await tx.match.updateMany({
        where: { userAId, userBId, isActive: true },
        data: { isActive: false, deactivatedAt: new Date(), deactivatedById: userId },
      });
      await tx.swipe.delete({ where: { id: latest.id } });
      await tx.dailyUsage.upsert({
        where: { userId_day: { userId, day: utcUsageDay() } },
        create: { userId, day: utcUsageDay(), rewinds: 1 },
        update: { rewinds: { increment: 1 } },
      });
      return { swipedId: latest.swipedId };
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});
