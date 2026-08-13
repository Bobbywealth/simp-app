const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setTokens(a: string | null, r: string | null) {
  accessToken = a;
  refreshToken = r;
  if (a) localStorage.setItem('simp_access', a);
  else localStorage.removeItem('simp_access');
  if (r) localStorage.setItem('simp_refresh', r);
  else localStorage.removeItem('simp_refresh');
}

export function loadTokens() {
  accessToken = localStorage.getItem('simp_access');
  refreshToken = localStorage.getItem('simp_refresh');
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        setTokens(null, null);
        return false;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setTokens(data.accessToken, data.refreshToken);
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
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (auth && accessToken) finalHeaders['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });

  if (res.status === 401 && auth && refreshToken) {
    const ok = await tryRefresh();
    if (ok) {
      finalHeaders['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${BASE_URL}${path}`, { ...rest, headers: finalHeaders });
      if (!retry.ok) throw await toError(retry);
      return (await retry.json()) as T;
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function toError(res: Response) {
  let body: { error?: string; message?: string; [k: string]: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  const err = new Error(body.message || body.error || `Request failed (${res.status})`) as Error & {
    status?: number;
    code?: string;
    /// Extra fields from the response body (e.g. `missing` from
    /// 451 legal_compliance_required). Lets callers react to structured
    /// error payloads without re-fetching.
    details?: Record<string, unknown>;
  };
  err.status = res.status;
  err.code = body.error;
  // Strip the two well-known fields, keep the rest as `details`.
  const { error: _e, message: _m, ...rest } = body;
  void _e;
  void _m;
  if (Object.keys(rest).length > 0) err.details = rest;
  return err;
}

export const API_BASE_URL = BASE_URL;
