import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getUnreadMessageCount } from '../api/messages';
import { getNotifications } from '../api/notifications';
import { getRealtimeSocket } from '../lib/realtime';

const TABS = [
  { to: '/discover', label: 'Discover', path: 'M12 21s7-4.35 7-11V5l-7-3-7 3v5c0 6.65 7 11 7 11Zm0-5.5 3-3-3-3-3 3 3 3Z' },
  { to: '/matches', label: 'Matches', path: 'M12 20.5 4.7 13.2a4.6 4.6 0 0 1 6.5-6.5L12 7.5l.8-.8a4.6 4.6 0 0 1 6.5 6.5L12 20.5Z' },
  { to: '/messages', label: 'Messages', path: 'M4 5.5h16v11H8l-4 3v-14Z' },
  { to: '/live', label: 'Live', path: 'M9 8.5v7l6-3.5-6-3.5ZM5.5 5.5h13v13h-13v-13Z' },
  { to: '/profile', label: 'Profile', path: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 8Zm-7 8c.8-4 3.1-6 7-6s6.2 2 7 6H5Z' },
] as const;

const PRIMARY_PATHS = new Set(['/home', '/discover', '/matches', '/messages', '/live', '/profile']);

export function BottomTabBar() {
  const location = useLocation();
  const [messageCount, setMessageCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const visible = PRIMARY_PATHS.has(location.pathname);

  useEffect(() => {
    if (!visible) return;
    void getUnreadMessageCount().then((result) => setMessageCount(result.count)).catch(() => undefined);
    void getNotifications()
      .then((result) =>
        setMatchCount(
          result.notifications.filter(
            (item) => !item.readAt && (item.type === 'MATCH' || item.type === 'LIKE'),
          ).length,
        ),
      )
      .catch(() => undefined);
    const socket = getRealtimeSocket();
    const onInbox = () => setMessageCount((count) => count + 1);
    const onNotification = (notification: { type?: string }) => {
      if (notification.type === 'MATCH' || notification.type === 'LIKE') setMatchCount((count) => count + 1);
    };
    socket.on('inbox:update', onInbox);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('inbox:update', onInbox);
      socket.off('notification:new', onNotification);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 bg-ink-950/72 backdrop-blur-2xl">
      <div className="mx-auto h-px max-w-md bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
      <div className="mx-auto grid max-w-md grid-cols-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}>
        {TABS.map((tab) => {
          const badge = tab.to === '/messages' ? messageCount : tab.to === '/matches' ? matchCount : 0;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              aria-label={`${tab.label}${badge ? `, ${badge} unread` : ''}`}
              className={({ isActive }) =>
                `relative flex min-h-[62px] flex-col items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition duration-300 active:scale-95 ${isActive ? 'text-gold-200' : 'text-white/42 hover:text-white/80'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"><path d={tab.path} /></svg>
                    {badge > 0 && <span className="absolute -right-2.5 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-gold-300 px-1 text-[8px] font-bold text-ink-950">{badge > 99 ? '99+' : badge}</span>}
                  </span>
                  <span>{tab.label}</span>
                  {isActive && <span className="absolute bottom-1 h-px w-4 bg-gold-200" aria-hidden />}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
