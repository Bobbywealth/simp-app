import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getExplore, getInterests, type InterestItem } from '../api/discovery';
import type { DiscoveryProfile } from '../types';
import { SimpLogo } from '../components/SimpLogo';
import { createSwipe } from '../api/swipes';
import { track } from '../api/analytics';

const INTEREST_DISPLAY: Record<string, string> = {
  'dinner': 'Dinner', 'travel': 'Travel', 'live-music': 'Live Music', 'art': 'Art',
  'wine': 'Wine', 'wellness': 'Wellness', 'fashion': 'Fashion', 'fitness': 'Fitness',
  'cooking': 'Cooking', 'photography': 'Photography', 'books': 'Books', 'outdoors': 'Outdoors',
  'dancing': 'Dancing', 'volunteering': 'Volunteering', 'tech': 'Tech', 'sports': 'Sports',
  'sushi': 'Sushi', 'coffee': 'Coffee', 'brunch': 'Brunch', 'hiking': 'Hiking',
  'gaming': 'Gaming', 'movies': 'Movies', 'yoga': 'Yoga', 'meditation': 'Meditation',
  'beach': 'Beach', 'camping': 'Camping', 'language-learning': 'Language Learning',
  'museums': 'Museums', 'podcasts': 'Podcasts', 'board-games': 'Board Games',
  'art-galleries': 'Art Galleries', 'wine-tasting': 'Wine Tasting', 'road-trips': 'Road Trips',
  'gardening': 'Gardening', 'diy': 'DIY', 'crafts': 'Crafts',
};

export default function Explore() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadInterests();
  }, []);

  async function loadInterests() {
    try {
      const res = await getInterests();
      setInterests(res.interests);
    } catch (e) {
      console.error('Failed to load interests', e);
    }
  }

  async function selectInterest(slug: string | null) {
    setSelectedInterest(slug);
    setProfiles([]);
    setLoadingProfiles(true);
    setLoading(true);
    try {
      const res = await getExplore({ interest: slug ?? undefined, limit: 20 });
      setProfiles(res.profiles);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setLoadingProfiles(false);
    }
  }

  async function handleSwipe(profile: DiscoveryProfile, action: 'LIKE' | 'PASS') {
    try {
      await createSwipe({ swipedId: profile.userId, action });
      setProfiles((prev) => prev.filter((p) => p.userId !== profile.userId));
    } catch (e) {
      console.error('Swipe failed', e);
    }
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={() => navigate('/home')}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">Explore</h1>
        <div className="w-12" />
      </header>

      <main className="relative z-10 px-6 pt-6 pb-24">
        <div className="mb-6">
          <h2 className="display-heading text-2xl font-light">Browse by Interest</h2>
          <p className="mt-1 text-sm text-white/60">Find people who share your passions</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => selectInterest(null)}
            className={`min-h-10 rounded-full border px-4 py-2 text-sm capitalize transition ${
              selectedInterest === null
                ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                : 'border-white/10 text-white/55 hover:border-white/20'
            }`}
          >
            All
          </button>
          {interests.map((interest) => (
            <button
              key={interest.slug}
              onClick={() => selectInterest(interest.slug)}
              className={`min-h-10 rounded-full border px-4 py-2 text-sm capitalize transition ${
                selectedInterest === interest.slug
                  ? 'border-gold-400 bg-gold-400/15 text-gold-100'
                  : 'border-white/10 text-white/55 hover:border-white/20'
              }`}
            >
              {INTEREST_DISPLAY[interest.slug] ?? interest.slug}
            </button>
          ))}
        </div>

        {loadingProfiles && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-ink-800" />
            ))}
          </div>
        )}

        {!loadingProfiles && profiles.length === 0 && selectedInterest && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={48} variant="emblem" />
            <h3 className="display-heading text-xl font-light">No one with this interest yet</h3>
            <p className="text-sm text-white/60">Check back later or try another interest</p>
          </div>
        )}

        {!loadingProfiles && profiles.length === 0 && !selectedInterest && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={48} variant="emblem" />
            <h3 className="display-heading text-xl font-light">Select an interest</h3>
            <p className="text-sm text-white/60">Choose from the categories above to find people</p>
          </div>
        )}

        {profiles.length > 0 && (
          <>
            <p className="mb-4 text-xs text-white/50">
              {profiles.length} {profiles.length === 1 ? 'person' : 'people'} found
            </p>
            <div className="grid grid-cols-2 gap-3">
              {profiles.map((profile) => (
                <motion.button
                  key={profile.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => navigate(`/profile/${profile.userId}`)}
                  className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 text-left"
                >
                  <div className="aspect-[3/4] overflow-hidden">
                    {profile.photos[0] ? (
                      <img
                        src={profile.photos[0].thumbnailUrl ?? profile.photos[0].url}
                        alt={profile.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ink-800 text-white/40">
                        ?
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-white">{profile.displayName}, {profile.age}</p>
                        {profile.isVerified && (
                          <span className="text-gold-400">✓</span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-white/70">{profile.city ?? 'Unknown location'}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {profile.interests.slice(0, 2).map((i) => (
                          <span key={i.slug} className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/70">
                            {i.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="absolute bottom-20 right-2 flex flex-col gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleSwipe(profile, 'PASS'); }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/60 backdrop-blur hover:border-white/40 hover:text-white"
                      >
                        ✕
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleSwipe(profile, 'LIKE'); }}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-black hover:bg-gold-300"
                      >
                        ♥
                      </button>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
