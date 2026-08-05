import { apiFetch } from './client';
import type { Interest, Profile } from '../types';

export function getMyProfile() {
  return apiFetch<Profile | null>('/users/me/profile');
}

export function upsertMyProfile(input: {
  displayName: string;
  bio?: string | null;
  birthDate: string;
  gender: 'WOMAN' | 'MAN' | 'NONBINARY' | 'PREFER_NOT_TO_SAY';
  lookingFor: 'WOMEN' | 'MEN' | 'EVERYONE';
  city?: string | null;
  occupation?: string | null;
  heightCm?: number | null;
  interestSlugs?: string[];
}) {
  return apiFetch<Profile>('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function listInterests() {
  return apiFetch<Interest[]>('/users/interests', { auth: false });
}
