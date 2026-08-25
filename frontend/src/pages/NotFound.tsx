import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth';
import { BottomTabBar } from '../components/BottomTabBar';
import { NavHeader } from '../components/NavHeader';
import { SimpLogo } from '../components/SimpLogo';

/**
 * Catch-all route for anything that doesn't match a known route.
 * Shown to both authenticated and unauthenticated users. Offers a
 * single primary CTA "Go home" (or "Sign in" if not authenticated)
 * and a secondary "Get help" link that opens the support page.
 *
 * Why this exists instead of silently redirecting: silent redirects
 * for mistyped URLs hide bugs (links pointing to stale routes, app
 * update that removed a route, etc.). Showing a real 404 with a clear
 * CTA helps users recover AND makes broken links visible.
 */
export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const target = user ? '/home' : '/login';
  const cta = user ? 'Go home' : 'Sign in';

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      {user && (
        <NavHeader
          title="Not found"
          showBack
        />
      )}
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center"
        role="main"
        aria-live="polite"
      >
        <SimpLogo size={72} variant="emblem" />
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.32em] text-gold-300">404</p>
        <h1 className="display-heading mt-3 text-2xl font-light">We can&apos;t find that page.</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
          The link may be broken, or the page may have moved in a recent update.
        </p>
        <button
          type="button"
          onClick={() => navigate(target, { replace: true })}
          className="btn-gold mt-7 w-full max-w-xs py-3 text-sm font-medium uppercase tracking-[0.18em]"
          autoFocus
        >
          {cta}
        </button>
        <button
          type="button"
          onClick={() => window.open('https://mysimp.com/support', '_blank', 'noopener,noreferrer')}
          className="mt-3 min-h-11 w-full max-w-xs text-xs uppercase tracking-[0.15em] text-white/45 hover:text-white/70"
        >
          Get help
        </button>
      </motion.main>
      {user && <BottomTabBar />}
    </div>
  );
}
