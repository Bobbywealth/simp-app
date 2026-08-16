import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional title rendered at the top of the sheet. */
  title?: string;
  /** Hide the drag handle — useful for action sheets where you want a clean look. */
  hideHandle?: boolean;
  /** Set max-height as a percentage of the viewport. Default 0.92. */
  maxHeightPct?: number;
  children: ReactNode;
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 };

/**
 * iOS-style bottom sheet.
 * - Slides up from the bottom with a spring
 * - Backdrop is blurred 12px + rgba(0,0,0,0.5)
 * - Drag handle at the top; drag down > 30% of sheet height to dismiss
 * - Esc closes; backdrop click closes
 * - Focus trap: focuses the first focusable element on open
 */
export function Sheet({ open, onClose, title, hideHandle, maxHeightPct = 0.92, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close + focus management
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    // Focus the first focusable element in the sheet
    requestAnimationFrame(() => {
      const el = sheetRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag={hideHandle ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_e, info) => {
              const sheetHeight = sheetRef.current?.offsetHeight ?? 0;
              if (info.offset.y > sheetHeight * 0.3 || info.velocity.y > 500) {
                onClose();
              }
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            style={{ maxHeight: `${maxHeightPct * 100}%` }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-ink-950 text-white shadow-soft"
          >
            <div className="flex flex-col overflow-hidden">
              {!hideHandle && (
                <div className="flex justify-center pt-3 pb-1">
                  <span className="block h-1 w-10 rounded-full bg-white/30" aria-hidden />
                </div>
              )}
              {title && (
                <div className="px-6 pt-4 pb-2 text-center">
                  <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>
                </div>
              )}
              <div className="overflow-y-auto px-6 pb-safe pt-2">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
