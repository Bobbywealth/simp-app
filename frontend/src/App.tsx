import { Suspense, useEffect, lazy, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from './store/auth';
import { LoadingScreen } from './components/LoadingScreen';
import { PageTransition } from './components/PageTransition';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPrompt } from './components/InstallPrompt';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';

// Lazy-load each page so the initial bundle stays small.
// Framer Motion is intentionally NOT lazy-loaded (used everywhere).
const Welcome = lazy(() => import('./pages/Welcome'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const ProfileView = lazy(() => import('./pages/ProfileView'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const Settings = lazy(() => import('./pages/Settings'));
const Discover = lazy(() => import('./pages/Discover'));
const LiveStream = lazy(() => import('./pages/LiveStream'));
const Matches = lazy(() => import('./pages/Matches'));
const MatchDetail = lazy(() => import('./pages/MatchDetail'));

const MIN_LOADING_MS = 1600;

export default function App() {
  const { initialize, ready } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    initialize();
    const startedAt = Date.now();
    const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
    const t = setTimeout(() => setMinTimeElapsed(true), remaining);
    return () => clearTimeout(t);
  }, [initialize]);

  const showLoader = !ready || !minTimeElapsed;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <InstallPrompt />
      <AnimatePresence mode="wait">
        {showLoader ? (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="fixed inset-0 z-50"
          >
            <LoadingScreen />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="contents"
          >
            <Routes>
              {/* iOS PWA: land on /login instead of /welcome */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/welcome" element={<PageTransition routeKey="/welcome"><Welcome /></PageTransition>} />
              <Route path="/onboarding" element={<PageTransition routeKey="/onboarding"><Onboarding /></PageTransition>} />
              <Route path="/signup" element={<PageTransition routeKey="/signup"><Signup /></PageTransition>} />
              <Route path="/login" element={<PageTransition routeKey="/login"><Login /></PageTransition>} />
              <Route
                path="/profile-setup"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/profile-setup"><ProfileSetup /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/home"><Home /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/profile"><ProfileView /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/edit"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/profile/edit"><ProfileEdit /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/settings"><Settings /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/discover"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/discover"><Discover /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/live"><Live /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live/:id"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/live/:id"><LiveStream /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/matches"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/matches"><Matches /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/matches/:id"
                element={
                  <ProtectedRoute>
                    <PageTransition routeKey="/matches/:id"><MatchDetail /></PageTransition>
                  </ProtectedRoute>
                }
              />
              {/* iOS PWA: unknown routes redirect to /login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <PwaUpdatePrompt />
          </motion.div>
        )}
      </AnimatePresence>
    </Suspense>
  );
}
