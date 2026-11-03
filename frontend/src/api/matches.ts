import { apiFetch } from './client';
import type { MatchDetail, MatchSummary } from '../types';

export function getMatches(cursor?: string) {
  return apiFetch<{ matches: MatchSummary[]; nextCursor: string | null; hasMore: boolean }>(`/matches${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
}

export function getMatch(id: string) {
  return apiFetch<MatchDetail>(`/matches/${id}`);
}

export function unmatch(id: string) {
  return apiFetch<{ ok: boolean }>(`/matches/${id}/unmatch`, {
    method: 'POST',
  });
}
