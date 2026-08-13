import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SimpLogo } from '../components/SimpLogo';
import { TabBar, type TabItem } from '../components/TabBar';
import { useAuth } from '../store/auth';
import { haptics } from '../lib/haptics';

// Tab list for the stub. Mirrors the production nav (Home / Live / Profile).
// As Discover / Matches ship, append them here so the bottom bar stays in sync.
const TABS: TabItem[] = [
  {
    key: 'home',
    label: 'Home',
    to: '/home',
    iconPath:
      'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z',
  },
  {
    key: 'live',
    label: 'Live',
    to: '/live',
    iconPath:
      'M15.5 8.5 21 5v14l-5.5-3.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2z',
  },
  {
    key: 'profile',
    label: 'Profile',
    to: '/profile',
    iconPath:
      'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  },
];

// Sample chat drives the overlay animation so the layout reads as a real live
// page. Replaced with real socket-driven chat once the backend lands.
const SAMPLE_MESSAGES: { id: number; user: string; text: string; color: string; host?: boolean }[] = [
  { id: 1, user: 'Maya', text: 'Hey y’all! 🙌', color: '#FFD66B' },
  { id: 2, user: 'Devon', text: 'Where in NJ are you based?', color: '#7FD8BE' },
  { id: 3, user: 'Aaliyah', text: '🔥🔥🔥', color: '#FF8A8A' },
  { id: 4, user: 'Marcus', text: 'Love the energy tonight', color: '#A0C4FF' },
  { id: 5, user: 'Zara', text: 'First time here — this UI is gorgeous', color: '#FFD66B' },
  { id: 6, user: 'You', text: 'Welcome everyone!', color: '#FFD66B', host: true },
];

const ACTION_PATHS = {
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  comment: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
} as const;

export default function Live() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [notified, setNotified] = useState(false);
  const [error, setError] = useState('');

  const handleNotify = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Enter a valid email');
      return;
    }
    setError('');
    haptics.success();
    setNotified(true);
    // TODO: POST /live/notify when the backend ships.
  };

  const displayName = user?.profile?.displayName ?? 'You';

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {/* ── Background placeholder (real video player lands here later) ── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-900 via-black to-ink-950" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(212,175,55,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_70%,rgba(168,85,247,0.12),transparent_50%)]" />
        <motion.div
          aria-hidden
          className="absolute inset-0 opacity-40"
          animate={{ backgroundPosition: ['0% 0%', '200% 200%'] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          style={{
            backgroundImage:
              'linear-gradient(45deg, transparent 30%, rgba(212,175,55,0.12) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
          }}
        />
      </div>

      {/* ── Top overlay: host + close ── */}
      <div className="absolute inset-x-0 top-0 z-30 safe-top">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="size-11 rounded-full bg-gradient-to-br from-gold-300 to-gold-500 p-[2px]">
                <div className="flex size-full items-center justify-center rounded-full bg-ink-950">
                  <SimpLogo size={30} variant="emblem" />
                </div>
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-[2px] text-[8px] font-bold uppercase tracking-wider text-white shadow-md">
                Live
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-white">{displayName}</p>
              <p className="text-[11px] font-medium text-white/75">
                <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-red-500 align-middle" />
                LIVE · <span className="font-semibold">0</span> watching
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Close live"
            className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right-side floating actions (TikTok Live style) ── */}
      <div className="absolute right-3 bottom-44 z-20 flex flex-col items-center gap-5">
        <ActionButton icon="heart" label="0" />
        <ActionButton icon="comment" label="0" />
        <ActionButton icon="share" label="Share" />
        <ActionButton icon="gift" label="Gift" />
      </div>

      {/* ── Center hero: "Coming Soon" with notify-me CTA ── */}
      <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        >
          <SimpLogo size={72} variant="emblem" className="mx-auto opacity-90" />
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.35em] text-gold-300">
            Coming Soon
          </p>
          <h1 className="mt-2 text-[34px] font-bold leading-[1.05] text-white">
            Go live.
            <br />
            <span className="text-gold-gradient">Get seen.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-[14px] leading-snug text-white/75">
            Real-time video chat. Host your audience. Build the room.
          </p>

          {!notified ? (
            <form
              onSubmit={handleNotify}
              className="mx-auto mt-7 max-w-[18rem] space-y-2"
              noValidate
            >
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                error={error}
                className="!bg-black/55 !border-white/15 text-center text-white placeholder:text-white/35"
              />
              <Button type="submit" variant="gold" haptic="medium">
                Notify me when Live drops
              </Button>
            </form>
          ) : (
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mt-7 max-w-[18rem] rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 backdrop-blur-md"
            >
              <p className="text-[14px] font-semibold text-gold-300">
                You&rsquo;re on the list.
              </p>
              <p className="mt-1 text-[12px] text-white/70">
                We&rsquo;ll text you the moment Live goes live.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ── Chat overlay (sits ON the video, not below) ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[72px] z-20">
        <div className="mx-3 mb-2 max-h-44 overflow-hidden">
          <AnimatePresence initial={false}>
            {SAMPLE_MESSAGES.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.45, duration: 0.45 }}
                className="mb-1.5 flex items-baseline gap-1.5"
              >
                <span
                  className="rounded-full bg-black/45 px-2 py-[3px] backdrop-blur-md"
                  style={{ boxShadow: `inset 2px 0 0 ${msg.color}` }}
                >
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: msg.color }}
                  >
                    {msg.user}
                    {msg.host ? ' · host' : ''}
                  </span>
                </span>
                <span className="rounded-2xl bg-black/45 px-3 py-1 backdrop-blur-md">
                  <span className="text-[12.5px] leading-snug text-white">
                    {msg.text}
                  </span>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="pointer-events-auto mx-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 py-2 backdrop-blur-xl">
          <input
            type="text"
            placeholder="Be the first to say something nice…"
            disabled
            aria-label="Live chat (coming soon)"
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/40 focus:outline-none disabled:opacity-70"
          />
          <button
            type="button"
            disabled
            className="rounded-full bg-gold-400/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-300"
          >
            Send
          </button>
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <TabBar tabs={TABS} />
    </div>
  );
}

function ActionButton({
  icon,
  label,
}: {
  icon: keyof typeof ACTION_PATHS;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={icon}
      className="flex flex-col items-center gap-1 text-white"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-black/45 backdrop-blur-md transition active:scale-95">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill={icon === 'heart' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ACTION_PATHS[icon]} />
        </svg>
      </span>
      <span className="text-[10px] font-semibold tracking-wide text-white/80">
        {label}
      </span>
    </button>
  );
}
