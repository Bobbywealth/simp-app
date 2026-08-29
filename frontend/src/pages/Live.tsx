import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { endStream, listLiveStreams, reportStream, startStream } from '../api/live';
import type { LiveStream } from '../api/live';
import { useAuth } from '../store/auth';
import { SimpLogo } from '../components/SimpLogo';
import { LegalGateModal } from '../components/LegalGateModal';
import { ShareButton } from '../components/ShareButton';
import { fetchLivekitConfig } from '../api/livekit';

const STREAM_CATEGORIES = [
  { id: 'casual', label: 'Casual Chat', emoji: '💬' },
  { id: 'date-night', label: 'Date Night', emoji: '🌙' },
  { id: 'qa', label: 'Q&A', emoji: '❓' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'social', label: 'Social', emoji: '🎉' },
];

function formatDuration(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function Live() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamCategory, setStreamCategory] = useState('casual');
  const [submitting, setSubmitting] = useState(false);
  // When the backend returns 451 legal_compliance_required from startStream,
  // we open the gate modal with this list. Once the user completes the
  // gate, we retry startStream automatically.
  const [legalMissing, setLegalMissing] = useState<Array<'age' | 'tos' | 'privacy'> | null>(null);

  const [livekitReady, setLivekitReady] = useState<boolean | null>(null);

  useEffect(() => {
    void loadStreams();
    const intv = setInterval(loadStreams, 15000);
    return () => clearInterval(intv);
  }, []);

  // Surface a soft warning when LiveKit env vars aren't configured yet.
  // Streams already in progress will keep running; only new broadcasts
  // and joins are blocked.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cfg = await fetchLivekitConfig();
      if (cancelled) return;
      setLivekitReady(Boolean(cfg));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadStreams() {
    try {
      const res = await listLiveStreams();
      setStreams(res.streams);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Detect whether the current user already has a live stream (e.g. from a
  // previous tab that crashed or was closed without ending the broadcast).
  // When found, surface it in the hero CTA so the user can resume or end it
  // instead of being blocked by the "stream_already_live" 409 response.
  const myLiveStream = useMemo(() => {
    if (!user?.id) return null;
    return streams.find((s) => s.broadcaster?.userId === user.id) ?? null;
  }, [streams, user?.id]);

  async function handleStartStream(forceReplace = false) {
    if (streamTitle.trim().length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await startStream(streamTitle.trim(), forceReplace);
      navigate(`/live/${res.streamId}`);
    } catch (e) {
      const err = e as Error & { status?: number; code?: string; details?: { missing?: string[] } };
      // 451 = "Unavailable For Legal Reasons". Backend returns the list of
      // outstanding legal steps in `details.missing`; open the gate modal
      // and let the user complete them, then we retry automatically.
      if (err.status === 451 && err.code === 'legal_compliance_required' && err.details?.missing) {
        setLegalMissing(err.details.missing as Array<'age' | 'tos' | 'privacy'>);
        setSubmitting(false);
        return;
      }
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function retryAfterLegal() {
    setLegalMissing(null);
    setSubmitting(true);
    setError(null);
    try {
      const res = await startStream(streamTitle.trim(), false);
      navigate(`/live/${res.streamId}`);
    } catch (e) {
      const err = e as Error & { status?: number; code?: string; details?: { missing?: string[] } };
      if (err.status === 451 && err.details?.missing) {
        setLegalMissing(err.details.missing as Array<'age' | 'tos' | 'privacy'>);
      } else {
        setError(err.message);
      }
      setSubmitting(false);
    }
  }

  async function handleEndMyStream() {
    if (!myLiveStream) return;
    try {
      await endStream(myLiveStream.id);
      setStreams((prev) => prev.filter((s) => s.id !== myLiveStream.id));
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={() => navigate('/home')}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">Live</h1>
        <span className="w-12" />
      </header>

      <main className="relative z-10 flex-1 px-6 pt-6 pb-24">
        {/* Hero "Go Live" CTA — swaps to "You're live" recovery card when the
            current user already has a LIVE stream (orphan from a previous tab). */}
        {myLiveStream ? (
          <div className="overflow-hidden rounded-2xl border border-red-400/40 bg-gradient-to-br from-red-900/40 via-ink-900 to-ink-900 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/30">
                <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
                  You&apos;re live
                </p>
                <p className="mt-1 truncate text-sm text-white/80">{myLiveStream.title}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => navigate(`/live/${myLiveStream.id}`)}
                className="w-full rounded-full border-2 border-red-500 bg-red-500 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-red-600"
              >
                ● Resume stream
              </button>
              <button
                onClick={handleEndMyStream}
                className="w-full rounded-full border border-white/20 bg-transparent py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-red-400/40 hover:text-red-300"
              >
                End stream
              </button>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-gold-400/30 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 p-6 shadow-soft">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-400/15 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/40 bg-ink-950">
                <span className="h-3 w-3 animate-pulse rounded-full bg-gold-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Go Live
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {streams.length > 0
                    ? `Join ${streams.length} live ${streams.length === 1 ? 'stream' : 'streams'} now.`
                    : 'Be the first to go live today.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGoLive(true)}
              className="btn-gold mt-5 w-full py-3 text-sm font-semibold uppercase tracking-[0.2em]"
            >
              ● Start streaming
            </button>
          </div>
        )}

        {livekitReady === false && (
          <div className="mt-4 rounded-2xl border border-gold-400/30 bg-gold-400/[0.05] px-4 py-3 text-[11px] text-white/65">
            <p className="font-semibold uppercase tracking-[0.16em] text-gold-200">
              Streaming is being upgraded
            </p>
            <p className="mt-1 text-white/55">
              The new LiveKit-backed streaming service is being configured. Until the
              env vars land on Render, starting a new stream and joining one will fail
              with “Live streaming is being upgraded.” Existing streams aren’t affected.
            </p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3 text-center">
            <div className="text-lg">💬</div>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">Real connections</p>
            <p className="mt-0.5 text-[9px] text-white/40">Meet people authentically</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3 text-center">
            <div className="text-lg">🎯</div>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">Grow your circle</p>
            <p className="mt-0.5 text-[9px] text-white/40">Find like-minded people</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3 text-center">
            <div className="text-lg">✨</div>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">Show your vibe</p>
            <p className="mt-0.5 text-[9px] text-white/40">Share your energy live</p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
            Live now
          </p>
          {streams.length > 0 && (
            <p className="text-[10px] text-white/40">
              Auto-refreshes every 15s
            </p>
          )}
        </div>

        {loading && <LiveSkeleton />}

        {error && !loading && (
          <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => loadStreams()}
              className="mt-2 text-xs text-white/60 hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && streams.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={64} variant="emblem" />
            <h2 className="display-heading text-2xl font-light">Nobody&apos;s live right now</h2>
            <p className="max-w-xs text-sm text-white/60">
              Be the first to go live. Show your energy, answer questions, and meet people in real time.
            </p>
          </div>
        )}

        {!loading && streams.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {streams.map((s) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button
                  onClick={() => navigate(`/live/${s.id}`)}
                  className={`relative w-full overflow-hidden rounded-2xl border text-left transition ${
                    s.id === myLiveStream?.id
                      ? 'border-red-400/60 hover:border-red-400'
                      : 'border-white/10 hover:border-gold-400/30'
                  } bg-ink-900/60`}
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    {s.broadcaster?.photoUrl ? (
                      <img
                        src={s.broadcaster.photoUrl}
                        alt={s.broadcaster.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ink-800 text-white/40">
                        ?
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      LIVE
                    </div>
                    <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                      <div className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                        👁 {s.viewerCount}
                      </div>
                      <div className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                        ❤️ {s.heartCount}
                      </div>
                    </div>
                    <div className="absolute left-2 top-2 mt-6 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                      ⏱ {formatDuration(s.startedAt)}
                    </div>
                    {s.id === myLiveStream?.id && (
                      <div className="absolute right-2 bottom-12 rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-950">
                        You
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{s.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-white/70">
                        <span>{s.broadcaster?.displayName ?? 'Unknown'}</span>
                        {s.broadcaster?.isVerified && <span className="text-blue-400">✓</span>}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const reason = window.prompt('Report this stream? Please provide a reason:');
                        if (reason) {
                          void reportStream(s.id, reason);
                        }
                      }}
                      className="absolute bottom-3 right-3 rounded-full bg-black/40 p-1.5 text-white/40 hover:text-red-400 transition"
                      title="Report stream"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </button>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </main>

      {showGoLive && (
        <GoLiveModal
          title={streamTitle}
          onTitleChange={setStreamTitle}
          category={streamCategory}
          onCategoryChange={setStreamCategory}
          onConfirm={() => handleStartStream(false)}
          onReplaceAndStart={() => handleStartStream(true)}
          onClose={() => {
            setShowGoLive(false);
            setStreamTitle('');
          }}
          submitting={submitting}
          error={error}
          existingStream={myLiveStream}
          onResumeExisting={() => {
            if (myLiveStream) navigate(`/live/${myLiveStream.id}`);
          }}
        />
      )}

      {legalMissing && (
        <LegalGateModal
          missing={legalMissing}
          onComplete={retryAfterLegal}
          onClose={() => setLegalMissing(null)}
        />
      )}
    </div>
  );
}

function LiveSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-ink-800" />
      ))}
    </div>
  );
}

interface GoLiveModalProps {
  title: string;
  onTitleChange: (s: string) => void;
  category: string;
  onCategoryChange: (s: string) => void;
  onConfirm: () => void;
  onReplaceAndStart: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
  existingStream: LiveStream | null;
  onResumeExisting: () => void;
}

function GoLiveModal({
  title,
  onTitleChange,
  category,
  onCategoryChange,
  onConfirm,
  onReplaceAndStart,
  onClose,
  submitting,
  error,
  existingStream,
  onResumeExisting,
}: GoLiveModalProps) {
  const showRecovery = !!error && (!!existingStream || /already.?live/i.test(error));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-gold-400/30 bg-ink-950 p-6 pb-safe"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Start a stream</p>
        <p className="mt-2 text-sm text-white/70">
          Give your stream a title and choose a vibe.
        </p>

        {/* Category Selection */}
        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-white/50">Stream vibe</p>
          <div className="flex flex-wrap gap-2">
            {STREAM_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                  category === cat.id
                    ? 'border-gold-400 bg-gold-400/20 text-gold-200'
                    : 'border-white/20 text-white/60 hover:border-white/40'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={120}
          autoFocus
          placeholder="What are you up to?"
          className="input-luxe mt-4 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-3 text-base text-white placeholder:text-white/40"
        />

        <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
          <span>🎙</span>
          <span>Camera + mic will be requested</span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3">
            <p className="text-xs font-semibold text-red-300">
              Couldn&apos;t start your stream
            </p>
            <p className="mt-1 text-[11px] text-red-200/80" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {showRecovery ? (
            <>
              <button
                onClick={onReplaceAndStart}
                disabled={submitting || title.trim().length < 2}
                className="w-full rounded-full border-2 border-red-500 bg-red-500 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-red-600 disabled:opacity-30"
              >
                {submitting ? 'Starting…' : 'End existing & start new'}
              </button>
              {existingStream && (
                <button
                  onClick={onResumeExisting}
                  className="w-full rounded-full border border-gold-400/40 bg-transparent py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300 transition hover:border-gold-300"
                >
                  Resume your live stream
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onConfirm}
                disabled={submitting || title.trim().length < 2}
                className="w-full rounded-full border-2 border-red-500 bg-red-500 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-red-600 disabled:opacity-30"
              >
                {submitting ? 'Starting…' : '● Go Live'}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
