import { motion, useReducedMotion } from 'framer-motion';

type Variant = 'full' | 'emblem';

interface Props {
  size?: number;
  className?: string;
  variant?: Variant;
}

const ASSETS: Record<Variant, { src: string; alt: string }> = {
  full: {
    src: '/simp-logo.png',
    alt: 'SIMP — Successful · Intentional · Male · Providers',
  },
  emblem: {
    src: '/simp-emblem.png',
    alt: 'SIMP',
  },
};

export function SimpLogo({ size = 220, className = '', variant = 'full' }: Props) {
  const { src, alt } = ASSETS[variant];
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  return (
    <motion.div
      style={{ width: size, height: size }}
      className={`relative inline-flex select-none items-center justify-center ${className}`}
      initial={animate ? { opacity: 0, scale: 0.92, y: 8 } : false}
      animate={
        animate
          ? {
              opacity: 1,
              scale: [1, 1.018, 1],
              y: [0, -2, 0],
            }
          : undefined
      }
      transition={
        animate
          ? {
              duration: 0.9,
              ease: [0.34, 1.56, 0.64, 1],
              repeat: Infinity,
              repeatDelay: 2.4,
            }
          : undefined
      }
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full bg-gold-400/20 blur-3xl"
        animate={animate ? { opacity: [0.25, 0.65, 0.25], scale: [0.92, 1.06, 0.92] } : undefined}
        transition={animate ? { duration: 4.2, ease: 'easeInOut', repeat: Infinity } : undefined}
      />
      <motion.img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="relative z-10 h-full w-full drop-shadow-[0_0_36px_rgba(212,169,58,0.42)]"
        draggable={false}
        initial={animate ? { filter: 'saturate(0.95) brightness(0.95)' } : undefined}
        animate={animate ? { filter: ['saturate(0.95) brightness(0.95)', 'saturate(1.1) brightness(1.04)', 'saturate(0.95) brightness(0.95)'] } : undefined}
        transition={animate ? { duration: 3.8, ease: 'easeInOut', repeat: Infinity } : undefined}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-y-[-6%] left-[-45%] z-20 w-[38%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/55 to-transparent mix-blend-screen"
        animate={animate ? { x: ['-80%', '320%'] } : undefined}
        transition={animate ? { duration: 4.9, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1.8 } : undefined}
      />
    </motion.div>
  );
}
