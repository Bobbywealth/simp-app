import { Suspense, useEffect, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth';
import { LoadingScreen } from './components/LoadingScreen';
import { PageTransition } from './components/PageTransition';
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallPrompt } from './components/InstallPrompt';

// Lazy-load each page so the initial bundle stays small.
// Framer Motion is intentionally NOT lazy-loaded (used everywhere).
const Welcome = lazy(() => import('./pages/Welcome'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));

export default function App() {
  const { initialize, ready } = useAuth();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/welcome"
          element={
            <PageTransition routeKey="/welcome">
              <Welcome />
            </PageTransition>
          }
        />
        <Route
          path="/onboarding"
          element={
            <PageTransition routeKey="/onboarding">
              <Onboarding />
            </PageTransition>
          }
        />
        <Route
          path="/signup"
          element={
            <PageTransition routeKey="/signup">
              <Signup />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition routeKey="/login">
              <Login />
            </PageTransition>
          }
        />
        <Route
          path="/profile-setup"
          element={
            <ProtectedRoute>
              <PageTransition routeKey="/profile-setup">
                <ProfileSetup />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <PageTransition routeKey="/home">
                <Home />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/live"
          element={
            <ProtectedRoute>
              <PageTransition routeKey="/live">
                <Live />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
