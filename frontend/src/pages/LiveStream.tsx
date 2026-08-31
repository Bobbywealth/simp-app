import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type LocalParticipant,
  type RemoteTrackPublication,
  type LocalTrackPublication,
  type DisconnectReason,
} from 'livekit-client';
import { endStream, getLiveStream, getStreamChat, reportStream } from '../api/live';
import type { LiveChatMessage, LiveStream as LiveStreamMeta } from '../api/live';
import { useAuth } from '../store/auth';
import { getRealtimeSocket } from '../lib/realtime';
import { fetchLivekitConfig, requestLiveToken } from '../api/livekit';
import { track } from '../api/analytics';

type ConnectionState = 'loading' | 'preview' | 'connecting' | 'live' | 'ended' | 'error';

const REPORT_REASONS = [
  'Fake photos or profile',
  'Inappropriate content',
  'Harassment or hate speech',
  'Spam or scam',
  'Underage',
  'Other',
];

export default function LiveStreamPage() {
  const navigate = useNavigate();
  const { id: streamId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [stream, setStream] = useState<LiveStreamMeta | null>(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livekitReady, setLivekitReady] = useState<boolean | null>(null);
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
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate content');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [connectInitiated, setConnectInitiated] = useState(false);

  // LiveKit + WebRTC refs
  const roomRef = useRef<Room | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement>(null);
  const localVideoElRef = useRef<HTMLVideoElement>(null);
  const localTrackRef = useRef<MediaStreamTrack | null>(null);
  const heartIdRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const streamMetaRef = useRef<LiveStreamMeta | null>(null);

  // Track viewer-join analytics (deduped per session via sessionStorage).
  useEffect(() => {
    if (!streamId) return;
    const KEY = `simp_live_viewed_${streamId}`;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    void track('live_viewed', { streamId });
  }, [streamId]);

  // Load stream metadata + LiveKit config
  useEffect(() => {
    if (!streamId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [found, lk] = await Promise.all([
          getLiveStream(streamId),
          fetchLivekitConfig(),
        ]);
        if (cancelled) return;
        setStream(found);
        streamMetaRef.current = found;
        setLivekitReady(Boolean(lk));
        setViewerCount(found.viewerCount);
        setHeartCount(found.heartCount ?? 0);
        const me = found.broadcaster?.userId === user?.id;
        setIsBroadcaster(me);
        if (me) {
          setConnectionState('preview');
        } else {
          // iOS Safari blocks autoplay until a user gesture. The tap-to-
          // watch button flips this state.
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

  // Broadcaster: start camera + mic once preview state mounts
  useEffect(() => {
    if (!isBroadcaster || connectionState !== 'preview') return;
    void startCamera();
    return () => stopLocalMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBroadcaster, connectionState]);

  // Chat socket setup (kept independent of WebRTC so chat/hearts/moderation
  // continue working even if LiveKit is unavailable).
  useEffect(() => {
    if (!streamId || !user) return;
    const socket = getRealtimeSocket();
    const onChat = (msg: LiveChatMessage) => {
      setMessages((prev) => [...prev, msg].slice(-100));
      window.setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    };
    const onHeart = (payload: { heartCount?: number }) => {
      if (typeof payload.heartCount === 'number') setHeartCount(payload.heartCount);
      spawnHeart();
    };
    const onViewerCount = (payload: { viewerCount: number }) => setViewerCount(payload.viewerCount);
    const onEnded = () => setConnectionState('ended');
    socket.on('live:chat', onChat);
    socket.on('live:heart', onHeart);
    socket.on('live:viewer-count', onViewerCount);
    socket.on('live:ended', onEnded);
    getStreamChat(streamId)
      .then((res) => setMessages(res.messages))
      .catch(() => null);
    return () => {
      socket.off('live:chat', onChat);
      socket.off('live:heart', onHeart);
      socket.off('live:viewer-count', onViewerCount);
      socket.off('live:ended', onEnded);
    };
  }, [streamId, user?.id]);

  // Auto-scroll chat on new messages
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
      localTrackRef.current = media.getVideoTracks()[0] ?? null;
      if (localVideoElRef.current) {
        localVideoElRef.current.srcObject = media;
        // Critical for iOS Safari: the local preview needs explicit muted
        // + inline to autoplay on the broadcaster's own preview.
        localVideoElRef.current.muted = true;
        localVideoElRef.current.setAttribute('playsinline', 'true');
        localVideoElRef.current.setAttribute('autoplay', 'true');
      }
      setCameraReady(true);
      setFacingMode(facing);
      return media;
    } catch {
      setError('Camera/mic permission denied. Please allow access and try again.');
      setConnectionState('error');
      return null;
    }
  }

  function stopLocalMedia() {
    const room = roomRef.current;
    if (room) {
      room.localParticipant.trackPublications.forEach((pub) => {
        try {
          pub.track?.stop?.();
          if (pub.track) void room.localParticipant.unpublishTrack(pub.track);
        } catch {
          /* ignore */
        }
      });
    }
    localTrackRef.current = null;
  }

  function toggleMic() {
    const room = roomRef.current;
    if (!room) return;
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = micPub?.audioTrack?.mediaStreamTrack;
    if (track) {
      track.enabled = !track.enabled;
      setMicEnabled(track.enabled);
    }
  }

  function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = camPub?.videoTrack?.mediaStreamTrack;
    if (track) {
      track.enabled = !track.enabled;
      setCameraEnabled(track.enabled);
    }
  }

  async function flipCamera() {
    if (!cameraReady) return;
    const next: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: next },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      const room = roomRef.current;
      if (room) {
        await room.switchActiveDevice('videoinput', newTrack.getSettings().deviceId ?? '');
      }
      localTrackRef.current = newTrack;
      setFacingMode(next);
    } catch (e) {
      console.error('flipCamera failed', e);
      setError('Could not switch camera. Try again.');
    }
  }

  /**
   * Join the LiveKit room (or fall back to legacy mesh if LiveKit is not
   * configured). On the viewer side this must be called from a user
   * gesture handler so iOS Safari allows the autoplaying remote video.
   */
  async function joinLiveRoom() {
    if (!streamId || !user) return;
    setConnectInitiated(true);
    setConnectionState('connecting');
    setError(null);
    if (livekitReady) {
      try {
        const { token, url } = await requestLiveToken(streamId, isBroadcaster);
        await connectLiveKit(url, token);
      } catch (e) {
        setError((e as Error).message);
        setConnectionState('error');
      }
    } else {
      // LiveKit not yet configured — fall back to mesh signalling.
      // (Only useful for the legacy dev path; production should always
      // have LiveKit env vars set.)
      setError('Live streaming is being upgraded. Try again in a minute.');
      setConnectionState('error');
    }
  }

  async function connectLiveKit(url: string, token: string) {
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Force the renderer to autoplay inline on iOS Safari.
      publishDefaults: { simulcast: true },
    });
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      if (!isBroadcaster) return;
      const meta = streamMetaRef.current;
      if (!meta) return;
      const count = (room.remoteParticipants.size + 1);
      getRealtimeSocket()?.emit('live:viewer-joined', {
        streamId: meta.id,
        viewerCount: count,
      });
      setViewerCount(count);
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (!isBroadcaster) return;
      const meta = streamMetaRef.current;
      if (!meta) return;
      const count = Math.max(0, room.remoteParticipants.size + 1);
      getRealtimeSocket()?.emit('live:viewer-left', {
        streamId: meta.id,
        viewerCount: count,
      });
      setViewerCount(count);
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Video) return;
      const el = remoteVideoElRef.current;
      if (!el) return;
      track.attach(el);
      // iOS Safari / Android autoplay guards: the subscribed video must
      // be muted inline. We handle audio separately.
      el.setAttribute('playsinline', 'true');
      el.muted = true;
      el.play().catch(() => undefined);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind !== Track.Kind.Video) return;
      const el = remoteVideoElRef.current;
      if (!el) return;
      track.detach(el);
    });

    room.on(RoomEvent.Disconnected, (_reason: DisconnectReason | undefined) => {
      setConnectionState('ended');
    });

    await room.connect(url, token);
    if (isBroadcaster) {
      // Publish camera + mic. We enable both at the SDK level so the
      // publish call uses whatever tracks the user has already granted
      // permissions for. The local preview is wired to the localVideoEl.
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
      } catch (error) {
        console.error('publish failed', error);
      }
    }
    setConnectionState('live');
    if (!isBroadcaster) {
      const meta = streamMetaRef.current;
      if (meta) {
        const remoteCount = room.remoteParticipants.size;
        // The broadcaster is the first participant; viewers = total - 1.
        const viewerCount = Math.max(0, remoteCount);
        setViewerCount(viewerCount);
        getRealtimeSocket()?.emit('live:join', { streamId: meta.id });
      }
    }
  }

  function leaveRoom() {
    const room = roomRef.current;
    if (room) {
      void room.disconnect();
      roomRef.current = null;
    }
    stopLocalMedia();
  }

  async function handleSubmitReport() {
    if (!streamId || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      await reportStream(streamId, reportReason, reportDetails || undefined);
      setReportDone(true);
      window.setTimeout(() => {
        setShowReport(false);
        setReportDone(false);
        setReportDetails('');
      }, 1500);
    } catch (e) {
      console.error('report failed', e);
      setReportSubmitting(false);
    }
  }

  async function handleEndStream() {
    if (!streamId) return;
    try {
      await endStream(streamId);
    } catch (e) {
      console.error('end stream failed', e);
    } finally {
      leaveRoom();
      navigate('/home');
    }
  }

  function sendChat() {
    const body = chatInput.trim();
    if (!body || !streamId) return;
    const socket = getRealtimeSocket();
    if (!socket.connected) {
      setError('Reconnecting. Your comment was not sent.');
      return;
    }
    socket.emit('live:chat', { streamId, body });
    setChatInput('');
  }

  function sendHeart() {
    if (!streamId) return;
    const socket = getRealtimeSocket();
    if (socket.connected) socket.emit('live:heart', { streamId });
    spawnHeart();
  }

  function spawnHeart() {
    heartIdRef.current += 1;
    setHearts((current) => [
      ...current.slice(-12),
      { id: heartIdRef.current, x: 12 + Math.random() * 70 },
    ]);
    window.setTimeout(() => {
      setHearts((current) => current.slice(1));
    }, 1800);
  }

  // Cleanup LiveKit on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTapToWatch = !isBroadcaster && connectionState === 'connecting' && !connectInitiated;

  return (
    <div className="relative flex h-screen min-h-screen flex-col overflow-hidden bg-black text-white">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pt-safe pb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2 rounded-full bg-red-500/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Live
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReport(true)}
            aria-label="Report stream"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 21V4h13l-2 4 2 4H4" strokeLinejoin="round" />
            </svg>
          </button>
          {isBroadcaster && (
            <button
              type="button"
              onClick={handleEndStream}
              aria-label="End stream"
              className="flex h-10 items-center rounded-full bg-red-600 px-4 text-xs font-semibold uppercase tracking-[0.16em]"
            >
              End
            </button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col">
        <section className="relative min-h-[58vh] flex-1 overflow-hidden bg-ink-950">
          <img src="/editorial/live.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />
          {isBroadcaster ? (
            <video
              ref={localVideoElRef}
              autoPlay
              muted
              playsInline
              aria-label="Your camera preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <video
              ref={remoteVideoElRef}
              autoPlay
              muted
              playsInline
              aria-label="Live stream"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {showTapToWatch && (
            <button
              type="button"
              onClick={joinLiveRoom}
              className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur"
              aria-label="Tap to join the live stream"
            >
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-gold-400/40 bg-black/55 px-8 py-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-400/50">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-gold-300" fill="currentColor">
                    <path d="M8 5v14l11-7Z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-200">
                  Tap to start watching
                </span>
              </div>
            </button>
          )}

          {connectionState === 'connecting' && !showTapToWatch && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-5 py-3 text-xs uppercase tracking-[0.18em] text-white/75">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" />
                Connecting…
              </div>
            </div>
          )}

          {connectionState === 'ended' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur">
              <div className="rounded-3xl border border-white/10 bg-black/60 px-6 py-5 text-center">
                <p className="text-base font-semibold">This stream has ended</p>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="mt-4 rounded-full border border-gold-400/40 bg-gold-400/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-x-3 bottom-3 rounded-xl border border-red-400/30 bg-red-500/[0.12] px-3 py-2 text-xs text-red-100 backdrop-blur">
              {error}
            </div>
          )}

          {/* Floating hearts */}
          <AnimatePresence>
            {hearts.map((heart) => (
              <motion.span
                key={heart.id}
                initial={{ y: 60, opacity: 0, scale: 0.6 }}
                animate={{ y: -120, opacity: [0, 1, 0.8, 0], scale: [0.6, 1.2, 1, 0.8] }}
                transition={{ duration: 1.8, ease: 'easeOut' }}
                className="pointer-events-none absolute bottom-24 text-3xl"
                style={{ left: `${heart.x}%` }}
              >
                ❤️
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Header strip */}
          <div className="absolute inset-x-0 top-0 flex items-end justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-20">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold drop-shadow">{stream?.title ?? 'Live'}</p>
              {stream?.broadcaster && (
                <p className="text-xs text-white/65 drop-shadow">
                  {stream.broadcaster.displayName}
                  {stream.broadcaster.age ? ` · ${stream.broadcaster.age}` : ''}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/85 backdrop-blur">
              👁 {viewerCount}
            </div>
          </div>

          {/* Broadcaster controls */}
          {isBroadcaster && (
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 px-4">
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micEnabled ? 'Mute mic' : 'Unmute mic'}
                className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                  micEnabled
                    ? 'border-white/20 bg-black/55 text-white'
                    : 'border-red-400/40 bg-red-500/20 text-red-200'
                } backdrop-blur`}
              >
                {micEnabled ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="3" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m4 4 16 16M9 3v3m6 0v9m-9 0a7 7 0 0 0 11 5M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={cameraEnabled ? 'Stop camera' : 'Start camera'}
                className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                  cameraEnabled
                    ? 'border-white/20 bg-black/55 text-white'
                    : 'border-red-400/40 bg-red-500/20 text-red-200'
                } backdrop-blur`}
              >
                {cameraEnabled ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="14" height="12" rx="2" />
                    <path d="m22 8-6 4 6 4Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m4 4 16 16M2 8v8M22 8l-6 4M22 8v8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={flipCamera}
                aria-label="Switch camera"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z" />
                  <path d="M9 8a3 3 0 1 0 0 6M16 16l-5-5" strokeLinecap="round" />
                </svg>
              </button>
              {connectionState !== 'live' && (
                <button
                  type="button"
                  onClick={joinLiveRoom}
                  disabled={!cameraReady || livekitReady === false}
                  className="rounded-full bg-gold-400 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-950 disabled:opacity-40"
                >
                  Go Live
                </button>
              )}
            </div>
          )}
        </section>

        <section className="relative z-20 flex max-h-[36vh] min-h-0 flex-1 flex-col border-t border-white/[0.12] bg-black/55 backdrop-blur-xl">
          <div
            ref={chatScrollRef}
            className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm"
          >
            {messages.length === 0 && (
              <p className="text-center text-xs text-white/45">Be the first to comment.</p>
            )}
            {messages.map((msg) => {
              const mine = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[78%] rounded-2xl bg-white/[0.07] px-3 py-1.5 text-sm text-white/90">
                    {!mine && (
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">
                        {msg.senderName}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendChat();
            }}
            className="flex items-center gap-2 border-t border-white/[0.06] bg-black/45 px-3 py-3 pb-safe"
          >
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              maxLength={280}
              placeholder="Say something kind…"
              aria-label="Send a comment"
              className="flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-gold-400/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={sendHeart}
              aria-label="Send heart"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-red-300 hover:bg-white/[0.1]"
            >
              ❤️
            </button>
            <button
              type="submit"
              disabled={!chatInput.trim()}
              aria-label="Send comment"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-ink-950 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="m5 12 14-7-5 14-2-5-7-2Z" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </section>
      </main>

      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowReport(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl border-t border-red-400/25 bg-ink-900 p-5 pb-safe"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-300">Report stream</h2>
              <div className="mt-4 space-y-1">
                {REPORT_REASONS.map((reason) => (
                  <label key={reason} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-white/75 hover:bg-white/5">
                    <input
                      type="radio"
                      name="reportReason"
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                      className="accent-gold-400"
                    />
                    {reason}
                  </label>
                ))}
              </div>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={3}
                maxLength={1_000}
                placeholder="Optional details for the safety team"
                className="mt-3 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowReport(false)} className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={reportSubmitting || reportDone}
                  className="rounded-full bg-red-500 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] disabled:opacity-50"
                >
                  {reportDone ? 'Submitted' : reportSubmitting ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
