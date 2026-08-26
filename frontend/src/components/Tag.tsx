import type { CSSProperties } from 'react';

interface TagProps {
  label: string;
  /** Selected / active variant (used in edit mode). */
  active?: boolean;
  /** Dismissible variant. */
  onRemove?: () => void;
  /** Custom click handler. */
  onClick?: () => void;
  /** Tailwind size preset. */
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

export function Tag({
  label,
  active,
  onRemove,
  onClick,
  size = 'md',
  className = '',
  style,
}: TagProps) {
  const sizing =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[10px]'
      : 'px-3 py-1 text-xs';
  const tone = active
    ? 'border-gold-400/55 bg-gold-400/15 text-gold-100'
    : 'border-white/12 bg-white/[0.045] text-white/75';
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Backspace' || event.key === 'Delete') {
          if (onRemove) {
            event.preventDefault();
            onRemove();
          }
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizing} font-medium tracking-wide transition hover:border-gold-400/45 hover:text-gold-100 ${tone} ${className}`}
      style={style}
    >
      <span>{label}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="-mr-1 ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px] hover:bg-white/20"
          aria-label={`Remove ${label}`}
        >
          ×
        </span>
      )}
    </button>
  );
}
