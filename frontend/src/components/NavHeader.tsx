import { useEffect, useState, type ReactNode } from 'react';
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

/**
 * iOS-style large title that collapses to 17pt on scroll.
 * The large title lives in the content area; the small sticky bar floats on
 * top with a frosted backdrop blur.
 */
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (v) => {
      setScrolled(v > 24);
    });
  }, [scrollY]);

  // Sticky small title fades in once we've scrolled past the large title
  const stickyOpacity = useTransform(scrollY, [0, 32, 56], [0, 0, 1]);

  const onBack = () => {
    haptics.light();
    navigate(-1);
  };

  return (
    <header className={`relative z-20 w-full ${className}`}>
      {/* Sticky small-title bar */}
      <div
        className={`sticky top-0 z-30 ${
          safeTop ? 'safe-top' : ''
        } ${noBlur ? '' : 'backdrop-blur-xl bg-black/40 border-b border-white/5'}`}
      >
        <div className="relative flex h-11 items-center justify-between px-3">
          <div className="flex w-16 items-center justify-start">
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="-ml-2 flex size-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/5 hover:text-white active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
          </div>
          <motion.div
            style={{ opacity: stickyOpacity }}
            className="pointer-events-none absolute inset-x-0 mx-auto text-center text-[15px] font-semibold text-white"
          >
            {title}
          </motion.div>
          <div className="flex w-16 items-center justify-end">{rightSlot}</div>
        </div>
      </div>

      {/* Large title (rendered in-flow so it scrolls with the page) */}
      {!alwaysCompact && (
        <div className="px-6 pt-2 pb-4">
          <h1 className="text-[34px] font-bold tracking-tight text-white leading-[1.1]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
