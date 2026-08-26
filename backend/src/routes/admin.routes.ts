import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js';
import { deleteStoredPhoto } from '../services/photo.service.js';
import { getFunnelCounts } from '../services/analytics.service.js';
import { listRecordings as listLiveRecordings } from '../services/livekit.service.js';
import { AppError } from '../utils/errors.js';
import { getRealtimeServer } from '../sockets/realtime.js';

export const adminRouter = Router();

adminRouter.use('/admin', requireAuth, requireRole('MODERATOR', 'ADMIN', 'SUPER_ADMIN'));

const fingerprint = (value: string) =>
  crypto
    .createHmac('sha256', env.IP_HASH_SECRET ?? env.JWT_ACCESS_SECRET)
    .update(value)
    .digest('hex');

adminRouter.get('/admin/stats', async (_req: AuthedRequest, res, next) => {
  try {
    const [users, matches, messages, streams, openReports, pendingVerification] = await Promise.all([
      prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      prisma.match.count({ where: { isActive: true } }),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.liveStream.count({ where: { status: 'LIVE' } }),
      prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      prisma.profileVerificationRequest.count({ where: { status: 'PENDING' } }),
    ]);
    res.json({ users, activeMatches: matches, messages, liveStreams: streams, openReports, pendingVerification });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/users', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        query: z.string().trim().max(120).optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']).optional(),
      })
      .parse(req.query);
    const rows = await prisma.user.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.query
          ? {
              OR: [
                { email: { contains: input.query, mode: 'insensitive' } },
                { profile: { displayName: { contains: input.query, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
        status: true,
        statusReason: true,
        suspendedUntil: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            isVerified: true,
            verificationStatus: true,
          },
        },
        _count: { select: { photos: true, reportsReceived: true, moderationActionsReceived: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const users = hasMore ? rows.slice(0, input.limit) : rows;
    res.json({ users, nextCursor: hasMore ? users.at(-1)?.id ?? null : null, hasMore });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/users/:id/status', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    if (req.params.id === req.userId) {
      throw new AppError('cannot_moderate_self', 400, 'You cannot change your own account status.');
    }
    const input = z
      .object({
        status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
        reason: z.string().trim().min(3).max(500),
        suspendedUntil: z.string().datetime().optional().nullable(),
      })
      .parse(req.body);
    if (input.status === 'SUSPENDED' && !input.suspendedUntil) {
      throw new AppError('suspension_end_required', 400, 'Choose when the suspension ends.');
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new AppError('user_not_found', 404, 'User not found.');
    if (target.role === 'SUPER_ADMIN' && req.userRole !== 'SUPER_ADMIN') {
      throw new AppError('insufficient_role', 403, 'Only a Super Admin can moderate this account.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          status: input.status,
          statusReason: input.status === 'ACTIVE' ? null : input.reason,
          suspendedUntil:
            input.status === 'SUSPENDED' ? new Date(input.suspendedUntil!) : null,
          bannedAt: input.status === 'BANNED' ? new Date() : null,
        },
      });
      if (input.status !== 'ACTIVE') {
        await Promise.all([
          tx.refreshToken.updateMany({
            where: { userId: target.id, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
          tx.match.updateMany({
            where: {
              isActive: true,
              OR: [{ userAId: target.id }, { userBId: target.id }],
            },
            data: { isActive: false, deactivatedAt: new Date(), deactivatedById: req.userId! },
          }),
          tx.liveStream.updateMany({
            where: { broadcasterId: target.id, status: 'LIVE' },
            data: { status: 'ENDED', endedAt: new Date() },
          }),
        ]);
      }
      await tx.moderationAction.create({
        data: {
          moderatorId: req.userId!,
          targetUserId: target.id,
          targetFingerprint: fingerprint(target.id),
          action: input.status === 'ACTIVE' ? 'RESTORE' : input.status === 'BANNED' ? 'BAN' : 'SUSPEND',
          reason: input.reason,
          metadata: input.suspendedUntil ? { suspendedUntil: input.suspendedUntil } : undefined,
        },
      });
    });
    getRealtimeServer()?.to(`user:${target.id}`).emit('account:status', { status: input.status });
    res.json({ ok: true, status: input.status });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/users/:id/role', requireRole('SUPER_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const { role, reason } = z
      .object({
        role: z.enum(['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(req.body);
    const target = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    await prisma.moderationAction.create({
      data: {
        moderatorId: req.userId!,
        targetUserId: target.id,
        targetFingerprint: fingerprint(target.id),
        action: 'WARN',
        reason,
        metadata: { role },
      },
    });
    res.json({ ok: true, role });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/reports', async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        status: z.enum(['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED']).optional(),
      })
      .parse(req.query);
    const rows = await prisma.report.findMany({
      where: input.status ? { status: input.status } : {},
      include: {
        reporter: { select: { id: true, profile: { select: { displayName: true } } } },
        reported: { select: { id: true, profile: { select: { displayName: true } } } },
        moderator: { select: { id: true, profile: { select: { displayName: true } } } },
        stream: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const reports = hasMore ? rows.slice(0, input.limit) : rows;
    res.json({ reports, nextCursor: hasMore ? reports.at(-1)?.id ?? null : null, hasMore });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/reports/:id', async (req: AuthedRequest, res, next) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { reporter: { include: { profile: true } }, reported: { include: { profile: true } }, stream: true },
    });
    if (!report) throw new AppError('report_not_found', 404, 'Report not found.');
    res.json(report);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/reports/:id', async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        status: z.enum(['REVIEWING', 'ACTIONED', 'DISMISSED']),
        moderatorNotes: z.string().trim().min(1).max(2_000),
      })
      .parse(req.body);
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: {
        status: input.status,
        moderatorId: req.userId!,
        moderatorNotes: input.moderatorNotes,
        reviewedAt: new Date(),
        actionedAt: input.status === 'ACTIONED' ? new Date() : null,
      },
    });
    res.json(report);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/live/recordings?streamId=...
 *
 * Lists LiveKit egress recordings for one stream, newest first. Used by
 * the moderator review page when a user reports a stream — the moderator
 * can scrub through the captured MP4 / HLS playlist without leaving
 * SIMP. Returns the LiveKit `location` URL when present, which is the
 * signed S3 (or LiveKit Cloud storage) playback URL.
 */
adminRouter.get('/admin/live/recordings', async (req: AuthedRequest, res, next) => {
  try {
    const { streamId } = z.object({ streamId: z.string().min(1).max(80) }).parse(req.query);
    const rows = await listLiveRecordings(streamId);
    res.json({
      recordings: rows.map((r) => ({
        egressId: r.egressId,
        status: r.status,
        url: r.location ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/admin/photos/:id', async (req: AuthedRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new AppError('photo_not_found', 404, 'Photo not found.');
    await prisma.$transaction([
      prisma.photo.delete({ where: { id: photo.id } }),
      prisma.moderationAction.create({
        data: {
          moderatorId: req.userId!,
          targetUserId: photo.userId,
          targetFingerprint: fingerprint(photo.userId),
          action: 'REMOVE_PHOTO',
          reason,
          metadata: { photoId: photo.id },
        },
      }),
    ]);
    await deleteStoredPhoto(photo);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/admin/live/:id/end', async (req: AuthedRequest, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
    if (!stream) throw new AppError('stream_not_found', 404, 'Stream not found.');
    await prisma.$transaction([
      prisma.liveStream.update({ where: { id: stream.id }, data: { status: 'ENDED', endedAt: new Date() } }),
      prisma.moderationAction.create({
        data: {
          moderatorId: req.userId!,
          targetUserId: stream.broadcasterId,
          targetFingerprint: fingerprint(stream.broadcasterId),
          action: 'END_STREAM',
          reason,
          metadata: { streamId: stream.id },
        },
      }),
    ]);
    getRealtimeServer()?.to(`stream:${stream.id}`).emit('live:ended', { streamId: stream.id, reason: 'moderation' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/verifications', async (req: AuthedRequest, res, next) => {
  try {
    const status = z.enum(['PENDING', 'APPROVED', 'REJECTED']).catch('PENDING').parse(req.query.status);
    const requests = await prisma.profileVerificationRequest.findMany({
      where: { status },
      include: { user: { include: { profile: true, photos: { orderBy: { position: 'asc' } } } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/admin/verifications/:id', async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        status: z.enum(['APPROVED', 'REJECTED']),
        reviewNote: z.string().trim().min(3).max(1_000),
      })
      .parse(req.body);
    const request = await prisma.profileVerificationRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== 'PENDING') {
      throw new AppError('verification_request_not_found', 404, 'Pending verification request not found.');
    }
    await prisma.$transaction([
      prisma.profileVerificationRequest.update({
        where: { id: request.id },
        data: { status: input.status, reviewNote: input.reviewNote, reviewerId: req.userId!, reviewedAt: new Date() },
      }),
      prisma.profile.update({
        where: { userId: request.userId },
        data: { verificationStatus: input.status, isVerified: input.status === 'APPROVED' },
      }),
      prisma.moderationAction.create({
        data: {
          moderatorId: req.userId!,
          targetUserId: request.userId,
          targetFingerprint: fingerprint(request.userId),
          action: input.status === 'APPROVED' ? 'APPROVE_VERIFICATION' : 'REJECT_VERIFICATION',
          reason: input.reviewNote,
          metadata: { verificationRequestId: request.id },
        },
      }),
    ]);
    res.json({ ok: true, status: input.status });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/admin/users/:id/moderation-history', async (req: AuthedRequest, res, next) => {
  try {
    const actions = await prisma.moderationAction.findMany({
      where: { targetUserId: req.params.id },
      include: { moderator: { select: { id: true, profile: { select: { displayName: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ actions });
  } catch (error) {
    next(error);
  }
});

/**
 * Funnel analytics for the admin dashboard.
 *
 * Returns counts of each funnel event over a date range plus computed
 * conversion rates between adjacent stages. Useful for at-a-glance
 * health checks ("signup → first match conversion is 12%") without
 * requiring a 3rd-party analytics provider.
 *
 * Example: GET /admin/analytics/funnel?days=7
 */
adminRouter.get('/admin/analytics/funnel', async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        days: z.coerce.number().int().min(1).max(180).default(7),
        source: z.enum(['client', 'server']).optional(),
      })
      .parse(req.query);
    const end = new Date();
    const start = new Date(end.getTime() - input.days * 24 * 60 * 60 * 1000);

    const counts = await getFunnelCounts({
      start,
      end,
      ...(input.source ? { source: input.source } : {}),
    });

    // Conversion rates between funnel stages. null = denominator is zero.
    const safeRate = (numerator: number, denominator: number): number | null =>
      denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10;

    res.json({
      windowDays: input.days,
      start,
      end,
      counts,
      conversions: {
        signupStartedToCompleted: safeRate(
          counts.signup_completed ?? 0,
          counts.signup_started ?? 0,
        ),
        signupCompletedToOnboarded: safeRate(
          counts.onboarding_completed ?? 0,
          counts.signup_completed ?? 0,
        ),
        onboardedToFirstSwipe: safeRate(
          counts.first_swipe ?? 0,
          counts.onboarding_completed ?? 0,
        ),
        firstSwipeToFirstMatch: safeRate(
          counts.first_match ?? 0,
          counts.first_swipe ?? 0,
        ),
        firstMatchToFirstMessage: safeRate(
          counts.first_message ?? 0,
          counts.first_match ?? 0,
        ),
        firstMessageToPurchase: safeRate(
          counts.purchase_completed ?? 0,
          counts.first_message ?? 0,
        ),
        purchaseStartedToCompleted: safeRate(
          counts.purchase_completed ?? 0,
          counts.purchase_started ?? 0,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cross-user moderation audit log. Returns the last N moderator
 * actions across all targets, with moderator name + target name joined.
 * Used for accountability (who banned who, when) and for compliance
 * audits (every action that affects a user's account status is
 * logged here + a row in ModerationAction per-user).
 */
adminRouter.get('/admin/audit-log', async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
        moderatorId: z.string().optional(),
        actionType: z
          .enum([
            'WARN',
            'SUSPEND',
            'BAN',
            'RESTORE',
            'REMOVE_PHOTO',
            'END_STREAM',
            'APPROVE_VERIFICATION',
            'REJECT_VERIFICATION',
          ])
          .optional(),
      })
      .parse(req.query);
    const where = {
      ...(input.moderatorId ? { moderatorId: input.moderatorId } : {}),
      ...(input.actionType ? { action: input.actionType } : {}),
    };
    const rows = await prisma.moderationAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        moderator: { select: { id: true, profile: { select: { displayName: true } } } },
        target: { select: { id: true, profile: { select: { displayName: true } } } },
      },
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    res.json({
      actions: page.map((a) => ({
        id: a.id,
        actionType: a.action,
        reason: a.reason,
        metadata: a.metadata,
        moderator: a.moderator
          ? {
              id: a.moderator.id,
              displayName: a.moderator.profile?.displayName ?? 'Moderator',
            }
          : null,
        targetUser: a.target
          ? {
              id: a.target.id,
              displayName: a.target.profile?.displayName ?? 'User',
            }
          : null,
        targetFingerprint: a.targetFingerprint,
        createdAt: a.createdAt,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Abuse monitoring metrics. Returns rolling counts over the requested
 * window so mods can spot abuse spikes (sudden report volume from one
 * user, mass-block patterns, etc.) without running SQL by hand.
 *
 * Heavy operations are rate-limited via the router-level rate limits
 * applied in app.ts.
 */
adminRouter.get('/admin/abuse-metrics', async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        hours: z.coerce.number().int().min(1).max(168).default(24),
      })
      .parse(req.query);
    const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);

    const [openReports, recentReports, recentBlocks, recentPhotoDeletions] = await Promise.all([
      prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
      prisma.report.count({ where: { createdAt: { gte: since } } }),
      prisma.block.count({ where: { createdAt: { gte: since } } }),
      // Photo deletions are hard-delete in the current schema
      // (no soft-delete column on Photo). We count admin photo-removal
      // events from ModerationAction.metadata.removedAt instead, so
      // the metric reflects moderator-initiated deletions, not user self-removals.
      prisma.moderationAction.count({
        where: {
          action: 'REMOVE_PHOTO',
          createdAt: { gte: since },
        },
      }),
    ]);

    // Top reporters — find users who have filed the most reports in
    // the window. Useful for catching coordinated bad-faith report
    // campaigns against a target. reporterId is nullable (anonymous
    // reports allowed) so we filter out nulls explicitly.
    const topReportersRaw = await prisma.report.groupBy({
      by: ['reporterId'],
      where: { createdAt: { gte: since }, reporterId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { reporterId: 'desc' } },
      take: 10,
    });
    // Prisma's groupBy output type infers reporterId as the scalar
    // type but with null filter we know it's non-null at runtime.
    const topReporters = topReportersRaw.map((r) => ({
      reporterId: r.reporterId as string,
      _count: { _all: r._count._all },
    }));

    // Top reported targets — users receiving the most reports.
    // reportedId is also nullable (could be a stream report or anonymous),
    // use explicit non-null filter.
    const topTargetsRaw = await prisma.report.groupBy({
      by: ['reportedId'],
      where: { createdAt: { gte: since }, reportedId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { reportedId: 'desc' } },
      take: 10,
    });
    const topTargets = topTargetsRaw.map((t) => ({
      reportedId: t.reportedId as string,
      _count: { _all: t._count._all },
    }));

    // Hydrate display names in a single query rather than N queries
    const userIds = Array.from(
      new Set([
        ...topReporters.map((r) => r.reporterId),
        ...topTargets.map((t) => t.reportedId),
      ]),
    );
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, profile: { select: { displayName: true } } },
    });
    const userMap = new Map(users.map((u) => [u.id, u.profile?.displayName ?? 'User']));

    res.json({
      windowHours: input.hours,
      since,
      totals: {
        openReports,
        recentReports,
        recentBlocks,
        recentPhotoDeletions,
      },
      topReporters: topReporters.map((r) => ({
        userId: r.reporterId,
        displayName: userMap.get(r.reporterId) ?? 'User',
        reportCount: r._count._all,
      })),
      topReportedTargets: topTargets.map((t) => ({
        userId: t.reportedId,
        displayName: userMap.get(t.reportedId) ?? 'User',
        reportCount: t._count._all,
      })),
    });
  } catch (error) {
    next(error);
  }
});
