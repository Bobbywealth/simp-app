import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '../api/analytics';

/**
 * Auto-fire `page_viewed` on every route change. Mount once inside
 * the authenticated app shell (after BrowserRouter).
 *
 * Skips noisy churn: hash-only changes inside the same path don't
 * re-fire. The actual tracking call is debounced by `requestAnimationFrame`
 * so a chain of route changes (e.g. auth redirect -> home -> onboarding)
 * still records each page but doesn't block the main thread.
 */
export function usePageViewTracker(): void {
  const location = useLocation();
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      track('page_viewed', {
        path: location.pathname,
        // No query string — auth tokens live in URL params (reset/verify),
        // and we strip query in the backend beforeSend hook anyway.
        // Only the path is useful for funnel analysis.
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);
}

/**
 * Lifecycle hook: track `app_backgrounded` and `app_foregrounded` for
 * iOS/Android session analytics. iOS Capacitor sends 'pause' / 'resume';
 * browsers send 'visibilitychange'. Mount once at the app root.
 */
export function useAppLifecycleTracker(): void {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void track('app_backgrounded');
      } else if (document.visibilityState === 'visible') {
        void track('app_foregrounded');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
