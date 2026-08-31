import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { haptics } from '../lib/haptics';

interface Props {
  title: string;
  /** When true, renders the small-title (sticky) bar all the way. */
  alwaysCompact?: boolean;
  /** Optional back button; when true, shows a chevron that calls navigate(-1). */
  showBack?: boolean;
  /** Right-side element (icon button, etc.) */
  rightSlot?: ReactNode;
  /** Disable the frosted blur (e.g. for a fully transparent area). */
  noBlur?: boolean;
  /** Optional subtitle under the large title. */
  subtitle?: string;
  /** Apply safe-area top padding to the header. Default true. */
  safeTop?: boolean;
  className?: string;
}

/** iOS-style large title that resolves into a restrained editorial masthead on scroll. */
export function NavHeader({
  title,
  alwaysCompact,
  showBack,
  rightSlot,
  noBlur,
  subtitle,
  safeTop = true,
  className = '',
}: Props) {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const stickyOpacity = useTransform(scrollY, [0, 32, 56], [0, 0, 1]);

  const onBack = () => {
    haptics.light();
    navigate(-1);
  };

  return (
    <header className={`relative z-20 w-full ${className}`}>
      <div className={`sticky top-0 z-30 ${safeTop ? 'safe-top' : ''} ${noBlur ? '' : 'bg-ink-950/45 backdrop-blur-2xl'}`}>
        {!noBlur && <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden />}
        <div className="relative flex h-11 items-center justify-between px-4">
          <div className="flex w-16 items-center justify-start">
            {showBack && (
              <button type="button" onClick={onBack} aria-label="Back" className="-ml-2 flex size-9 items-center justify-center rounded-full text-white/75 transition duration-300 hover:bg-white/[0.06] hover:text-white active:scale-95">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            )}
          </div>
          <motion.div style={{ opacity: alwaysCompact ? 1 : stickyOpacity }} className="pointer-events-none absolute inset-x-0 mx-auto text-center font-display text-[19px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </motion.div>
          <div className="flex w-16 items-center justify-end">{rightSlot}</div>
        </div>
      </div>

      {!alwaysCompact && (
        <div className="px-6 pb-7 pt-5">
          <div className="mb-4 h-px w-10 bg-gold-300/70" aria-hidden />
          <h1 className="font-display text-[42px] font-medium leading-[0.92] tracking-[-0.045em] text-white">{title}</h1>
          {subtitle && <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/58">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
