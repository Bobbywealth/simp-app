import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  listExperiences,
  type Experience,
  type ExperienceCategory,
} from '../api/experiences';
import {
  EXPERIENCE_CATEGORY_LABELS,
  EXPERIENCE_CATEGORY_OPTIONS,
  categoryGradient,
  formatExperienceDate,
  formatExperiencePrice,
} from '../lib/experiences';
import { SimpLogo } from '../components/SimpLogo';

const PAGE_SIZE = 12;

export default function Experiences() {
  const navigate = useNavigate();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [category, setCategory] = useState<ExperienceCategory | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [city, setCity] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (opts: {
      category: ExperienceCategory | null;
      city: string;
      cursor?: string | null;
      append?: boolean;
    }) => {
      const requestId = ++requestIdRef.current;
      if (opts.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await listExperiences({
          category: opts.category ?? undefined,
          city: opts.city || undefined,
          cursor: opts.cursor ?? undefined,
          limit: PAGE_SIZE,
        });
        // Ignore stale responses from superseded requests.
        if (requestId !== requestIdRef.current) return;
        setExperiences((prev) => (opts.append ? [...prev, ...res.experiences] : res.experiences));
        setCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setError('Could not load experiences. Try again.');
      } finally {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({ category, city });
  }, [category, city, load]);

  function selectCategory(next: ExperienceCategory | null) {
    setCategory(next);
  }

  function submitCity(e: React.FormEvent) {
    e.preventDefault();
    setCity(cityInput.trim());
  }

  function loadMore() {
    void load({ category, city, cursor, append: true });
  }

  const showEmpty = !loading && !error && experiences.length === 0;

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={() => navigate('/home')}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
          Experiences
        </h1>
        <button
          onClick={() => navigate('/experiences/mine')}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          Mine
        </button>
      </header>

      <main className="relative z-10 px-6 pt-6 pb-28">
        <div className="mb-6">
          <h2 className="display-heading text-2xl font-light">Host the date, not just the match</h2>
          <p className="mt-1 text-sm text-white/60">
            Real plans, hosted by real people. Request a spot and show up.
          </p>
        </div>

        <form onSubmit={submitCity} className="mb-4">
          <div className="relative">
            <input
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              placeholder="Search by city…"
              aria-label="Search experiences by city"
              className="input-luxe w-full pr-12"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-gold-400 text-ink-950 transition hover:bg-gold-300"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </button>
          </div>
        </form>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => selectCategory(null)}
            className={`min-h-10 rounded-full border px-4 py-2 text-sm transition ${
              category === null
                ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                : 'border-white/10 text-white/55 hover:border-white/20'
            }`}
          >
            All
          </button>
          {EXPERIENCE_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => selectCategory(category === opt.value ? null : opt.value)}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm transition ${
                category === opt.value
                  ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                  : 'border-white/10 text-white/55 hover:border-white/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60">
                <div className="aspect-[16/10] bg-ink-800" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-ink-800" />
                  <div className="h-3 w-1/2 rounded bg-ink-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-white/60">{error}</p>
            <button
              onClick={() => void load({ category, city })}
              className="btn-gold-outline px-6 py-2.5 text-xs uppercase tracking-[0.18em]"
            >
              Retry
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={48} variant="emblem" />
            <h3 className="display-heading text-xl font-light">No experiences yet</h3>
            <p className="max-w-xs text-sm text-white/60">
              {city || category
                ? 'Nothing matches those filters. Try another city or category.'
                : 'Be the first to plan something worth showing up for.'}
            </p>
            <button
              onClick={() => navigate('/experiences/new')}
              className="btn-gold mt-2 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Host your own
            </button>
          </div>
        )}

        {!loading && !error && experiences.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {experiences.map((exp, i) => (
                <ExperienceCard key={exp.id} experience={exp} index={i} onOpen={() => navigate(`/experiences/${exp.id}`)} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn-gold-outline px-8 py-3 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <button
        onClick={() => navigate('/experiences/new')}
        aria-label="Host a new experience"
        className="fixed bottom-6 right-6 z-30 flex h-14 items-center gap-2 rounded-full bg-gold-gradient px-5 text-sm font-bold text-ink-950 shadow-[0_18px_40px_-12px_rgba(214,172,63,0.6)] transition active:scale-95"
      >
        <span className="text-xl leading-none">+</span> Host
      </button>
    </div>
  );
}

function ExperienceCard({
  experience,
  index,
  onOpen,
}: {
  experience: Experience;
  index: number;
  onOpen: () => void;
}) {
  const price = formatExperiencePrice(experience.priceCents, experience.currency);
  const spotsLeft = Math.max(0, experience.capacity - experience.approvedCount);

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      onClick={onOpen}
      className="w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 text-left transition hover:border-gold-400/40"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {experience.imageUrl ? (
          <img src={experience.imageUrl} alt={experience.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryGradient(experience.category)}`}>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-200/70">
              {EXPERIENCE_CATEGORY_LABELS[experience.category]}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full border border-gold-300/40 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-200 backdrop-blur">
          {EXPERIENCE_CATEGORY_LABELS[experience.category]}
        </span>
        {price && (
          <span className="absolute right-3 top-3 rounded-full bg-gold-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-950">
            {price}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-white">{experience.title}</h3>
        <p className="mt-1 text-xs text-white/55">
          {experience.city} · {formatExperienceDate(experience.startsAt)}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            {experience.host.photoUrl ? (
              <img src={experience.host.photoUrl} alt={experience.host.displayName} className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-700 text-[10px] text-white/60">
                {(experience.host.displayName.charAt(0) || '?').toUpperCase()}
              </span>
            )}
            <span className="truncate text-xs text-white/70">{experience.host.displayName}</span>
          </div>
          <span className={`shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] ${spotsLeft === 0 ? 'text-white/40' : 'text-gold-200'}`}>
            {experience.approvedCount}/{experience.capacity} spots
          </span>
        </div>
      </div>
    </motion.button>
  );
}
