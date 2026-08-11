import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Listens for the Next.js-style PWA update event (window.dispatchEvent 'pwa:update')
 * which is fired by the registered virtual:pwa-register SW module, and shows a
 * sticky banner with a Refresh button that calls skipWaiting + reload.
 */
export function PwaUpdatePrompt() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    function onUpdate() {
      setWaiting(true);
    }
    window.addEventListener('pwa:update', onUpdate);
    return () => window.removeEventListener('pwa:update', onUpdate);
  }, []);

  function refresh() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.waiting.addEventListener('statechange', () => {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      });
    } else {
      window.location.reload();
    }
  }

  return (
    <AnimatePresence>
      {waiting && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed bottom-20 left-4 right-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold-400/40 bg-ink-900/95 p-4 shadow-2xl backdrop-blur"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">New version available</p>
            <p className="mt-0.5 text-xs text-white/60">
              Refresh to get the latest features and fixes.
            </p>
          </div>
          <button
            onClick={refresh}
            className="rounded-full bg-gold-400 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-950"
          >
            Refresh
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
