import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { endStream, getStreamChat, listLiveStreams } from '../api/live';
import type { LiveChatMessage, LiveStream } from '../api/live';
import { useAuth } from '../store/auth';
import { API_BASE_URL } from '../api/client';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function LiveStreamPage() {
  const navigate = useNavigate();
  const { id: streamId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [connected, setConnected] = useState(false);
  const [streamEnded, setStreamEnded] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const heartIdRef = useRef(0);

  // Load stream metadata
  useEffect(() => {
    if (!streamId) return;
    void (async () => {
      try {
        const res = await listLiveStreams();
        const found = res.streams.find((s) => s.id === streamId);
        if (!found) {
          setError('Stream not found or ended');
          return;
        }
        setStream(found);
        setIsBroadcaster(found.broadcaster?.userId === user?.id);
        setViewerCount(found.viewerCount);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [streamId, user?.id]);

  // Set up socket + webrtc
  useEffect(() => {
    if (!streamId || !user) return;
    const token = localStorage.getItem('simp_access');
    if (!token) return;

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      if (isBroadcaster) {
        socket.emit('live:broadcast', { streamId });
      } else {
        socket.emit('live:join', { streamId });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('live:error', (payload: { error: string }) => {
      setError(payload.error);
    });

    socket.on('live:viewer-joined', (payload: { userId: string; viewerCount: number }) => {
      setViewerCount(payload.viewerCount);
      if (isBroadcaster && payload.userId !== user.id) {
        // Create a peer connection for the new viewer
        createPeerConnectionForViewer(payload.userId, streamId);
      }
    });

    socket.on('live:viewer-left', (payload: { viewerCount: number }) => {
      setViewerCount(payload.viewerCount);
    });

    socket.on('live:offer', async (payload: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (!isBroadcaster) return;
      const pc = getOrCreatePeerConnection(payload.from, streamId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('live:answer', { streamId, to: payload.from, sdp: answer });
      } catch (e) {
        console.error('offer failed', e);
      }
    });

    socket.on('live:answer', async (payload: { from: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(payload.from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch (e) {
        console.error('answer failed', e);
      }
    });

    socket.on('live:ice', async (payload: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(payload.from);
      if (!pc || !payload.candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (e) {
        console.error('ice failed', e);
      }
    });

    socket.on('live:chat', (msg: LiveChatMessage) => {
      setMessages((prev) => [...prev, msg].slice(-100));
    });

    socket.on('live:heart', () => {
      spawnHeart(socketRef.current ? true : false);
    });

    socket.on('live:ended', () => {
      setStreamEnded(true);
      stopLocalStream();
    });

    // Load existing chat history
    getStreamChat(streamId)
      .then((res) => setMessages(res.messages))
      .catch(() => null);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, user?.id, isBroadcaster]);

  // Broadcaster: start camera + mic
  useEffect(() => {
    if (!isBroadcaster || !connected) return;
    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' },
          audio: true,
        });
        localStreamRef.current = media;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          localVideoRef.current.muted = true;
        }
      } catch (e) {
        setError('Camera/mic permission denied. Please allow access to go live.');
      }
    })();

    return () => {
      stopLocalStream();
    };
  }, [isBroadcaster, connected]);

  function getOrCreatePeerConnection(peerId: string, sid: string): RTCPeerConnection {
    let pc = peerConnectionsRef.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc!.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('live:ice', { streamId: sid, to: peerId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }

  async function createPeerConnectionForViewer(viewerId: string, sid: string) {
    const pc = getOrCreatePeerConnection(viewerId, sid);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('live:offer', { streamId: sid, to: viewerId, sdp: offer });
    } catch (e) {
      console.error('createPeerConnectionForViewer failed', e);
    }
  }

  function stopLocalStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }

  function sendChatMessage() {
    const body = chatInput.trim();
    if (!body || !streamId) return;
    socketRef.current?.emit('live:chat', { streamId, body });
    setChatInput('');
  }

  function sendHeart() {
    if (!streamId) return;
    socketRef.current?.emit('live:heart', { streamId });
    spawnHeart(true);
  }

  function spawnHeart(fromSelf: boolean) {
    const id = ++heartIdRef.current;
    const x = 20 + Math.random() * 60; // 20% to 80% horizontal
    setHearts((prev) => [...prev, { id, x }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 4000);
  }

  async function handleEndStream() {
    if (!streamId) return;
    try {
      await endStream(streamId);
      socketRef.current?.emit('live:end', { streamId });
    } catch (e) {
      console.error('end stream failed', e);
    }
    stopLocalStream();
    navigate('/live', { replace: true });
  }

  if (error && !stream) {
    return (
      <Scaffold onBack={() => navigate('/live')}>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => navigate('/live')}
              className="mt-4 btn-gold-outline px-5 py-2 text-xs font-medium uppercase tracking-[0.18em]"
            >
              Back to Live
            </button>
          </div>
        </div>
      </Scaffold>
    );
  }

  return (
    <Scaffold onBack={() => navigate('/live')}>
      <div className="relative flex-1">
        {/* Video area */}
        <div className="relative mx-auto aspect-[9/16] max-h-[80vh] w-full max-w-md overflow-hidden bg-black">
          {/* Broadcaster sees their own video; viewer sees broadcaster via remote stream */}
          {isBroadcaster ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          )}

          {/* Empty state when stream hasn't connected yet */}
          {!connected && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/60">Connecting…</p>
              </div>
            </div>
          )}

          {/* Stream ended overlay */}
          {streamEnded && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/90">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">Stream ended</p>
                <button
                  onClick={() => navigate('/live')}
                  className="mt-6 btn-gold px-6 py-3 text-sm font-medium uppercase tracking-[0.18em]"
                >
                  Back to Live
                </button>
              </div>
            </div>
          )}

          {/* Top overlay: LIVE badge + viewer count */}
          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </div>
            <div className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
              ♥ {viewerCount}
            </div>
          </div>

          {/* Title + broadcaster */}
          {stream && (
            <div className="absolute left-3 right-3 top-12 flex items-center gap-2">
              {stream.broadcaster?.photoUrl && (
                <img
                  src={stream.broadcaster.photoUrl}
                  alt=""
                  className="h-8 w-8 rounded-full border border-white/30 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{stream.broadcaster?.displayName}</p>
                <p className="truncate text-[10px] text-white/70">{stream.title}</p>
              </div>
              {isBroadcaster && (
                <button
                  onClick={handleEndStream}
                  className="rounded-full bg-red-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
                >
                  End
                </button>
              )}
            </div>
          )}

          {/* Floating hearts */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {hearts.map((h) => (
              <motion.div
                key={h.id}
                initial={{ y: '100%', opacity: 1, scale: 0.6 }}
                animate={{ y: '-20%', opacity: 0, scale: 1.4 }}
                transition={{ duration: 3, ease: 'easeOut' }}
                className="absolute text-2xl text-red-400"
                style={{ left: `${h.x}%` }}
              >
                ♥
              </motion.div>
            ))}
          </div>

          {/* Chat overlay bottom */}
          <div className="absolute inset-x-0 bottom-0 max-h-[40%] overflow-hidden bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
            <div className="mb-2 max-h-40 space-y-1 overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="text-xs">
                  <span className="font-semibold text-gold-300">{m.senderName}:</span>{' '}
                  <span className="text-white">{m.body}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={sendHeart}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20"
              >
                ♥
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChatMessage();
                }}
                maxLength={280}
                placeholder="Say something nice…"
                className="flex-1 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/40"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                className="rounded-full bg-gold-400 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-ink-950 disabled:opacity-30"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </Scaffold>
  );
}

interface ScaffoldProps {
  children: React.ReactNode;
  onBack: () => void;
}

function Scaffold({ children, onBack }: ScaffoldProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={onBack}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">Live</h1>
        <span className="w-12" />
      </header>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
    </div>
  );
}
