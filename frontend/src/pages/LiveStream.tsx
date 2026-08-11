import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { endStream, getStreamChat, listLiveStreams } from '../api/live';
import type { LiveChatMessage, LiveStream } from '../api/live';
import { useAuth } from '../store/auth';
import { API_BASE_URL } from '../api/client';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type ConnectionState = 'loading' | 'preview' | 'connecting' | 'live' | 'ended' | 'error';

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
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [cameraReady, setCameraReady] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const heartIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load stream metadata
  useEffect(() => {
    if (!streamId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await listLiveStreams();
        const found = res.streams.find((s) => s.id === streamId);
        if (cancelled) return;
        if (!found) {
          setError('Stream not found or has ended');
          setConnectionState('error');
          return;
        }
        setStream(found);
        const isBroadcasterNow = found.broadcaster?.userId === user?.id;
        setIsBroadcaster(isBroadcasterNow);
        setViewerCount(found.viewerCount);
        if (isBroadcasterNow) {
          // Broadcaster: show preview first, then "going live" once socket connects
          setConnectionState('preview');
        } else {
          setConnectionState('connecting');
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setConnectionState('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamId, user?.id]);

  // Broadcaster: start camera preview as soon as the page loads (preview state)
  useEffect(() => {
    if (!isBroadcaster || connectionState !== 'preview') return;
    void startCamera();
    return () => {
      stopLocalStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBroadcaster, connectionState]);

  // Set up socket + rtc
  useEffect(() => {
    if (!streamId || !user) return;
    if (!isBroadcaster && connectionState === 'preview') return; // not yet ready
    const token = localStorage.getItem('simp_access');
    if (!token) return;

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (isBroadcaster) {
        setConnectionState('live');
        socket.emit('live:broadcast', { streamId });
      } else {
        setConnectionState('live');
        socket.emit('live:join', { streamId });
      }
    });

    socket.on('disconnect', () => {
      if (!socket.connected) setConnectionState('connecting');
    });

    socket.on('live:error', (payload: { error: string }) => {
      setError(payload.error);
      setConnectionState('error');
    });

    socket.on('live:viewer-joined', (payload: { userId: string; viewerCount: number }) => {
      setViewerCount(payload.viewerCount);
      if (isBroadcaster && payload.userId !== user.id) {
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
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    });

    socket.on('live:heart', () => {
      spawnHeart();
    });

    socket.on('live:ended', () => {
      setConnectionState('ended');
      stopLocalStream();
    });

    // Load existing chat
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
  }, [streamId, user?.id, isBroadcaster, connectionState]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function startCamera() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      localStreamRef.current = media;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = media;
        localVideoRef.current.muted = true;
      }
      setCameraReady(true);
    } catch (e) {
      setError('Camera/mic permission denied. Please allow access and try again.');
      setConnectionState('error');
    }
  }

  function stopLocalStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }

  function toggleMic() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
    }
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraEnabled(videoTrack.enabled);
    }
  }

  function getOrCreatePeerConnection(peerId: string, sid: string): RTCPeerConnection {
    let pc = peerConnectionsRef.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (track.enabled) pc!.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current?.emit('live:ice', { streamId: sid, to: peerId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream && remoteVideoRef.current && remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream;
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

  function sendChatMessage() {
    const body = chatInput.trim();
    if (!body || !streamId) return;
    socketRef.current?.emit('live:chat', { streamId, body });
    setChatInput('');
  }

  function sendHeart() {
    if (!streamId) return;
    socketRef.current?.emit('live:heart', { streamId });
    spawnHeart();
  }

  function spawnHeart() {
    const id = ++heartIdRef.current;
    const x = 20 + Math.random() * 60;
    setHearts((prev) => [...prev, { id, x }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, 3000);
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
    setConnectionState('ended');
    setTimeout(() => navigate('/live', { replace: true }), 1500);
  }

  if (connectionState === 'error' && !stream) {
    return (
      <Scaffold onBack={() => navigate('/live')}>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <p className="text-sm text-red-300">{error ?? 'Something went wrong.'}</p>
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
        <div className="mx-auto flex h-full max-w-5xl flex-col gap-0 px-3 pb-24 pt-3 lg:flex-row lg:gap-4 lg:px-4 lg:pb-6">
          {/* Video stage */}
          <div className="relative aspect-[9/16] w-full shrink-0 overflow-hidden rounded-2xl bg-black lg:aspect-auto lg:h-auto lg:flex-1">
            {/* The video element always renders so we can attach the stream when ready */}
            <video
              ref={isBroadcaster ? localVideoRef : remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Connecting state */}
            {(connectionState === 'connecting' || connectionState === 'loading') && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/60">Connecting…</p>
                </div>
              </div>
            )}

            {/* Preview state (broadcaster: camera ready, not yet "live") */}
            {connectionState === 'preview' && (
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black via-black/40 to-transparent">
                <div className="p-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                    Camera ready
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Tap <span className="font-semibold text-white">Go Live</span> to start streaming
                  </p>
                </div>
              </div>
            )}

            {/* Ended state */}
            {connectionState === 'ended' && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950/95">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">
                    Stream ended
                  </p>
                  <button
                    onClick={() => navigate('/live')}
                    className="mt-6 btn-gold px-6 py-3 text-sm font-medium uppercase tracking-[0.18em]"
                  >
                    Back to Live
                  </button>
                </div>
              </div>
            )}

            {/* Top overlay — LIVE badge + viewer count */}
            {connectionState === 'live' && (
              <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  LIVE
                </div>
                <div className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white">
                  <span>👁</span>
                  <span className="font-semibold">{viewerCount}</span>
                </div>
              </div>
            )}

            {/* Broadcaster title + controls */}
            {stream && (
              <div className="absolute left-3 right-3 top-12 flex items-center gap-2">
                {stream.broadcaster?.photoUrl && (
                  <img
                    src={stream.broadcaster.photoUrl}
                    alt=""
                    className="h-9 w-9 rounded-full border border-white/40 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {stream.broadcaster?.displayName}
                  </p>
                  <p className="truncate text-[11px] text-white/80">{stream.title}</p>
                </div>
                {isBroadcaster && connectionState === 'live' && (
                  <button
                    onClick={handleEndStream}
                    className="rounded-full border border-white/40 bg-black/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-red-500"
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
                  transition={{ duration: 2.5, ease: 'easeOut' }}
                  className="absolute text-3xl text-red-500 drop-shadow"
                  style={{ left: `${h.x}%` }}
                >
                  ♥
                </motion.div>
              ))}
            </div>

            {/* Broadcaster: bottom controls (mic toggle, camera toggle, end stream) */}
            {isBroadcaster && (connectionState === 'preview' || connectionState === 'live') && (
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 px-3">
                <BroadcasterControlButton
                  active={micEnabled}
                  onClick={toggleMic}
                  disabled={connectionState === 'preview'}
                  label={micEnabled ? 'Mic on' : 'Mic off'}
                  icon={micEnabled ? '🎙' : '🔇'}
                />
                <BroadcasterControlButton
                  active={cameraEnabled}
                  onClick={toggleCamera}
                  disabled={connectionState === 'preview'}
                  label={cameraEnabled ? 'Camera on' : 'Camera off'}
                  icon={cameraEnabled ? '📹' : '📷'}
                />
                {connectionState === 'preview' && cameraReady && (
                  <button
                    onClick={() => setConnectionState('connecting')}
                    className="rounded-full border-2 border-red-500 bg-red-500 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white hover:bg-red-600"
                  >
                    ● Go Live
                  </button>
                )}
              </div>
            )}

            {/* Viewer: tap to send heart */}
            {!isBroadcaster && connectionState === 'live' && (
              <button
                onClick={sendHeart}
                className="absolute inset-0"
                aria-label="Send a heart"
              />
            )}
          </div>

          {/* Chat panel (always-visible, separate from video) */}
          <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-ink-900/60 lg:mt-0 lg:w-80 lg:shrink-0">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                Live chat
              </p>
              <p className="text-[10px] text-white/40">
                {viewerCount} watching
              </p>
            </div>

            <div
              ref={chatScrollRef}
              className="flex-1 space-y-2 overflow-y-auto px-4 py-3 lg:max-h-[60vh]"
            >
              {messages.length === 0 && (
                <p className="text-center text-xs text-white/40">
                  Be the first to say something nice.
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} className="text-xs leading-snug">
                  <span className="font-semibold text-gold-300">{m.senderName}</span>
                  <span className="ml-1 text-white">{m.body}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-white/10 p-3">
              <button
                onClick={sendHeart}
                disabled={connectionState !== 'live'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-red-500/30 hover:text-red-400 disabled:opacity-40"
                aria-label="Send heart"
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
                disabled={connectionState !== 'live'}
                placeholder="Say something nice…"
                className="flex-1 rounded-full border border-white/10 bg-ink-950 px-3 py-2 text-xs text-white placeholder:text-white/40 disabled:opacity-50"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || connectionState !== 'live'}
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

interface BroadcasterButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon: string;
}

function BroadcasterControlButton({ active, onClick, disabled, label, icon }: BroadcasterButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full border transition disabled:opacity-30 ${
        active
          ? 'border-white/30 bg-black/40 text-white hover:bg-white/20'
          : 'border-red-400/40 bg-red-500/20 text-red-400 hover:bg-red-500/30'
      }`}
    >
      <span className="text-base">{icon}</span>
    </button>
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
