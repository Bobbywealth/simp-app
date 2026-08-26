import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export interface PhotoCarouselImage {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
}

interface PhotoCarouselProps {
  photos: PhotoCarouselImage[];
  /** Show navigation arrows + dot indicator (desktop). On mobile the
   * carousel is still swipeable but arrows are hidden. */
  showArrows?: boolean;
  /** Optional overlay rendered below the carousel image. */
  overlay?: React.ReactNode;
  /** When the user changes photo. */
  onIndexChange?: (index: number) => void;
  /** When the carousel only has one image, this fallback fills the slot. */
  emptyState?: React.ReactNode;
}

export function PhotoCarousel({
  photos,
  showArrows = true,
  overlay,
  onIndexChange,
  emptyState,
}: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const total = photos.length;
  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [total, index]);
  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const touchStartX = useRef<number | null>(null);

  if (total === 0) {
    return (
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900/60">
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          {emptyState ?? (
            <p className="text-sm text-white/50">Add a photo to start matching.</p>
          )}
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(index, total - 1);
  const photo = photos[safeIndex]!;

  function go(delta: number) {
    setIndex((current) => {
      const next = (current + delta + total) % total;
      onIndexChange?.(next);
      return next;
    });
  }

  return (
    <div
      className="relative aspect-[3/4] w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black/50 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
      onTouchStart={(e) => (touchStartX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const end = e.changedTouches[0]?.clientX ?? start;
        const dx = end - start;
        if (Math.abs(dx) < 40) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.img
          key={photo.id}
          src={photo.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        />
      </AnimatePresence>
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/40 to-transparent" />
      {overlay}
      {total > 1 && (
        <>
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {photos.map((p, i) => (
              <span
                key={p.id}
                className={`h-1 flex-1 rounded-full transition-all ${i === safeIndex ? 'bg-white/95' : 'bg-white/25'}`}
              />
            ))}
          </div>
          {showArrows && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition hover:bg-black/65 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition hover:bg-black/65 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur">
            {safeIndex + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
}
