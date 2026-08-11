import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { env, allowedOrigins } from '../config/env.js';

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    streamId?: string;
  };
}

// In-memory tracking of broadcasters and viewers per stream
const broadcasters = new Map<string, string>(); // streamId -> broadcaster socketId
const viewers = new Map<string, Set<string>>(); // streamId -> set of viewer socketIds

let io: Server | null = null;

export function attachLiveSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(new Error('CORS: origin not allowed'));
      },
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authenticate socket using JWT from handshake auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('missing_token'));
    try {
      const claims = verifyAccessToken(token);
      if (claims.typ !== 'access') return next(new Error('invalid_token_type'));
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.data.userId;
    console.log(`[live] socket connected: userId=${userId} socketId=${socket.id}`);

    // Broadcaster joins their own stream room
    socket.on('live:broadcast', async (payload: { streamId: string }) => {
      const { streamId } = payload;
      const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
      if (!stream || stream.broadcasterId !== userId) {
        socket.emit('live:error', { error: 'not_broadcaster' });
        return;
      }
      if (stream.status !== 'LIVE') {
        socket.emit('live:error', { error: 'stream_not_live' });
        return;
      }
      socket.data.streamId = streamId;
      socket.join(`stream:${streamId}`);
      broadcasters.set(streamId, socket.id);
      if (!viewers.has(streamId)) viewers.set(streamId, new Set());
      console.log(`[live] broadcaster ${userId} on stream ${streamId}`);
    });

    // Viewer joins a stream's room
    socket.on('live:join', async (payload: { streamId: string }) => {
      const { streamId } = payload;
      const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
      if (!stream || stream.status !== 'LIVE') {
        socket.emit('live:error', { error: 'stream_not_live' });
        return;
      }
      socket.data.streamId = streamId;
      socket.join(`stream:${streamId}`);
      const set = viewers.get(streamId) ?? new Set<string>();
      set.add(socket.id);
      viewers.set(streamId, set);
      const newCount = set.size;
      await prisma.liveStream.update({
        where: { id: streamId },
        data: { viewerCount: newCount },
      });
      io?.to(`stream:${streamId}`).emit('live:viewer-joined', { userId, viewerCount: newCount });
      // Tell broadcaster a new viewer wants to connect
      const bid = broadcasters.get(streamId);
      if (bid) io?.to(bid).emit('live:viewer-joined', { userId, viewerCount: newCount });
      console.log(`[live] viewer ${userId} joined stream ${streamId} (count=${newCount})`);
    });

    // WebRTC signaling: viewer -> broadcaster (offer)
    socket.on('live:offer', (payload: { streamId: string; to: string; sdp: unknown }) => {
      const bid = broadcasters.get(payload.streamId);
      if (bid) io?.to(bid).emit('live:offer', { from: userId, sdp: payload.sdp });
    });

    // WebRTC signaling: broadcaster -> viewer (answer)
    socket.on('live:answer', (payload: { streamId: string; to: string; sdp: unknown }) => {
      io?.to(payload.to).emit('live:answer', { from: userId, sdp: payload.sdp });
    });

    // WebRTC signaling: ICE candidates
    socket.on('live:ice', (payload: { streamId: string; to: string; candidate: unknown }) => {
      io?.to(payload.to).emit('live:ice', { from: userId, candidate: payload.candidate });
    });

    // Live chat message
    socket.on('live:chat', async (payload: { streamId: string; body: string }) => {
      const { streamId, body } = payload;
      if (!body || body.trim().length === 0 || body.length > 280) return;
      const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
      if (!stream || stream.status !== 'LIVE') return;
      const msg = await prisma.liveChatMessage.create({
        data: { streamId, senderId: userId, body: body.trim() },
        include: { sender: { include: { profile: { select: { displayName: true } } } } },
      });
      io?.to(`stream:${streamId}`).emit('live:chat', {
        id: msg.id,
        body: msg.body,
        senderId: msg.senderId,
        senderName: msg.sender.profile?.displayName ?? 'Unknown',
        createdAt: msg.createdAt,
      });
    });

    // Heart reaction
    socket.on('live:heart', (payload: { streamId: string }) => {
      io?.to(`stream:${payload.streamId}`).emit('live:heart', { from: userId });
    });

    // Broadcaster ends stream
    socket.on('live:end', async (payload: { streamId: string }) => {
      const { streamId } = payload;
      const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
      if (!stream || stream.broadcasterId !== userId) return;
      await prisma.liveStream.update({
        where: { id: streamId },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      io?.to(`stream:${streamId}`).emit('live:ended', { streamId });
      broadcasters.delete(streamId);
      viewers.delete(streamId);
    });

    socket.on('disconnect', async () => {
      const streamId = socket.data.streamId;
      if (!streamId) return;
      const set = viewers.get(streamId);
      if (set) {
        set.delete(socket.id);
        const newCount = Math.max(0, set.size);
        await prisma.liveStream.update({
          where: { id: streamId },
          data: { viewerCount: newCount },
        }).catch(() => null);
        io?.to(`stream:${streamId}`).emit('live:viewer-left', { userId, viewerCount: newCount });
      }
      if (broadcasters.get(streamId) === socket.id) {
        broadcasters.delete(streamId);
        viewers.delete(streamId);
        await prisma.liveStream
          .update({
            where: { id: streamId },
            data: { status: 'ENDED', endedAt: new Date() },
          })
          .catch(() => null);
        io?.to(`stream:${streamId}`).emit('live:ended', { streamId });
      }
      console.log(`[live] socket disconnected: userId=${userId} streamId=${streamId}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}
