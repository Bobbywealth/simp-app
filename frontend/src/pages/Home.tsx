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
            <ConciergeCarousel
              slides={[
                { src: "/editorial/profiles/women-03.jpg", name: "Nia", age: 30, neighborhood: "Brooklyn" },
                { src: "/editorial/profiles/women-04.jpg", name: "Ava", age: 28, neighborhood: "Jersey City" },
                { src: "/editorial/profiles/men-02.jpg", name: "Marcus", age: 33, neighborhood: "Hoboken" },
                { src: "/editorial/profiles/men-04.jpg", name: "Jordan", age: 31, neighborhood: "Manhattan" },
              ]}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-200">
                Tonight&apos;s concierge pick
              </p>
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gold-400 px-2.5 text-[10px] font-bold text-black">
                +{counts.matches + 1}
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
        <LiveMessageTicker />
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
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-200">
                Your pulse
              </p>
              <h2 className="display-heading mt-1 text-2xl font-light">
                Quick glance
              </h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <ProgressBar
              label="Profile strength"
              value={completion}
              onClick={() => navigate("/profile/edit")}
            />
            <div className="rounded-2xl border border-gold-300/25 bg-gradient-to-r from-ink-900/80 via-black/55 to-ink-900/80 p-4 backdrop-blur">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-[0.16em] text-gold-200">
                  Active streaks
                </span>
                <span className="rounded-full bg-gold-300/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-gold-100">
                  🔥 3 days
                </span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {["M","T","W","T","F","S","S"].map((d, i) => (
                  <div
                    key={`${d}-${i}`}
                    className={`h-7 rounded-md ${
                      i < 5 ? "bg-gold-gradient" : "bg-white/8"
                    }`}
                    aria-hidden
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                5 of 7 days active. You're on a roll.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gold-300/20 bg-white/[0.04] p-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-200">
                  Your vibe
                </p>
                <p className="mt-2 font-display text-2xl font-medium leading-tight text-white">
                  Jazz + cooking
                </p>
                <p className="mt-1 text-[11px] text-white/55">
                  Most-matched interests
                </p>
              </div>
              <div className="rounded-2xl border border-gold-300/20 bg-white/[0.04] p-4 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-200">
                  Best time
                </p>
                <p className="mt-2 font-display text-2xl font-medium leading-tight text-white">
                  8–10 PM
                </p>
                <p className="mt-1 text-[11px] text-white/55">
                  Peak activity window
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-200">
              Quick actions
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
              Or use the menu below
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChipAction label="New message" onClick={() => navigate("/messages")} />
            <ChipAction label="Go live" onClick={() => navigate("/live")} />
            <ChipAction label="Tribe finder" onClick={() => navigate("/explore")} />
            <ChipAction label="Safety tools" onClick={() => setShowSafety(true)} />
          </div>
        </section>
      </main>
    </div>
  );
}
function ConciergeCarousel({
  slides,
}: {
  slides: { src: string; name: string; age: number; neighborhood: string }[];
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [slides.length]);
  return (
    <div className="relative h-full w-full">
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          src={slide.src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === index ? "w-5 bg-gold-300" : "w-1.5 bg-white/55"
            }`}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function LiveMessageTicker() {
  const messages: { name: string; text: string; accent: string }[] = [
    { name: "Maya, 27", text: "Just hopped on. Coffee first?", accent: "Coffee" },
    { name: "Devin, 32", text: "Looking for a Sunday brunch buddy in Brooklyn.", accent: "Brunch" },
    { name: "Aria, 29", text: "Live in 5. Bringing good energy only.", accent: "Live" },
    { name: "Kai, 30", text: "Verified and ready. Who&apos;s out tonight?", accent: "Verified" },
  ];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [messages.length]);
  const current: { name: string; text: string; accent: string } =
    (messages[index] as { name: string; text: string; accent: string } | undefined) ||
    (messages[0] as { name: string; text: string; accent: string });
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gold-300/20 bg-gradient-to-r from-ink-900/80 via-black/55 to-ink-900/80 px-4 py-3 backdrop-blur">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold-300/60" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-gold-300" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-gold-200">
          Live right now
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-white">
          {current.name} · {current.text}
        </p>
      </div>
      <span className="rounded-full bg-gold-300/15 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-gold-200">
        {current.accent}
      </span>
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

function ProgressBar({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-2xl border border-gold-300/20 bg-white/[0.04] p-4 text-left backdrop-blur transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-[0.16em] text-gold-200">
          {label}
        </span>
        <span className="font-extrabold text-gold-100">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gold-gradient transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </button>
  );
}

function ChipAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-gold-300/30 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 transition active:scale-95 hover:border-gold-300/60 hover:bg-gold-300/10 hover:text-gold-100"
    >
      {label}
    </button>
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
