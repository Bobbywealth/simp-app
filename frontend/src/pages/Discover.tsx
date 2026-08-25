import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { getDiscovery } from '../api/discovery';
import { createSwipe, undoSwipe } from '../api/swipes';
import { blockUser, reportUser, REPORT_REASONS, type ReportReason } from '../api/moderation';
import type { DiscoveryPreferences, DiscoveryProfile, SwipeAction } from '../types';
import { getDiscoveryPreferences, updateDiscoveryPreferences } from '../api/users';
import { track, trackMilestone } from '../api/analytics';
import { SimpLogo } from '../components/SimpLogo';
import { DiscoverFilters } from '../components/DiscoverFilters';

type DeckState = 'loading' | 'ready' | 'empty' | 'error';

interface SwipedRecord {
  swipeId: string;
  profile: DiscoveryProfile;
}

export default function Discover() {
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckState>('loading');
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<DiscoveryPreferences>({
    minAge: 18, maxAge: 99, maxDistanceKm: null, verifiedOnly: false, interestSlugs: [],
  });
  const [showFilters, setShowFilters] = useState(false);

  const [matchedProfile, setMatchedProfile] = useState<DiscoveryProfile | null>(null);
  const [matchedNote, setMatchedNote] = useState<string | null>(null);

  const [pendingLike, setPendingLike] = useState<DiscoveryProfile | null>(null);
  const [convinceText, setConvinceText] = useState('');

  const [peekedProfiles, setPeekedProfiles] = useState<Set<string>>(new Set());

  const [swipeHistory, setSwipeHistory] = useState<SwipedRecord[]>([]);

  const [photoIndex, setPhotoIndex] = useState<Record<string, number>>({});

  const [reportTarget, setReportTarget] = useState<DiscoveryProfile | null>(null);

  const loadingRef = useRef(false);

  useEffect(() => {
    void getDiscoveryPreferences()
      .then((saved) => {
        setFilters(saved);
        return loadDeck(true, saved);
      })
      .catch(() => loadDeck(true));
    // Initial load only; applying filters explicitly reloads the deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDeck(reset: boolean, activeFilters: DiscoveryPreferences = filters) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setDeck((prev) => (profiles.length === 0 ? 'loading' : prev));
    setError(null);
    try {
      const res = await getDiscovery({
        minAge: activeFilters.minAge,
        maxAge: activeFilters.maxAge,
        cursor: reset ? undefined : nextCursor ?? undefined,
        limit: 20,
      });
      if (reset) {
        setProfiles(res.profiles);
        setTopIndex(0);
        setSwipeHistory([]);
      } else {
        setProfiles((prev) => [...prev, ...res.profiles]);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setDeck(res.profiles.length === 0 ? 'empty' : 'ready');
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      setDeck('error');
    } finally {
      loadingRef.current = false;
    }
  }

  async function loadMore() {
    if (!hasMore || loadingRef.current) return;
    await loadDeck(false);
  }

  function advanceDeck() {
    if (topIndex < profiles.length - 1) {
      setTopIndex((i) => i + 1);
    } else if (hasMore) {
      void loadMore();
    } else {
      setDeck('empty');
    }
  }

  async function doSwipe(profile: DiscoveryProfile, action: SwipeAction, note?: string | null) {
    try {
      const res = await createSwipe({ swipedId: profile.userId, action, note });
      setSwipeHistory((prev) => [...prev, { swipeId: res.swipeId, profile }]);
      if (res.matched) {
        setMatchedProfile(profile);
        setMatchedNote(note ?? null);
        void track('match_created');
        void trackMilestone('first_match');
      }
      // Per-action discovery events for granular funnel analysis.
      const actionEvent =
        action === 'PASS' ? 'discovery_pass' :
        action === 'LIKE' ? 'discovery_like' :
        action === 'SUPERLIKE' ? 'discovery_super_like' : 'discovery_pass';
      void track(actionEvent);
      // Generic discovery_swipe covers all actions for the high-level funnel.
      void track('discovery_swipe', { action });
      void trackMilestone('first_swipe', { action });
      advanceDeck();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onSwipeLeft(profile: DiscoveryProfile) {
    void doSwipe(profile, 'PASS');
  }

  function onSwipeRight(profile: DiscoveryProfile) {
    // Right-swipe (LIKE) is the most common path through the funnel.
    void doSwipe(profile, 'LIKE');
  }

  function onSwipeUp(profile: DiscoveryProfile) {
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

  function skipSwipeNote() {
    if (!pendingLike) return;
    const profile = pendingLike;
    setPendingLike(null);
    setConvinceText('');
    void doSwipe(profile, 'LIKE', null);
  }

  async function handleUndo() {
    const last = swipeHistory[swipeHistory.length - 1];
    if (!last) return;
    try {
      await undoSwipe(last.swipeId);
      setSwipeHistory((prev) => prev.slice(0, -1));
      setTopIndex((i) => Math.max(0, i - 1));
    } catch (e) {
      console.error('undo failed', e);
    }
  }

  async function handleBlock() {
    if (!reportTarget) return;
    try {
      await blockUser(reportTarget.userId);
      setReportTarget(null);
      advanceDeck();
    } catch (e) {
      console.error('block failed', e);
    }
  }

  async function handleReport(reason: ReportReason) {
    if (!reportTarget) return;
    try {
      await reportUser(reportTarget.userId, reason);
      setReportTarget(null);
      advanceDeck();
    } catch (e) {
      console.error('report failed', e);
    }
  }

  function togglePeek(profileId: string) {
    setPeekedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function cyclePhoto(profileId: string, direction: 1 | -1, max: number) {
    setPhotoIndex((prev) => {
      const current = prev[profileId] ?? 0;
      const next = (current + direction + max) % max;
      return { ...prev, [profileId]: next };
    });
  }

  if (deck === 'loading' && profiles.length === 0) {
    return <DiscoverSkeleton />;
  }

  if (deck === 'error') {
    return (
      <Scaffold onBack={() => navigate('/home')} showFilters={() => setShowFilters(true)}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm text-white/80">{error ?? 'Something went wrong.'}</p>
          <button
            onClick={() => loadDeck(true)}
            className="btn-gold-outline px-5 py-2 text-xs font-medium uppercase tracking-[0.18em]"
          >
            Try again
          </button>
        </div>
      </Scaffold>
    );
  }

  if (deck === 'empty' || topIndex >= profiles.length) {
    return (
      <Scaffold onBack={() => navigate('/home')} showFilters={() => setShowFilters(true)}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <SimpLogo size={64} variant="emblem" />
          <h2 className="display-heading text-2xl font-light text-white">
            You&apos;ve seen everyone nearby.
          </h2>
          <p className="text-sm text-white/60 max-w-xs">
            New curated profiles appear throughout the day. Try one of these to keep going:
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => loadDeck(true)}
              className="btn-gold w-full py-3 text-sm font-medium uppercase tracking-[0.18em]"
              aria-label="Refresh discovery deck with new profiles"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowFilters(true)}
              className="btn-gold-outline w-full py-3 text-sm font-medium uppercase tracking-[0.18em]"
              aria-label="Open filters to expand your discovery radius or age range"
            >
              Expand filters
            </button>
          </div>
          <p className="mt-2 text-xs text-white/40 max-w-xs">
            SIMP refreshes new profiles every 30 minutes. Come back soon — your next match could be loading.
          </p>
        </div>
      </Scaffold>
    );
  }

  const top = profiles[topIndex];
  if (!top) {
    return (
      <Scaffold onBack={() => navigate('/home')} showFilters={() => setShowFilters(true)}>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-white/50 text-sm">Loading more…</div>
        </div>
      </Scaffold>
    );
  }
  const stack: DiscoveryProfile[] = [];
  for (let i = 0; i < 3; i++) {
    const p = profiles[topIndex + i];
    if (p) stack.push(p);
  }

  const canUndo = swipeHistory.length > 0;

  return (
    <Scaffold
      onBack={() => navigate('/home')}
      showFilters={() => setShowFilters(true)}
      hasFilters={filters.minAge !== 18 || filters.maxAge !== 99 || filters.maxDistanceKm !== null || filters.verifiedOnly || filters.interestSlugs.length > 0}
    >
      <div className="flex flex-col flex-1 pb-20">
        <div className="relative mx-auto w-full flex-1 max-w-md px-4">
          {stack
            .slice()
            .reverse()
            .map((p, i) => {
              const stackIndex = stack.length - 1 - i;
              return (
                <SwipeCard
                  key={p.userId}
                  profile={p}
                  isTop={stackIndex === stack.length - 1}
                  stackDepth={stackIndex}
                  peeked={peekedProfiles.has(p.userId)}
                  photoIndex={photoIndex[p.userId] ?? 0}
                  onTogglePeek={() => togglePeek(p.userId)}
                  onCyclePhoto={(dir) => cyclePhoto(p.userId, dir, p.photos.length)}
                  onSwipeRight={() => onSwipeRight(p)}
                  onSwipeLeft={() => onSwipeLeft(p)}
                  onSwipeUp={() => onSwipeUp(p)}
                />
              );
            })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 px-4">
          <ActionButton
            onClick={handleUndo}
            disabled={!canUndo}
            variant="circle"
            label="Undo"
            title="Undo last swipe"
          >
            ↺
          </ActionButton>
          <ActionButton onClick={() => onSwipeLeft(top)} variant="circle" tone="red" label="Pass" title="Pass">
            ✕
          </ActionButton>
          <ActionButton
            onClick={() => onSwipeUp(top)}
            variant="circle"
            tone="cyan"
            label="Super"
            title="Super Like"
          >
            ★
          </ActionButton>
          <ActionButton
            onClick={() => onSwipeRight(top)}
            variant="circle"
            tone="green"
            label="Like"
            title="Like (with note)"
          >
            ♥
          </ActionButton>
          <ActionButton
            onClick={() => setReportTarget(top)}
            variant="circle"
            label="Report"
            title="Report or block"
          >
            ⋯
          </ActionButton>
        </div>
      </div>

      <DiscoverFilters
        open={showFilters}
        onClose={() => setShowFilters(false)}
        value={filters}
        onApply={async (nextFilters) => {
          const saved = await updateDiscoveryPreferences(nextFilters);
          setFilters(saved);
          setShowFilters(false);
          await loadDeck(true, saved);
        }}
      />

      <ConvinceMeModal
        open={pendingLike !== null}
        profile={pendingLike}
        text={convinceText}
        onTextChange={setConvinceText}
        onConfirm={confirmSwipe}
        onCancel={cancelSwipe}
        onSkip={skipSwipeNote}
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

      {error && deck === 'ready' && (
        <button type="button" onClick={() => setError(null)} className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-red-400/25 bg-red-950/95 px-4 py-3 text-left text-xs text-red-100 shadow-xl" role="alert">
          {error}
        </button>
      )}

      <ReportModal
        profile={reportTarget}
        onClose={() => setReportTarget(null)}
        onReport={handleReport}
        onBlock={handleBlock}
      />
    </Scaffold>
  );
}

interface ScaffoldProps {
  children: React.ReactNode;
  onBack: () => void;
  showFilters?: () => void;
  hasFilters?: boolean;
}

function Scaffold({ children, onBack, showFilters, hasFilters }: ScaffoldProps) {
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
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">Discover</h1>
        <button
          onClick={showFilters}
          className={`text-xs font-medium uppercase tracking-[0.2em] ${
            hasFilters ? 'text-gold-300' : 'text-white/60 hover:text-white'
          }`}
        >
          {hasFilters ? 'Active' : 'Filters'}
        </button>
      </header>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
    </div>
  );
}

interface SwipeCardProps {
  profile: DiscoveryProfile;
  isTop: boolean;
  stackDepth: number;
  peeked: boolean;
  photoIndex: number;
  onTogglePeek: () => void;
  onCyclePhoto: (direction: 1 | -1) => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSwipeUp: () => void;
}

function SwipeCard({
  profile,
  isTop,
  stackDepth,
  peeked,
  photoIndex,
  onTogglePeek,
  onCyclePhoto,
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

  const photo = profile.photos[photoIndex];
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
      className="absolute inset-x-0 top-0 mx-auto h-full origin-bottom cursor-grab active:cursor-grabbing"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-gold-400/15 bg-ink-900 shadow-2xl">
        <div className="relative flex-1 overflow-hidden">
          {photo && (
            <img
              src={photo.url}
              alt={profile.displayName}
              className={`absolute inset-0 h-full w-full object-cover transition-[filter] duration-300 ${
                showBlurredTop ? 'blur-md scale-100' : ''
              }`}
              draggable={false}
            />
          )}

          {profile.photos.length > 1 && !showBlurredTop && (
            <div className="absolute left-0 right-0 top-2 flex gap-1 px-2">
              {profile.photos.map((p, i) => (
                <div
                  key={p.id}
                  className={`h-1 flex-1 rounded-full transition ${
                    i === photoIndex ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          )}

          {isTop && profile.photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCyclePhoto(-1);
                }}
                className="absolute left-0 top-10 bottom-16 w-1/3"
                aria-label="Previous photo"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCyclePhoto(1);
                }}
                className="absolute right-0 top-10 bottom-16 w-1/3"
                aria-label="Next photo"
              />
            </>
          )}

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

          {isTop && (
            <>
              <motion.div
                style={{ opacity: likeOpacity }}
                className="pointer-events-none absolute left-6 top-12 rounded-lg border-2 border-green-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-green-400"
              >
                Like
              </motion.div>
              <motion.div
                style={{ opacity: nopeOpacity }}
                className="pointer-events-none absolute right-6 top-12 rounded-lg border-2 border-red-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-red-400"
              >
                Pass
              </motion.div>
              <motion.div
                style={{ opacity: superLikeOpacity }}
                className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg border-2 border-cyan-400 px-3 py-1 text-2xl font-bold uppercase tracking-wider text-cyan-400"
              >
                Super
              </motion.div>
            </>
          )}
        </div>

        <div className="max-h-[40%] overflow-y-auto bg-gradient-to-t from-black via-black/80 to-transparent px-5 pb-4 pt-6">
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
            {profile.distanceKm ? ` · ${profile.distanceKm} km away` : ''}
          </p>

          {profile.bio && <p className="mt-3 line-clamp-3 text-sm text-white/80">{profile.bio}</p>}

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
      </div>
    </motion.div>
  );
}

interface ActionButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'outline' | 'circle';
  disabled?: boolean;
  tone?: 'red' | 'green' | 'cyan';
  label?: string;
  title?: string;
}

function ActionButton({ children, onClick, variant, disabled, tone, label, title }: ActionButtonProps) {
  if (variant === 'circle') {
    const toneClasses: Record<string, string> = {
      red: 'border-red-400/40 text-red-400 hover:bg-red-400/10',
      green: 'border-green-400/40 text-green-400 hover:bg-green-400/10',
      cyan: 'border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/10',
    };
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={label}
        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-ink-900 text-lg transition disabled:opacity-30 disabled:cursor-not-allowed ${
          tone ? toneClasses[tone] : 'border-white/20 text-white/60 hover:bg-white/10'
        }`}
      >
        {children}
      </button>
    );
  }
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

interface ConvinceMeModalProps {
  open: boolean;
  profile: DiscoveryProfile | null;
  text: string;
  onTextChange: (s: string) => void;
  onConfirm: (superLike: boolean) => void;
  onCancel: () => void;
  onSkip: () => void;
}

function ConvinceMeModal({ open, profile, text, onTextChange, onConfirm, onCancel, onSkip }: ConvinceMeModalProps) {
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
              <button onClick={() => onConfirm(true)} className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]">
                Send Super Like
              </button>
              <button onClick={() => onConfirm(false)} className="btn-gold-outline w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]">
                Send Like
              </button>
              <button onClick={onSkip} className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white/70">
                Skip the note
              </button>
              <button onClick={onCancel} className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/30 hover:text-white/50">
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
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">It&apos;s a Match</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">Your note</p>
              <p className="mt-2 text-sm italic text-white/90">&ldquo;{note}&rdquo;</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <button onClick={onViewMatches} className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]">
              Send a message
            </button>
            <button onClick={onClose} className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white/70">
              Keep browsing
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DiscoverSkeleton() {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <span className="w-12 text-xs text-white/40">‹ Back</span>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">Discover</h1>
        <span className="w-12 text-xs text-white/40">Filters</span>
      </header>
      <main className="relative z-10 flex flex-1 flex-col px-4 pb-20">
        <div className="mt-4 max-w-md mx-auto w-full">
          <div className="aspect-[3/4] w-full animate-pulse rounded-3xl bg-ink-800" />
          <div className="mt-4 flex justify-center gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-12 animate-pulse rounded-full bg-ink-800" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

interface ReportModalProps {
  profile: DiscoveryProfile | null;
  onClose: () => void;
  onReport: (reason: ReportReason) => void;
  onBlock: () => void;
}

function ReportModal({ profile, onClose, onReport, onBlock }: ReportModalProps) {
  if (!profile) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="report"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
            Report or block {profile.displayName}
          </p>
          <p className="mt-2 text-sm text-white/70">
            Blocking removes them from your deck. Reports send a private note to our team.
          </p>

          <div className="mt-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Report reason</p>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => onReport(r)}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
              >
                {r}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <button
              onClick={onBlock}
              className="w-full rounded-full border border-red-400/30 bg-red-500/10 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300 hover:bg-red-500/20"
            >
              Block {profile.displayName}
            </button>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
          >
            Cancel
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
