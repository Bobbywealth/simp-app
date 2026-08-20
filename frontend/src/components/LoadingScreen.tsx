import { motion } from 'framer-motion';
import { SimpLogo } from './SimpLogo';

export function LoadingScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="flex h-[200vh] w-full flex-col will-change-transform"
          animate={{ y: ['0%', '-50%'] }}
          transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
          aria-hidden
        >
          <img
            src="/satin-black.png"
            alt=""
            className="block h-[100vh] w-full object-cover select-none"
            draggable={false}
          />
          <img
            src="/satin-black.png"
            alt=""
            className="block h-[100vh] w-full object-cover select-none"
            draggable={false}
          />
        </motion.div>
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      </div>

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/18 blur-3xl pointer-events-none"
        animate={{ opacity: [0.2, 0.55, 0.2], scale: [0.92, 1.08, 0.92] }}
        transition={{ duration: 4.8, ease: 'easeInOut', repeat: Infinity }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
      >
        <SimpLogo size={120} variant="emblem" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-gold-gradient">
            Loading your experience
          </p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-white/40">
            SIMP &nbsp;·&nbsp; EST. 2026
          </p>
        </div>

        <div
          className="relative h-[2px] w-[280px] overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Loading"
        >
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full"
            style={{ background: 'linear-gradient(90deg, transparent, #f6e6b8 30%, #d4a93a 60%, transparent)' }}
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  );
}
