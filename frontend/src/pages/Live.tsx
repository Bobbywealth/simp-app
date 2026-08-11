import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listLiveStreams, startStream } from '../api/live';
import type { LiveStream } from '../api/live';
import { SimpLogo } from '../components/SimpLogo';

export default function Live() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadStreams();
    const intv = setInterval(loadStreams, 15000);
    return () => clearInterval(intv);
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

  async function handleStartStream() {
    if (streamTitle.trim().length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await startStream(streamTitle.trim());
      navigate(`/live/${res.streamId}`);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setSubmitting(false);
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
        {/* Hero "Go Live" CTA */}
        <div className="overflow-hidden rounded-2xl border border-gold-400/30 bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
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
            className="mt-4 w-full rounded-full border-2 border-red-500 bg-red-500 py-3 text-sm font-bold uppercase tracking-[0.2em] text-white transition hover:bg-red-600"
          >
            ● Start streaming
          </button>
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
                  className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 text-left transition hover:border-gold-400/30"
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
                    <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                      👁 {s.viewerCount}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{s.title}</p>
                      <p className="mt-0.5 text-xs text-white/70">
                        {s.broadcaster?.displayName ?? 'Unknown'}
                      </p>
                    </div>
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
          onConfirm={handleStartStream}
          onClose={() => {
            setShowGoLive(false);
            setStreamTitle('');
          }}
          submitting={submitting}
          error={error}
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
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
  error: string | null;
}

function GoLiveModal({ title, onTitleChange, onConfirm, onClose, submitting, error }: GoLiveModalProps) {
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
          Give your stream a title. Your camera and mic will turn on next.
        </p>

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
          <p className="mt-3 text-xs text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
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
        </div>
      </motion.div>
    </div>
  );
}
