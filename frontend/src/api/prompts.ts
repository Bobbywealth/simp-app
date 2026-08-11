import { apiFetch } from './client';

export interface Prompt {
  id: string;
  userId: string;
  question: string;
  answer: string;
  position: number;
  createdAt: string;
}

export function listMyPrompts() {
  return apiFetch<{ prompts: Prompt[] }>('/users/me/prompts');
}

export function createPrompt(input: {
  question: string;
  answer: string;
  position?: number;
}) {
  return apiFetch<Prompt>('/users/me/prompts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deletePrompt(id: string) {
  return apiFetch<{ ok: boolean }>(`/users/me/prompts/${id}`, { method: 'DELETE' });
}

export function patchMyProfile(input: Record<string, unknown>) {
  return apiFetch<{ ok: boolean }>('/users/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
