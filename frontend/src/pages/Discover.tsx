import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { getDiscovery } from '../api/discovery';
import { createSwipe } from '../api/swipes';
import type { DiscoveryProfile, SwipeAction } from '../types';
import { SimpLogo } from '../components/SimpLogo';

type DeckState = 'loading' | 'ready' | 'empty' | 'error';

const CARD_DECK_LIMIT = 20;

export default function Discover() {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckState>('loading');
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Match modal
  const [matchedProfile, setMatchedProfile] = useState<DiscoveryProfile | null>(null);
  const [matchedNote, setMatchedNote] = useState<string | null>(null);

  // Convince Me modal
  const [pendingLike, setPendingLike] = useState<DiscoveryProfile | null>(null);
  const [convinceText, setConvinceText] = useState('');

  // Earned reveal: per-profile peek state
  const [peekedProfiles, setPeekedProfiles] = useState<Set<string>>(new Set());

  const loadingRef = useRef(false);

  useEffect(() => {
    void loadDeck();
  }, []);

  async function loadDeck() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setDeck('loading');
    setError(null);
    try {
      const res = await getDiscovery();
      setProfiles(res.profiles);
      setTopIndex(0);
      setDeck(res.profiles.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setDeck('error');
    } finally {
      loadingRef.current = false;
    }
  }

  function advanceDeck() {
    if (topIndex < profiles.length - 1) {
      setTopIndex((i) => i + 1);
    } else {
      // Try to load more
      void loadDeck();
    }
  }

  async function doSwipe(profile: DiscoveryProfile, action: SwipeAction, note?: string | null) {
    try {
      const res = await createSwipe({ swipedId: profile.userId, action, note });
      if (res.matched) {
        setMatchedProfile(profile);
        setMatchedNote(note ?? null);
      }
    } catch (e) {
      console.error('swipe failed', e);
    } finally {
      advanceDeck();
    }
  }

  function onSwipeRight(profile: DiscoveryProfile) {
    // Trigger "Convince Me" modal
    setPendingLike(profile);
    setConvinceText('');
  }

  function onSwipeLeft(profile: DiscoveryProfile) {
    void doSwipe(profile, 'PASS');
  }

  function onSwipeUp(profile: DiscoveryProfile) {
    // Superlike also opens Convince Me (it's more emphatic)
    setPendingLike(profile);
    setConvinceText('');
  }

  function confirmSwipe(superLike: boolean) {
    if (!pendingLike) return;
    const profile = pendingLike;
    const note = convinceText.trim() || null;
    setPendingLike(null);
    setConvinceText('');
    void doSwipe(profile, superLike ? 'SUPERLIKE' : 'LIKE', note);
  }

  function cancelSwipe() {
    setPendingLike(null);
    setConvinceText('');
  }

  function togglePeek(profileId: string) {
    setPeekedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  if (deck === 'loading' && profiles.length === 0) {
    return (
      <Scaffold canGoBack onBack={() => navigate('/home')}>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-white/50 text-sm">Curating your deck…</div>
        </div>
      </Scaffold>
    );
  }

  if (deck === 'error') {
    return (
      <Scaffold canGoBack onBack={() => navigate('/home')}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-white/80">{error ?? 'Something went wrong.'}</p>
          <RetryButton onClick={() => loadDeck()}>Try again</RetryButton>
        </div>
      </Scaffold>
    );
  }

  if (deck === 'empty' || topIndex >= profiles.length) {
    return (
      <Scaffold canGoBack onBack={() => navigate('/home')}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <SimpLogo size={64} variant="emblem" />
          <h2 className="display-heading text-2xl font-light text-white">
            You&apos;ve seen everyone.
          </h2>
          <p className="text-sm text-white/60 max-w-xs">
            New curated profiles appear throughout the day. Check back soon.
          </p>
          <ActionButton onClick={() => loadDeck()}>Refresh</ActionButton>
          <ActionButton onClick={() => navigate('/matches')} variant="outline">
            See your matches
          </ActionButton>
        </div>
      </Scaffold>
    );
  }

  // Render the top 3 cards as a stack
  const top = profiles[topIndex];
  const stack: DiscoveryProfile[] = [];
  for (let i = 0; i < 3; i++) {
    const p = profiles[topIndex + i];
    if (p) stack.push(p);
  }

  return (
    <Scaffold canGoBack onBack={() => navigate('/home')}>
      <div className="relative flex-1 px-4 pb-6">
        <div className="relative mx-auto h-full max-w-md min-h-0">
          {stack
            .slice()
            .reverse() // render bottom first
            .map((p, i) => {
              const stackIndex = stack.length - 1 - i; // top card has highest index
              return (
                <SwipeCard
                  key={p.userId}
                  profile={p}
                  isTop={stackIndex === stack.length - 1}
                  stackDepth={stackIndex}
                  peeked={peekedProfiles.has(p.userId)}
                  onTogglePeek={() => togglePeek(p.userId)}
                  onSwipeRight={() => onSwipeRight(p)}
                  onSwipeLeft={() => onSwipeLeft(p)}
                  onSwipeUp={() => onSwipeUp(p)}
                />
              );
            })}
        </div>
      </div>

      <ConvinceMeModal
        open={pendingLike !== null}
        profile={pendingLike}
        text={convinceText}
        onTextChange={setConvinceText}
        onConfirm={confirmSwipe}
        onCancel={cancelSwipe}
        onSkip={() => {
          if (pendingLike) {
            const profile = pendingLike;
            setPendingLike(null);
            setConvinceText('');
            void doSwipe(profile, 'LIKE', null);
          }
        }}
      />

      <MatchModal
        profile={matchedProfile}
        note={matchedNote}
        onClose={() => {
          setMatchedProfile(null);
          setMatchedNote(null);
        }}
        onViewMatches={() => {
          setMatchedProfile(null);
          setMatchedNote(null);
          navigate('/matches');
        }}
      />
    </Scaffold>
  );
}

interface ScaffoldProps {
  canGoBack?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}

function Scaffold({ canGoBack, onBack, children }: ScaffoldProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        {canGoBack ? (
          <button
            onClick={onBack}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            ‹ Back
          </button>
        ) : (
          <span />
        )}
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
          Discover
        </h1>
        <span className="w-12" />
      </header>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
    </div>
  );
}

interface SwipeCardProps {
  profile: DiscoveryProfile;
  isTop: boolean;
  stackDepth: number; // 0 = behind, 1 = middle, 2+ = top
  peeked: boolean;
  onTogglePeek: () => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeUp: () => void;
}

function SwipeCard({
  profile,
  isTop,
  stackDepth,
  peeked,
  onTogglePeek,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);
  const superLikeOpacity = useTransform(y, [-150, -50], [1, 0]);

  const photoUrl = profile.photos[0]?.url;
  const blurPhotos = !peeked && !isTop; // show blurry on stack-below cards (always below)

  // For the top card, photos are blurred by default — user can peek
  const showBlurredTop = isTop && !peeked;

  const handleDragEnd = (_: unknown, info: { offset: { x: number; y: number } }) => {
    const dx = info.offset.x;
    const dy = info.offset.y;
    if (dy < -120 && Math.abs(dx) < 120) {
      onSwipeUp();
    } else if (dx > 120) {
      onSwipeRight();
    } else if (dx < -120) {
      onSwipeLeft();
    }
  };

  return (
    <motion.div
      drag={isTop}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      style={{
        x: isTop ? x : 0,
        y: isTop ? y : stackDepth * 8,
        rotate: isTop ? rotate : 0,
        zIndex: 10 - stackDepth,
      }}
      initial={false}
      animate={{
        scale: 1 - stackDepth * 0.04,
        opacity: stackDepth > 2 ? 0 : 1,
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-x-0 top-0 bottom-0 mx-auto origin-bottom cursor-grab active:cursor-grabbing"
    >
      <div className="relative h-full overflow-hidden rounded-3xl border border-gold-400/15 bg-ink-900 shadow-2xl">
        {photoUrl && (
          <img
            src={photoUrl}
            alt={profile.displayName}
            className={`absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ${
              blurPhotos || showBlurredTop ? 'blur-2xl scale-110' : ''
            }`}
            draggable={false}
          />
        )}

        {/* Earned reveal overlay — gold overlay + CTA when blurred (top card only) */}
        {showBlurredTop && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/40 backdrop-blur-sm">
            <div className="rounded-full border border-gold-400/40 bg-ink-950/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-gold-300">
              Earned Reveal
            </div>
            <p className="mt-3 max-w-[80%] text-center text-sm text-white/80">
              Photos unlock when you match. Take a chance and look.
            </p>
            <button
              onClick={onTogglePeek}
              className="mt-4 rounded-full border border-gold-400/40 bg-gold-400/10 px-5 py-2 text-xs font-medium uppercase tracking-[0.18em] text-gold-200 hover:bg-gold-400/20"
            >
              Tap to peek
            </button>
          </div>
        )}

        {/* Bottom info panel */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pt-20">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="flex items-baseline gap-2 text-2xl font-light text-white">
                {profile.displayName}
                <span className="text-xl text-white/70">{profile.age}</span>
                {profile.isVerified && (
                  <span className="ml-1 rounded-full border border-gold-400/40 bg-gold-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-200">
                    Verified
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-white/60">
                {profile.occupation}
                {profile.occupation && profile.city ? ' · ' : ''}
                {profile.city}
              </p>
            </div>
          </div>

          {profile.bio && (
            <p className="mt-3 line-clamp-2 text-sm text-white/80">{profile.bio}</p>
          )}

          {profile.prompts[0] && (
            <div className="mt-3 rounded-xl border border-gold-400/20 bg-ink-900/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-gold-300">
                {profile.prompts[0].question}
              </p>
              <p className="mt-1 text-sm text-white/90">{profile.prompts[0].answer}</p>
            </div>
          )}

          {profile.interests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 4).map((i) => (
                <span
                  key={i.slug}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-white/70"
                >
                  {i.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Drag indicators */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute left-6 top-6 rounded-lg border-2 border-green-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-green-400"
            >
              Like
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute right-6 top-6 rounded-lg border-2 border-red-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-red-400"
            >
              Pass
            </motion.div>
            <motion.div
              style={{ opacity: superLikeOpacity }}
              className="absolute left-1/2 top-10 -translate-x-1/2 rounded-lg border-2 border-cyan-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-cyan-400"
            >
              Super
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}

interface ConvinceMeModalProps {
  open: boolean;
  profile: DiscoveryProfile | null;
  text: string;
  onTextChange: (s: string) => void;
  onConfirm: (superLike: boolean) => void;
  onCancel: () => void;
  onSkip: () => void;
}

function ConvinceMeModal({
  open,
  profile,
  text,
  onTextChange,
  onConfirm,
  onCancel,
  onSkip,
}: ConvinceMeModalProps) {
  if (!profile) return null;
  const photoUrl = profile.photos[0]?.url;
  const overLimit = text.length > 280;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="convince"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-t-3xl border-t border-gold-400/30 bg-ink-950 p-6 pb-safe"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
            <div className="flex items-center gap-3">
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-gold-400/40"
                />
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Convince Me
                </p>
                <p className="text-sm text-white/80">
                  Why should <span className="text-white">{profile.displayName}</span> match with you?
                </p>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              maxLength={300}
              placeholder="Optional — but a great note makes you 3x more memorable."
              rows={4}
              className="input-luxe mt-4 w-full resize-none rounded-xl border border-white/10 bg-ink-900 p-3 text-sm text-white placeholder:text-white/40"
            />
            <div className={`mt-1 text-right text-[10px] ${overLimit ? 'text-red-400' : 'text-white/40'}`}>
              {text.length} / 280
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => onConfirm(true)}
                className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]"
              >
                Send Super Like
              </button>
              <button
                onClick={() => onConfirm(false)}
                className="btn-gold-outline w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]"
              >
                Send Like
              </button>
              <button
                onClick={onSkip}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white/70"
              >
                Skip the note
              </button>
              <button
                onClick={onCancel}
                className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/30 hover:text-white/50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MatchModalProps {
  profile: DiscoveryProfile | null;
  note: string | null;
  onClose: () => void;
  onViewMatches: () => void;
}

function MatchModal({ profile, note, onClose, onViewMatches }: MatchModalProps) {
  if (!profile) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="match"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative mx-6 max-w-sm rounded-3xl border border-gold-400/40 bg-ink-900 p-6 text-center"
        >
          <div className="absolute inset-x-0 -top-px mx-auto h-1 w-32 rounded-full bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">
            It&apos;s a Match
          </p>
          <h2 className="display-heading mt-2 text-3xl font-light text-white">
            You and {profile.displayName}
          </h2>
          <p className="mt-1 text-sm text-white/70">liked each other</p>

          {profile.photos[0] && (
            <img
              src={profile.photos[0].url}
              alt={profile.displayName}
              className="mx-auto mt-5 h-40 w-40 rounded-full object-cover ring-4 ring-gold-400/40"
            />
          )}

          {note && (
            <div className="mt-5 rounded-xl border border-gold-400/20 bg-ink-950/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">
                Your note
              </p>
              <p className="mt-2 text-sm italic text-white/90">&ldquo;{note}&rdquo;</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <button onClick={onViewMatches} className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]">
              Send a message
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white/70"
            >
              Keep browsing
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'outline';
}) {
  const className =
    variant === 'outline'
      ? 'btn-gold-outline w-full max-w-xs px-6 py-3 text-sm font-medium uppercase tracking-[0.18em]'
      : 'btn-gold w-full max-w-xs px-6 py-3 text-sm font-medium uppercase tracking-[0.18em]';
  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function RetryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-gold-outline px-6 py-3 text-sm font-medium uppercase tracking-[0.18em]">
      {children}
    </button>
  );
}

// Unused but exported for tree-shaking guard
export const _CARD_DECK_LIMIT = CARD_DECK_LIMIT;
