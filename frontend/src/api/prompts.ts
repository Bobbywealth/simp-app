import { apiFetch } from './client';

export interface Prompt {
  id: string;
  userId: string;
  question: string;
  answer: string;
  position: number;
  createdAt: string;
  updatedAt: string;
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

export function updatePrompt(id: string, input: { question?: string; answer?: string }) {
  return apiFetch<Prompt>(`/users/me/prompts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePrompt(id: string) {
  return apiFetch<{ ok: boolean }>(`/users/me/prompts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function reorderPrompts(ids: string[]) {
  return apiFetch<{ prompts: Prompt[] }>('/users/me/prompts/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}
