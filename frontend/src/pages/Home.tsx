import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Button } from '../components/Button';
import { SimpLogo } from '../components/SimpLogo';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-safe">
        <header className="flex items-center justify-between pt-6">
          <SimpLogo size={48} variant="emblem" />
          <button
            onClick={handleLogout}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Log out
          </button>
        </header>

        <div className="mt-12 flex-1">
          <h1 className="display-heading text-3xl font-light">
            Welcome{user?.profile?.displayName ? `, ${user.profile.displayName}` : ''}.
          </h1>
          <div className="gold-divider mt-4 !mx-0" />
          <p className="mt-4 text-sm text-white/70">
            Your profile is set. The next milestone is discovery, matching, and messaging.
          </p>

          <div className="mt-10 rounded-2xl border border-gold-400/20 bg-ink-800/60 p-5">
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
          <Button onClick={() => navigate('/welcome')}>Back to home</Button>
        </div>
      </main>
    </div>
  );
}
