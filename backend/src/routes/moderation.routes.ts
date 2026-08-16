import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const moderationRouter = Router();

const blockSchema = z.object({
  blockedId: z.string().min(1),
});

const reportSchema = z.object({
  reportedId: z.string().min(1),
  reason: z.string().min(1).max(80),
  details: z.string().max(500).optional().nullable(),
});

const REPORT_REASONS = [
  'Fake photos or profile',
  'Inappropriate content',
  'Harassment or hate speech',
  'Spam or scam',
  'Underage',
  'Other',
] as const;

/**
 * POST /blocks — block a user
 *
 * Blocked users are excluded from /discovery and /matches
 * (filters applied server-side). Idempotent.
 */
moderationRouter.post('/blocks', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { blockedId } = blockSchema.parse(req.body);

    if (blockedId === userId) {
      return res.status(400).json({ error: 'cannot_block_self' });
    }

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId } },
      update: {},
      create: { blockerId: userId, blockedId },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /blocks/:blockedId — unblock a user
 */
moderationRouter.delete('/blocks/:blockedId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const blockedId = req.params.blockedId!;

    await prisma.block
      .delete({
        where: { blockerId_blockedId: { blockerId: userId, blockedId } },
      })
      .catch(() => null);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /blocks — list users the current user has blocked
 */
moderationRouter.get('/blocks', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const blocks = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: { select: { id: true, profile: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      blocks: blocks.map((b) => ({
        blockedId: b.blockedId,
        displayName: b.blocked.profile?.displayName ?? 'Unknown',
        createdAt: b.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /reports/reasons — allowed reason strings (for clients)
 */
moderationRouter.get('/reports/reasons', (_req, res) => {
  res.json({ reasons: REPORT_REASONS });
});

/**
 * POST /reports — report a user
 */
moderationRouter.post('/reports', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const data = reportSchema.parse(req.body);

    if (data.reportedId === userId) {
      return res.status(400).json({ error: 'cannot_report_self' });
    }

    if (!REPORT_REASONS.includes(data.reason as (typeof REPORT_REASONS)[number])) {
      return res.status(400).json({ error: 'invalid_reason' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reportedId: data.reportedId,
        reason: data.reason,
        details: data.details ?? null,
      },
    });

    res.status(201).json({ reportId: report.id });
  } catch (e) {
    next(e);
  }
});
