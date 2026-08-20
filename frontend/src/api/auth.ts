import { getDeviceContext } from '../capacitor';
import type { AuthTokens, UserResponse } from '../types';
import { apiFetch, getRefreshToken, setTokens } from './client';

type AuthResult = AuthTokens & {
  refreshToken?: string;
  verificationRequired?: boolean;
  verificationEmailSent?: boolean;
};

export async function signup(input: { email: string; password: string; displayName: string }) {
  const device = await getDeviceContext();
  const result = await apiFetch<AuthResult>('/auth/signup', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ ...input, device }),
  });
  await setTokens(result.accessToken, result.refreshToken);
  return result;
}

export async function login(input: { email: string; password: string }) {
  const device = await getDeviceContext();
  const result = await apiFetch<AuthResult>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ ...input, device }),
  });
  await setTokens(result.accessToken, result.refreshToken);
  return result;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  const device = await getDeviceContext();
  try {
    await apiFetch<void>('/auth/logout', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ ...(refreshToken ? { refreshToken } : {}), device }),
    });
  } finally {
    await setTokens(null, null);
  }
}

export const me = () => apiFetch<UserResponse>('/auth/me');

export const forgotPassword = (email: string) =>
  apiFetch<{ ok: boolean; message: string }>('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email }),
  });

export const resetPassword = (token: string, password: string) =>
  apiFetch<{ ok: boolean; message: string }>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token, password }),
  });

export const verifyEmail = (token: string) =>
  apiFetch<{ ok: boolean; message: string }>('/auth/verify-email', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token }),
  });

export const resendVerification = () =>
  apiFetch<{ ok: boolean; alreadyVerified: boolean }>('/auth/resend-verification', {
    method: 'POST',
  });

export const changePassword = (input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  revokeOtherSessions?: boolean;
}) =>
  apiFetch<{ ok: boolean; message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ revokeOtherSessions: true, ...input }),
  });

export type Session = {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  platform: 'IOS' | 'ANDROID' | 'WEB';
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};

export const listSessions = () => apiFetch<{ sessions: Session[] }>('/auth/sessions');
export const revokeSession = (id: string) =>
  apiFetch<{ ok: boolean }>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const logoutAll = () => apiFetch<{ ok: boolean }>('/auth/logout-all', { method: 'POST' });
