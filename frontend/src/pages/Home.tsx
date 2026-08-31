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
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center gap-3 px-5 pb-4 pt-safe">
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
            Heyy 👋
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
      <main className="relative z-10 mx-auto w-full max-w-md px-5 pt-3">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/15"
        >
          <div className="aspect-[16/9] w-full">
            <img
              src="/editorial/profiles/women-03.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-200">
                Tonight&apos;s concierge pick
              </p>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gold-400 px-2.5 text-[10px] font-bold text-black">
                +1
              </span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-200">
                Verified chemistry
              </p>
              <h2 className="display-heading mt-2 text-4xl font-light leading-[.95]">
                Meet with intention
              </h2>
            </div>
          </div>
        </motion.section>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SmallCounter label="Matches" value={counts.matches} />
          <SmallCounter label="Messages" value={counts.messages} />
          <SmallCounter label="Alerts" value={counts.notifications} />
        </div>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          onClick={() => navigate("/discover")}
          className="mt-4 w-full overflow-hidden rounded-2xl bg-gold-gradient p-5 text-left shadow-[0_22px_50px_-22px_rgba(214,172,63,0.55)] transition active:scale-[0.99]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-950/70">
            Curated for you
          </p>
          <p className="mt-3 font-display text-3xl font-medium leading-[1.05] text-ink-950">
            Discover someone worth meeting
          </p>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-950/80">
            Start discovering →
          </p>
        </motion.button>
        {showNotificationBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-gold-400/25 bg-gold-400/[0.08] p-4"
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
          <div className="mt-1 grid grid-cols-2 gap-3">
            <SmallCard
              icon="message"
              label="Messages"
              value={counts.messages ? `${counts.messages} unread` : "Start a conversation"}
              onClick={() => navigate("/messages")}
            />
            <SmallCard
              icon="heart"
              label="Matches"
              value={counts.matches ? `${counts.matches} connections` : "Your connections"}
              onClick={() => navigate("/matches")}
            />
            <SmallCard
              icon="live"
              label="Live"
              value="See who is live"
              onClick={() => navigate("/live")}
            />
            <SmallCard
              icon="explore"
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
function SmallCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur">
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
        {label}
      </p>
    </div>
  );
}

function SmallCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: "message" | "heart" | "live" | "explore";
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition active:scale-[0.98]"
    >
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
        <SmallCardIcon name={icon} />
        <p className="mt-3 text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-[11px] text-white/55">{value}</p>
      </div>
    </button>
  );
}

function SmallCardIcon({ name }: { name: "message" | "heart" | "live" | "explore" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5 text-gold-300",
  };
  if (name === "message") {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5a8 8 0 1 1 16-3Z" />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg {...common}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
      </svg>
    );
  }
  if (name === "live") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="14" height="12" rx="2" />
        <path d="m17 9 4-2v10l-4-2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function DashboardCard({
  label,
  value,
  onClick,
  count,
  icon,
}: {
  label: string;
  value: string;
  onClick: () => void;
  count?: number;
  icon: "chat" | "spark" | "wave" | "orbit";
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="group relative min-h-32 overflow-hidden rounded-2xl border border-gold-400/35 bg-gradient-to-br from-ink-900/90 via-black/30 to-ink-900/80 p-4 text-left backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.6),0_18px_40px_-26px_rgba(0,0,0,0.9)] transition duration-300 hover:border-gold-300/70"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(120deg, transparent 35%, rgba(255,221,135,0.18) 50%, transparent 65%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-gold-300/15 blur-3xl transition duration-500 group-hover:bg-gold-300/35"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[2px] rounded-full bg-gradient-to-b from-transparent via-gold-300/80 to-transparent transition group-hover:via-gold-200"
      />
      <div className="relative flex items-center justify-between">
        <p className="bg-gold-gradient bg-clip-text text-[9px] font-extrabold uppercase tracking-[0.28em] text-transparent">
          {label}
        </p>
        {typeof count === "number" && count > 0 && (
          <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full bg-gold-gradient px-2 text-[11px] font-black text-ink-950 shadow-[0_0_0_3px_rgba(214,172,63,0.18)]">
            <span className="absolute inset-0 animate-[pulse_2.4s_ease-in-out_infinite] rounded-full bg-gold-300/40" />
            <span className="relative">{count}</span>
          </span>
        )}
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        <DashboardIcon name={icon} />
        <p className="text-sm font-semibold leading-relaxed text-white/90">
          {value}
        </p>
      </div>
      <div className="relative mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-200 transition group-hover:gap-2">
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
        <span className="text-[9px] uppercase tracking-[0.22em] text-white/35">
          Tap
        </span>
      </div>
    </motion.button>
  );
}

function DashboardIcon({ name }: { name: "chat" | "spark" | "wave" | "orbit" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-4 w-4 text-gold-200 transition group-hover:text-gold-100",
  };
  if (name === "chat") {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5a8 8 0 1 1 16-3Z" />
      </svg>
    );
  }
  if (name === "spark") {
    return (
      <svg {...common}>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8" />
      </svg>
    );
  }
  if (name === "wave") {
    return (
      <svg {...common}>
        <path d="M3 12c2 0 2-3 4-3s2 6 4 6 2-9 4-9 2 6 4 6 2-3 2-3" />
        <circle cx="20" cy="9" r="1.3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      <ellipse
        cx="12"
        cy="12"
        rx="3.5"
        ry="9"
        className="opacity-70"
      />
    </svg>
  );
}
