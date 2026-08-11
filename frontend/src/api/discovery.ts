import { apiFetch } from './client';
import type { DiscoveryProfile } from '../types';

export interface DiscoveryParams {
  minAge?: number;
  maxAge?: number;
  cursor?: string | null;
  limit?: number;
}

export function getDiscovery(params: DiscoveryParams = {}) {
  const search = new URLSearchParams();
  if (params.minAge !== undefined) search.set('minAge', String(params.minAge));
  if (params.maxAge !== undefined) search.set('maxAge', String(params.maxAge));
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const qs = search.toString();
  return apiFetch<{ profiles: DiscoveryProfile[]; nextCursor: string | null; hasMore: boolean }>(
    `/discovery${qs ? `?${qs}` : ''}`
  );
}
