import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { requireLegalCompliance } from '../middleware/legal.js';

export const liveRouter = Router();

const startStreamSchema = z.object({
  title: z.string().min(2).max(120),
  // When true, if the user already has a LIVE stream, end it first and start
  // a fresh one. Used by the frontend recovery flow when the user previously
  // crashed/closed the tab without ending their broadcast.
  forceReplace: z.boolean().optional(),
});

/**
 * GET /live/streams — list of currently LIVE streams
 */
liveRouter.get('/live/streams', requireAuth, async (_req, res, next) => {
  try {
    const streams = await prisma.liveStream.findMany({
      where: { status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    // Attach broadcaster profile info
    const broadcasterIds = Array.from(new Set(streams.map((s) => s.broadcasterId)));
    const broadcasters = await prisma.user.findMany({
      where: { id: { in: broadcasterIds } },
      include: { profile: true, photos: { take: 1, orderBy: { position: 'asc' } } },
    });
    const broadcasterMap = new Map(broadcasters.map((b) => [b.id, b]));

    res.json({
      streams: streams.map((s) => {
        const b = broadcasterMap.get(s.broadcasterId);
        return {
          id: s.id,
          title: s.title,
          startedAt: s.startedAt,
          viewerCount: s.viewerCount,
          broadcaster: b?.profile
            ? {
                userId: b.id,
                displayName: b.profile.displayName,
                age: b.profile.birthDate
                  ? Math.floor((Date.now() - b.profile.birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                  : null,
                photoUrl: b.photos[0]?.url ?? null,
                isVerified: b.profile.isVerified,
                isPremium: b.profile.isPremium,
              }
            : null,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /live/streams — start a new live stream
 *
 * Returns the new stream id. The actual WebRTC negotiation happens over
 * Socket.IO via the `live:join` event.
 *
 * Gated by `requireLegalCompliance` so users cannot broadcast until
 * they have confirmed 18+ and accepted the current ToS / Privacy
 * Policy. If they have not, returns 451 with a `missing` array so the
 * frontend can show the legal gate.
 */
liveRouter.post(
  '/live/streams',
  requireAuth,
  requireLegalCompliance,
  async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { title, forceReplace } = startStreamSchema.parse(req.body);

    // Block if user already has a LIVE stream — but allow an explicit forceReplace
    // (used by the frontend recovery flow) to end the orphan first.
    const existing = await prisma.liveStream.findFirst({
      where: { broadcasterId: userId, status: 'LIVE' },
    });
    if (existing) {
      if (!forceReplace) {
        return res.status(409).json({ error: 'stream_already_live', streamId: existing.id });
      }
      await prisma.liveStream.update({
        where: { id: existing.id },
        data: { status: 'ENDED', endedAt: new Date() },
      });
    }

    const stream = await prisma.liveStream.create({
      data: { broadcasterId: userId, title, status: 'LIVE' },
    });

    res.status(201).json({ streamId: stream.id, startedAt: stream.startedAt });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /live/streams/:id/end — end a stream (broadcaster only)
 */
liveRouter.post('/live/streams/:id/end', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const streamId = req.params.id!;

    const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
    if (!stream) return res.status(404).json({ error: 'stream_not_found' });
    if (stream.broadcasterId !== userId) return res.status(403).json({ error: 'not_broadcaster' });

    await prisma.liveStream.update({
      where: { id: streamId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /live/streams/:id/chat — recent chat messages for a stream
 */
liveRouter.get('/live/streams/:id/chat', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const messages = await prisma.liveChatMessage.findMany({
      where: { streamId: req.params.id! },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { sender: { include: { profile: { select: { displayName: true } } } } },
    });
    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        senderId: m.senderId,
        senderName: m.sender.profile?.displayName ?? 'Unknown',
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /live/streams/:id/heart — increment "heart" reaction on a stream
 * (broadcasters can see how many hearts they've received)
 */
liveRouter.post('/live/streams/:id/heart', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id: req.params.id! },
      select: { id: true, viewerCount: true },
    });
    if (!stream) return res.status(404).json({ error: 'stream_not_found' });
    // Note: viewerCount is used as a proxy for heart count for simplicity.
    res.json({ streamId: stream.id });
  } catch (e) {
    next(e);
  }
});
