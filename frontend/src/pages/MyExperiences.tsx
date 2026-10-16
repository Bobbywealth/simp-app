import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMyExperiences, type Experience } from '../api/experiences';
import { getRealtimeSocket } from '../lib/realtime';
import {
  EXPERIENCE_CATEGORY_LABELS,
  categoryGradient,
  experienceStatusLabel,
  experienceStatusStyle,
  formatExperienceDate,
} from '../lib/experiences';
import { SimpLogo } from '../components/SimpLogo';

type Tab = 'hosted' | 'joined';

export default function MyExperiences() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('hosted');
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (role: Tab, silent = false) => {
    const requestId = ++requestIdRef.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await getMyExperiences(role);
      if (requestId !== requestIdRef.current) return;
      setExperiences(res.experiences);
    } catch {
      if (requestId !== requestIdRef.current) return;
      if (!silent) setError('Could not load your experiences. Try again.');
    } finally {
      if (requestId !== requestIdRef.current) return;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  // Silent refresh when experience state changes elsewhere.
  useEffect(() => {
    const socket = getRealtimeSocket();
    const onChange = () => void load(tab, true);
    socket.on('experience:request', onChange);
    socket.on('experience:approved', onChange);
    socket.on('experience:declined', onChange);
    socket.on('experience:cancelled', onChange);
    socket.on('experience:removed', onChange);
    socket.on('experience:guest-left', onChange);
    return () => {
      socket.off('experience:request', onChange);
      socket.off('experience:approved', onChange);
      socket.off('experience:declined', onChange);
      socket.off('experience:cancelled', onChange);
      socket.off('experience:removed', onChange);
      socket.off('experience:guest-left', onChange);
    };
  }, [tab, load]);

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={() => navigate('/experiences')}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
          My experiences
        </h1>
        <div className="w-12" />
      </header>

      <main className="relative z-10 px-6 pt-6 pb-28">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-black/40 p-1">
          {(['hosted', 'joined'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                tab === t ? 'bg-gold-400 text-ink-950' : 'text-white/55 hover:text-white'
              }`}
            >
              {t === 'hosted' ? 'Hosting' : 'Joined'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse gap-4 rounded-2xl border border-white/10 bg-ink-900/60 p-3">
                <div className="h-20 w-20 shrink-0 rounded-xl bg-ink-800" />
                <div className="flex-1 space-y-2 py-1">
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
              onClick={() => void load(tab)}
              className="btn-gold-outline px-6 py-2.5 text-xs uppercase tracking-[0.18em]"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && experiences.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={48} variant="emblem" />
            <h3 className="display-heading text-xl font-light">
              {tab === 'hosted' ? 'Nothing hosted yet' : 'No plans joined yet'}
            </h3>
            <p className="max-w-xs text-sm text-white/60">
              {tab === 'hosted'
                ? 'Plan your first experience and approve who comes.'
                : 'Browse experiences and request a spot at one worth showing up for.'}
            </p>
            <button
              onClick={() => navigate(tab === 'hosted' ? '/experiences/new' : '/experiences')}
              className="btn-gold mt-2 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]"
            >
              {tab === 'hosted' ? 'Host an experience' : 'Browse experiences'}
            </button>
          </div>
        )}

        {!loading && !error && experiences.length > 0 && (
          <div className="space-y-3">
            {experiences.map((exp, i) => (
              <motion.button
                key={exp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.24) }}
                onClick={() => navigate(`/experiences/${exp.id}`)}
                className="flex w-full gap-4 rounded-2xl border border-white/10 bg-ink-900/60 p-3 text-left transition hover:border-gold-400/40"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                  {exp.imageUrl ? (
                    <img
                      src={exp.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryGradient(exp.category)} ${exp.imageUrl ? '-mt-20' : ''}`}>
                      <span className="px-1 text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-200/70">
                        {EXPERIENCE_CATEGORY_LABELS[exp.category]}
                      </span>
                    </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-semibold text-white">{exp.title}</h3>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${experienceStatusStyle(exp.status)}`}>
                      {experienceStatusLabel(exp.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/55">
                    {exp.city} · {formatExperienceDate(exp.startsAt)}
                  </p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-200/80">
                    {exp.approvedCount}/{exp.capacity} spots
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
