import type { MessageType, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { getRealtimeServer } from '../sockets/realtime.js';
import { AppError } from '../utils/errors.js';
import { createNotification, dispatchNotification } from './notification.service.js';

export async function authorizeConversation(
  tx: Prisma.TransactionClient,
  conversationId: string,
  userId: string,
) {
  const conversation = await tx.conversation.findUnique({
    where: { id: conversationId },
    include: {
      match: {
        include: {
          userA: { select: { id: true, status: true, profile: { select: { displayName: true } } } },
          userB: { select: { id: true, status: true, profile: { select: { displayName: true } } } },
        },
      },
    },
  });
  if (!conversation) throw new AppError('conversation_not_found', 404, 'Conversation not found.');
  const match = conversation.match;
  if (match.userAId !== userId && match.userBId !== userId) {
    throw new AppError('not_your_conversation', 403, 'You cannot access this conversation.');
  }
  if (!match.isActive) throw new AppError('match_inactive', 409, 'This match is no longer active.');
  const other = match.userAId === userId ? match.userB : match.userA;
  if (other.status !== 'ACTIVE') {
    throw new AppError('recipient_unavailable', 409, 'This person is no longer available.');
  }
  const blocked = await tx.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: other.id },
        { blockerId: other.id, blockedId: userId },
      ],
    },
  });
  if (blocked) throw new AppError('messaging_blocked', 403, 'Messaging is unavailable.');
  return { conversation, other };
}

export type SendMessageInput = {
  conversationId: string;
  senderId: string;
  body: string;
  clientId?: string;
  messageType?: MessageType;
};

export async function sendMessage(input: SendMessageInput) {
  const result = await prisma.$transaction(async (tx) => {
    const { conversation, other } = await authorizeConversation(
      tx,
      input.conversationId,
      input.senderId,
    );
    if (input.clientId) {
      const existing = await tx.message.findUnique({
        where: {
          conversationId_clientId: {
            conversationId: input.conversationId,
            clientId: input.clientId,
          },
        },
      });
      if (existing) {
        if (existing.senderId !== input.senderId) {
          throw new AppError('message_id_conflict', 409, 'Message identifier conflict.');
        }
        return { message: existing, recipientId: other.id, notificationId: null, created: false };
      }
    }

    const message = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        clientId: input.clientId,
        body: input.body,
        messageType: input.messageType ?? 'TEXT',
      },
    });
    await Promise.all([
      tx.match.update({
        where: { id: conversation.matchId },
        data: { lastMessageAt: message.createdAt },
      }),
      tx.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: message.createdAt },
      }),
    ]);
    const sender =
      conversation.match.userAId === input.senderId
        ? conversation.match.userA
        : conversation.match.userB;
    const notification = await createNotification(tx, {
      userId: other.id,
      actorId: input.senderId,
      type: 'MESSAGE',
      entityId: input.conversationId,
      title: sender.profile?.displayName ?? 'New message',
      body: 'Sent you a message.',
      data: { route: `/messages/${input.conversationId}` },
    });
    return {
      message,
      recipientId: other.id,
      notificationId: notification.id,
      created: true,
    };
  });

  if (!result.created) return result.message;
  const io = getRealtimeServer();
  const recipientConnected = Boolean(io?.sockets.adapter.rooms.get(`user:${result.recipientId}`)?.size);
  let message = result.message;
  if (recipientConnected) {
    message = await prisma.message.update({
      where: { id: message.id },
      data: { deliveredAt: new Date() },
    });
  }
  io?.to(`conversation:${input.conversationId}`).emit('message:new', message);
  io?.to(`user:${result.recipientId}`).emit('inbox:update', {
    conversationId: input.conversationId,
    message,
  });
  if (result.notificationId) await dispatchNotification(result.notificationId);
  return message;
}

export async function markMessagesDelivered(
  conversationId: string,
  userId: string,
  throughMessageId?: string,
) {
  return prisma.$transaction(async (tx) => {
    await authorizeConversation(tx, conversationId, userId);
    const through = throughMessageId
      ? await tx.message.findFirst({ where: { id: throughMessageId, conversationId } })
      : null;
    if (throughMessageId && !through) {
      throw new AppError('message_not_found', 404, 'Message not found.');
    }
    const at = new Date();
    await tx.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        deliveredAt: null,
        deletedAt: null,
        ...(through ? { createdAt: { lte: through.createdAt } } : {}),
      },
      data: { deliveredAt: at },
    });
    return { at };
  });
}

export async function markMessagesRead(
  conversationId: string,
  userId: string,
  throughMessageId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const { other } = await authorizeConversation(tx, conversationId, userId);
    const through = throughMessageId
      ? await tx.message.findFirst({ where: { id: throughMessageId, conversationId } })
      : null;
    if (throughMessageId && !through) {
      throw new AppError('message_not_found', 404, 'Message not found.');
    }
    const at = new Date();
    await tx.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
        deletedAt: null,
        ...(through ? { createdAt: { lte: through.createdAt } } : {}),
      },
      data: { deliveredAt: at, readAt: at },
    });
    return { at, otherUserId: other.id };
  });
}
