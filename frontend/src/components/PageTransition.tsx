import { useRef, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  /** Optional route key to drive exit/enter rather than useLocation().pathname. */
  routeKey?: string;
}

// iOS-style cubic-bezier (slightly overshoot, settle)
const IOS_EASE = [0.32, 0.72, 0, 1] as const;
const DURATION = 0.3; // 300ms — iOS sheets sit around 280–320ms

// We track direction in a ref so each route knows whether it's entering or
// exiting as part of a forward vs back navigation. We can't rely on
// framer-motion's exit alone because the new route mounts before the old one
// exits (mode="wait" defers mounts).
export function PageTransition({ children, routeKey }: Props) {
  const location = useLocation();
  const navType = useNavigationType();
  // Direction: 1 = forward, -1 = back, 0 = first mount / refresh
  const directionRef = useRef<1 | -1 | 0>(0);

  useEffect(() => {
    if (navType === 'PUSH') directionRef.current = 1;
    else if (navType === 'POP') directionRef.current = -1;
  }, [navType, location.pathname]);

  const key = routeKey ?? location.pathname;
  const dir = directionRef.current;

  const variants = {
    initial: (d: number) => ({
      x: d >= 0 ? '100%' : '-30%',
      opacity: d >= 0 ? 1 : 0.6,
    }),
    animate: {
      x: 0,
      opacity: 1,
    },
    exit: (d: number) => ({
      x: d >= 0 ? '-30%' : '100%',
      opacity: d >= 0 ? 0.6 : 1,
    }),
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        custom={dir}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: DURATION, ease: IOS_EASE as unknown as number[] }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
