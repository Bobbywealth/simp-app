import type {
  DiscoveryPreferences,
  Gender,
  Interest,
  LookingFor,
  Profile,
  ProfileCompletion,
} from '../types';
import { apiFetch } from './client';

export type ProfileInput = {
  displayName: string;
  bio?: string | null;
  birthDate: string;
  gender: Gender;
  lookingFor: LookingFor;
  city?: string | null;
  occupation?: string | null;
  heightCm?: number | null;
  interestSlugs?: string[];
};

export const getMyProfile = () => apiFetch<Profile | null>('/users/me/profile');
export const upsertMyProfile = (input: ProfileInput) =>
  apiFetch<Profile>('/users/me/profile', { method: 'PUT', body: JSON.stringify(input) });
export const patchMyProfile = (input: Partial<ProfileInput>) =>
  apiFetch<Profile>('/users/me/profile', { method: 'PATCH', body: JSON.stringify(input) });
export const getProfileCompletion = () =>
  apiFetch<ProfileCompletion>('/users/me/profile/completion');
export const listInterests = () => apiFetch<Interest[]>('/users/interests', { auth: false });

export const getOnboardingState = () =>
  apiFetch<{
    onboardingState: Record<string, unknown> | null;
    onboardingStep: number;
    onboardingCompletedAt: string | null;
  }>('/users/me/onboarding');
export const saveOnboardingState = (step: number, state: Record<string, unknown>) =>
  apiFetch<{ onboardingState: Record<string, unknown>; onboardingStep: number }>(
    '/users/me/onboarding',
    { method: 'PATCH', body: JSON.stringify({ step, state }) },
  );
export const completeOnboarding = () =>
  apiFetch<{ ok: boolean }>('/users/me/onboarding/complete', { method: 'POST' });

export const getDiscoveryPreferences = () =>
  apiFetch<DiscoveryPreferences>('/users/me/discovery-preferences');
export const updateDiscoveryPreferences = (input: Partial<DiscoveryPreferences>) =>
  apiFetch<DiscoveryPreferences>('/users/me/discovery-preferences', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const requestProfileVerification = (note?: string) =>
  apiFetch<{ id: string; status: string }>('/users/me/verification/request', {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
