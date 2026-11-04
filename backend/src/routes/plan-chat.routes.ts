import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { getRealtimeServer } from '../sockets/realtime.js';

export const planChatRouter = Router();

const bodySchema = z.object({ body: z.string().trim().min(1).max(1000) });

/** Loads the plan and makes sure the caller is its host or an approved guest. */
async function requireParticipant(experienceId: string, me: string) {
  const experience = await prisma.experience.findUnique({
    where: { id: experienceId },
    select: { id: true, hostId: true, title: true, isActive: true, status: true },
  });
  if (!experience || !experience.isActive || experience.status === 'CANCELLED') {
    throw new AppError('experience_not_found', 404, 'Plan not found.');
  }
  if (experience.hostId !== me) {
    const approved = await prisma.experienceRequest.findFirst({
      where: { experienceId, requesterId: me, status: 'APPROVED' },
      select: { id: true },
    });
    if (!approved) throw new AppError('not_on_this_plan', 403, 'Only people on this plan can use its chat.');
  }
  return experience;
}

async function blockedWith(me: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: me }, { blockedId: me }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(blocks.map((b) => (b.blockerId === me ? b.blockedId : b.blockerId)));
}

async function senderCards(ids: string[]) {
  if (ids.length === 0) return new Map<string, { displayName: string | null; photoUrl: string | null }>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      profile: { select: { displayName: true } },
      photos: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
    },
  });
  return new Map(users.map((u) => [u.id, { displayName: u.profile?.displayName ?? null, photoUrl: u.photos[0]?.url ?? null }]));
}

// Messages, oldest first within the page. `before` pages backwards through history.
planChatRouter.get('/experiences/:id/chat', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const experienceId = z.string().min(1).parse(req.params.id);
    const me = req.userId!;
    const query = z
      .object({ before: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(req.query);
    await requireParticipant(experienceId, me);
    const blocked = await blockedWith(me);

    const rows = await prisma.planMessage.findMany({
      where: {
        experienceId,
        deletedAt: null,
        ...(blocked.size ? { senderId: { notIn: [...blocked] } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = (hasMore ? rows.slice(0, query.limit) : rows).reverse();
    const cards = await senderCards([...new Set(page.map((m) => m.senderId))]);
    res.json({
      messages: page.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: cards.get(m.senderId)?.displayName ?? null,
        senderPhotoUrl: cards.get(m.senderId)?.photoUrl ?? null,
        body: m.body,
        createdAt: m.createdAt,
        mine: m.senderId === me,
      })),
      nextCursor: hasMore ? page[0]?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

planChatRouter.post('/experiences/:id/chat', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const experienceId = z.string().min(1).parse(req.params.id);
    const me = req.userId!;
    const input = bodySchema.parse(req.body);
    const experience = await requireParticipant(experienceId, me);

    const message = await prisma.planMessage.create({
      data: { experienceId, senderId: me, body: input.body },
    });
    const [card] = [(await senderCards([me])).get(me)];

    const approved = await prisma.experienceRequest.findMany({
      where: { experienceId, status: 'APPROVED' },
      select: { requesterId: true },
    });
    const blocked = await blockedWith(me);
    const payload = {
      id: message.id,
      senderId: me,
      senderName: card?.displayName ?? null,
      senderPhotoUrl: card?.photoUrl ?? null,
      body: message.body,
      createdAt: message.createdAt,
    };
    for (const userId of new Set([experience.hostId, ...approved.map((a) => a.requesterId)])) {
      if (userId === me || blocked.has(userId)) continue;
      getRealtimeServer()?.to(`user:${userId}`).emit('plan:message', { experienceId, message: { ...payload, mine: false } });
    }
    res.status(201).json({ message: { ...payload, mine: true } });
  } catch (error) {
    next(error);
  }
});
