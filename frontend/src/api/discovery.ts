import { apiFetch } from './client';
import type { DiscoveryProfile } from '../types';

export function getDiscovery() {
  return apiFetch<{ profiles: DiscoveryProfile[] }>('/discovery');
}
