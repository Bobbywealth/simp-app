import { apiFetch } from './client';

export type ExperienceCategory =
  | 'DINNER'
  | 'DRINKS'
  | 'EVENT'
  | 'CONCERT'
  | 'TRAVEL'
  | 'SHOPPING'
  | 'ADVENTURE'
  | 'VIP'
  | 'OTHER';

export type ExperienceStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';

export type ExperienceRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';

export interface ExperienceHost {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  age?: number | null;
}

export interface Experience {
  id: string;
  title: string;
  description: string | null;
  category: ExperienceCategory;
  city: string;
  startsAt: string;
  priceCents: number | null;
  currency: string;
  capacity: number | null;
  imageUrl: string | null;
  status: ExperienceStatus;
  host: ExperienceHost;
  approvedCount: number;
  venue: string | null;
  logistics: string | null;
}

export interface MyExperienceRequest {
  id: string;
  status: ExperienceRequestStatus;
  note: string | null;
}

export interface ExperienceDetail extends Experience {
  isHost: boolean;
  myRequest: MyExperienceRequest | null;
}

export interface ExperienceRequestItem {
  id: string;
  note: string | null;
  status: ExperienceRequestStatus;
  createdAt: string;
  requester: {
    id: string;
    displayName: string | null;
    photoUrl: string | null;
    age: number | null;
  };
}

export interface CreateExperienceInput {
  title: string;
  description?: string;
  category: ExperienceCategory;
  city: string;
  startsAt: string;
  priceCents?: number;
  currency?: string;
  capacity: number;
  imageUrl?: string;
  venue?: string;
  logistics?: string;
}

export interface UpdateExperienceInput {
  title?: string;
  description?: string;
  startsAt?: string;
  capacity?: number;
  imageUrl?: string;
}

export interface ListExperiencesParams {
  city?: string;
  category?: ExperienceCategory;
  cursor?: string | null;
  limit?: number;
}

export function createExperience(input: CreateExperienceInput) {
  return apiFetch<{ id: string }>('/experiences', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listExperiences(params: ListExperiencesParams = {}) {
  const search = new URLSearchParams();
  if (params.city) search.set('city', params.city);
  if (params.category) search.set('category', params.category);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  const qs = search.toString();
  return apiFetch<{ experiences: Experience[]; nextCursor: string | null; hasMore: boolean }>(
    `/experiences${qs ? `?${qs}` : ''}`,
  );
}

export function getMyExperiences(role: 'hosted' | 'joined') {
  return apiFetch<{ experiences: Experience[] }>(`/experiences/mine?role=${role}`);
}

export function getExperience(id: string) {
  return apiFetch<ExperienceDetail>(`/experiences/${id}`);
}

export function updateExperience(id: string, patch: UpdateExperienceInput) {
  return apiFetch<Experience>(`/experiences/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function cancelExperience(id: string) {
  return apiFetch<Experience>(`/experiences/${id}/cancel`, {
    method: 'POST',
  });
}

export function requestToJoin(id: string, note?: string) {
  return apiFetch<{ request: { id: string; status: ExperienceRequestStatus; note: string | null; createdAt: string } }>(`/experiences/${id}/requests`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {}),
  });
}

export function cancelMyRequest(id: string) {
  return apiFetch<{ id: string; status: ExperienceRequestStatus }>(`/experiences/${id}/requests/mine`, {
    method: 'DELETE',
  });
}

export function getExperienceRequests(id: string) {
  return apiFetch<{ requests: ExperienceRequestItem[] }>(`/experiences/${id}/requests`);
}

export function approveRequest(experienceId: string, requestId: string) {
  return apiFetch<{
    request: ExperienceRequestItem;
    approvedCount: number;
    experienceStatus: ExperienceStatus;
  }>(`/experiences/${experienceId}/requests/${requestId}/approve`, {
    method: 'POST',
  });
}

export function declineRequest(experienceId: string, requestId: string) {
  return apiFetch<{ request: ExperienceRequestItem }>(
    `/experiences/${experienceId}/requests/${requestId}/decline`,
    { method: 'POST' },
  );
}

export function removeGuest(experienceId: string, requestId: string) {
  return apiFetch<{ request: ExperienceRequestItem }>(
    `/experiences/${experienceId}/requests/${requestId}`,
    { method: 'DELETE' },
  );
}
