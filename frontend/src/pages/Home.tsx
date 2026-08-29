import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMatches } from '../api/matches';
import { getUnreadMessageCount } from '../api/messages';
import { getNotificationPreferences, getNotificationUnreadCount, registerPushToken } from '../api/notifications';
import { getMyProfile } from '../api/users';
import { useAuth } from '../store/auth';
import { SimpLogo } from '../components/SimpLogo';
import { SafetyMenu } from '../components/SafetyMenu';
import { getDeviceContext, requestNativePushPermission } from '../capacitor';

export default function Home() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [completion, setCompletion] = useState(100);
  const [showSafety, setShowSafety] = useState(false);
  const [counts, setCounts] = useState({ matches: 0, messages: 0, notifications: 0 });
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    void Promise.all([getMyProfile(), getMatches(), getUnreadMessageCount(), getNotificationUnreadCount()])
      .then(([profile, matches, messages, notifications]) => {
        setAvatar(profile?.user?.photos[0]?.thumbnailUrl ?? profile?.user?.photos[0]?.url ?? null);
        setCompletion(profile?.completion?.percent ?? 100);
        setCounts({ matches: matches.matches.length, messages: messages.count, notifications: notifications.count });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user?.createdAt || bannerDismissed) return;
    const daysActive = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const hasFirstMatch = counts.matches > 0;
    if (daysActive >= 3 || hasFirstMatch) {
      getNotificationPreferences()
        .then((prefs) => {
          const allDisabled = !prefs.matches && !prefs.messages && !prefs.likes && !prefs.live && !prefs.security;
          if (allDisabled) setShowNotificationBanner(true);
        })
        .catch(() => setShowNotificationBanner(true));
    }
  }, [user?.createdAt, counts.matches, bannerDismissed]);

  async function enableNotifications() {
    const device = await getDeviceContext();
    const result = await requestNativePushPermission({
      onToken: async (token) => {
        await registerPushToken({ token, ...device });
      },
      onRoute: (route) => navigate(route),
    });
    if (result === 'granted' || result === 'denied') {
      setShowNotificationBanner(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-ink-950 pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center gap-3 px-6 pb-5 pt-safe">
        <button type="button" onClick={() => navigate('/profile')} className="mt-5 h-12 w-12 overflow-hidden rounded-full border border-gold-400/30 bg-ink-800" aria-label="Open profile">
          {avatar ? <img src={avatar} alt="Your profile" className="h-full w-full object-cover" /> : <SimpLogo size={34} variant="emblem" />}
        </button>
        <div className="mt-5 min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold-300">Good to see you</p>
          <h1 className="truncate text-lg font-semibold">{user?.profile?.displayName ?? 'SIMP member'}</h1>
        </div>
        <button type="button" onClick={() => setShowSafety(true)} className="relative mt-5 flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400" aria-label="Safety">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </button>
        <button type="button" onClick={() => navigate('/notifications')} className="relative mt-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65" aria-label="Notifications">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          {counts.notifications > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-gold-400 px-1 text-[8px] font-bold text-black">{counts.notifications}</span>}
        </button>
      </header>

      {showSafety && <SafetyMenu onClose={() => setShowSafety(false)} />}

      {showNotificationBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 rounded-2xl border border-gold-400/20 bg-gradient-to-br from-gold-400/15 to-transparent p-4"
        >
          <p className="text-sm text-white/85">Turn on notifications to know when someone likes you back</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void enableNotifications()}
              className="btn-gold flex-1 py-2 text-xs uppercase tracking-[0.16em]"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => {
                setBannerDismissed(true);
                setShowNotificationBanner(false);
              }}
              className="flex-1 py-2 text-xs uppercase tracking-[0.16em] text-white/45"
            >
              Not now
            </button>
          </div>
        </motion.div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-md px-5">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="mb-4 overflow-hidden rounded-[2rem] border border-gold-400/20 bg-gradient-to-br from-gold-400/14 via-white/[0.04] to-transparent p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
        >
          <div className="relative mb-5 h-44 overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/45">
            <img src="/onboarding/couple-night.jpg" alt="Curated SIMP connection" className="absolute inset-0 h-full w-full object-cover opacity-55" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
            <div className="absolute left-4 top-4 rounded-full border border-gold-400/35 bg-black/60 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-200 backdrop-blur-md">
              Tonight's concierge pick
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-gold-200">Verified chemistry</p>
                <h2 className="display-heading mt-1 text-3xl leading-none">Meet with intention</h2>
              </div>
              <div className="flex -space-x-3">
                {avatar && <img src={avatar} alt="Your profile" className="h-12 w-12 rounded-full border-2 border-black object-cover" />}
                <img src="https://randomuser.me/api/portraits/women/44.jpg" alt="Profile preview" className="h-12 w-12 rounded-full border-2 border-black object-cover" />
                <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-gold-400 text-xs font-bold text-black">+{counts.matches || 1}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatPill label="Matches" value={counts.matches ? String(counts.matches) : '0'} />
            <StatPill label="Messages" value={counts.messages ? String(counts.messages) : '0'} />
            <StatPill label="Alerts" value={counts.notifications ? String(counts.notifications) : '0'} />
          </div>
        </motion.section>

        {completion < 100 && (
          <button type="button" onClick={() => navigate('/profile/edit')} className="mb-4 w-full rounded-2xl border border-gold-400/20 bg-gold-400/[0.06] p-4 text-left">
            <div className="flex justify-between text-xs"><span className="font-semibold text-gold-200">Profile strength</span><span className="text-white/50">{completion}%</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gold-400" style={{ width: `${completion}%` }} /></div>
            <p className="mt-2 text-[11px] text-white/45">A complete profile earns more meaningful connections.</p>
          </button>
        )}

        <motion.button type="button" whileTap={{ scale: 0.985 }} onClick={() => navigate('/discover')} className="relative w-full overflow-hidden rounded-3xl border border-gold-400/25 bg-gradient-to-br from-gold-300 via-gold-500 to-gold-800 p-6 text-left text-black shadow-[0_18px_55px_rgba(169,131,32,0.18)]">
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full border border-black/10" />
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-black/60">Curated for you</p>
          <h2 className="display-heading mt-2 text-3xl font-medium">Discover someone worth meeting</h2>
          <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]">Start discovering <span aria-hidden>→</span></span>
        </motion.button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <DashboardCard label="Messages" value={counts.messages ? `${counts.messages} unread` : 'Start a conversation'} onClick={() => navigate('/messages')} iconPath="M4 5.5h16v11H8l-4 3v-14Z" />
          <DashboardCard label="Matches" value={counts.matches ? `${counts.matches} connections` : 'Your connections'} onClick={() => navigate('/matches')} iconPath="M12 20.5 4.7 13.2a4.6 4.6 0 0 1 6.5-6.5L12 7.5l.8-.8a4.6 4.6 0 0 1 6.5 6.5L12 20.5Z" />
          <DashboardCard label="Live" value="See who is live" onClick={() => navigate('/live')} iconPath="M9 8.5v7l6-3.5-6-3.5ZM5.5 5.5h13v13h-13v-13Z" />
          <DashboardCard label="Explore" value="Browse by interest" onClick={() => navigate('/explore')} iconPath="M21 21l-6-6m2-5a7 7 0 1 0-14 0 7 7 0 0 0 14 0Z" />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({ label, value, onClick, iconPath }: { label: string; value: string; onClick: () => void; iconPath: string }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onClick} className="min-h-36 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-left backdrop-blur-sm">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-gold-300" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={iconPath} /></svg>
      <p className="mt-6 text-sm font-semibold text-white/90">{label}</p>
      <p className="mt-1 text-[11px] text-white/40">{value}</p>
    </motion.button>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 px-3 py-3 text-left">
      <p className="text-[9px] uppercase tracking-[0.28em] text-white/35">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
