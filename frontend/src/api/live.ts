import { apiFetch } from './client';

export interface LiveStreamBroadcaster {
  userId: string;
  displayName: string;
  age: number | null;
  photoUrl: string | null;
  isVerified: boolean;
  isPremium: boolean;
}

export interface LiveStream {
  id: string;
  title: string;
  startedAt: string;
  viewerCount: number;
  heartCount: number;
  broadcaster: LiveStreamBroadcaster | null;
}

export interface LiveChatMessage {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

export function listLiveStreams() {
  return apiFetch<{ streams: LiveStream[]; nextCursor?: string | null; hasMore?: boolean }>('/live/streams');
}

export function getLiveStream(streamId: string) {
  return apiFetch<LiveStream>(`/live/streams/${encodeURIComponent(streamId)}`);
}

export function startStream(title: string, forceReplace = false) {
  return apiFetch<{ streamId: string; startedAt: string }>('/live/streams', {
    method: 'POST',
    body: JSON.stringify({ title, forceReplace }),
  });
}

export function endStream(streamId: string) {
  return apiFetch<{ ok: boolean }>(`/live/streams/${streamId}/end`, {
    method: 'POST',
  });
}

export function getStreamChat(streamId: string) {
  return apiFetch<{ messages: LiveChatMessage[] }>(`/live/streams/${streamId}/chat`);
}

export function reportStream(streamId: string, reason: string, details?: string) {
  return apiFetch<{ ok: true; alreadyReported?: boolean }>(`/live/streams/${streamId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, details }),
  });
}

export function moderateLiveUser(streamId: string, userId: string, action: 'MUTE' | 'REMOVE', reason?: string) {
  return apiFetch<{ ok: true }>(`/live/streams/${encodeURIComponent(streamId)}/moderation`, {
    method: 'POST', body: JSON.stringify({ userId, action, reason }),
  });
}
