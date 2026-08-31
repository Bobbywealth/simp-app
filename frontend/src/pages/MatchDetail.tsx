import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMatch, unmatch } from '../api/matches';
import { blockUser, reportUser } from '../api/moderation';
import { openMatchConversation } from '../api/messages';
import type { MatchDetail as MatchDetailType } from '../types';

const REPORT_OPTIONS = [
  'Fake photos or profile',
  'Inappropriate content',
  'Harassment or hate speech',
  'Spam or scam',
  'Underage',
  'Other',
];

export default function MatchDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

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

  async function handleMessage() {
    if (!match) return;
    try {
      const conversationId = match.conversationId ?? (await openMatchConversation(match.matchId)).conversationId;
      navigate(`/messages/${conversationId}`);
    } catch (e) {
      setError((e as Error).message);
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

  async function handleBlock() {
    if (!match) return;
    try {
      await blockUser(match.otherUser.userId);
      navigate('/matches', { replace: true });
    } catch (e) {
      console.error('block failed', e);
    }
  }

  async function handleReport(reason: string) {
    if (!match) return;
    try {
      await reportUser(match.otherUser.userId, reason as never);
      setReportStatus('Report submitted. Our team will review.');
      setShowReportSheet(false);
      setTimeout(() => setReportStatus(null), 3000);
    } catch (e) {
      console.error('report failed', e);
    }
  }

  if (loading) {
    return (
      <Scaffold onBack={() => navigate('/matches')}>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
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
  const primaryPhoto = u.photos[0]?.url ?? '/editorial/profiles/women-01.jpg';
  const remainingPhotos = u.photos.slice(1);

  return (
    <Scaffold onBack={() => navigate('/matches')}>
      <div className="flex-1 overflow-y-auto pb-24">
        {primaryPhoto && (
          <div className="relative mx-5 mt-3 overflow-hidden rounded-[2rem] border border-white/10 sm:mx-6">
            <img src={primaryPhoto} alt={u.displayName} className="aspect-[4/5] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">A mutual invitation</p>
              <h1 className="display-heading mt-2 flex items-baseline gap-2 text-4xl font-light text-white">{u.displayName}<span className="text-2xl text-white/70">{u.age}</span></h1>
              <p className="mt-1 text-sm text-white/70">{u.occupation}{u.occupation && u.city ? ' · ' : ''}{u.city}</p>
            </div>
          </div>
        )}

        <div className="px-6 pt-5"><div className="flex items-center justify-between border-y border-white/10 py-3 text-[10px] uppercase tracking-[0.17em] text-white/45"><span>{u.isVerified ? '✓ Verified profile' : 'Profile connection'}</span><span>Photos unlocked</span></div></div>

        {(match.myNote || match.theirNote) && (
          <section className="mt-8 px-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">
              The Convince Notes
            </h2>
            <div className="mt-3 space-y-3">
              {match.theirNote && (
                <div className="border-l border-gold-400/45 pl-4 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-300">
                    {u.displayName}&apos;s note to you
                  </p>
                  <p className="mt-1 text-sm italic text-white/90">&ldquo;{match.theirNote}&rdquo;</p>
                </div>
              )}
              {match.myNote && (
                <div className="border-l border-white/25 pl-4 py-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    Your note to {u.displayName}
                  </p>
                  <p className="mt-1 text-sm italic text-white/90">&ldquo;{match.myNote}&rdquo;</p>
                </div>
              )}
            </div>
          </section>
        )}

        {u.bio && (
          <section className="mt-8 px-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">About</h2>
            <p className="mt-2 text-sm text-white/90">{u.bio}</p>
          </section>
        )}

        {u.prompts.length > 0 && (
          <section className="mt-8 px-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">Prompts</h2>
            <div className="mt-3 space-y-3">
              {u.prompts.map((p) => (
                <div key={p.id} className="border-l border-gold-400/45 pl-4 py-1">
                  <p className="text-xs font-medium text-gold-300">{p.question}</p>
                  <p className="mt-1 text-sm text-white/90">{p.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {remainingPhotos.length > 0 && (
          <section className="mt-8 px-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">More photos</h2>
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

        {u.interests.length > 0 && (
          <section className="mt-8 px-6">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">Interests</h2>
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

        <section className="mt-8 px-6 space-y-3">
          <button
            className="btn-gold w-full py-4 text-sm font-semibold uppercase tracking-[0.18em]"
            onClick={() => void handleMessage()}
          >
            Send a message
          </button>
          <button
            onClick={() => setShowReportSheet(true)}
            className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
          >
            Report or block
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

      {showReportSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowReportSheet(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border-t border-gold-400/30 bg-ink-950 p-6 pb-safe"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">
              Report or block {u.displayName}
            </p>
            <p className="mt-2 text-sm text-white/70">
              Choose a reason. You can also block below.
            </p>

            <div className="mt-4 space-y-1">
              {REPORT_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleReport(r)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                >
                  {r}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                onClick={handleBlock}
                className="w-full rounded-full border border-red-400/30 bg-red-500/10 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300"
              >
                Block {u.displayName}
              </button>
            </div>

            <button
              onClick={() => setShowReportSheet(false)}
              className="mt-4 w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}

      {reportStatus && (
        <div className="fixed bottom-24 left-0 right-0 mx-auto max-w-xs rounded-full border border-green-400/40 bg-green-900/60 px-4 py-2 text-center text-xs text-green-200">
          {reportStatus}
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
