import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyProfile } from '../api/users';
import type { Profile } from '../types';
import { useAuth } from '../store/auth';
import { SimpLogo } from '../components/SimpLogo';

export default function ProfileView() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const p = await getMyProfile();
      setProfile(p);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/welcome', { replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 text-white/50">
        Loading…
      </div>
    );
  }

  const photos = profile?.user?.photos ?? [];
  const prompts = profile?.user?.prompts ?? [];

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-24">
        <header className="flex items-center justify-between">
          <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
            Profile
          </h1>
          <button
            onClick={handleLogout}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            Log out
          </button>
        </header>

        {!profile ? (
          <div className="mt-12 text-center">
            <p>No profile yet.</p>
            <button onClick={() => navigate('/profile-setup')} className="btn-gold mt-4 px-6 py-2">
              Create profile
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <SimpLogo size={48} variant="emblem" />
              <div>
                <h2 className="text-2xl font-light">{profile.displayName}</h2>
                <p className="text-xs text-white/60">{user?.email}</p>
              </div>
            </div>

            {photos.length === 0 && (
              <div className="mt-6 rounded-xl border border-gold-400/30 bg-gold-400/5 p-4">
                <p className="text-sm text-white/90">No photos yet.</p>
                <p className="mt-1 text-xs text-white/60">
                  Add at least one photo to appear in others' Discover deck.
                </p>
              </div>
            )}

            {photos.length > 0 && (
              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Photos ({photos.length})
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photos.map((p) => (
                    <img
                      key={p.id}
                      src={p.url}
                      alt=""
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              </section>
            )}

            {profile.bio && (
              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  About
                </h3>
                <p className="mt-2 text-sm text-white/90">{profile.bio}</p>
              </section>
            )}

            {prompts.length > 0 && (
              <section className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Prompts ({prompts.length}/3)
                </h3>
                <div className="mt-3 space-y-3">
                  {prompts.map((p) => (
                    <div key={p.id} className="rounded-xl border border-gold-400/20 bg-ink-900/60 p-3">
                      <p className="text-xs font-medium text-gold-300">{p.question}</p>
                      <p className="mt-1 text-sm text-white/90">{p.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-white/70">
              <Data label="Age" value={profile.birthDate ? String(new Date().getFullYear() - new Date(profile.birthDate).getFullYear()) : '—'} />
              <Data label="Gender" value={profile.gender} />
              <Data label="Looking for" value={profile.lookingFor} />
              <Data label="City" value={profile.city ?? '—'} />
              <Data label="Occupation" value={profile.occupation ?? '—'} />
              {profile.heightCm && <Data label="Height" value={`${profile.heightCm} cm`} />}
            </div>

            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={() => navigate('/profile/edit')}
                className="btn-gold w-full py-3 text-sm font-semibold uppercase tracking-[0.18em]"
              >
                Edit profile
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="btn-gold-outline w-full py-3 text-sm font-medium uppercase tracking-[0.18em]"
              >
                Settings
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-1 text-sm text-white/90">{value}</p>
    </div>
  );
}
