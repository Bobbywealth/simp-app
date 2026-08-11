import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMatch, unmatch } from '../api/matches';
import type { MatchDetail as MatchDetailType } from '../types';

export default function MatchDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    void loadMatch(id);
  }, [id]);

  async function loadMatch(matchId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await getMatch(matchId);
      setMatch(res);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnmatch() {
    if (!match) return;
    try {
      await unmatch(match.matchId);
      navigate('/matches', { replace: true });
    } catch (e) {
      console.error('unmatch failed', e);
    }
  }

  if (loading) {
    return (
      <Scaffold onBack={() => navigate('/matches')}>
        <div className="flex flex-1 items-center justify-center text-sm text-white/50">
          Loading match…
        </div>
      </Scaffold>
    );
  }

  if (error || !match) {
    return (
      <Scaffold onBack={() => navigate('/matches')}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-white/70">{error ?? 'Match not found.'}</p>
          <button
            onClick={() => navigate('/matches')}
            className="btn-gold-outline px-5 py-2 text-xs font-medium uppercase tracking-[0.18em]"
          >
            Back to matches
          </button>
        </div>
      </Scaffold>
    );
  }

  const u = match.otherUser;
  const primaryPhoto = u.photos[0]?.url;
  const remainingPhotos = u.photos.slice(1);

  return (
    <Scaffold onBack={() => navigate('/matches')}>
      <div className="flex-1 overflow-y-auto pb-safe">
        {/* Hero photo — fully unlocked */}
        {primaryPhoto && (
          <div className="relative">
            <img
              src={primaryPhoto}
              alt={u.displayName}
              className="aspect-[3/4] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <h1 className="display-heading flex items-baseline gap-2 text-3xl font-light text-white">
                {u.displayName}
                <span className="text-2xl text-white/70">{u.age}</span>
                {u.isVerified && (
                  <span className="ml-1 rounded-full border border-gold-400/40 bg-gold-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-200">
                    Verified
                  </span>
                )}
              </h1>
              <p className="mt-1 text-sm text-white/70">
                {u.occupation}
                {u.occupation && u.city ? ' · ' : ''}
                {u.city}
              </p>
            </div>
          </div>
        )}

        {/* Photos unlocked reveal */}
        <div className="px-6 pt-2">
          <div className="rounded-xl border border-gold-400/20 bg-gold-400/5 p-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Photos Unlocked
            </p>
            <p className="mt-1 text-[10px] text-white/50">
              You matched — full access granted.
            </p>
          </div>
        </div>

        {/* Mutual notes */}
        {(match.myNote || match.theirNote) && (
          <section className="mt-6 px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              The Convince Notes
            </h2>
            <div className="mt-3 space-y-3">
              {match.theirNote && (
                <div className="rounded-xl border border-gold-400/20 bg-ink-900/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-300">
                    {u.displayName}&apos;s note to you
                  </p>
                  <p className="mt-1 text-sm italic text-white/90">
                    &ldquo;{match.theirNote}&rdquo;
                  </p>
                </div>
              )}
              {match.myNote && (
                <div className="rounded-xl border border-white/10 bg-ink-900/60 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    Your note to {u.displayName}
                  </p>
                  <p className="mt-1 text-sm italic text-white/90">
                    &ldquo;{match.myNote}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Bio */}
        {u.bio && (
          <section className="mt-6 px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              About
            </h2>
            <p className="mt-2 text-sm text-white/90">{u.bio}</p>
          </section>
        )}

        {/* Prompts */}
        {u.prompts.length > 0 && (
          <section className="mt-6 px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Prompts
            </h2>
            <div className="mt-3 space-y-3">
              {u.prompts.map((p) => (
                <div key={p.id} className="rounded-xl border border-gold-400/20 bg-ink-900/60 p-4">
                  <p className="text-xs font-medium text-gold-300">{p.question}</p>
                  <p className="mt-1 text-sm text-white/90">{p.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Additional photos */}
        {remainingPhotos.length > 0 && (
          <section className="mt-6 px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              More photos
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {remainingPhotos.map((p) => (
                <motion.img
                  key={p.id}
                  src={p.url}
                  alt=""
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {/* Interests */}
        {u.interests.length > 0 && (
          <section className="mt-6 px-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Interests
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {u.interests.map((i) => (
                <span
                  key={i.slug}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                >
                  {i.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="mt-8 px-6 space-y-3">
          <button
            className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]"
            onClick={() => alert('Messaging is coming in the next roadmap item.')}
          >
            Send a message
          </button>
          <button
            onClick={() => setShowUnmatchConfirm(true)}
            className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
          >
            Unmatch
          </button>
        </section>
      </div>

      {showUnmatchConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowUnmatchConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-6 max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-6 text-center"
          >
            <p className="text-sm text-white/90">
              Unmatch with {u.displayName}? You won&apos;t see them again in your deck.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowUnmatchConfirm(false)}
                className="flex-1 rounded-full border border-white/15 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/70"
              >
                Cancel
              </button>
              <button
                onClick={handleUnmatch}
                className="flex-1 rounded-full bg-red-500/80 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white"
              >
                Unmatch
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Scaffold>
  );
}

function Scaffold({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
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
        <span className="w-12" />
        <span className="w-12" />
      </header>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
    </div>
  );
}
