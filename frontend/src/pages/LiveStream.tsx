import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { endStream, getLiveStream, getStreamChat, reportStream } from '../api/live';
import type { LiveChatMessage, LiveStream } from '../api/live';
import { useAuth } from '../store/auth';
import { API_BASE_URL, getAccessToken } from '../api/client';
import { getIceConfig, type IceServer } from '../api/config';

type ConnectionState = 'loading' | 'preview' | 'connecting' | 'live' | 'ended' | 'error';

export default function LiveStreamPage() {
  const navigate = useNavigate();
  const { id: streamId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [heartCount, setHeartCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [cameraReady, setCameraReady] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  // ICE config (STUN + optional TURN) fetched from /config/ice-servers on
  // mount. When TURN isn't configured on the backend, iceServers still
  // contains STUN entries, which work for ~50% of viewers (those on open
  // networks). A separate warning surfaces in the UI when TURN is off.
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
  ]);
  const [turnWarning, setTurnWarning] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate content');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const REPORT_REASONS = [
    'Fake photos or profile',
    'Inappropriate content',
    'Harassment or hate speech',
    'Spam or scam',
    'Underage',
    'Other',
  ];

  async function submitReport() {
    if (!streamId || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await reportStream(streamId, reportReason, reportDetails || undefined);
      setReportDone(true);
      // Close the modal after a brief delay so the user sees the success state.
      setTimeout(() => {
        setShowReport(false);
        setReportDone(false);
        setReportDetails('');
      }, 1500);
    } catch (e) {
      console.error('report failed', e);
      setReportSubmitting(false);
    }
  }
  // Tracks whether the user (broadcaster) has clicked "Go Live" so we know
  // it's safe to open the socket. For viewers, this is flipped on as soon as
  // the stream metadata loads.
  const [connectInitiated, setConnectInitiated] = useState(false);

  // Load ICE server config (STUN + optional TURN) once on mount. Without
  // TURN, cross-network viewers see a black screen; we surface that as a
  // soft warning the broadcaster can see in the preview state.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await getIceConfig();
        if (cancelled) return;
        const servers: RTCIceServer[] = cfg.iceServers.map((s: IceServer) => ({
          urls: s.urls,
          ...(s.username ? { username: s.username } : {}),
          ...(s.credential ? { credential: s.credential } : {}),
        }));
        if (servers.length > 0) setIceServers(servers);
        if (!cfg.turnConfigured && cfg.recommendation) setTurnWarning(cfg.recommendation);
      } catch {
        // Fall back to the hardcoded STUN list so the page still works
        // even if /config/ice-servers is unreachable. The warning stays
        // null so we don't alarm the user about a config we couldn't fetch.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const heartIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load stream metadata
  useEffect(() => {
    if (!streamId) return;
    let cancelled = false;
    void (async () => {
      try {
        const found = await getLiveStream(streamId);
        if (cancelled) return;
        setStream(found);
        const isBroadcasterNow = found.broadcaster?.userId === user?.id;
        setIsBroadcaster(isBroadcasterNow);
        setViewerCount(found.viewerCount);
        setHeartCount(found.heartCount ?? 0);
        if (isBroadcasterNow) {
          // Broadcaster: show preview first, then "going live" once socket connects
          setConnectionState('preview');
        } else {
          setConnectionState('connecting');
          // Viewer is ready to open the socket once metadata loads
          setConnectInitiated(true);
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

  // Set up socket + rtc. NOTE: deliberately does NOT depend on `connectionState`
  // — depending on it would create an infinite loop because disconnect during
  // cleanup flips the state, which retriggers this effect, which disconnects
  // again, forever.
  useEffect(() => {
    if (!streamId || !user) return;
    if (!connectInitiated) return;
    if (isBroadcaster && connectionState === 'preview') return;
    const token = getAccessToken();
    if (!token) return;

    intentionalDisconnectRef.current = false;
    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('live');
      if (isBroadcaster) {
        socket.emit('live:broadcast', { streamId });
      } else {
        socket.emit('live:join', { streamId });
      }
    });

    socket.on('disconnect', () => {
      // Ignore disconnects that we triggered ourselves from this effect's
      // cleanup — otherwise we'd flip back to 'connecting' and re-trigger the
      // effect forever.
      if (intentionalDisconnectRef.current) return;
      setConnectionState('connecting');
    });

    socket.on('live:error', (payload: { error: string }) => {
      setError(payload.error);
      setConnectionState('error');
    });

    socket.on('live:viewer-joined', (payload: { userId: string; peerId: string; viewerCount: number }) => {
      setViewerCount(payload.viewerCount);
      if (isBroadcaster && payload.userId !== user.id) {
        createPeerConnectionForViewer(payload.peerId, streamId);
      }
    });

    socket.on('live:viewer-count', (payload: { viewerCount: number }) => {
      setViewerCount(payload.viewerCount);
    });

    socket.on('live:viewer-left', (payload: { viewerCount: number }) => {
      setViewerCount(payload.viewerCount);
    });

    socket.on('live:offer', async (payload: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (isBroadcaster) return;
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

    socket.on('live:heart', (payload: { heartCount?: number }) => {
      if (typeof payload.heartCount === 'number') setHeartCount(payload.heartCount);
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

    const activePeerConnections = peerConnectionsRef.current;
    return () => {
      intentionalDisconnectRef.current = true;
      socket.disconnect();
      socketRef.current = null;
      activePeerConnections.forEach((pc) => pc.close());
      activePeerConnections.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId, user?.id, isBroadcaster, connectInitiated]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function startCamera(facing: 'user' | 'environment' = 'user') {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing },
        audio: true,
      });
      localStreamRef.current = media;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = media;
        localVideoRef.current.muted = true;
      }
      setCameraReady(true);
      setFacingMode(facing);
    } catch {
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

  async function flipCamera() {
    if (!cameraReady || !localStreamRef.current) return;
    const next: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: next },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Swap the video track in the local stream without tearing down audio
      const oldVideoTracks = localStreamRef.current.getVideoTracks();
      oldVideoTracks.forEach((t) => {
        localStreamRef.current!.removeTrack(t);
        t.stop();
      });
      localStreamRef.current.addTrack(newVideoTrack);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Hot-swap the video track on every active peer connection so viewers
      // see the new camera without a renegotiation round-trip.
      peerConnectionsRef.current.forEach((pc) => {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch((e) => console.error('replaceTrack failed', e));
        }
      });

      setFacingMode(next);
    } catch (e) {
      console.error('flipCamera failed', e);
      setError('Could not switch camera. Try again.');
    }
  }

  function getOrCreatePeerConnection(peerId: string, sid: string): RTCPeerConnection {
    let pc = peerConnectionsRef.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers });

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
    if (!socketRef.current?.connected) {
      setError('Reconnecting. Your comment was not sent.');
      return;
    }
    socketRef.current.emit('live:chat', { streamId, body });
    setChatInput('');
  }

  function sendHeart() {
    if (!streamId) return;
    if (socketRef.current?.connected) {
      socketRef.current.emit('live:heart', { streamId });
    }
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
        <div className="mx-auto flex h-full max-w-5xl flex-col px-3 pb-24 pt-3 lg:flex-row lg:items-stretch lg:gap-4 lg:px-4 lg:pb-6">
          {/* Video stage — on mobile the chat overlays the bottom of this box */}
          <div className="relative aspect-[9/16] w-full shrink-0 overflow-hidden rounded-2xl bg-black lg:aspect-auto lg:h-full lg:min-h-[500px] lg:flex-1">
            {/* The video element always renders so we can attach the stream when ready */}
            <video
              ref={isBroadcaster ? localVideoRef : remoteVideoRef}
              autoPlay
              playsInline
              muted={isBroadcaster}
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
                <div className="w-full p-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                    Camera ready
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Tap <span className="font-semibold text-white">Go Live</span> to start streaming
                  </p>
                  {turnWarning && (
                    <p className="mx-auto mt-3 max-w-xs rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-200">
                      ⚠ {turnWarning}
                    </p>
                  )}
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
                  <span className="ml-2 text-red-300">♥ {heartCount}</span>
                </div>
              </div>
            )}

            {/* Broadcaster title overlay (no controls here anymore — moved to a
                dedicated toolbar below the video so the chat overlay doesn't
                cover them). */}
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

            {/* Viewer: tap to send heart (sits above the chat overlay so taps still register) */}
            {!isBroadcaster && connectionState === 'live' && (
              <button
                onClick={sendHeart}
                className="absolute inset-x-0 top-0 z-0 h-[calc(100%-12rem)]"
                aria-label="Send a heart"
              />
            )}
          </div>

          {/* Broadcaster toolbar — sits between video stage and chat panel so
              the chat overlay never covers it. Shows mic toggle, camera
              toggle, camera-flip, and End-stream. Always rendered when the
              viewer is the broadcaster across preview / live / connecting
              states. */}
          {isBroadcaster && (
            <div
              className="relative z-20 mb-2 flex items-center justify-center gap-2 self-center rounded-full border border-white/15 bg-ink-950/90 px-3 py-2 shadow-2xl backdrop-blur-md lg:hidden"
              role="toolbar"
              aria-label="Broadcaster controls"
            >
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
              <BroadcasterControlButton
                active={facingMode === 'user'}
                onClick={flipCamera}
                disabled={!cameraReady}
                label={facingMode === 'user' ? 'Front camera' : 'Back camera'}
                icon="🔄"
              />
              {(connectionState === 'live' ||
                connectionState === 'preview' ||
                connectionState === 'connecting') && (
                <button
                  onClick={handleEndStream}
                  className="ml-1 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-200 hover:bg-red-500 hover:text-white"
                >
                  End
                </button>
              )}
            </div>
          )}

          {/* Desktop-only broadcaster toolbar (shown on lg+ via the in-flow
              flex row that wraps it; hidden on mobile because mobile has the
              dedicated toolbar above the chat panel). */}
          {isBroadcaster && (
            <div
              className="mb-2 hidden items-center justify-center gap-2 self-center rounded-full border border-white/15 bg-ink-950/90 px-3 py-2 shadow-2xl backdrop-blur-md lg:flex"
              role="toolbar"
              aria-label="Broadcaster controls"
            >
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
              <BroadcasterControlButton
                active={facingMode === 'user'}
                onClick={flipCamera}
                disabled={!cameraReady}
                label={facingMode === 'user' ? 'Front camera' : 'Back camera'}
                icon="🔄"
              />
              {(connectionState === 'live' ||
                connectionState === 'preview' ||
                connectionState === 'connecting') && (
                <button
                  onClick={handleEndStream}
                  className="ml-1 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-200 hover:bg-red-500 hover:text-white"
                >
                  End
                </button>
              )}
            </div>
          )}

          {/* Chat panel — overlaid on the video on mobile (so users can watch and chat at once),
              side-by-side on desktop */}
          <div className="relative z-10 -mt-40 flex flex-col rounded-t-2xl border border-white/10 bg-gradient-to-b from-ink-900/40 via-ink-900/80 to-ink-900/95 px-1 pb-1 pt-2 backdrop-blur-md lg:mt-0 lg:h-full lg:min-h-[500px] lg:w-80 lg:shrink-0 lg:rounded-2xl lg:border lg:bg-ink-900/60 lg:p-0 lg:backdrop-blur-0">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 lg:px-4 lg:py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                Live chat
              </p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-white/40">
                  {viewerCount} watching
                </p>
                {!isBroadcaster && (
                  <button
                    onClick={() => setShowReport(true)}
                    aria-label="Report this stream"
                    className="rounded-full p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-300"
                  >
                    🚩
                  </button>
                )}
              </div>
            </div>

            <div
              ref={chatScrollRef}
              className="h-40 space-y-2 overflow-y-auto px-3 py-2 lg:h-auto lg:flex-1 lg:max-h-[60vh] lg:px-4 lg:py-3"
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

            <div className="flex items-center gap-2 border-t border-white/10 p-2 lg:p-3">
              <button
                onClick={sendHeart}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-red-500/30 hover:text-red-400"
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
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                enterKeyHint="send"
                maxLength={280}
                placeholder="Say something nice…"
                className="flex-1 rounded-full border border-white/10 bg-ink-950 px-3 py-2 text-base text-white placeholder:text-white/40 focus:border-gold-400/60 focus:outline-none focus:ring-2 focus:ring-gold-400/20 sm:text-xs"
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

      {/* Report stream modal — viewer-side. Required by Apple App Store
          Guideline 1.4.1 (in-app content reporting) and Google Play UGC
          policy. */}
      {showReport && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => !reportSubmitting && setShowReport(false)}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-gold-400/30 bg-ink-950 p-6 pb-safe sm:rounded-3xl sm:border"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20 sm:hidden" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
              Report this stream
            </p>
            <p className="mt-1 text-sm text-white/70">
              Tell us what's wrong. Reports are reviewed within 24 hours.
            </p>

            <div className="mt-4 space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                    reportReason === r
                      ? 'border-red-400/60 bg-red-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    className="h-4 w-4 accent-red-400"
                  />
                  <span className="text-sm text-white">{r}</span>
                </label>
              ))}
            </div>

            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              maxLength={500}
              placeholder="Optional: add details (max 500 chars)"
              className="mt-4 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-red-400/60 focus:outline-none"
              rows={3}
            />

            {reportDone && (
              <p className="mt-3 text-center text-sm text-green-300">
                ✓ Report submitted. We'll review within 24 hours.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={submitReport}
                disabled={reportSubmitting || reportDone}
                className="w-full rounded-full bg-red-500 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-600 disabled:opacity-30"
              >
                {reportSubmitting ? 'Submitting…' : reportDone ? 'Submitted' : 'Submit report'}
              </button>
              <button
                onClick={() => setShowReport(false)}
                disabled={reportSubmitting}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
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
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? 'border-white/30 bg-black/50 text-white hover:bg-white/20'
          : 'border-red-400/50 bg-red-500/25 text-red-300 hover:bg-red-500/40'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
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
