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
