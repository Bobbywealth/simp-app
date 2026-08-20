import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { getRealtimeServer } from '../sockets/realtime.js';
import { logger } from '../utils/logger.js';
import { sendPushToUser } from './push.service.js';

type NotificationInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  entityId?: string | null;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
};

export async function createNotification(
  client: Prisma.TransactionClient,
  input: NotificationInput,
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId,
      type: input.type,
      entityId: input.entityId,
      title: input.title,
      body: input.body,
      data: input.data,
    },
  });
}

export async function dispatchNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: { include: { notificationPreference: true } } },
  });
  if (!notification) return;

  getRealtimeServer()?.to(`user:${notification.userId}`).emit('notification:new', {
    id: notification.id,
    type: notification.type,
    entityId: notification.entityId,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    createdAt: notification.createdAt,
  });

  const preferences = notification.user.notificationPreference;
  const allowed =
    notification.type === 'MATCH'
      ? preferences?.matches !== false
      : notification.type === 'MESSAGE'
        ? preferences?.messages !== false
        : notification.type === 'LIKE'
          ? preferences?.likes !== false
          : notification.type === 'LIVE'
            ? preferences?.live !== false
            : notification.type === 'SECURITY'
              ? preferences?.security !== false
              : true;
  if (!allowed) return;

  const stringData: Record<string, string> = {
    type: notification.type,
    ...(notification.entityId ? { entityId: notification.entityId } : {}),
  };
  if (notification.data && typeof notification.data === 'object' && !Array.isArray(notification.data)) {
    for (const [key, value] of Object.entries(notification.data)) {
      if (typeof value === 'string') stringData[key] = value;
    }
  }

  try {
    await sendPushToUser(notification.userId, {
      title: notification.title,
      body: notification.body,
      data: stringData,
    });
  } catch (error) {
    logger.warn({
      event: 'notification_dispatch_failed',
      notificationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notify(input: NotificationInput) {
  const notification = await prisma.notification.create({ data: input });
  await dispatchNotification(notification.id);
  return notification;
}
