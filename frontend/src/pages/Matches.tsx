import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMatches } from '../api/matches';
import type { MatchSummary } from '../types';
import { SimpLogo } from '../components/SimpLogo';

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadMatches();
  }, []);

  async function loadMatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await getMatches();
      setMatches(res.matches);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setLoading(false);
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
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">Matches</h1>
        <span className="w-12" />
      </header>

      <main className="relative z-10 flex-1 px-6 pt-6 pb-safe">
        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-white/50">
            Loading your matches…
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-sm text-white/70">{error}</p>
            <button
              onClick={() => loadMatches()}
              className="btn-gold-outline px-5 py-2 text-xs font-medium uppercase tracking-[0.18em]"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <SimpLogo size={64} variant="emblem" />
            <h2 className="display-heading text-2xl font-light">No matches yet</h2>
            <p className="max-w-xs text-sm text-white/60">
              When you and someone else like each other, you&apos;ll see them here.
            </p>
            <button
              onClick={() => navigate('/discover')}
              className="btn-gold px-6 py-3 text-sm font-medium uppercase tracking-[0.18em]"
            >
              Start swiping
            </button>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <>
            <p className="mb-4 text-xs text-white/50">
              {matches.length} {matches.length === 1 ? 'match' : 'matches'}
            </p>
            <ul className="space-y-3">
              {matches.map((m, i) => (
                <motion.li
                  key={m.matchId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <button
                    onClick={() => navigate(`/matches/${m.matchId}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3 text-left hover:border-gold-400/30 hover:bg-ink-800/60"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gold-400/30">
                      {m.otherUser.photoUrl ? (
                        <img
                          src={m.otherUser.photoUrl}
                          alt={m.otherUser.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-ink-800 text-white/40">
                          ?
                        </div>
                      )}
                      {m.otherUser.isVerified && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-ink-950 bg-gold-400 text-[10px] text-ink-950">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="truncate font-medium text-white">
                          {m.otherUser.displayName}
                        </h3>
                        <span className="text-xs text-white/60">{m.otherUser.age}</span>
                      </div>
                      {m.noteFromOther ? (
                        <p className="mt-1 line-clamp-2 text-xs italic text-gold-300/80">
                          &ldquo;{m.noteFromOther}&rdquo;
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-white/50">
                          {m.otherUser.occupation ?? 'New match'}
                        </p>
                      )}
                    </div>
                  </button>
                </motion.li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
