import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMatches } from '../api/matches';
import type { MatchSummary } from '../types';
import { SimpLogo } from '../components/SimpLogo';

const editorialProfiles = [
  '/editorial/profiles/women-01.jpg',
  '/editorial/profiles/men-02.jpg',
  '/editorial/profiles/women-04.jpg',
  '/editorial/profiles/men-06.jpg',
];

export default function Matches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void loadMatches(); }, []);

  async function loadMatches() {
    setLoading(true);
    setError(null);
    try {
      const res = await getMatches();
      setMatches(res.matches);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <header className="relative z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-safe pt-6">
        <button onClick={() => navigate('/home')} className="text-xs font-medium uppercase tracking-[0.2em] text-white/55 transition hover:text-white">‹ Back</button>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-300">Your invitations</p>
        <span className="w-12" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-5 pb-24 pt-5 sm:px-6">
        {loading && <MatchesSkeleton />}
        {error && !loading && (
          <div className="py-24 text-center"><p className="text-sm text-white/65">{error}</p><button onClick={() => void loadMatches()} className="btn-gold-outline mt-5 px-5 py-2 text-xs uppercase tracking-[0.18em]">Try again</button></div>
        )}
        {!loading && !error && matches.length === 0 && <EmptyMatches />}
        {!loading && !error && matches.length > 0 && (
          <>
            <section className="relative mb-8 min-h-[245px] overflow-hidden rounded-[2rem] border border-white/10">
              <img src="/editorial/matches.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-ink-950/15" />
              <div className="relative flex min-h-[245px] max-w-sm flex-col justify-end p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.27em] text-gold-300">A mutual yes</p>
                <h1 className="display-heading mt-2 text-4xl font-light leading-[.95]">A few people worth meeting.</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/70">Read the small things that made the connection feel possible, then begin wherever it feels natural.</p>
              </div>
            </section>
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <p className="text-xs text-white/50">{matches.length} {matches.length === 1 ? 'invitation' : 'invitations'} waiting</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Take your time</p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {matches.map((m, index) => <MatchInvitation key={m.matchId} match={m} index={index} onOpen={() => navigate(`/matches/${m.matchId}`)} />)}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

function MatchInvitation({ match, index, onOpen }: { match: MatchSummary; index: number; onOpen: () => void }) {
  const { otherUser } = match;
  const photo = otherUser.photoUrl || otherUser.thumbnailUrl || editorialProfiles[index % editorialProfiles.length];
  const context = otherUser.occupation ? `${otherUser.occupation}${otherUser.city ? ` · ${otherUser.city}` : ''}` : otherUser.city ?? 'A new shared energy';
  return (
    <motion.li initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.06, 0.3) }}>
      <button onClick={onOpen} className="group block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400">
        <div className="relative aspect-[4/4.4] overflow-hidden rounded-[1.65rem] bg-ink-800">
          <img src={photo} alt={otherUser.displayName} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end justify-between gap-3">
              <div><h2 className="display-heading text-3xl font-light">{otherUser.displayName}<span className="ml-2 text-xl text-white/70">{otherUser.age}</span></h2><p className="mt-1 text-xs text-white/65">{context}</p></div>
              {otherUser.isVerified && <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gold-200">✓ Verified</span>}
            </div>
          </div>
        </div>
        <div className="px-1 pt-3">
          {match.noteFromOther ? <><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">Their opening note</p><p className="mt-1 line-clamp-2 font-serif text-[15px] leading-relaxed text-white/80">“{match.noteFromOther}”</p></> : <><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">Shared energy</p><p className="mt-1 text-sm text-white/60">A mutual spark. See what you have in common.</p></>}
        </div>
      </button>
    </motion.li>
  );
}

function MatchesSkeleton() { return <div className="space-y-5"><div className="h-60 animate-pulse rounded-[2rem] bg-white/[0.06]" /><div className="grid gap-5 sm:grid-cols-2">{[1, 2].map(i => <div key={i} className="aspect-[4/5] animate-pulse rounded-[1.65rem] bg-white/[0.06]" />)}</div></div>; }

function EmptyMatches() {
  const navigate = useNavigate();
  return <div className="flex flex-col items-center py-24 text-center"><SimpLogo size={64} variant="emblem" /><p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.26em] text-gold-300">The room is still open</p><h2 className="display-heading mt-3 max-w-sm text-3xl font-light">Your next invitation is still finding its way here.</h2><p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">Keep discovering. When someone chooses you back, this is where the story starts.</p><button onClick={() => navigate('/discover')} className="btn-gold mt-7 px-6 py-3 text-xs font-medium uppercase tracking-[0.18em]">Discover people</button></div>;
}
