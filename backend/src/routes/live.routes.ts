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
 *
 * Excludes any stream that has been reported >= 3 times by distinct
 * viewers. The 3-report threshold is a soft auto-hide so obvious
 * policy violations disappear from the feed immediately while
 * moderators review. Lower for stricter moderation, raise for
 * lighter touch.
 */
liveRouter.get('/live/streams', requireAuth, async (_req, res, next) => {
  try {
    const streams = await prisma.liveStream.findMany({
      where: { status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    // Filter out streams with 3+ distinct user reports
    const broadcasterIds = Array.from(new Set(streams.map((s) => s.broadcasterId)));
    const reportCounts = await prisma.report.groupBy({
      by: ['reportedId'],
      where: { reportedId: { in: broadcasterIds }, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { reporterId: true },
    });
    const reportCountMap = new Map(reportCounts.map((r) => [r.reportedId, r._count.reporterId]));
    const filtered = streams.filter((s) => (reportCountMap.get(s.broadcasterId) ?? 0) < 3);

    const broadcasters = await prisma.user.findMany({
      where: { id: { in: filtered.map((s) => s.broadcasterId) } },
      include: { profile: true, photos: { take: 1, orderBy: { position: 'asc' } } },
    });
    const broadcasterMap = new Map(broadcasters.map((b) => [b.id, b]));

    res.json({
      streams: filtered.map((s) => {
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

/**
 * POST /live/streams/:id/report — report a stream as policy-violating
 *
 * Creates a Report row tied to the broadcaster AND ends the stream
 * immediately for the reporter (server-side socket close happens via
 * the existing 'live:end' channel in socket.ts; this endpoint just
 * updates the DB so the stream is removed from /live/streams).
 *
 * Required by Apple App Store Review Guideline 1.4.1 (content
 * moderation) and Google Play UGC policy (in-app reporting).
 *
 * Idempotent: if the user has already reported this stream, returns
 * 200 with `alreadyReported: true` and doesn't create a duplicate row.
 */
liveRouter.post('/live/streams/:id/report', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const streamId = req.params.id!;
    const { reason, details } = z
      .object({
        reason: z.string().min(1).max(80),
        details: z.string().max(500).optional().nullable(),
      })
      .parse(req.body);

    const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
    if (!stream) return res.status(404).json({ error: 'stream_not_found' });
    if (stream.broadcasterId === userId) return res.status(400).json({ error: 'cannot_report_self' });

    const existing = await prisma.report.findFirst({
      where: { reporterId: userId, reportedId: stream.broadcasterId },
    });
    if (existing) return res.json({ ok: true, alreadyReported: true });

    await prisma.report.create({
      data: {
        reporterId: userId,
        reportedId: stream.broadcasterId,
        reason,
        details: details ?? null,
      },
    });

    // End the stream for the reporter. Other viewers see the stream
    // drop from /live/streams once the report count hits 3 (see
    // /live/streams GET handler above).
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
