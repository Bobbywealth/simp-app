import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { getUnreadMessageCount } from "../api/messages";
import { getRealtimeSocket } from "../lib/realtime";
import { SimpLogo } from "./SimpLogo";
import { BottomTabBar } from "./BottomTabBar";

export const APP_LINKS = [
  { to: "/home", label: "Overview", path: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z" },
  {
    to: "/experiences",
    label: "Experiences",
    path: "M4 5h16v16H4ZM8 2v6M16 2v6M4 11h16",
  },
  {
    to: "/discover",
    label: "Discover",
    path: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5Z",
  },
  {
    to: "/matches",
    label: "Matches",
    path: "M12 21 4 13a5 5 0 0 1 8-6 5 5 0 0 1 8 6Z",
  },
  {
    to: "/messages",
    label: "Messages",
    path: "M4 4h16v13H8l-4 3ZM8 8h8M8 12h5",
  },
  { to: "/live", label: "Live", path: "M4 5h16v14H4ZM10 9l5 3-5 3Z" },
] as const;
const PUBLIC_PATHS = new Set([
  "/",
  "/welcome",
  "/onboarding",
  "/signup",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-email-pending",
  "/profile-setup",
]);

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const user = useAuth((state) => state.user);
  const [unread, setUnread] = useState(0);
  const enabled = Boolean(
    user?.emailVerified &&
      user.onboardingCompletedAt &&
      !PUBLIC_PATHS.has(pathname) &&
      !pathname.startsWith("/admin"),
  );

  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return;
    }
    let active = true;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = async () => {
      const id = ++sequence;
      try {
        const response = await getUnreadMessageCount();
        if (active && id === sequence) setUnread(Math.max(0, response.count));
      } catch {
        /* Preserve the last confirmed count while offline. */
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), 150);
    };
    void sync();
    const socket = getRealtimeSocket();
    socket.on("inbox:update", schedule);
    socket.on("connect", schedule);
    window.addEventListener("simp:inbox-read", schedule);
    window.addEventListener("focus", schedule);
    return () => {
      active = false;
      clearTimeout(timer);
      socket.off("inbox:update", schedule);
      socket.off("connect", schedule);
      window.removeEventListener("simp:inbox-read", schedule);
      window.removeEventListener("focus", schedule);
    };
  }, [enabled, pathname, user?.id]);

  if (!enabled) return <>{children}</>;
  const title =
    APP_LINKS.find(
      (link) => pathname === link.to || pathname.startsWith(link.to + "/"),
    )?.label ??
    (pathname.startsWith("/profile")
      ? "Your profile"
      : pathname.startsWith("/settings")
        ? "Settings"
        : pathname === "/notifications"
          ? "Notifications"
          : "Your space");
  return (
    <div className="simp-workspace" data-page={pathname.split("/")[1]}>
      <a href="#simp-content" className="simp-skip-link">
        Skip to content
      </a>
      <aside className="simp-desktop-sidebar" aria-label="Desktop navigation">
        <NavLink to="/home" className="simp-sidebar-brand">
          <SimpLogo size={42} variant="emblem" />
          <span>
            SIMP<small>Real connections.</small>
          </span>
        </NavLink>
        <p className="simp-nav-caption">Your space</p>
        <nav aria-label="Desktop primary" className="simp-sidebar-links">
          {APP_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              aria-label={`${link.label}${link.to === "/messages" && unread > 0 ? `, ${unread} unread` : ""}`}
              className={({ isActive }) =>
                `simp-sidebar-link${isActive ? " is-active" : ""}`
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={link.path} />
              </svg>
              <span>{link.label}</span>
              {link.to === "/messages" && unread > 0 && (
                <span className="simp-nav-badge" aria-hidden="true">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="simp-sidebar-bottom">
          <NavLink className="simp-sidebar-link" to="/settings">
            Settings & safety <span aria-hidden="true">↗</span>
          </NavLink>
          {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && (
            <NavLink className="simp-sidebar-link" to="/admin">
              Moderation
            </NavLink>
          )}
          <NavLink to="/profile" className="simp-sidebar-account">
            <span className="simp-account-initial">
              {(user?.profile?.displayName || "S").slice(0, 1)}
            </span>
            <span>
              {user?.profile?.displayName || "Your profile"}
              <small>View your profile</small>
            </span>
            <span aria-hidden="true">↗</span>
          </NavLink>
        </div>
      </aside>
      <div className="simp-app-content" id="simp-content" tabIndex={-1}>
        <div className="simp-desktop-topbar">
          <span>{title}</span>
          <div>
            <NavLink to="/experiences/mine">My plans</NavLink>
            <NavLink to="/notifications">Notifications</NavLink>
            <NavLink to="/profile/edit">Edit profile</NavLink>
          </div>
        </div>
        {(user?.email ?? "").toLowerCase().endsWith("@simp-seed.demo") && (
          <aside className="simp-demo-banner" role="note">
            Demo testing · Sample profiles, not real dating accounts. Try likes,
            interests, and matches safely.
          </aside>
        )}
        {children}
      </div>
      <BottomTabBar messageCount={unread} />
    </div>
  );
}
