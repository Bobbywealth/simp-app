import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

export const notificationsRouter = Router();

const tokenSchema = z.object({
  token: z.string().min(20).max(4_096),
  deviceId: z.string().max(200).optional(),
  deviceName: z.string().max(120).optional(),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']),
});
const preferencesSchema = z.object({
  matches: z.boolean().optional(),
  messages: z.boolean().optional(),
  likes: z.boolean().optional(),
  live: z.boolean().optional(),
  marketing: z.boolean().optional(),
});

notificationsRouter.get('/notifications', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '30'), 10) || 30));
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const rows = await prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    res.json({
      notifications: page,
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get('/notifications/unread-count', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json({
      count: await prisma.notification.count({ where: { userId: req.userId!, readAt: null } }),
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/read-all', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.userId!, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new AppError('notification_not_found', 404, 'Notification not found.');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/users/me/push-tokens', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = tokenSchema.parse(req.body);
    const token = await prisma.pushToken.upsert({
      where: { token: input.token },
      create: { userId: req.userId!, ...input },
      update: {
        userId: req.userId!,
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        platform: input.platform,
        active: true,
        lastSeenAt: new Date(),
      },
    });
    res.status(201).json({ id: token.id, active: token.active });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.delete('/users/me/push-tokens/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const result = await prisma.pushToken.updateMany({
      where: { id: req.params.id, userId: req.userId! },
      data: { active: false },
    });
    if (!result.count) throw new AppError('push_token_not_found', 404, 'Device token not found.');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get('/users/me/notification-preferences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId! },
      update: {},
    });
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch('/users/me/notification-preferences', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = preferencesSchema.parse(req.body);
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...input },
      update: input,
    });
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});
