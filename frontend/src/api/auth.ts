import { apiFetch, setTokens } from './client';
import type { AuthTokens, UserResponse } from '../types';

export async function signup(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthTokens> {
  const tokens = await apiFetch<AuthTokens>('/auth/signup', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(input),
  });
  setTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const tokens = await apiFetch<AuthTokens>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(input),
  });
  setTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export async function logout() {
  const refreshToken = localStorage.getItem('simp_refresh');
  try {
    if (refreshToken) {
      await apiFetch<void>('/auth/logout', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // ignore
  }
  setTokens(null, null);
}

export async function me(): Promise<UserResponse> {
  return apiFetch<UserResponse>('/auth/me');
}
