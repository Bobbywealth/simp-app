import { API_BASE_URL, ApiError, apiFetch, getAccessToken, refreshAccessToken } from './client';

export async function exportMyData(): Promise<Blob> {
  const request = () =>
    fetch(`${API_BASE_URL}/account/me/export`, {
      credentials: 'include',
      headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
    });
  let response = await request();
  if (response.status === 401 && (await refreshAccessToken())) response = await request();
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    const error = new ApiError(body.message ?? body.error ?? 'Your data export could not be prepared.');
    error.status = response.status;
    error.code = body.error;
    throw error;
  }
  return response.blob();
}

export const deleteMyAccount = (password: string, confirm: 'DELETE') =>
  apiFetch<{ ok: true }>('/account/me', {
    method: 'DELETE',
    body: JSON.stringify({ password, confirm }),
  });
