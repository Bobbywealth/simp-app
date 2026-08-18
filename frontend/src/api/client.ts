import {
  getDeviceContext,
  hydrateRefreshTokenNative,
  isNative,
  persistRefreshTokenNative,
} from '../capacitor';

const BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 15_000;

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  status?: number;
  code?: string;
  fieldErrors: Record<string, string[]> = {};
  details?: Record<string, unknown>;
  requestId?: string;
}

export async function setTokens(access: string | null, refresh?: string | null) {
  accessToken = access;
  if (refresh !== undefined) refreshToken = refresh;
  // Remove legacy persistent web tokens. Web refresh is now an HttpOnly cookie.
  localStorage.removeItem('simp_access');
  localStorage.removeItem('simp_refresh');
  sessionStorage.removeItem('simp_access');
  if (isNative() && refresh !== undefined) await persistRefreshTokenNative(refresh ?? null);
  window.dispatchEvent(new CustomEvent('simp:token', { detail: { accessToken: access } }));
}

export async function loadTokens() {
  // One-time migration for sessions created by versions that used localStorage.
  accessToken = localStorage.getItem('simp_access') ?? sessionStorage.getItem('simp_access');
  const legacyRefresh = localStorage.getItem('simp_refresh');
  refreshToken = isNative() ? await hydrateRefreshTokenNative() : legacyRefresh;
  localStorage.removeItem('simp_access');
  localStorage.removeItem('simp_refresh');
  sessionStorage.removeItem('simp_access');
}

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      const timeoutError = new ApiError('The request timed out. Try again.');
      timeoutError.code = 'request_timeout';
      throw timeoutError;
    }
    const networkError = new ApiError(
      navigator.onLine ? 'Unable to reach SIMP. Try again.' : 'You are offline. Reconnect and try again.',
    );
    networkError.code = navigator.onLine ? 'network_error' : 'offline';
    throw networkError;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const device = await getDeviceContext();
      const response = await fetchWithTimeout(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(refreshToken ? { refreshToken } : {}),
          device,
        }),
      });
      if (!response.ok) {
        await setTokens(null, null);
        return false;
      }
      const data = (await response.json()) as { accessToken: string; refreshToken?: string };
      await setTokens(data.accessToken, data.refreshToken ?? refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (rest.body && !(rest.body instanceof FormData) && !finalHeaders.has('Content-Type')) {
    finalHeaders.set('Content-Type', 'application/json');
  }
  if (auth && accessToken) finalHeaders.set('Authorization', `Bearer ${accessToken}`);

  let response = await fetchWithTimeout(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });
  if (response.status === 401 && auth && (await refreshAccessToken())) {
    finalHeaders.set('Authorization', `Bearer ${accessToken}`);
    response = await fetchWithTimeout(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });
  }

  if (!response.ok) throw await toError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toError(response: Response) {
  let body: {
    error?: string;
    message?: string;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>;
    requestId?: string;
  } = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON provider/proxy errors are normalized below.
  }
  const error = new ApiError(body.message || body.error || `Request failed (${response.status})`);
  error.status = response.status;
  error.code = body.error;
  error.fieldErrors = body.fieldErrors ?? {};
  error.details = body.details;
  error.requestId = body.requestId;
  return error;
}

export const API_BASE_URL = BASE_URL;
