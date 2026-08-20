import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  pushSupported,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from '../api/notifications';
import type { InAppNotification } from '../types';
import { getRealtimeSocket } from '../lib/realtime';

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then((response) => {
        if (!cancelled) setItems(response.notifications);
      })
      .catch((value) => {
        if (!cancelled) setError((value as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const socket = getRealtimeSocket();
    const onNew = (notification: InAppNotification) => {
      setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
    };
    socket.on('notification:new', onNew);

    // Reflect current browser permission + existing push subscription.
    if (pushSupported() && 'Notification' in window && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushEnabled(Boolean(sub) && Notification.permission === 'granted'))
        .catch(() => undefined);
    }

    // Service worker may post a navigate hint when a push is clicked.
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; route?: string } | undefined;
      if (data?.type === 'simp:navigate' && typeof data.route === 'string') {
        navigate(data.route);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      cancelled = true;
      socket.off('notification:new', onNew);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [navigate]);

  async function handleTogglePush() {
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (pushEnabled) {
        await unsubscribeFromWebPush();
        setPushEnabled(false);
        setPushMessage('Notifications disabled.');
      } else {
        const result = await subscribeToWebPush();
        if (result) {
          setPushEnabled(true);
          setPushMessage("You're subscribed. New matches and messages will alert you.");
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          setPushMessage('Notifications are blocked in your browser settings.');
        } else {
          setPushMessage('Notifications are not available on this device.');
        }
      }
    } catch (err) {
      setPushMessage((err as Error).message ?? 'Could not update notifications.');
    } finally {
      setPushBusy(false);
    }
  }

  async function open(notification: InAppNotification) {
    if (!notification.readAt) {
      await markNotificationRead(notification.id).catch(() => undefined);
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    }
    const route = notification.data?.route;
    if (typeof route === 'string' && route.startsWith('/')) navigate(route);
    else if (notification.type === 'MATCH' && notification.entityId) navigate(`/matches/${notification.entityId}`);
    else if (notification.type === 'MESSAGE' && notification.entityId) navigate(`/messages/${notification.entityId}`);
  }

  async function markAll() {
    await markAllNotificationsRead();
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pb-4 pt-safe">
        <button type="button" onClick={() => navigate(-1)} className="mt-4 flex h-11 w-11 items-center justify-center rounded-full text-white/65 hover:bg-white/5" aria-label="Back">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h1 className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-gold-300">Notifications</h1>
        <button type="button" onClick={() => void markAll()} className="mt-4 min-h-11 text-[10px] uppercase tracking-[0.14em] text-white/50 hover:text-white">Read all</button>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pb-28">
        {pushSupported() && (
          <section className="mb-5 rounded-2xl border border-gold-400/20 bg-gold-400/[0.04] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Push Notifications
                </p>
                <p className="mt-1 text-sm text-white/65">
                  {pushEnabled
                    ? 'Get notified the moment you match or receive a message.'
                    : 'Enable browser notifications so you never miss a match.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleTogglePush()}
                disabled={pushBusy}
                className={`min-h-11 shrink-0 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[0.18em] transition disabled:opacity-40 ${
                  pushEnabled
                    ? 'border border-white/15 text-white/70 hover:bg-white/5'
                    : 'btn-gold'
                }`}
              >
                {pushBusy ? '…' : pushEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            {pushMessage && (
              <p className="mt-3 text-[11px] text-white/45">{pushMessage}</p>
            )}
          </section>
        )}
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/[0.05]" />)}
          </div>
        )}
        {!loading && error && <p className="py-20 text-center text-sm text-red-200">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="py-24 text-center">
            <h2 className="display-heading text-2xl font-light">You’re all caught up</h2>
            <p className="mt-2 text-sm text-white/45">Matches, messages, and important updates will appear here.</p>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((notification) => (
              <li key={notification.id}>
                <button type="button" onClick={() => void open(notification)} className={`flex w-full gap-3 rounded-2xl border p-4 text-left transition ${notification.readAt ? 'border-white/[0.06] bg-white/[0.025]' : 'border-gold-400/20 bg-gold-400/[0.06]'}`}>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? 'bg-white/15' : 'bg-gold-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white/90">{notification.title}</span>
                    <span className="mt-1 block text-sm leading-snug text-white/55">{notification.body}</span>
                    <span className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-white/25">{formatRelative(notification.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function formatRelative(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1_000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
