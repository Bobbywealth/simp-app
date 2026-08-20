import type { InAppNotification } from '../types';
import { apiFetch } from './client';

export const getNotifications = (cursor?: string) =>
  apiFetch<{ notifications: InAppNotification[]; nextCursor: string | null; hasMore: boolean }>(
    `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  );
export const getNotificationUnreadCount = () =>
  apiFetch<{ count: number }>('/notifications/unread-count');
export const markNotificationRead = (id: string) =>
  apiFetch<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = () =>
  apiFetch<{ ok: boolean; count: number }>('/notifications/read-all', { method: 'PATCH' });

export type NotificationPreferences = {
  matches: boolean;
  messages: boolean;
  likes: boolean;
  live: boolean;
  security: boolean;
  marketing: boolean;
};
export const getNotificationPreferences = () =>
  apiFetch<NotificationPreferences>('/users/me/notification-preferences');
export const updateNotificationPreferences = (input: Partial<NotificationPreferences>) =>
  apiFetch<NotificationPreferences>('/users/me/notification-preferences', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const registerPushToken = (input: {
  token: string;
  deviceId?: string;
  deviceName?: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
}) =>
  apiFetch<{ id: string; active: boolean }>('/users/me/push-tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  });

// --- Web Push (PWA) ---------------------------------------------------------
// The backend exposes the VAPID public key at /push/vapid-public-key (no auth).
// Once the browser holds a PushSubscription, the frontend posts it to
// /users/me/push-subscriptions with auth so the backend can deliver.

export type PushSubscriptionKeys = { p256dh: string; auth: string };
export type PushSubscriptionPayload = {
  endpoint: string;
  keys: PushSubscriptionKeys;
  deviceId?: string;
  deviceName?: string;
};

export const getVapidPublicKey = () =>
  apiFetch<{ publicKey: string }>('/push/vapid-public-key');

export const registerPushSubscription = (input: PushSubscriptionPayload) =>
  apiFetch<{ id: string; endpoint: string; active: boolean }>(
    '/users/me/push-subscriptions',
    { method: 'POST', body: JSON.stringify(input) },
  );

export const unregisterPushSubscription = (id: string) =>
  apiFetch<{ ok: boolean }>(
    `/users/me/push-subscriptions/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function subscribeToWebPush(): Promise<{ id: string } | null> {
  if (!pushSupported()) return null;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await getVapidPublicKey().catch(() => ({ publicKey: '' }));
  if (!publicKey) return null;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  const result = await registerPushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    deviceId: deviceFingerprint(),
    deviceName: browserInfo(),
  });
  return { id: result.id };
}

export async function unsubscribeFromWebPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  return subscription.unsubscribe();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceFingerprint(): string {
  try {
    const stored = localStorage.getItem('simp:device-id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem('simp:device-id', id);
    return id;
  } catch {
    return 'unknown';
  }
}

function browserInfo(): string {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Safari PWA';
  if (/Android/.test(ua)) return 'Android Chrome PWA';
  if (/Edg\//.test(ua)) return 'Edge PWA';
  if (/Firefox\//.test(ua)) return 'Firefox PWA';
  if (/Chrome\//.test(ua)) return 'Chrome PWA';
  if (/Safari\//.test(ua)) return 'Safari PWA';
  return 'Web PWA';
}
