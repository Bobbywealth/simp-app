import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMyProfile } from '../api/users';
import type { Profile } from '../types';
import { useAuth } from '../store/auth';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { PromptSwiper } from '../components/PromptSwiper';
import { ProfileStrengthBar } from '../components/ProfileStrengthBar';
import { Tag } from '../components/Tag';

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
      setProfile(await getMyProfile());
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/welcome', { replace: true });
  }

  if (loading) {
    return <ProfileViewSkeleton />;
  }

  if (!profile) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink-950 text-white">
        <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
        <div className="relative z-10 max-w-sm px-6 text-center">
          <h1 className="display-heading text-3xl">Your profile isn&apos;t ready yet</h1>
          <p className="mt-3 text-sm text-white/65">
            Set up your profile so others can match with you.
          </p>
          <button
            type="button"
            onClick={() => navigate('/profile-setup')}
            className="btn-gold mt-6 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Create profile
          </button>
        </div>
      </div>
    );
  }

  const photos = profile.user?.photos ?? [];
  const prompts = profile.user?.prompts ?? [];
  const curatedInterests = profile.interests?.map((i) => i.interest.label) ?? [];
  const customInterests = profile.customInterests ?? [];
  const allInterests = [...curatedInterests, ...customInterests];
  const age = profile.birthDate ? new Date().getFullYear() - new Date(profile.birthDate).getUTCFullYear() : null;
  const location = [profile.occupation, profile.city].filter(Boolean).join(' · ');

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <header className="relative z-20 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-safe pb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition hover:bg-black/65"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-[10px] font-semibold uppercase tracking-[0.32em] text-gold-300/85">
          Profile
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition hover:bg-black/65"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8V9a1.7 1.7 0 0 0 1.5-1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile/edit')}
            aria-label="Edit profile"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-ink-950 transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md flex-1 space-y-6 px-5 pb-32">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative"
        >
          <PhotoCarousel
            photos={photos.map((p) => ({ id: p.id, url: p.url, thumbnailUrl: p.thumbnailUrl }))}
            overlay={
              <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h2 className="display-heading truncate text-[34px] font-light leading-none drop-shadow">
                        {profile.displayName}
                      </h2>
                      {age && <span className="text-2xl text-white/80">{age}</span>}
                    </div>
                    {location && (
                      <p className="mt-1 truncate text-sm text-white/85 drop-shadow">{location}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {profile.isVerified ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-400/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate('/settings')}
                      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur hover:border-gold-400/40 hover:text-gold-200"
                    >
                      Get verified →
                    </button>
                  )}
                </div>
              </div>
            }
            emptyState={
              <div className="px-6 text-center">
                <p className="text-sm font-medium text-white/85">Add your first photo</p>
                <p className="mt-1 text-xs text-white/55">
                  Profiles with 3+ photos get up to 2× more matches.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/profile/edit')}
                  className="btn-gold mt-4 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
                >
                  Add photos
                </button>
              </div>
            }
          />
        </motion.section>

        <ProfileStrengthBar
          completion={profile.completion}
          onEdit={() => navigate('/profile/edit')}
        />

        {profile.bio && (
          <section className="rounded-3xl border border-white/10 bg-ink-900/55 p-5 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-300">About</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-white/90">{profile.bio}</p>
          </section>
        )}

        {prompts.length > 0 && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-300">
                Prompts
              </h3>
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                {prompts.length}/3
              </span>
            </div>
            <PromptSwiper prompts={prompts} />
          </section>
        )}

        {allInterests.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-ink-900/55 p-5 backdrop-blur">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-300">
                Interests
              </h3>
              {customInterests.length > 0 && (
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {customInterests.length} custom
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {curatedInterests.map((label) => (
                <Tag key={label} label={label} size="sm" />
              ))}
              {customInterests.map((label) => (
                <Tag
                  key={`custom-${label}`}
                  label={label}
                  size="sm"
                  className="border-gold-400/40 bg-gold-400/10 text-gold-100"
                />
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/[0.06] bg-black/30 p-5 text-xs text-white/55">
          <div className="grid grid-cols-2 gap-4">
            <Meta label="Looking for" value={prettifyLookingFor(profile.lookingFor)} />
            <Meta label="Verification" value={profile.isVerified ? 'Verified' : prettifyStatus(profile.verificationStatus)} />
            {profile.heightCm && <Meta label="Height" value={`${profile.heightCm} cm`} />}
            <Meta
              label="Account"
              value={user?.email ? user.email.replace(/(.{2}).+(@.+)/, '$1•••$2') : '—'}
            />
          </div>
        </section>

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/75"
          >
            Log out
          </button>
        </div>
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 text-[13px] text-white/75">{value}</p>
    </div>
  );
}

function prettifyLookingFor(value: string): string {
  if (value === 'WOMEN') return 'Women';
  if (value === 'MEN') return 'Men';
  if (value === 'EVERYONE') return 'Everyone';
  return value;
}

function prettifyStatus(value: string): string {
  if (!value || value === 'NOT_REQUESTED') return 'Not requested';
  return value
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function ProfileViewSkeleton() {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <div className="relative z-10 mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-6">
        <div className="aspect-[3/4] w-full animate-pulse rounded-[2rem] bg-white/[0.06]" />
        <div className="h-20 animate-pulse rounded-3xl bg-white/[0.04]" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/[0.04]" />
        <div className="h-44 animate-pulse rounded-3xl bg-white/[0.04]" />
        <div className="h-24 animate-pulse rounded-3xl bg-white/[0.04]" />
      </div>
    </div>
  );
}
