import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from './store/auth';
import { BottomTabBar } from './components/BottomTabBar';
import { InstallPrompt } from './components/InstallPrompt';
import { LoadingScreen } from './components/LoadingScreen';
import { PageTransition } from './components/PageTransition';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';

const Welcome = lazy(() => import('./pages/Welcome'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Signup = lazy(() => import('./pages/Signup'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyEmailPending = lazy(() => import('./pages/VerifyEmailPending'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const Home = lazy(() => import('./pages/Home'));
const Live = lazy(() => import('./pages/Live'));
const ProfileView = lazy(() => import('./pages/ProfileView'));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'));
const Settings = lazy(() => import('./pages/Settings'));
const Premium = lazy(() => import('./pages/Premium'));
const Discover = lazy(() => import('./pages/Discover'));
const LiveStream = lazy(() => import('./pages/LiveStream'));
const Matches = lazy(() => import('./pages/Matches'));
const MatchDetail = lazy(() => import('./pages/MatchDetail'));
const Messages = lazy(() => import('./pages/Messages'));
const Conversation = lazy(() => import('./pages/Conversation'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Licenses = lazy(() => import('./pages/Licenses'));
const Admin = lazy(() => import('./pages/Admin'));

export default function App() {
  const { initialize, ready, user } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const value = (event as CustomEvent<{ url?: string }>).detail?.url;
      if (!value) return;
      try {
        const parsed = new URL(value);
        let route = parsed.pathname;
        if (parsed.protocol === 'simp:') route = `/${parsed.host}${parsed.pathname}`;
        const allowed = ['/matches/', '/messages/', '/live/', '/verify-email', '/reset-password'];
        if (allowed.some((prefix) => route.startsWith(prefix))) {
          navigate(`${route}${parsed.search}`);
        }
      } catch {
        // Ignore malformed external links.
      }
    };
    window.addEventListener('simp:deeplink', handler);
    return () => window.removeEventListener('simp:deeplink', handler);
  }, [navigate]);

  if (!ready) return <LoadingScreen />;

  return (
    <AppErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <InstallPrompt />
        {!online && (
          <div className="fixed inset-x-0 top-0 z-[70] bg-amber-400 px-3 py-2 text-center text-xs font-semibold text-black" role="status">
            You’re offline. Browsing cached screens only.
          </div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key="app"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="contents"
          >
            <Routes>
              <Route path="/" element={<Navigate to={user ? (user.onboardingCompletedAt ? '/home' : '/profile-setup') : '/login'} replace />} />
              <Route path="/welcome" element={<PageTransition routeKey="/welcome"><Welcome /></PageTransition>} />
              <Route path="/onboarding" element={<PageTransition routeKey="/onboarding"><Onboarding /></PageTransition>} />
              <Route path="/signup" element={<PageTransition routeKey="/signup"><Signup /></PageTransition>} />
              <Route path="/login" element={<PageTransition routeKey="/login"><Login /></PageTransition>} />
              <Route path="/forgot-password" element={<PageTransition routeKey="/forgot-password"><ForgotPassword /></PageTransition>} />
              <Route path="/reset-password" element={<PageTransition routeKey="/reset-password"><ResetPassword /></PageTransition>} />
              <Route path="/verify-email" element={<PageTransition routeKey="/verify-email"><VerifyEmail /></PageTransition>} />
              <Route path="/verify-email-pending" element={<ProtectedRoute><VerifyEmailPending /></ProtectedRoute>} />
              <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />

              <Route path="/home" element={<ProtectedRoute requireOnboarding><Home /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute requireOnboarding><ProfileView /></ProtectedRoute>} />
              <Route path="/profile/edit" element={<ProtectedRoute requireOnboarding><ProfileEdit /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute requireOnboarding><Settings /></ProtectedRoute>} />
              <Route path="/discover" element={<ProtectedRoute requireOnboarding><Discover /></ProtectedRoute>} />
              <Route path="/live" element={<ProtectedRoute requireOnboarding><Live /></ProtectedRoute>} />
              <Route path="/live/:id" element={<ProtectedRoute requireOnboarding><LiveStream /></ProtectedRoute>} />
              <Route path="/matches" element={<ProtectedRoute requireOnboarding><Matches /></ProtectedRoute>} />
              <Route path="/matches/:id" element={<ProtectedRoute requireOnboarding><MatchDetail /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute requireOnboarding><Messages /></ProtectedRoute>} />
              <Route path="/messages/:id" element={<ProtectedRoute requireOnboarding><Conversation /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute requireOnboarding><Notifications /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute requireOnboarding><Premium /></ProtectedRoute>} />
              <Route path="/licenses" element={<ProtectedRoute requireOnboarding><Licenses /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['MODERATOR', 'ADMIN', 'SUPER_ADMIN']}><Admin /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
            </Routes>
            <BottomTabBar />
            <PwaUpdatePrompt />
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </AppErrorBoundary>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.dispatchEvent(
      new CustomEvent('simp:frontend-error', {
        detail: { message: error.message, componentStack: info.componentStack },
      }),
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center text-white">
        <div className="max-w-sm">
          <h1 className="display-heading text-3xl font-light">SIMP needs a fresh start</h1>
          <p className="mt-3 text-sm text-white/55">Something unexpected happened. Your account and conversations are safe.</p>
          <button type="button" onClick={() => window.location.reload()} className="btn-gold mt-6 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]">Reload app</button>
        </div>
      </div>
    );
  }
}
