import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SimpLogo } from '../components/SimpLogo';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between bg-black text-white">
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
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{ scale: 1.08, transformOrigin: '60% 40%' }}
          animate={{ x: ['0%', '-3%', '0%'], y: ['0%', '2%', '0%'] }}
          transition={{ duration: 22, ease: 'easeInOut', repeat: Infinity }}
          aria-hidden
        >
          <div
            className="h-full w-full opacity-60 mix-blend-screen"
            style={{
              backgroundImage: 'url(/satin-black.png)',
              backgroundSize: '120% auto',
              backgroundRepeat: 'repeat',
              filter: 'blur(28px)',
            }}
          />
        </motion.div>
      </div>
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[480px] rounded-full bg-gold-400/10 blur-3xl pointer-events-none" />

      <div className="relative pt-safe" />

      <main className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative mt-32 mb-10 flex items-center justify-center"
        >
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[320px] rounded-full bg-gold-400/30 blur-3xl pointer-events-none"
            initial={{ opacity: 0.5, scale: 0.9 }}
            animate={{
              opacity: [0.35, 0.7, 0.35],
              scale: [0.9, 1.08, 0.9],
            }}
            transition={{
              duration: 3.2,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: 0.6,
            }}
          />
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[420px] rounded-full bg-gold-300/15 blur-3xl pointer-events-none"
            initial={{ opacity: 0.3, scale: 0.85 }}
            animate={{
              opacity: [0.2, 0.45, 0.2],
              scale: [0.85, 1.15, 0.85],
            }}
            transition={{
              duration: 4.5,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: 0.9,
            }}
          />
          <SimpLogo size={220} className="relative" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="whitespace-nowrap px-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-gold-300/80"
        >
          Superior · Intelligent · Male · Pleasers
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="gold-divider my-10"
        />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="whitespace-nowrap px-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/70"
        >
          Experiences &nbsp;&gt;&nbsp; Connections &nbsp;&gt;&nbsp; Memories
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-400"
        >
          It all starts here.
        </motion.p>
      </main>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.85 }}
        className="relative z-10 w-full max-w-md space-y-3 px-6 pb-safe pt-10"
      >
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="btn-gold w-full"
          data-testid="get-started"
        >
          Get Started
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="btn-ghost w-full text-white/70"
        >
          Log In
        </button>
      </motion.div>
    </div>
  );
}
