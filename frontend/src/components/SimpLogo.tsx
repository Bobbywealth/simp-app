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

/**
 * SVG rebuild of the SIMP mark — a 3D metallic-gold five-point crown above
 * an interlocking serif "S" — so the crown can be animated independently
 * from the S beneath it.
 */
function SimpMarkSvg({ reducedMotion }: { reducedMotion: boolean }) {
  const crownLift = reducedMotion ? 0 : [0, -6, 0];
  const crownRotate = reducedMotion ? 0 : [0, -4, 4, 0];
  const glow = reducedMotion ? 0.55 : [0.4, 0.75, 0.4];

  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label="SIMP — Successful · Intentional · Male · Providers"
      xmlns="http://www.w3.org/2000/svg"
      className="block h-full w-full"
    >
      <defs>
        <linearGradient id="simp-gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbe9a1" />
          <stop offset="35%" stopColor="#e0bb4d" />
          <stop offset="70%" stopColor="#b48a2a" />
          <stop offset="100%" stopColor="#7a5a18" />
        </linearGradient>
        <linearGradient id="simp-gold-highlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff7d6" />
          <stop offset="100%" stopColor="#f6d680" />
        </linearGradient>
        <radialGradient id="simp-crown-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fde58f" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#d4a93a" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#d4a93a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Crown glow halo */}
      <motion.ellipse
        cx="200"
        cy="120"
        rx="150"
        ry="38"
        fill="url(#simp-crown-glow)"
        animate={reducedMotion ? { opacity: 0.55 } : { opacity: glow }}
        transition={reducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Crown — animated as its own group */}
      <motion.g
        style={{ originX: '50%', originY: '100%' }}
        animate={reducedMotion ? {} : { y: crownLift, rotate: crownRotate }}
        transition={
          reducedMotion
            ? undefined
            : {
                y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 5.2, repeat: Infinity, ease: 'easeInOut' },
              }
        }
      >
        {/* Crown base bar */}
        <path
          d="M122 168 L278 168 L266 138 L240 156 L200 96 L160 156 L134 138 Z"
          fill="url(#simp-gold)"
          stroke="#5b3f0e"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Crown upper rim highlight */}
        <path
          d="M128 164 L272 164"
          stroke="url(#simp-gold-highlight)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Five jewel tips */}
        {[
          { x: 200, r: 14, top: true },
          { x: 160, r: 10 },
          { x: 240, r: 10 },
          { x: 134, r: 8 },
          { x: 266, r: 8 },
        ].map((tip, i) => (
          <g key={i}>
            <motion.circle
              cx={tip.x}
              cy={tip.top ? 88 : 140}
              r={tip.r}
              fill="#fde58f"
              stroke="#5b3f0e"
              strokeWidth="1.6"
              animate={
                reducedMotion
                  ? {}
                  : {
                      scale: [1, 1.18, 1],
                      fill: ['#fde58f', '#fff7d6', '#fde58f'],
                    }
              }
              transition={
                reducedMotion
                  ? undefined
                  : {
                      duration: 1.6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.18,
                    }
              }
            />
            <motion.circle
              cx={tip.x}
              cy={tip.top ? 88 : 140}
              r={tip.r * 0.45}
              fill="#ffffff"
              opacity={0.55}
              animate={
                reducedMotion
                  ? {}
                  : { opacity: [0.35, 0.85, 0.35] }
              }
              transition={
                reducedMotion
                  ? undefined
                  : {
                      duration: 1.6,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.18,
                    }
              }
            />
          </g>
        ))}
      </motion.g>

      {/* Interlocking serif S — deliberately static so the crown reads as the animated mark */}
      <g>
        <path
          d="M260 222c0-26-22-40-58-40s-58 14-58 36c0 52 116 30 116 96 0 28-26 46-62 46s-62-18-62-46"
          fill="none"
          stroke="url(#simp-gold)"
          strokeWidth="34"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M260 222c0-26-22-40-58-40s-58 14-58 36c0 52 116 30 116 96 0 28-26 46-62 46s-62-18-62-46"
          fill="none"
          stroke="url(#simp-gold-highlight)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}

export function SimpLogo({ size = 220, className = '', variant = 'full' }: Props) {
  const { src, alt } = ASSETS[variant];
  const reduceMotion = useReducedMotion();
  const animate = !reduceMotion;

  if (variant === 'full') {
    return (
      <motion.div
        style={{ width: size, height: size }}
        className={`relative inline-flex select-none items-center justify-center ${className}`}
        initial={animate ? { opacity: 0, y: 6 } : false}
        animate={animate ? { opacity: 1, y: 0 } : undefined}
        transition={animate ? { duration: 0.7, ease: 'easeOut' } : undefined}
      >
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full bg-gold-400/22 blur-3xl"
          animate={animate ? { opacity: [0.25, 0.6, 0.25], scale: [0.94, 1.06, 0.94] } : undefined}
          transition={animate ? { duration: 4.4, ease: 'easeInOut', repeat: Infinity } : undefined}
        />
        <div className="relative z-10 h-full w-full">
          <SimpMarkSvg reducedMotion={reduceMotion ?? false} />
        </div>
      </motion.div>
    );
  }

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
    </motion.div>
  );
}