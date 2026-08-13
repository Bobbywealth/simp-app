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
  return apiFetch<{ streams: LiveStream[] }>('/live/streams');
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
