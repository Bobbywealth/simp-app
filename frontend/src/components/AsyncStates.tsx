import { motion } from 'framer-motion';

/**
 * Shared async-state primitives for SIMP pages. Use these instead of
 * re-implementing the same loading / error / empty markup in every
 * page so the visual language stays consistent and pages can focus
 * on their actual data flow.
 *
 * Three primitives:
 * - <AsyncLoading> — spinner + label
 * - <AsyncError>   — error message + retry button
 * - <AsyncEmpty>   — friendly empty state with optional CTA
 *
 * All three respect prefers-reduced-motion globally (handled at the
 * App.tsx MotionConfig boundary).
 */

interface AsyncErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function AsyncError({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }: AsyncErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <span aria-hidden="true" className="text-3xl">⚠️</span>
      <h3 className="text-sm font-semibold text-white/85">{title}</h3>
      <p className="max-w-xs text-xs leading-relaxed text-white/55">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-gold-outline mt-2 px-6 py-2 text-xs font-semibold uppercase tracking-[0.15em]"
        >
          {retryLabel}
        </button>
      )}
    </motion.div>
  );
}

interface AsyncEmptyProps {
  icon?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function AsyncEmpty({ icon = '✨', title, description, ctaLabel, onCta }: AsyncEmptyProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <span aria-hidden="true" className="text-3xl">{icon}</span>
      <h3 className="text-sm font-semibold text-white/85">{title}</h3>
      {description && <p className="max-w-xs text-xs leading-relaxed text-white/55">{description}</p>}
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="btn-gold mt-2 px-6 py-2 text-xs font-semibold uppercase tracking-[0.15em]"
        >
          {ctaLabel}
        </button>
      )}
    </motion.div>
  );
}

interface AsyncLoadingProps {
  label?: string;
  compact?: boolean;
}

export function AsyncLoading({ label = 'Loading…', compact = false }: AsyncLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        compact
          ? 'flex items-center justify-center gap-2 px-4 py-2 text-xs text-white/55'
          : 'flex flex-col items-center justify-center gap-3 px-6 py-10 text-xs text-white/55'
      }
    >
      <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      <span>{label}</span>
    </div>
  );
}
