import type { NotificationType, Prisma } from '@prisma/client';
import { Prisma as PrismaValue } from '@prisma/client';
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

/**
 * Audience tokens used by `broadcastToUsers`. Each maps to a Prisma
 * `where` clause that selects the set of users a broadcast should hit.
 *
 * - `all`         : every active (non-deleted) user
 * - `verified`    : active users whose profile is verified
 * - `pushable`    : active users with at least one active push token
 * - `role:USER` / `role:MODERATOR` / `role:ADMIN` / `role:SUPER_ADMIN` : filter by role
 */
export type BroadcastAudience =
  | 'all'
  | 'verified'
  | 'pushable'
  | 'role:USER'
  | 'role:MODERATOR'
  | 'role:ADMIN'
  | 'role:SUPER_ADMIN';

export const BROADCAST_AUDIENCES: readonly BroadcastAudience[] = [
  'all',
  'verified',
  'pushable',
  'role:USER',
  'role:MODERATOR',
  'role:ADMIN',
  'role:SUPER_ADMIN',
] as const;

function audienceWhere(audience: BroadcastAudience): Prisma.UserWhereInput {
  switch (audience) {
    case 'all':
      return { status: 'ACTIVE' };
    case 'verified':
      return { status: 'ACTIVE', profile: { isVerified: true } };
    case 'pushable':
      return { status: 'ACTIVE', pushTokens: { some: { active: true } } };
    case 'role:USER':
      return { status: 'ACTIVE', role: 'USER' };
    case 'role:MODERATOR':
      return { status: 'ACTIVE', role: 'MODERATOR' };
    case 'role:ADMIN':
      return { status: 'ACTIVE', role: 'ADMIN' };
    case 'role:SUPER_ADMIN':
      return { status: 'ACTIVE', role: 'SUPER_ADMIN' };
  }
}

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

export type BroadcastInput = {
  actorId: string | null;
  audience: BroadcastAudience;
  title: string;
  body: string;
  route?: string;
  data?: Prisma.InputJsonValue;
};

export type BroadcastResult = {
  broadcastId: string;
  targeted: number;
  dispatched: number;
  failed: number;
};

/**
 * Send a custom notification to every user in the given audience.
 *
 * Implementation notes:
 * - One `Broadcast` row is created up front so the admin UI can show
 *   the broadcast in history with its counts and audience.
 * - The targeted user IDs are resolved via `audienceWhere()` against
 *   the `User` table. We only need IDs — no row payload.
 * - Each recipient gets a `Notification` row with `type = 'SYSTEM'`
 *   so it shows up in their regular in-app notifications and can be
 *   marked read / deleted normally.
 * - `dispatchNotification()` is invoked once per recipient — that
 *   single call emits Socket.IO + push and respects NotificationPreference.
 * - If `route` is provided it is stored on the broadcast and forwarded
 *   to each notification's `data.route` so the iOS / Android tap-handler
 *   in `requestNativePushPermission` can deep-link the user.
 * - The dispatch loop is sequential and bounded by `targeted` —
 *   for very large audiences this can take a few seconds, which is
 *   acceptable for an admin-only endpoint (no per-request timeout
 *   budget to worry about). Failures are logged + counted but never
 *   throw — partial success is preferred over 500s for an admin tool.
 */
export async function broadcastToUsers(input: BroadcastInput): Promise<BroadcastResult> {
  const broadcast = await prisma.broadcast.create({
    data: {
      actorId: input.actorId,
      audience: input.audience,
      title: input.title,
      body: input.body,
      route: input.route ?? null,
      data: input.data ?? PrismaValue.JsonNull,
    },
  });

  const targets = await prisma.user.findMany({
    where: audienceWhere(input.audience),
    select: { id: true },
  });

  let dispatched = 0;
  let failed = 0;
  const baseData: Record<string, string> = { broadcastId: broadcast.id, type: 'SYSTEM' };
  if (input.route) baseData.route = input.route;
  if (input.data && typeof input.data === 'object' && !Array.isArray(input.data)) {
    for (const [k, v] of Object.entries(input.data)) {
      if (typeof v === 'string') baseData[k] = v;
    }
  }

  for (const target of targets) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: target.id,
          actorId: input.actorId,
          type: 'SYSTEM',
          title: input.title,
          body: input.body,
          data: { ...baseData, ...(input.route ? { route: input.route } : {}) },
        },
      });
      await dispatchNotification(notification.id);
      dispatched += 1;
    } catch (error) {
      failed += 1;
      logger.warn({
        event: 'broadcast_dispatch_failed',
        broadcastId: broadcast.id,
        userId: target.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { targeted: targets.length, dispatched, failed },
  });

  logger.info({
    event: 'broadcast_complete',
    broadcastId: broadcast.id,
    audience: input.audience,
    targeted: targets.length,
    dispatched,
    failed,
    actorId: input.actorId,
  });

  return { broadcastId: broadcast.id, targeted: targets.length, dispatched, failed };
}
