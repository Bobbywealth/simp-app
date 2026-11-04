import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listExperiences, type Experience, type ExperienceCategory } from '../api/experiences';
import {
  EXPERIENCE_CATEGORY_LABELS,
  EXPERIENCE_CATEGORY_OPTIONS,
  formatExperienceDate,
  formatExperiencePrice,
} from '../lib/experiences';
import { ExperienceCover } from '../components/ExperienceCover';
import { SimpLogo } from '../components/SimpLogo';

const PAGE_SIZE = 10;

/**
 * Discover = browse experiences. Each card leads with the plan (cover, name,
 * when, where); the host is secondary ("Hosted by …" with a small photo).
 */
export default function Discover() {
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
    async (opts: { category: ExperienceCategory | null; city: string; cursor?: string | null; append?: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (opts.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await listExperiences({
          category: opts.category ?? undefined,
          city: opts.city || undefined,
          cursor: opts.cursor ?? undefined,
          limit: PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return;
        setExperiences((prev) => (opts.append ? [...prev, ...res.experiences] : res.experiences));
        setCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setError('Could not load experiences. Try again.');
      } finally {
        if (opts.append) setLoadingMore(false);
        else if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load({ category, city });
  }, [category, city, load]);

  const showEmpty = !loading && !error && experiences.length === 0;

  return (
    <main className="relative min-h-screen bg-ink-950 pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <div className="relative z-10 mx-auto max-w-xl px-5 pt-safe pt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-300">Discover</p>
        <h1 className="display-heading mt-2 text-3xl font-light">What do you feel like doing?</h1>
        <p className="mt-1 text-sm text-white/55">Pick a plan. Ask to join. Meet the people behind it.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCity(cityInput.trim());
          }}
          className="mt-5"
        >
          <input
            value={cityInput}
            onChange={(e) => {
              setCityInput(e.target.value);
              if (!e.target.value.trim()) setCity('');
            }}
            placeholder="Search by city…"
            aria-label="Search experiences by city"
            className="input-luxe w-full"
          />
        </form>

        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {[{ value: null, label: 'All' }, ...EXPERIENCE_CATEGORY_OPTIONS].map((opt) => (
            <button
              key={opt.value ?? 'all'}
              aria-pressed={category === opt.value}
              onClick={() => setCategory(category === opt.value ? null : opt.value)}
              className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm transition ${
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
          <div className="mt-6 space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-3xl bg-ink-800" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-white/60">{error}</p>
            <button onClick={() => void load({ category, city })} className="btn-gold-outline px-6 py-2.5 text-xs uppercase tracking-[0.18em]">
              Retry
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={48} variant="emblem" />
            <h2 className="display-heading text-xl font-light">No plans here yet</h2>
            <p className="max-w-xs text-sm text-white/60">
              {city || category ? 'Nothing matches those filters. Try another city or type.' : 'Be the first to plan something worth showing up for.'}
            </p>
            <button onClick={() => navigate('/experiences/new')} className="btn-gold mt-2 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]">
              Host a plan
            </button>
          </div>
        )}

        {!loading && !error && experiences.length > 0 && (
          <div className="mt-6 space-y-6">
            {experiences.map((exp, i) => (
              <DiscoverCard key={exp.id} experience={exp} index={i} onOpen={() => navigate(`/experiences/${exp.id}`)} />
            ))}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => void load({ category, city, cursor, append: true })}
                  disabled={loadingMore}
                  className="btn-gold-outline px-8 py-3 text-xs uppercase tracking-[0.18em] disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Show more plans'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      <button
        onClick={() => navigate('/experiences/new')}
        aria-label="Host a new experience"
        className="simp-host-fab fixed right-6 z-30 flex h-14 items-center gap-2 rounded-full bg-gold-gradient px-5 text-sm font-bold text-ink-950 shadow-[0_18px_40px_-12px_rgba(214,172,63,0.6)] transition active:scale-95"
      >
        <span className="text-xl leading-none">+</span> Host
      </button>
    </main>
  );
}

function DiscoverCard({ experience, index, onOpen }: { experience: Experience; index: number; onOpen: () => void }) {
  const price = formatExperiencePrice(experience.priceCents, experience.currency);
  const spotsLeft = experience.capacity ? Math.max(0, experience.capacity - experience.approvedCount) : null;
  const hostName = experience.host.displayName ?? 'a SIMP member';

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.3) }}
    >
      <button
        onClick={onOpen}
        aria-label={`${experience.title}, ${EXPERIENCE_CATEGORY_LABELS[experience.category]} in ${experience.city}. Hosted by ${hostName}`}
        className="group relative block aspect-[4/5] w-full md:aspect-[16/10] overflow-hidden rounded-3xl border border-white/10 text-left shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] transition hover:border-gold-400/40"
      >
        <ExperienceCover
          imageUrl={experience.imageUrl}
          category={experience.category}
          title={experience.title}
          className="absolute inset-0 transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/30" aria-hidden />

        <div className="absolute inset-x-4 top-4 flex items-start justify-between">
          <span className="rounded-full border border-gold-300/40 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur">
            {EXPERIENCE_CATEGORY_LABELS[experience.category]}
          </span>
          {price ? (
            <span className="rounded-full bg-gold-400 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-950">{price}</span>
          ) : (
            <span className="rounded-full border border-white/20 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur">Free</span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="display-heading text-3xl font-light leading-tight">{experience.title}</h2>
          <p className="mt-2 text-sm text-white/80">
            {formatExperienceDate(experience.startsAt)}
          </p>
          <p className="text-sm text-white/60">
            {experience.venue ? `${experience.venue} · ` : ''}
            {experience.city}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/15 pt-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <HostAvatar name={experience.host.displayName} photoUrl={experience.host.photoUrl} />
              <p className="truncate text-xs text-white/70">
                Hosted by <span className="font-medium text-white">{hostName}</span>
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-200">
              {spotsLeft === null
                ? `${experience.approvedCount} joined`
                : spotsLeft === 0
                  ? 'Full'
                  : `${spotsLeft} ${spotsLeft === 1 ? 'spot' : 'spots'} left`}
            </span>
          </div>
        </div>
      </button>
    </motion.article>
  );
}

function HostAvatar({ name, photoUrl }: { name: string | null; photoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = ((name ?? '').charAt(0) || '?').toUpperCase();
  return photoUrl && !failed ? (
    <img src={photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/30 object-cover" onError={() => setFailed(true)} />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-ink-700 text-xs text-white/70">{initial}</span>
  );
}
