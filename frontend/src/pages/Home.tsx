import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getMatches } from '../api/matches';
import { getUnreadMessageCount } from '../api/messages';
import { getNotificationUnreadCount } from '../api/notifications';
import { getMyProfile } from '../api/users';
import { useAuth } from '../store/auth';
import { SimpLogo } from '../components/SimpLogo';

export default function Home() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [completion, setCompletion] = useState(100);
  const [counts, setCounts] = useState({ matches: 0, messages: 0, notifications: 0 });

  useEffect(() => {
    void Promise.all([getMyProfile(), getMatches(), getUnreadMessageCount(), getNotificationUnreadCount()])
      .then(([profile, matches, messages, notifications]) => {
        setAvatar(profile?.user?.photos[0]?.thumbnailUrl ?? profile?.user?.photos[0]?.url ?? null);
        setCompletion(profile?.completion?.percent ?? 100);
        setCounts({ matches: matches.matches.length, messages: messages.count, notifications: notifications.count });
      })
      .catch(() => undefined);
  }, []);

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
        <button type="button" onClick={() => navigate('/notifications')} className="relative mt-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/65" aria-label="Notifications">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          {counts.notifications > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-gold-400 px-1 text-[8px] font-bold text-black">{counts.notifications}</span>}
        </button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md px-5">
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
          <DashboardCard label="Your profile" value="Preview and refine" onClick={() => navigate('/profile')} iconPath="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-4 3.1-6 7-6s6.2 2 7 6H5Z" />
        </div>

        {import.meta.env.VITE_BILLING_ENABLED === 'true' && user?.entitlement.tier === 'FREE' && (
          <button type="button" onClick={() => navigate('/premium')} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-gold-400/15 bg-black/30 p-4 text-left">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">SIMP+</p><p className="mt-1 text-sm text-white/55">More control over how you connect.</p></div><span className="text-gold-300">›</span>
          </button>
        )}
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
