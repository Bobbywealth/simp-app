import { apiFetch } from './client';
import type { ReceivedNote, SwipeAction, SwipeResult } from '../types';

export function createSwipe(input: {
  swipedId: string;
  action: SwipeAction;
  note?: string | null;
}) {
  return apiFetch<SwipeResult>('/swipes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getReceivedNotes() {
  return apiFetch<{ notes: ReceivedNote[] }>('/swipes/received-notes');
}

export function undoSwipe(swipeId: string) {
  return apiFetch<{ ok: boolean; swipedId: string }>(`/swipes/${swipeId}`, {
    method: 'DELETE',
  });
}
