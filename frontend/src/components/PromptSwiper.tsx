import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { DiscoveryPrompt } from '../types';

interface PromptSwiperProps {
  prompts: DiscoveryPrompt[];
  className?: string;
}

/**
 * Single-prompt-at-a-time horizontal carousel with peek-sides preview.
 * One prompt dominates the center column; the previous/next prompts are
 * 70% scale, 60% opacity, peeking on the sides.
 */
export function PromptSwiper({ prompts, className = '' }: PromptSwiperProps) {
  const [index, setIndex] = useState(0);
  const total = prompts.length;
  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [total, index]);
  const touchStartX = useRef<number | null>(null);

  if (total === 0) return null;
  const safeIndex = Math.min(index, total - 1);
  const prompt = prompts[safeIndex]!;
  const prev = prompts[(safeIndex - 1 + total) % total];
  const next = prompts[(safeIndex + 1) % total];

  function go(delta: number) {
    setIndex((current) => (current + delta + total) % total);
  }

  return (
    <div className={className}>
      <div
        className="relative h-44 overflow-hidden"
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
        {/* Peek previous */}
        {prev && prev !== prompt && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous prompt"
            className="absolute inset-y-0 left-0 w-1/3 scale-[0.7] origin-left opacity-40 transition hover:opacity-65"
          >
            <PromptCard prompt={prev} variant="ghost" />
          </button>
        )}
        {/* Peek next */}
        {next && next !== prompt && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next prompt"
            className="absolute inset-y-0 right-0 w-1/3 scale-[0.7] origin-right opacity-40 transition hover:opacity-65"
          >
            <PromptCard prompt={next} variant="ghost" />
          </button>
        )}
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={prompt.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center px-2"
          >
            <PromptCard prompt={prompt} variant="active" />
          </motion.div>
        </AnimatePresence>
      </div>
      {total > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {prompts.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Prompt ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-6 bg-gold-300' : 'w-1.5 bg-white/25 hover:bg-white/45'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  variant,
}: {
  prompt: DiscoveryPrompt;
  variant: 'active' | 'ghost';
}) {
  const isGhost = variant === 'ghost';
  return (
    <div
      className={`flex h-full w-full flex-col justify-center rounded-3xl border px-5 py-5 text-left transition ${
        isGhost
          ? 'border-white/8 bg-ink-900/45 backdrop-blur-sm'
          : 'border-gold-400/30 bg-gradient-to-br from-ink-900/85 via-ink-900/65 to-ink-950/85 shadow-[0_18px_55px_rgba(212,169,58,0.12)] backdrop-blur-sm'
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${isGhost ? 'text-gold-300/55' : 'text-gold-300'}`}>
        {prompt.question}
      </p>
      <p className={`mt-2 font-display text-[17px] leading-snug ${isGhost ? 'text-white/55' : 'text-white'}`}>
        {prompt.answer}
      </p>
    </div>
  );
}
