import type { CSSProperties } from 'react';

interface TagProps {
  label: string;
  active?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  style?: CSSProperties;
}

export function Tag({ label, active, onRemove, onClick, size = 'md', className = '', style }: TagProps) {
  const sizing = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-xs';
  const tone = active ? 'border-gold-300/45 bg-gold-200/[0.11] text-gold-50' : 'border-white/[0.1] bg-black/20 text-white/72';
  return (
    <button type="button" onClick={onClick} onKeyDown={(event) => { if ((event.key === 'Backspace' || event.key === 'Delete') && onRemove) { event.preventDefault(); onRemove(); } }} className={`inline-flex items-center gap-1.5 rounded-full border ${sizing} font-medium tracking-wide transition duration-300 hover:border-gold-300/45 hover:text-gold-50 ${tone} ${className}`} style={style}>
      <span>{label}</span>
      {onRemove && <span onClick={(event) => { event.stopPropagation(); onRemove(); }} className="-mr-1 ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[13px] leading-none text-current/70 hover:bg-white/10 hover:text-white" aria-label={`Remove ${label}`} role="button" tabIndex={-1}>×</span>}
    </button>
  );
}
