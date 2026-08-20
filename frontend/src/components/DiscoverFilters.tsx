import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { DiscoveryPreferences } from '../types';

const INTERESTS = [
  'dinner', 'travel', 'live-music', 'art', 'wine', 'wellness', 'fashion', 'fitness',
  'cooking', 'photography', 'books', 'outdoors', 'dancing', 'volunteering', 'tech', 'sports',
];

export function DiscoverFilters({
  open,
  onClose,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: DiscoveryPreferences;
  onApply: (value: DiscoveryPreferences) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const toggleInterest = (slug: string) => {
    setDraft((current) => ({
      ...current,
      interestSlugs: current.interestSlugs.includes(slug)
        ? current.interestSlugs.filter((item) => item !== slug)
        : current.interestSlugs.length < 5
          ? [...current.interestSlugs, slug]
          : current.interestSlugs,
    }));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 280 }} onClick={(event) => event.stopPropagation()} className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-gold-400/25 bg-ink-950 p-6 pb-safe text-white">
            <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20" />
            <div className="flex items-center justify-between"><h2 className="display-heading text-2xl font-light">Discovery filters</h2><button type="button" onClick={onClose} className="min-h-11 px-2 text-xs uppercase tracking-[0.16em] text-white/45">Close</button></div>

            <section className="mt-7">
              <div className="flex items-center justify-between"><span className="label-luxe !mb-0">Age range</span><span className="text-sm text-gold-200">{draft.minAge}–{draft.maxAge === 99 ? '99+' : draft.maxAge}</span></div>
              <label className="mt-5 block text-[10px] uppercase tracking-[0.13em] text-white/35">Minimum age<input type="range" min={18} max={98} value={draft.minAge} onChange={(event) => setDraft((current) => ({ ...current, minAge: Math.min(Number(event.target.value), current.maxAge) }))} className="mt-2 w-full accent-gold-400" /></label>
              <label className="mt-4 block text-[10px] uppercase tracking-[0.13em] text-white/35">Maximum age<input type="range" min={19} max={99} value={draft.maxAge} onChange={(event) => setDraft((current) => ({ ...current, maxAge: Math.max(Number(event.target.value), current.minAge) }))} className="mt-2 w-full accent-gold-400" /></label>
            </section>

            <section className="mt-7 border-t border-white/[0.08] pt-6">
              <label className="label-luxe" htmlFor="distance">Maximum distance</label>
              <select id="distance" value={draft.maxDistanceKm ?? ''} onChange={(event) => setDraft((current) => ({ ...current, maxDistanceKm: event.target.value ? Number(event.target.value) : null }))} className="input-luxe w-full rounded-xl px-3 py-3 text-sm">
                <option value="">Any distance</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="250">250 km</option>
              </select>
              <p className="mt-2 text-[10px] leading-relaxed text-white/35">Distance is shown only when both people have enabled approximate location. SIMP never displays exact coordinates.</p>
            </section>

            <section className="mt-7 border-t border-white/[0.08] pt-6">
              <label className="flex min-h-11 items-center justify-between gap-4"><span><span className="block text-sm font-medium">Verified profiles only</span><span className="mt-1 block text-[10px] text-white/35">Show moderator-approved profiles</span></span><input type="checkbox" checked={draft.verifiedOnly} onChange={(event) => setDraft((current) => ({ ...current, verifiedOnly: event.target.checked }))} className="h-5 w-5 accent-gold-400" /></label>
            </section>

            <section className="mt-7 border-t border-white/[0.08] pt-6">
              <div className="flex items-center justify-between"><span className="label-luxe !mb-0">Shared interests</span><span className="text-[10px] text-white/35">Up to 5</span></div>
              <div className="mt-4 flex flex-wrap gap-2">{INTERESTS.map((slug) => { const active = draft.interestSlugs.includes(slug); return <button key={slug} type="button" onClick={() => toggleInterest(slug)} className={`min-h-10 rounded-full border px-3 py-2 text-xs capitalize ${active ? 'border-gold-400 bg-gold-400/15 text-gold-100' : 'border-white/10 text-white/55'}`}>{slug.replace(/-/g, ' ')}</button>; })}</div>
            </section>

            <div className="mt-8 grid grid-cols-2 gap-3"><button type="button" onClick={() => setDraft({ minAge: 18, maxAge: 99, maxDistanceKm: null, verifiedOnly: false, interestSlugs: [] })} className="rounded-full border border-white/10 py-3 text-xs uppercase tracking-[0.16em] text-white/55">Reset</button><button type="button" disabled={saving} onClick={async () => { setSaving(true); try { await onApply(draft); } finally { setSaving(false); } }} className="btn-gold rounded-full py-3 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-40">{saving ? 'Saving…' : 'Apply'}</button></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
