import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { prisma } from '../config/db.js';
import { allowedOrigins } from '../config/env.js';
import { authorizeConversation, markMessagesDelivered, markMessagesRead, sendMessage } from '../services/messaging.service.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { deleteRoom, stopRecording } from '../services/livekit.service.js';
import { setRealtimeServer } from './realtime.js';

const STREAM_MAX_DURATION_MS = 4 * 60 * 60 * 1_000;
const STREAM_SWEEP_INTERVAL_MS = 60 * 1_000;
const BROADCAST_RECONNECT_GRACE_MS = 30 * 1_000;

type SocketData = {
  userId: string;
  streamId?: string;
  authorizedConversations: Set<string>;
};
interface AuthedSocket extends Socket {
  data: SocketData;
}

const broadcasters = new Map<string, string>();
const viewers = new Map<string, Set<string>>();
const broadcasterEndTimers = new Map<string, ReturnType<typeof setTimeout>>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const onlineCounts = new Map<string, number>();
const connectionAttempts = new Map<string, { count: number; resetAt: number }>();
const eventWindows = new Map<string, { count: number; resetAt: number }>();
let io: Server | null = null;

function allowedEvent(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const current = eventWindows.get(key);
  if (!current || current.resetAt <= now) {
    eventWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

function socketError(socket: AuthedSocket, event: string, error: unknown, clientId?: string) {
  const value = error as { code?: string; message?: string };
  socket.emit(event, {
    error: value.code ?? 'request_failed',
    message: value.message ?? 'That action could not be completed.',
    ...(clientId ? { clientId } : {}),
  });
}

async function activeLiveParticipant(socket: AuthedSocket, streamId: string) {
  if (socket.data.streamId !== streamId) return false;
  if (broadcasters.get(streamId) === socket.id) return true;
  return viewers.get(streamId)?.has(socket.id) ?? false;
}

async function canJoinLive(userId: string, streamId: string) {
  const stream = await prisma.liveStream.findFirst({
    where: { id: streamId, status: 'LIVE', broadcaster: { status: 'ACTIVE' } },
  });
  if (!stream) return { ok: false as const, error: 'stream_not_live' };
  const [block, moderation] = await Promise.all([
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: stream.broadcasterId },
          { blockerId: stream.broadcasterId, blockedId: userId },
        ],
      },
    }),
    prisma.liveModeration.findUnique({
      where: { streamId_userId: { streamId, userId } },
    }),
  ]);
  if (block || moderation?.removedAt) return { ok: false as const, error: 'stream_unavailable' };
  return { ok: true as const, stream, moderation };
}

export function attachLiveSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('origin_not_allowed'));
      },
      credentials: true,
    },
    path: '/socket.io',
    maxHttpBufferSize: 64 * 1_024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    allowRequest: (request, callback) => {
      const ip = request.socket.remoteAddress ?? 'unknown';
      const now = Date.now();
      const attempt = connectionAttempts.get(ip);
      if (!attempt || attempt.resetAt <= now) {
        connectionAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
        callback(null, true);
        return;
      }
      attempt.count += 1;
      callback(null, attempt.count <= 30);
    },
  });
  setRealtimeServer(io);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('missing_token'));
    try {
      const claims = verifyAccessToken(token);
      if (claims.typ !== 'access') return next(new Error('invalid_token_type'));
      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { status: true, suspendedUntil: true },
      });
      const suspended =
        user?.status === 'SUSPENDED' &&
        (!user.suspendedUntil || user.suspendedUntil > new Date());
      if (!user || user.status === 'BANNED' || user.status === 'DELETED' || suspended) {
        return next(new Error('account_unavailable'));
      }
      socket.data.userId = claims.sub;
      socket.data.authorizedConversations = new Set<string>();
      return next();
    } catch {
      return next(new Error('invalid_token'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    onlineCounts.set(userId, (onlineCounts.get(userId) ?? 0) + 1);

    socket.on('conversation:join', async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || conversationId.length > 100) return;
      try {
        const { other } = await prisma.$transaction((tx) =>
          authorizeConversation(tx, conversationId, userId),
        );
        socket.data.authorizedConversations.add(conversationId);
        socket.join(`conversation:${conversationId}`);
        const delivered = await markMessagesDelivered(conversationId, userId);
        io?.to(`conversation:${conversationId}`).emit('message:delivered', {
          conversationId,
          userId,
          at: delivered.at,
        });
        socket.emit('conversation:joined', {
          conversationId,
          otherOnline: (onlineCounts.get(other.id) ?? 0) > 0,
        });
        io?.to(`conversation:${conversationId}`).emit('presence:update', {
          userId,
          online: true,
        });
      } catch (error) {
        socketError(socket, 'message:error', error);
      }
    });

    socket.on('conversation:leave', (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      socket.data.authorizedConversations.delete(conversationId);
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      'message:send',
      async (payload: { conversationId?: string; body?: string; clientId?: string }) => {
        const conversationId = payload?.conversationId;
        const clientId = payload?.clientId;
        if (!conversationId || !clientId || typeof payload.body !== 'string') return;
        if (!allowedEvent(`message:${socket.id}`, 30, 60_000)) {
          return socketError(socket, 'message:error', { code: 'message_rate_limited', message: 'Slow down for a moment.' }, clientId);
        }
        const body = payload.body.trim();
        if (!body || body.length > 2_000 || clientId.length < 8 || clientId.length > 100) {
          return socketError(socket, 'message:error', { code: 'invalid_message', message: 'Enter a message up to 2,000 characters.' }, clientId);
        }
        try {
          const message = await sendMessage({ conversationId, senderId: userId, body, clientId });
          socket.emit('message:sent', message);
        } catch (error) {
          socketError(socket, 'message:error', error, clientId);
        }
      },
    );

    socket.on(
      'message:delivered',
      async (payload: { conversationId?: string; throughMessageId?: string }) => {
        if (!payload?.conversationId) return;
        try {
          const result = await markMessagesDelivered(payload.conversationId, userId, payload.throughMessageId);
          socket.to(`conversation:${payload.conversationId}`).emit('message:delivered', {
            conversationId: payload.conversationId,
            userId,
            throughMessageId: payload.throughMessageId,
            at: result.at,
          });
        } catch (error) {
          socketError(socket, 'message:error', error);
        }
      },
    );

    socket.on('message:read', async (payload: { conversationId?: string; throughMessageId?: string }) => {
      if (!payload?.conversationId) return;
      try {
        const result = await markMessagesRead(payload.conversationId, userId, payload.throughMessageId);
        socket.to(`conversation:${payload.conversationId}`).emit('message:read', {
          conversationId: payload.conversationId,
          userId,
          throughMessageId: payload.throughMessageId,
          at: result.at,
        });
      } catch (error) {
        socketError(socket, 'message:error', error);
      }
    });

    const typing = async (event: 'typing:start' | 'typing:stop', payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId || !allowedEvent(`typing:${socket.id}`, 20, 10_000)) return;
      const timerKey = `${conversationId}:${userId}`;
      if (event === 'typing:stop') {
        const existing = typingTimers.get(timerKey);
        if (existing) { clearTimeout(existing); typingTimers.delete(timerKey); }
      }
      try {
        await prisma.$transaction((tx) => authorizeConversation(tx, conversationId, userId));
        if (event === 'typing:start') {
          const existing = typingTimers.get(timerKey);
          if (existing) clearTimeout(existing);
          const timer = setTimeout(() => {
            typingTimers.delete(timerKey);
            socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
          }, 30_000);
          typingTimers.set(timerKey, timer);
        }
        socket.to(`conversation:${conversationId}`).emit(event, { conversationId, userId });
      } catch {
        // Authorization failures intentionally do not reveal conversation state.
      }
    };
    socket.on('typing:start', (payload) => void typing('typing:start', payload));
    socket.on('typing:stop', (payload) => void typing('typing:stop', payload));

    socket.on('live:broadcast', async (payload: { streamId?: string }) => {
      const streamId = payload?.streamId;
      if (!streamId) return;
      const stream = await prisma.liveStream.findFirst({
        where: { id: streamId, broadcasterId: userId, status: 'LIVE' },
      });
      if (!stream) { socket.emit('live:error', { error: 'not_broadcaster' }); return; }
      if (Date.now() - stream.startedAt.getTime() > STREAM_MAX_DURATION_MS) {
        await prisma.liveStream.update({
          where: { id: streamId },
          data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
        });
        socket.emit('live:ended', { streamId, reason: 'duration_cap' });
        return;
      }
      const timer = broadcasterEndTimers.get(streamId);
      if (timer) clearTimeout(timer);
      broadcasterEndTimers.delete(streamId);
      const previous = broadcasters.get(streamId);
      if (previous && previous !== socket.id) io?.sockets.sockets.get(previous)?.disconnect(true);
      socket.data.streamId = streamId;
      socket.join(`stream:${streamId}`);
      broadcasters.set(streamId, socket.id);
      viewers.set(streamId, viewers.get(streamId) ?? new Set());
      socket.emit('live:broadcast-ready', { streamId });
    });

    socket.on('live:join', async (payload: { streamId?: string }) => {
      const streamId = payload?.streamId;
      if (!streamId) return;
      const allowed = await canJoinLive(userId, streamId);
      if (!allowed.ok) { socket.emit('live:error', { error: allowed.error }); return; }
      socket.data.streamId = streamId;
      socket.join(`stream:${streamId}`);
      const set = viewers.get(streamId) ?? new Set<string>();
      set.add(socket.id);
      viewers.set(streamId, set);
      await prisma.liveStream.update({ where: { id: streamId }, data: { viewerCount: set.size } });
      const broadcasterSocket = broadcasters.get(streamId);
      if (broadcasterSocket) {
        io?.to(broadcasterSocket).emit('live:viewer-joined', {
          userId,
          peerId: socket.id,
          viewerCount: set.size,
        });
      }
      io?.to(`stream:${streamId}`).emit('live:viewer-count', { viewerCount: set.size });
    });

    socket.on(
      'live:offer',
      (payload: { streamId?: string; to?: string; sdp?: unknown }) => {
        const streamId = payload?.streamId;
        const target = payload?.to;
        if (!streamId || !target || broadcasters.get(streamId) !== socket.id) return;
        if (!viewers.get(streamId)?.has(target)) return;
        io?.to(target).emit('live:offer', { from: socket.id, sdp: payload.sdp });
      },
    );

    socket.on(
      'live:answer',
      (payload: { streamId?: string; to?: string; sdp?: unknown }) => {
        const streamId = payload?.streamId;
        const target = payload?.to;
        if (!streamId || !target || !viewers.get(streamId)?.has(socket.id)) return;
        if (broadcasters.get(streamId) !== target) return;
        io?.to(target).emit('live:answer', { from: socket.id, sdp: payload.sdp });
      },
    );

    socket.on(
      'live:ice',
      async (payload: { streamId?: string; to?: string; candidate?: unknown }) => {
        const streamId = payload?.streamId;
        const target = payload?.to;
        if (!streamId || !target || !(await activeLiveParticipant(socket, streamId))) return;
        const broadcaster = broadcasters.get(streamId);
        const targetIsParticipant = broadcaster === target || viewers.get(streamId)?.has(target);
        if (!targetIsParticipant) return;
        io?.to(target).emit('live:ice', { from: socket.id, candidate: payload.candidate });
      },
    );

    socket.on('live:chat', async (payload: { streamId?: string; body?: string }) => {
      const streamId = payload?.streamId;
      const body = payload?.body?.trim();
      if (!streamId || !body || body.length > 280 || !(await activeLiveParticipant(socket, streamId))) return;
      if (!allowedEvent(`live-chat:${socket.id}`, 5, 10_000)) {
        socket.emit('live:error', { error: 'chat_rate_limited' });
        return;
      }
      const [stream, moderation] = await Promise.all([
        prisma.liveStream.findFirst({ where: { id: streamId, status: 'LIVE' } }),
        prisma.liveModeration.findUnique({ where: { streamId_userId: { streamId, userId } } }),
      ]);
      if (!stream || moderation?.removedAt || (moderation?.mutedUntil && moderation.mutedUntil > new Date())) {
        socket.emit('live:error', { error: 'chat_unavailable' });
        return;
      }
      const message = await prisma.liveChatMessage.create({
        data: { streamId, senderId: userId, body },
        include: { sender: { select: { profile: { select: { displayName: true } } } } },
      });
      io?.to(`stream:${streamId}`).emit('live:chat', {
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        senderName: message.sender.profile?.displayName ?? 'SIMP member',
        createdAt: message.createdAt,
      });
    });

    socket.on('live:heart', async (payload: { streamId?: string }) => {
      const streamId = payload?.streamId;
      if (!streamId || !(await activeLiveParticipant(socket, streamId))) return;
      if (!allowedEvent(`live-heart:${socket.id}`, 20, 10_000)) return;
      try {
        const stream = await prisma.$transaction(async (tx) => {
          const active = await tx.liveStream.findFirst({ where: { id: streamId, status: 'LIVE' } });
          if (!active) throw new Error('stream_not_live');
          await tx.liveReaction.create({ data: { streamId, userId } });
          return tx.liveStream.update({
            where: { id: streamId },
            data: { heartCount: { increment: 1 } },
            select: { heartCount: true },
          });
        });
        io?.to(`stream:${streamId}`).emit('live:heart', { from: userId, heartCount: stream.heartCount });
      } catch {
        // Stream ended between validation and update.
      }
    });

    socket.on('live:end', async (payload: { streamId?: string }) => {
      const streamId = payload?.streamId;
      if (!streamId || broadcasters.get(streamId) !== socket.id) return;
      await endStream(streamId, 'broadcaster');
    });

    socket.on('disconnect', () => {
      const count = Math.max(0, (onlineCounts.get(userId) ?? 1) - 1);
      if (count === 0) onlineCounts.delete(userId);
      else onlineCounts.set(userId, count);
      for (const conversationId of socket.data.authorizedConversations) {
        socket.to(`conversation:${conversationId}`).emit('presence:update', {
          userId,
          online: count > 0,
        });
      }

      const streamId = socket.data.streamId;
      if (!streamId) return;
      const set = viewers.get(streamId);
      if (set?.delete(socket.id)) {
        void prisma.liveStream
          .update({ where: { id: streamId }, data: { viewerCount: set.size } })
          .catch(() => undefined);
        io?.to(`stream:${streamId}`).emit('live:viewer-count', { viewerCount: set.size });
      }
      if (broadcasters.get(streamId) === socket.id) {
        broadcasters.delete(streamId);
        const timer = setTimeout(() => {
          if (!broadcasters.has(streamId)) void endStream(streamId, 'disconnect');
        }, BROADCAST_RECONNECT_GRACE_MS);
        timer.unref();
        broadcasterEndTimers.set(streamId, timer);
      }
    });
  });

  const sweep = setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STREAM_MAX_DURATION_MS);
      const overdue = await prisma.liveStream.findMany({
        where: { status: 'LIVE', startedAt: { lt: cutoff } },
        select: { id: true },
      });
      await Promise.all(overdue.map((stream) => endStream(stream.id, 'duration_cap')));
    } catch (error) {
      logger.error({ event: 'live_sweep_failed', error: error instanceof Error ? error.message : String(error) });
    }
  }, STREAM_SWEEP_INTERVAL_MS);
  sweep.unref();

  const orphanSweep = setTimeout(async () => {
    const live = await prisma.liveStream.findMany({ where: { status: 'LIVE' }, select: { id: true } });
    await Promise.all(live.filter((stream) => !broadcasters.has(stream.id)).map((stream) => endStream(stream.id, 'server_restart')));
  }, 90_000);
  orphanSweep.unref();

  return io;
}

async function endStream(streamId: string, reason: string) {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId }, select: { recordingEgressId: true } });
  await prisma.liveStream.updateMany({
    where: { id: streamId, status: 'LIVE' },
    data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
  });
  io?.to(`stream:${streamId}`).emit('live:ended', { streamId, reason });
  broadcasters.delete(streamId);
  viewers.delete(streamId);
  const timer = broadcasterEndTimers.get(streamId);
  if (timer) clearTimeout(timer);
  broadcasterEndTimers.delete(streamId);
  // Recording + room cleanup is async, non-blocking. Recording failures
  // are logged but never affect the user-facing 'ended' event.
  if (stream?.recordingEgressId) {
    void stopRecording(streamId, stream.recordingEgressId).catch(() => undefined);
  } else {
    void stopRecording(streamId).catch(() => undefined);
  }
  void deleteRoom(streamId).catch(() => undefined);
}

export function getIO() {
  return io;
}
