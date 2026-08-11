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
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6">
        <header className="flex items-center justify-between">
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
            Curated profiles. Real conversations. Earned reveals.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/discover')}
              className="btn-gold flex flex-col items-center justify-center py-6 text-sm font-medium uppercase tracking-[0.18em]"
            >
              <span className="text-2xl">↗</span>
              <span className="mt-1">Discover</span>
            </button>
            <button
              onClick={() => navigate('/matches')}
              className="btn-gold-outline flex flex-col items-center justify-center py-6 text-sm font-medium uppercase tracking-[0.18em]"
            >
              <span className="text-2xl">♥</span>
              <span className="mt-1">Matches</span>
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-gold-400/20 bg-ink-800/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
              What&apos;s next
            </p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>· Messaging — real-time chat with your matches</li>
              <li>· Live streaming — go live and build your audience</li>
              <li>· Experiences — dinner, travel, events</li>
              <li>· Premium — unlock unlimited likes and boosts</li>
            </ul>
          </div>
        </div>

        <div className="pb-24 py-6">
          <Button onClick={() => navigate('/profile/edit')}>Edit profile</Button>
        </div>
      </main>
    </div>
  );
}
