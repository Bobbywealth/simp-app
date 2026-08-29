import type { ReportCategory } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, requireVerifiedEmail, type AuthedRequest } from '../middleware/auth.js';
import { requireLegalCompliance } from '../middleware/legal.js';
import { getRealtimeServer } from '../sockets/realtime.js';
import { AppError } from '../utils/errors.js';
import { getProfileCompletion } from '../services/profile-completion.service.js';
import { REPORT_CATEGORIES } from './moderation.routes.js';
import { trackAnalytics } from '../services/analytics.service.js';
import {
  issueLiveToken,
  startRecording,
  stopRecording,
  deleteRoom,
} from '../services/livekit.service.js';

export const liveRouter = Router();

const startStreamSchema = z.object({
  title: z.string().trim().min(2).max(120),
  forceReplace: z.boolean().optional(),
});
const reportCategoryValues = REPORT_CATEGORIES.map((item) => item.value) as [
  ReportCategory,
  ...ReportCategory[],
];

async function blockedUserIds(userId: string) {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((item) => (item.blockerId === userId ? item.blockedId : item.blockerId));
}

liveRouter.get('/live/streams', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const blockedIds = await blockedUserIds(req.userId!);
    const rows = await prisma.liveStream.findMany({
      where: {
        status: 'LIVE',
        broadcasterId: { notIn: blockedIds },
        broadcaster: { status: 'ACTIVE' },
        reports: {
          none: {
            reporterId: req.userId!,
            status: { in: ['OPEN', 'REVIEWING', 'ACTIONED'] },
          },
        },
      },
      include: {
        broadcaster: {
          select: {
            id: true,
            profile: true,
            photos: { take: 1, orderBy: { position: 'asc' } },
          },
        },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const streams = (hasMore ? rows.slice(0, limit) : rows).flatMap((stream) => {
      const profile = stream.broadcaster.profile;
      if (!profile) return [];
      return [
        {
          id: stream.id,
          title: stream.title,
          startedAt: stream.startedAt,
          viewerCount: stream.viewerCount,
          heartCount: stream.heartCount,
          broadcaster: {
            userId: stream.broadcaster.id,
            displayName: profile.displayName,
            age: Math.floor(
              (Date.now() - profile.birthDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1_000),
            ),
            photoUrl: stream.broadcaster.photos[0]?.url ?? null,
            isVerified: profile.isVerified,
          },
        },
      ];
    });
    res.json({ streams, nextCursor: hasMore ? streams.at(-1)?.id ?? null : null, hasMore });
  } catch (error) {
    next(error);
  }
});

liveRouter.get('/live/streams/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const blockedIds = await blockedUserIds(req.userId!);
    const stream = await prisma.liveStream.findFirst({
      where: {
        id: req.params.id,
        status: 'LIVE',
        broadcasterId: { notIn: blockedIds },
        broadcaster: { status: 'ACTIVE' },
      },
      include: {
        broadcaster: { select: { id: true, profile: true, photos: { take: 1, orderBy: { position: 'asc' } } } },
      },
    });
    if (!stream?.broadcaster.profile) throw new AppError('stream_not_found', 404, 'Stream not found.');
    res.json({
      id: stream.id,
      title: stream.title,
      startedAt: stream.startedAt,
      viewerCount: stream.viewerCount,
      heartCount: stream.heartCount,
      broadcaster: {
        userId: stream.broadcaster.id,
        displayName: stream.broadcaster.profile.displayName,
        photoUrl: stream.broadcaster.photos[0]?.url ?? null,
        isVerified: stream.broadcaster.profile.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
});

liveRouter.post(
  '/live/streams',
  requireAuth,
  requireVerifiedEmail,
  requireLegalCompliance,
  async (req: AuthedRequest, res, next) => {
    try {
      const userId = req.userId!;
      const input = startStreamSchema.parse(req.body);
      const completion = await getProfileCompletion(userId);
      if (!completion.complete) {
        throw new AppError('profile_incomplete', 409, 'Complete your profile before going live.', {
          details: { missing: completion.missing },
        });
      }

      const stream = await prisma.$transaction(async (tx) => {
        const existing = await tx.liveStream.findFirst({
          where: { broadcasterId: userId, status: 'LIVE' },
        });
        if (existing && !input.forceReplace) {
          throw new AppError('stream_already_live', 409, 'You already have a live stream.', {
            details: { streamId: existing.id },
          });
        }
        if (existing) {
          await tx.liveStream.update({
            where: { id: existing.id },
            data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
          });
        }
        return tx.liveStream.create({ data: { broadcasterId: userId, title: input.title } });
      });
      res.status(201).json({ streamId: stream.id, startedAt: stream.startedAt });
      setImmediate(() => {
        void trackAnalytics({
          event: 'live_started',
          userId,
          source: 'server',
          properties: { streamId: stream.id },
        });
        // Kick off composite recording asynchronously. Failures here are
        // non-fatal — the stream is live regardless; recording just won't
        // be retained.
        void startRecording(stream.id).catch(() => undefined);
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Issue a LiveKit access token for the requested stream. The token is
 * scoped to that one room, has canPublish derived from the user's role
 * (broadcaster = canPublish + canSubscribe; viewer = canSubscribe only),
 * and expires in 4h. The frontend calls this right before
 * `Room.connect(url, token)`.
 */
liveRouter.post("/live/token", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        streamId: z.string().min(1).max(80),
        isBroadcaster: z.boolean().optional(),
      })
      .parse(req.body ?? {});
    const userId = req.userId!;
    const stream = await prisma.liveStream.findFirst({
      where: { id: input.streamId, status: "LIVE" },
      include: { broadcaster: { select: { id: true, profile: { select: { displayName: true } } } } },
    });
    if (!stream) throw new AppError("stream_not_live", 404, "Stream is not live.");
    let isBroadcaster = Boolean(input.isBroadcaster);
    if (isBroadcaster && stream.broadcasterId !== userId) {
      throw new AppError("not_broadcaster", 403, "Only the broadcaster can publish.");
    }
    if (input.isBroadcaster === undefined && stream.broadcasterId === userId) {
      isBroadcaster = true;
    }
    if (!isBroadcaster) {
      const blocks = await prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: stream.broadcasterId },
            { blockerId: stream.broadcasterId, blockedId: userId },
          ],
        },
      });
      if (blocks) throw new AppError("stream_unavailable", 403, "Stream not available.");
    }
    const displayName = stream.broadcaster.profile?.displayName ?? "SIMP member";
    const { token, url } = await issueLiveToken({
      userId,
      roomName: input.streamId,
      isBroadcaster,
      displayName,
    });
    res.json({ token, url, roomName: input.streamId, isBroadcaster });
  } catch (error) {
    next(error);
  }
});

liveRouter.post('/live/streams/:id/end', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await prisma.liveStream.updateMany({
      where: { id: req.params.id, broadcasterId: req.userId!, status: 'LIVE' },
      data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
    });
    if (!result.count) throw new AppError('stream_not_found', 404, 'Live stream not found.');
    const streamId = req.params.id!;
    const egress = await prisma.liveStream.findUnique({ where: { id: streamId }, select: { recordingEgressId: true } });
    getRealtimeServer()?.to(`stream:${streamId}`).emit('live:ended', { streamId });
    res.json({ ok: true });
    setImmediate(() => {
      void trackAnalytics({
        event: 'live_ended',
        userId: req.userId!,
        source: 'server',
        properties: { streamId },
      });
      // Recording stop is async — we don't gate the response on it.
      void stopRecording(streamId, egress?.recordingEgressId).catch(() => undefined);
      void deleteRoom(streamId).catch(() => undefined);
    });
  } catch (error) {
    next(error);
  }
});

liveRouter.get('/live/streams/:id/chat', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const blockedIds = await blockedUserIds(req.userId!);
    const rows = await prisma.liveChatMessage.findMany({
      where: { streamId: req.params.id!, deletedAt: null, senderId: { notIn: blockedIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { sender: { select: { profile: { select: { displayName: true } } } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      messages: [...page].reverse().map((message) => ({
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        senderName: message.sender.profile?.displayName ?? 'SIMP member',
        createdAt: message.createdAt,
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

liveRouter.post('/live/streams/:id/heart', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const streamId = req.params.id!;
    const recent = await prisma.liveReaction.count({
      where: { streamId, userId: req.userId!, createdAt: { gte: new Date(Date.now() - 10_000) } },
    });
    if (recent >= 20) throw new AppError('reaction_rate_limited', 429, 'Slow down for a moment.');
    const result = await prisma.$transaction(async (tx) => {
      const stream = await tx.liveStream.findFirst({ where: { id: streamId, status: 'LIVE' } });
      if (!stream) throw new AppError('stream_not_found', 404, 'Stream not found.');
      await tx.liveReaction.create({ data: { streamId, userId: req.userId! } });
      return tx.liveStream.update({
        where: { id: streamId },
        data: { heartCount: { increment: 1 } },
        select: { heartCount: true },
      });
    });
    getRealtimeServer()?.to(`stream:${streamId}`).emit('live:heart', {
      from: req.userId,
      heartCount: result.heartCount,
    });
    res.json({ streamId, heartCount: result.heartCount });
    setImmediate(() => {
      void trackAnalytics({
        event: 'live_reacted',
        userId: req.userId!,
        source: 'server',
        properties: { streamId, type: 'heart' },
      });
    });
  } catch (error) {
    next(error);
  }
});

liveRouter.post('/live/streams/:id/report', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        category: z.enum(reportCategoryValues).optional(),
        reason: z.string().trim().max(120).optional(),
        details: z.string().trim().max(1_000).optional().nullable(),
      })
      .parse(req.body);
    const streamId = req.params.id!;
    const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
    if (!stream) throw new AppError('stream_not_found', 404, 'Stream not found.');
    if (stream.broadcasterId === req.userId) {
      throw new AppError('cannot_report_self', 400, 'You cannot report your own stream.');
    }
    const category = input.category ?? 'OTHER';
    const contextKey = `stream:${streamId}`;
    const existing = await prisma.report.findUnique({
      where: { reporterId_contextKey: { reporterId: req.userId!, contextKey } },
    });
    if (existing) return res.json({ ok: true, alreadyReported: true });

    await prisma.report.create({
      data: {
        reporterId: req.userId!,
        reportedId: stream.broadcasterId,
        streamId,
        category,
        reason: input.reason ?? REPORT_CATEGORIES.find((item) => item.value === category)?.label ?? 'Other',
        details: input.details || null,
        contextKey,
      },
    });
    const count = await prisma.report.count({
      where: { streamId, status: { in: ['OPEN', 'REVIEWING'] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    });
    if (count >= 3) {
      await prisma.liveStream.updateMany({
        where: { id: streamId, status: 'LIVE' },
        data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
      });
      getRealtimeServer()?.to(`stream:${streamId}`).emit('live:ended', {
        streamId,
        reason: 'pending_moderation',
      });
    }
    res.status(201).json({ ok: true, alreadyReported: false });
  } catch (error) {
    next(error);
  }
});

liveRouter.post('/live/streams/:id/chat/:messageId/report', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({ category: z.enum(reportCategoryValues), details: z.string().trim().max(1_000).optional() })
      .parse(req.body);
    const message = await prisma.liveChatMessage.findFirst({
      where: { id: req.params.messageId, streamId: req.params.id },
    });
    if (!message) throw new AppError('message_not_found', 404, 'Comment not found.');
    if (message.senderId === req.userId) throw new AppError('cannot_report_self', 400, 'You cannot report yourself.');
    const contextKey = `live-comment:${message.id}`;
    const report = await prisma.report.upsert({
      where: { reporterId_contextKey: { reporterId: req.userId!, contextKey } },
      create: {
        reporterId: req.userId!,
        reportedId: message.senderId,
        streamId: message.streamId,
        category: input.category,
        reason: `Live comment: ${input.category}`,
        details: input.details,
        contextKey,
      },
      update: {},
    });
    res.status(201).json({ reportId: report.id });
  } catch (error) {
    next(error);
  }
});

liveRouter.post('/live/streams/:id/moderation', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        userId: z.string().min(1),
        action: z.enum(['MUTE', 'REMOVE']),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(req.body);
    const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
    if (!stream || stream.broadcasterId !== req.userId) {
      throw new AppError('not_broadcaster', 403, 'Only the broadcaster can moderate this stream.');
    }
    const moderation = await prisma.liveModeration.upsert({
      where: { streamId_userId: { streamId: stream.id, userId: input.userId } },
      create: {
        streamId: stream.id,
        userId: input.userId,
        moderatorId: req.userId!,
        mutedUntil: input.action === 'MUTE' ? new Date(Date.now() + 15 * 60 * 1_000) : null,
        removedAt: input.action === 'REMOVE' ? new Date() : null,
        reason: input.reason,
      },
      update: {
        moderatorId: req.userId!,
        mutedUntil: input.action === 'MUTE' ? new Date(Date.now() + 15 * 60 * 1_000) : null,
        removedAt: input.action === 'REMOVE' ? new Date() : null,
        reason: input.reason,
      },
    });
    getRealtimeServer()?.to(`user:${input.userId}`).emit('live:moderated', {
      streamId: stream.id,
      action: input.action,
      mutedUntil: moderation.mutedUntil,
    });
    res.json({ ok: true, moderation });
  } catch (error) {
    next(error);
  }
});
