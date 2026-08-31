import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getMatches } from "../api/matches";
import { getUnreadMessageCount } from "../api/messages";
import {
  getNotificationPreferences,
  getNotificationUnreadCount,
  registerPushToken,
} from "../api/notifications";
import { getMyProfile } from "../api/users";
import { useAuth } from "../store/auth";
import { SimpLogo } from "../components/SimpLogo";
import { SafetyMenu } from "../components/SafetyMenu";
import { getDeviceContext, requestNativePushPermission } from "../capacitor";

export default function Home() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [completion, setCompletion] = useState(100);
  const [showSafety, setShowSafety] = useState(false);
  const [counts, setCounts] = useState({
    matches: 0,
    messages: 0,
    notifications: 0,
  });
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    void Promise.all([
      getMyProfile(),
      getMatches(),
      getUnreadMessageCount(),
      getNotificationUnreadCount(),
    ])
      .then(([profile, matches, messages, notifications]) => {
        setAvatar(
          profile?.user?.photos[0]?.thumbnailUrl ??
            profile?.user?.photos[0]?.url ??
            null,
        );
        setCompletion(profile?.completion?.percent ?? 100);
        setCounts({
          matches: matches.matches.length,
          messages: messages.count,
          notifications: notifications.count,
        });
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!user?.createdAt || bannerDismissed) return;
    const daysActive = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysActive >= 3 || counts.matches > 0) {
      getNotificationPreferences()
        .then((prefs) => {
          if (
            !prefs.matches &&
            !prefs.messages &&
            !prefs.likes &&
            !prefs.live &&
            !prefs.security
          )
            setShowNotificationBanner(true);
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
    if (result === "granted" || result === "denied")
      setShowNotificationBanner(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black pb-28 text-white">
      <img
        src="/editorial/home.jpg"
        alt=""
        className="absolute inset-x-0 top-0 h-[38rem] w-full object-cover opacity-65"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-gradient-to-b from-black/15 via-black/20 to-black" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center gap-3 px-5 pb-5 pt-safe">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="mt-5 h-11 w-11 overflow-hidden rounded-full border border-white/25 bg-black/45 backdrop-blur-md"
          aria-label="Open profile"
        >
          {avatar ? (
            <img
              src={avatar}
              alt="Your profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <SimpLogo size={30} variant="emblem" />
          )}
        </button>
        <div className="mt-5 min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-gold-200">
            Tonight&apos;s edit
          </p>
          <h1 className="truncate text-base font-medium">
            {user?.profile?.displayName ?? "SIMP member"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowSafety(true)}
          className="mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-gold-200 backdrop-blur-md"
          aria-label="Safety"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => navigate("/notifications")}
          className="relative mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/75 backdrop-blur-md"
          aria-label="Notifications"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
          {counts.notifications > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-gold-400 px-1 text-[8px] font-bold text-black">
              {counts.notifications}
            </span>
          )}
        </button>
      </header>
      {showSafety && <SafetyMenu onClose={() => setShowSafety(false)} />}
      <main className="relative z-10 mx-auto w-full max-w-md px-5 pt-52">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="rounded-[2rem] border border-white/15 bg-black/50 p-5 shadow-2xl backdrop-blur-xl"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-200">
            Your concierge has a thought
          </p>
          <h2 className="display-heading mt-3 max-w-xs text-4xl font-light leading-none">
            Make room for a good story.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
            A fresh edit of people who share your pace, interests, and
            intentions.
          </p>
          <button
            type="button"
            onClick={() => navigate("/discover")}
            className="btn-gold mt-6 w-full"
          >
            Open tonight&apos;s edit
          </button>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" /> Quietly
            verified people, on your terms
          </div>
        </motion.section>
        {showNotificationBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-gold-400/20 bg-gold-400/[0.08] p-4"
          >
            <p className="text-sm text-white/85">
              Know when a conversation is waiting for you.
            </p>
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
        {completion < 100 && (
          <button
            type="button"
            onClick={() => navigate("/profile/edit")}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur"
          >
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-gold-200">
                Profile strength
              </span>
              <span className="text-white/50">{completion}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gold-400"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/45">
              A few details help the concierge make a better introduction.
            </p>
          </button>
        )}
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-200">
                At a glance
              </p>
              <h2 className="display-heading mt-1 text-2xl font-light">
                Your room
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/explore")}
              className="text-xs text-gold-200"
            >
              Explore interests
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <DashboardCard
              label="Messages"
              value={
                counts.messages
                  ? `${counts.messages} unread`
                  : "Start a conversation"
              }
              onClick={() => navigate("/messages")}
            />
            <DashboardCard
              label="Matches"
              value={
                counts.matches
                  ? `${counts.matches} connections`
                  : "Your connections"
              }
              onClick={() => navigate("/matches")}
            />
            <DashboardCard
              label="Live"
              value="See who is live"
              onClick={() => navigate("/live")}
            />
            <DashboardCard
              label="Explore"
              value="Browse by interest"
              onClick={() => navigate("/explore")}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
function DashboardCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative min-h-32 overflow-hidden rounded-2xl border border-gold-400/35 bg-gradient-to-br from-ink-900/85 via-black/35 to-ink-900/70 p-4 text-left backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-26px_rgba(0,0,0,0.9)] transition duration-300 hover:border-gold-300/65 hover:from-ink-900/95 hover:to-ink-900/75"
    >
      <span
        className="pointer-events-none absolute inset-y-3 left-0 w-[2px] bg-gradient-to-b from-transparent via-gold-300/80 to-transparent"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-gold-300/10 blur-2xl transition group-hover:bg-gold-300/20"
        aria-hidden
      />
      <p className="bg-gold-gradient bg-clip-text text-[9px] font-extrabold uppercase tracking-[0.26em] text-transparent">
        {label}
      </p>
      <p className="mt-6 text-sm font-medium leading-relaxed text-white/85">
        {value}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-200 transition group-hover:gap-2">
        Open
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            d="M5 12h14M13 5l7 7-7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </motion.button>
  );
}
