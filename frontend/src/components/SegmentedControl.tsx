import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { haptics } from '../lib/haptics';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  ariaLabel?: string;
}

/**
 * iOS-style segmented control: 2–4 options, sliding gold indicator.
 * Uses framer-motion's layoutId for the sliding pill.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className = '',
  ariaLabel,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  // Measure the active tab to position the sliding indicator
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-value="${value}"]`
    );
    if (!el || !containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setIndicator({
      left: eRect.left - cRect.left + 4, // 4px padding inside container
      width: eRect.width - 8,
    });
  }, [value, options.length]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      ref={containerRef}
      className={`relative grid w-full overflow-hidden rounded-full bg-white/5 p-1 ring-1 ring-white/10 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {indicator && (
        <motion.span
          layoutId="segmented-indicator"
          className="absolute top-1 bottom-1 rounded-full bg-gold-gradient shadow-glow"
          initial={false}
          animate={{ left: indicator.left, width: indicator.width }}
          transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.6 }}
        />
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-value={opt.value}
            onClick={() => {
              if (!active) {
                haptics.selection();
                onChange(opt.value);
              }
            }}
            className={`relative z-10 px-3 py-2 text-[13px] font-semibold tracking-tight transition-colors ${
              active ? 'text-ink-950' : 'text-white/70 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
