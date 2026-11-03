import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMatches } from "../api/matches";
import { getUnreadMessageCount } from "../api/messages";
import { getNotificationUnreadCount } from "../api/notifications";
import { getMyProfile, getProfileCompletion } from "../api/users";
import { useAuth } from "../store/auth";
import { SimpLogo } from "../components/SimpLogo";
import { SafetyMenu } from "../components/SafetyMenu";
import { getRealtimeSocket } from "../lib/realtime";

export default function Home() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const [showSafety, setShowSafety] = useState(false);
  const [completion, setCompletion] = useState<number | null>(null);
  const [moreMatches, setMoreMatches] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [counts, setCounts] = useState<{
    matches: number | null;
    messages: number | null;
    notifications: number | null;
  }>({ matches: null, messages: null, notifications: null });
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      getMyProfile(),
      getProfileCompletion(),
      getMatches(),
      getUnreadMessageCount(),
      getNotificationUnreadCount(),
    ] as const);
    const [profile, strength, matches, messages, notifications] = results;
    if (profile.status === "fulfilled")
      setAvatar(
        profile.value?.user?.photos[0]?.thumbnailUrl ??
          profile.value?.user?.photos[0]?.url ??
          null,
      );
    if (strength.status === "fulfilled") setCompletion(strength.value.percent);
    setMoreMatches(
      matches.status === "fulfilled" && Boolean(matches.value.hasMore),
    );
    setCounts({
      matches:
        matches.status === "fulfilled" ? matches.value.matches.length : null,
      messages: messages.status === "fulfilled" ? messages.value.count : null,
      notifications:
        notifications.status === "fulfilled" ? notifications.value.count : null,
    });
    setError(results.some((result) => result.status === "rejected"));
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    const socket = getRealtimeSocket();
    const refresh = () => void load();
    socket.on("inbox:update", refresh);
    socket.on("notification:new", refresh);
    window.addEventListener("simp:inbox-read", refresh);
    return () => {
      socket.off("inbox:update", refresh);
      socket.off("notification:new", refresh);
      window.removeEventListener("simp:inbox-read", refresh);
    };
  }, [load]);

  return (
    <div className="relative min-h-screen bg-ink-950 pb-28 text-white">
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center gap-3 px-5 pb-4 pt-safe">
        <button
          onClick={() => navigate("/profile")}
          className="mt-5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20"
          aria-label="Open profile"
        >
          {avatar ? (
            <img
              src={avatar}
              alt="Your profile"
              className="h-full w-full object-cover"
            />
          ) : (
            <SimpLogo size={32} variant="emblem" />
          )}
        </button>
        <div className="mt-5 min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[.2em] text-gold-200">
            Your next chapter
          </p>
          <h1 className="mt-1 truncate text-xl font-medium">
            Welcome back, {user?.profile?.displayName ?? "SIMP member"}.
          </h1>
        </div>
        <button
          onClick={() => setShowSafety(true)}
          aria-label="Safety tools"
          className="mt-5 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 text-gold-200"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6ZM9 12l2 2 4-4" />
          </svg>
        </button>
      </header>
      {showSafety && <SafetyMenu onClose={() => setShowSafety(false)} />}
      <main className="relative z-10 mx-auto w-full max-w-md space-y-5 px-5 pt-3 lg:space-y-0">
        {error && (
          <div
            className="home-wide flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-300/20 p-4"
            role="status"
          >
            <p className="text-sm text-white/60">
              Some account details couldn’t load. Your other features are still
              available.
            </p>
            <button
              className="min-h-11 text-sm text-gold-200"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        )}
        <section className="home-wide relative overflow-hidden rounded-[2rem] border border-white/10">
          <img
            src="/editorial/welcome.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent" />
          <div className="relative max-w-lg p-7 lg:p-10">
            <p className="text-[10px] uppercase tracking-[.24em] text-gold-200">
              Make room for something real
            </p>
            <h2 className="display-heading mt-5 text-5xl leading-none lg:text-6xl">
              Good company.
              <br />
              Better plans.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">
              Meet someone who shares your energy, start a conversation, and
              take it beyond the screen.
            </p>
            <button
              onClick={() => navigate("/experiences")}
              className="btn-gold mt-7 text-xs"
            >
              Explore experiences <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
        <section
          className="home-wide grid grid-cols-3 gap-3"
          aria-label="Your account activity"
          aria-busy={loading}
        >
          {(
            [
              { key: "matches", label: "Matches", route: "/matches" },
              { key: "messages", label: "Unread chats", route: "/messages" },
              {
                key: "notifications",
                label: "Notifications",
                route: "/notifications",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.route)}
              className="min-h-24 rounded-2xl border border-white/10 bg-white/[.025] px-2 py-5 text-center transition hover:border-gold-300/40"
            >
              <span className="block text-3xl font-medium text-gold-100">
                {counts[item.key] ?? "–"}
                {item.key === "matches" && moreMatches ? "+" : ""}
              </span>
              <span className="mt-2 block text-[10px] uppercase tracking-[.1em] text-white/50">
                {item.label}
              </span>
              {item.key === "matches" && (
                <span className="sr-only">loaded on this page</span>
              )}
            </button>
          ))}
        </section>
        <section className="rounded-2xl border border-white/10 p-6">
          <p className="text-[10px] uppercase tracking-[.2em] text-gold-200">
            People, not just profiles
          </p>
          <h2 className="display-heading mt-4 text-3xl">
            Find your kind of energy.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Discover people, explore shared interests, and see who you connect
            with.
          </p>
          <button
            onClick={() => navigate("/discover")}
            className="btn-gold-outline mt-6 text-xs"
          >
            Discover people <span aria-hidden="true">↗</span>
          </button>
        </section>
        <section className="rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[.2em] text-gold-200">
              Your profile
            </p>
            <span className="text-sm text-gold-100">
              {completion === null ? "Not loaded" : `${completion}% complete`}
            </span>
          </div>
          <h2 className="display-heading mt-4 text-3xl">
            Let them meet the real you.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Keep your photos, interests, and intentions up to date.
          </p>
          {completion !== null && (
            <div
              role="progressbar"
              aria-label="Profile completion"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full bg-gold-300"
                style={{ width: `${Math.max(0, Math.min(100, completion))}%` }}
              />
            </div>
          )}
          <button
            onClick={() => navigate("/profile/edit")}
            className="mt-5 min-h-11 text-xs text-gold-200"
          >
            Update your profile <span aria-hidden="true">↗</span>
          </button>
        </section>
        <section className="home-wide rounded-2xl border border-white/10 p-5">
          <h2 className="text-xs text-white/60">Make your next move</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Messages", route: "/messages" },
              { label: "Live conversations", route: "/live" },
              { label: "Explore interests", route: "/explore" },
              { label: "My plans", route: "/experiences/mine" },
            ].map((item) => (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className="min-h-11 rounded-full border border-white/10 px-4 text-xs text-white/70 hover:border-gold-300/40"
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
