import type { ReportCategory } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { getRealtimeServer } from '../sockets/realtime.js';
import { AppError } from '../utils/errors.js';

export const moderationRouter = Router();

export const REPORT_CATEGORIES: Array<{ value: ReportCategory; label: string }> = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE_SPEECH', label: 'Hate speech' },
  { value: 'SCAM', label: 'Scam' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'FAKE_PROFILE', label: 'Fake profile' },
  { value: 'INAPPROPRIATE_SEXUAL_CONTENT', label: 'Inappropriate sexual content' },
  { value: 'UNDERAGE_USER', label: 'Underage user' },
  { value: 'THREAT_VIOLENCE', label: 'Threat or violence' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'OTHER', label: 'Other' },
];
const categoryValues = REPORT_CATEGORIES.map((item) => item.value) as [ReportCategory, ...ReportCategory[]];

const legacyCategory = (reason: string): ReportCategory => {
  const value = reason.toLowerCase();
  if (value.includes('harass')) return 'HARASSMENT';
  if (value.includes('hate')) return 'HATE_SPEECH';
  if (value.includes('scam')) return 'SCAM';
  if (value.includes('spam')) return 'SPAM';
  if (value.includes('fake')) return 'FAKE_PROFILE';
  if (value.includes('underage')) return 'UNDERAGE_USER';
  if (value.includes('inappropriate')) return 'INAPPROPRIATE_SEXUAL_CONTENT';
  if (value.includes('threat') || value.includes('violence')) return 'THREAT_VIOLENCE';
  return 'OTHER';
};

moderationRouter.post('/blocks', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { blockedId } = z.object({ blockedId: z.string().min(1) }).parse(req.body);
    const userId = req.userId!;
    if (blockedId === userId) throw new AppError('cannot_block_self', 400, 'You cannot block yourself.');
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new AppError('user_not_found', 404, 'User not found.');

    await prisma.$transaction(async (tx) => {
      await tx.block.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId } },
        create: { blockerId: userId, blockedId },
        update: {},
      });
      await tx.match.updateMany({
        where: {
          isActive: true,
          OR: [
            { userAId: userId, userBId: blockedId },
            { userAId: blockedId, userBId: userId },
          ],
        },
        data: { isActive: false, deactivatedAt: new Date(), deactivatedById: userId },
      });
    });

    getRealtimeServer()?.to(`user:${blockedId}`).emit('safety:block', { byUserId: userId });
    getRealtimeServer()?.to(`user:${userId}`).emit('safety:block', { userId: blockedId });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

moderationRouter.delete('/blocks/:blockedId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.block.deleteMany({
      where: { blockerId: req.userId!, blockedId: req.params.blockedId! },
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

moderationRouter.get('/blocks', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.userId! },
      include: {
        blocked: {
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
      blocks: blocks.map((block) => ({
        blockedId: block.blockedId,
        displayName: block.blocked.profile?.displayName ?? 'SIMP member',
        photoUrl: block.blocked.photos[0]?.url ?? null,
        createdAt: block.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

moderationRouter.get('/reports/reasons', (_req, res) => {
  res.json({ categories: REPORT_CATEGORIES });
});

moderationRouter.post('/reports', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = z
      .object({
        reportedId: z.string().min(1),
        category: z.enum(categoryValues).optional(),
        reason: z.string().trim().min(1).max(120).optional(),
        details: z.string().trim().max(1_000).optional().nullable(),
      })
      .refine((value) => value.category || value.reason, 'Choose a report category')
      .parse(req.body);
    if (input.reportedId === req.userId) {
      throw new AppError('cannot_report_self', 400, 'You cannot report yourself.');
    }
    const target = await prisma.user.findUnique({ where: { id: input.reportedId }, select: { id: true } });
    if (!target) throw new AppError('user_not_found', 404, 'User not found.');
    const category = input.category ?? legacyCategory(input.reason!);
    const label = REPORT_CATEGORIES.find((item) => item.value === category)?.label ?? 'Other';
    const contextKey = `user:${input.reportedId}:${category}`;
    const existing = await prisma.report.findUnique({
      where: { reporterId_contextKey: { reporterId: req.userId!, contextKey } },
    });
    if (existing) return res.json({ reportId: existing.id, alreadyReported: true });

    const report = await prisma.report.create({
      data: {
        reporterId: req.userId!,
        reportedId: input.reportedId,
        category,
        reason: input.reason ?? label,
        details: input.details || null,
        contextKey,
      },
    });
    res.status(201).json({ reportId: report.id, alreadyReported: false });
  } catch (error) {
    next(error);
  }
});
