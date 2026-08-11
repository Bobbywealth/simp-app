import { apiFetch } from './client';
import type { MatchDetail, MatchSummary } from '../types';

export function getMatches() {
  return apiFetch<{ matches: MatchSummary[] }>('/matches');
}

export function getMatch(id: string) {
  return apiFetch<MatchDetail>(`/matches/${id}`);
}

export function unmatch(id: string) {
  return apiFetch<{ ok: boolean }>(`/matches/${id}/unmatch`, {
    method: 'POST',
  });
}
