import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Button } from '../components/Button';
import { SimpLogo } from '../components/SimpLogo';
import { NavHeader } from '../components/NavHeader';
import { Skeleton } from '../components/Skeleton';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { haptics } from '../lib/haptics';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useSwipeBack(true);

  const handleLogout = async () => {
    haptics.medium();
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) {
    // Brief skeleton while the route is mounted but the user resolved to null
    // (ProtectedRoute guards the redirect, but render a tasteful skeleton anyway).
    return (
      <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
        <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
        <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pt-safe">
          <Skeleton width={64} height={64} rounded="full" />
          <Skeleton width={'70%'} height={32} />
          <Skeleton width={'90%'} height={12} />
          <Skeleton width={'60%'} height={12} />
          <Skeleton width={'100%'} height={140} rounded="lg" />
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <NavHeader
        title="Home"
        alwaysCompact
        showBack
        rightSlot={
          <button
            onClick={handleLogout}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Log out
          </button>
        }
      />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-2">
        <div className="mt-2 flex flex-1 flex-col items-center text-center">
          <SimpLogo size={64} variant="emblem" />
          <h1 className="display-heading mt-6 text-3xl font-light">
            Welcome{user?.profile?.displayName ? `, ${user.profile.displayName}` : ''}.
          </h1>
          <div className="gold-divider mt-4" />
          <p className="mt-4 text-sm text-white/70">
            Your profile is set. The next milestone is discovery, matching, and messaging.
          </p>

          <div className="mt-10 w-full rounded-2xl border border-gold-400/20 bg-ink-800/60 p-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
              Coming next
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>· Discovery — swipe through curated profiles</li>
              <li>· Matching — get notified when it&apos;s mutual</li>
              <li>· Messaging — encrypted, real-time</li>
              <li>· Live — go live and build your audience</li>
              <li>· Experiences — dinner, travel, events</li>
            </ul>
          </div>
        </div>

        <div className="pb-safe py-6">
          <Button onClick={() => navigate('/welcome')}>Back to welcome</Button>
        </div>
      </main>
    </div>
  );
}
