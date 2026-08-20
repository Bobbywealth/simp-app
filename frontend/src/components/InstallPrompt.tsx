import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptics } from '../lib/haptics';
import { Sheet } from './Sheet';

const STORAGE_KEY = 'simp:install-prompt-dismissed';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DWELL_MS = 5000; // Show 5s after the user lands on /login

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isWebkit = /WebKit/.test(ua);
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  // Safari (not Chrome/Firefox/Edge) on iOS, not yet installed
  return isIOS && isWebkit && !isStandalone;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function getDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function setDismissedAt(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Captures the `beforeinstallprompt` event and shows a gold CTA card after the
 * user has dwelled on the page for a few seconds. Dismissible with a 7-day
 * cooldown. On iOS Safari (not standalone), shows "Add to Home Screen" steps
 * in a bottom sheet instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showChrome, setShowChrome] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dwellComplete, setDwellComplete] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedAt = getDismissedAt();
    if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);

    const dwell = window.setTimeout(() => {
      setDwellComplete(true);
      if (isIosSafari()) {
        setShowIosHelp(true);
      }
    }, DWELL_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.clearTimeout(dwell);
    };
  }, []);

  useEffect(() => {
    if (!dwellComplete || !deferred || isIosSafari() || isStandalone()) return;
    const dismissedAt = getDismissedAt();
    if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;
    setShowChrome(true);
  }, [deferred, dwellComplete]);

  const dismiss = () => {
    haptics.light();
    setDismissedAt();
    setShowChrome(false);
    setShowIosHelp(false);
  };

  const onInstall = async () => {
    if (!deferred) return;
    haptics.medium();
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setDismissedAt();
      }
    } finally {
      setShowChrome(false);
      setDeferred(null);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showChrome && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-safe"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-gold-400/30 bg-ink-900/95 p-3 shadow-soft backdrop-blur-xl">
              <img
                src="/icons/icon-192.png"
                alt=""
                width={40}
                height={40}
                className="size-10 rounded-xl"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Install SIMP</p>
                <p className="text-xs text-white/60">Add to your home screen for the full app feel.</p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full p-2 text-white/50 hover:bg-white/5 hover:text-white"
                aria-label="Dismiss"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onInstall}
                className="rounded-full bg-gold-gradient px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-950 shadow-glow active:scale-95"
              >
                Install
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={showIosHelp} onClose={dismiss} title="Add SIMP to your Home Screen">
        <div className="space-y-4 pb-6 pt-2 text-sm text-white/80">
          <p>
            SIMP works best as a home-screen app. On iOS Safari:
          </p>
          <ol className="space-y-3 text-[15px] leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">1</span>
              <span>
                Tap the <span className="font-semibold text-white">Share</span> button
                <span className="mx-1 inline-flex align-middle">
                  <svg viewBox="0 0 24 24" className="size-4 text-gold-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12" />
                    <path d="M7 8l5-5 5 5" />
                    <path d="M5 21h14" />
                  </svg>
                </span>
                in Safari's bottom bar.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">2</span>
              <span>
                Scroll and choose <span className="font-semibold text-white">Add to Home Screen</span>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-sm font-semibold text-gold-300">3</span>
              <span>
                Tap <span className="font-semibold text-white">Add</span> in the top right. SIMP will launch full-screen, no Safari chrome.
              </span>
            </li>
          </ol>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 w-full rounded-full bg-gold-gradient px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-ink-950 shadow-glow active:scale-95"
          >
            Got it
          </button>
        </div>
      </Sheet>
    </>
  );
}
