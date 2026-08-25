import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { getRealtimeServer } from '../sockets/realtime.js';
import {
  authorizeConversation,
  markMessagesDelivered,
  markMessagesRead,
  sendMessage,
} from '../services/messaging.service.js';
import { cloudinaryThumbnailUrl } from '../services/cloudinary.service.js';
import { trackAnalytics } from '../services/analytics.service.js';

export const messagesRouter = Router();

const sendSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
  clientId: z.string().trim().min(8).max(100).optional(),
  messageType: z.enum(['TEXT']).default('TEXT'),
});
const receiptSchema = z.object({ throughMessageId: z.string().min(1).optional() });

messagesRouter.get('/conversations', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const blocks = await prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blocks.map((item) => (item.blockerId === userId ? item.blockedId : item.blockerId));

    const conversations = await prisma.conversation.findMany({
      where: {
        match: {
          isActive: true,
          OR: [{ userAId: userId }, { userBId: userId }],
          userAId: { notIn: blockedIds },
          userBId: { notIn: blockedIds },
          userA: { status: 'ACTIVE' },
          userB: { status: 'ACTIVE' },
        },
      },
      include: {
        match: {
          include: {
            userA: { select: { id: true, profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
            userB: { select: { id: true, profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
          },
        },
        messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: { messages: { where: { senderId: { not: userId }, readAt: null, deletedAt: null } } },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = conversations.length > limit;
    const page = hasMore ? conversations.slice(0, limit) : conversations;
    res.json({
      conversations: page.map((conversation) => {
        const other =
          conversation.match.userAId === userId
            ? conversation.match.userB
            : conversation.match.userA;
        return {
          id: conversation.id,
          matchId: conversation.matchId,
          updatedAt: conversation.updatedAt,
          otherUser: {
            userId: other.id,
            displayName: other.profile?.displayName ?? 'SIMP member',
            photoUrl: other.photos[0]?.url ?? null,
            thumbnailUrl: other.photos[0] ? cloudinaryThumbnailUrl(other.photos[0].url) : null,
            isVerified: other.profile?.isVerified ?? false,
          },
          latestMessage: conversation.messages[0] ?? null,
          unreadCount: conversation._count.messages,
        };
      }),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.get('/conversations/unread-count', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const count = await prisma.message.count({
      where: {
        senderId: { not: req.userId! },
        readAt: null,
        deletedAt: null,
        conversation: {
          match: {
            isActive: true,
            OR: [{ userAId: req.userId! }, { userBId: req.userId! }],
          },
        },
      },
    });
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/matches/:matchId/conversation', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: req.params.matchId } });
    if (!match || (match.userAId !== req.userId && match.userBId !== req.userId)) {
      throw new AppError('match_not_found', 404, 'Match not found.');
    }
    if (!match.isActive) throw new AppError('match_inactive', 409, 'This match is no longer active.');
    const conversation = await prisma.conversation.upsert({
      where: { matchId: match.id },
      create: { matchId: match.id },
      update: {},
    });
    res.status(201).json({ conversationId: conversation.id });
  } catch (error) {
    next(error);
  }
});

messagesRouter.get('/conversations/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => authorizeConversation(tx, req.params.id!, req.userId!));
    const other = result.other;
    const photo = await prisma.photo.findFirst({ where: { userId: other.id }, orderBy: { position: 'asc' } });
    res.json({
      id: result.conversation.id,
      matchId: result.conversation.matchId,
      otherUser: {
        userId: other.id,
        displayName: other.profile?.displayName ?? 'SIMP member',
        photoUrl: photo?.url ?? null,
        thumbnailUrl: photo ? cloudinaryThumbnailUrl(photo.url) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.get('/conversations/:id/messages', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const conversationId = req.params.id!;
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '40'), 10) || 40));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    await prisma.$transaction(async (tx) => authorizeConversation(tx, conversationId, req.userId!));
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      messages: [...page].reverse(),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post(
  '/conversations/:id/messages',
  requireAuth,
  requireVerifiedEmail,
  async (req: AuthedRequest, res, next) => {
    try {
      const input = sendSchema.parse(req.body);
      const message = await sendMessage({
        conversationId: req.params.id!,
        senderId: req.userId!,
        ...input,
      });
      // Server-side message_sent event for funnel analysis. Per-user
      // first_message milestone is tracked client-side via trackMilestone.
      setImmediate(() => {
        void trackAnalytics({
          event: 'message_sent',
          userId: req.userId!,
          source: 'server',
          properties: { conversationId: req.params.id! },
        });
      });
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  },
);

messagesRouter.post('/conversations/:id/delivered', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = receiptSchema.parse(req.body);
    const result = await markMessagesDelivered(req.params.id!, req.userId!, input.throughMessageId);
    getRealtimeServer()?.to(`conversation:${req.params.id}`).emit('message:delivered', {
      conversationId: req.params.id,
      userId: req.userId,
      at: result.at,
      throughMessageId: input.throughMessageId,
    });
    res.json({ ok: true, deliveredAt: result.at });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post('/conversations/:id/read', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = receiptSchema.parse(req.body);
    const result = await markMessagesRead(req.params.id!, req.userId!, input.throughMessageId);
    getRealtimeServer()?.to(`conversation:${req.params.id}`).emit('message:read', {
      conversationId: req.params.id,
      userId: req.userId,
      at: result.at,
      throughMessageId: input.throughMessageId,
    });
    res.json({ ok: true, readAt: result.at });
  } catch (error) {
    next(error);
  }
});

messagesRouter.delete('/messages/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.senderId !== req.userId) {
      throw new AppError('message_not_found', 404, 'Message not found.');
    }
    if (Date.now() - message.createdAt.getTime() > 15 * 60 * 1_000) {
      throw new AppError('delete_window_expired', 409, 'Messages can be removed for 15 minutes.');
    }
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { body: '', deletedAt: new Date() },
    });
    getRealtimeServer()?.to(`conversation:${message.conversationId}`).emit('message:deleted', {
      conversationId: message.conversationId,
      messageId: message.id,
      deletedAt: updated.deletedAt,
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
