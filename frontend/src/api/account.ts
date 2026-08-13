import { apiFetch } from './client';

export interface DataExportResponse {
  exportedAt: string;
  schemaVersion: number;
  user: unknown;
  profile: unknown;
  photos: unknown[];
  interests: unknown[];
  prompts: unknown[];
  swipesMade: unknown[];
  swipesReceived: unknown[];
  matchesAsA: unknown[];
  matchesAsB: unknown[];
  blocksMade: unknown[];
  blocksReceived: unknown[];
  reportsMade: unknown[];
  reportsReceived: unknown[];
  streamsBroadcast: unknown[];
  liveChatMessages: unknown[];
  tosAcceptances: unknown[];
  activeSessionCount: number;
}

/**
 * Download a full copy of the user's personal data. Triggered from
 * Settings → Privacy → Download my data. Resolves to a Blob the
 * frontend can offer as a file download.
 *
 * Bypasses the JSON parse in apiFetch so we can get the raw bytes —
 * the response is large and we want to stream it directly to a file
 * rather than hold it as a string.
 */
export async function exportMyData(): Promise<Blob> {
  const accessToken = localStorage.getItem('simp_access');
  const res = await fetch(
    `${(await import('./client')).API_BASE_URL}/account/me/export`,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }
  );
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  return res.blob();
}

/**
 * Hard-delete the user's account and all associated personal data.
 *
 * Required by:
 *   - Apple App Store Guideline 5.1.1(v)
 *   - Google Play Account Deletion requirement
 *   - GDPR Article 17 (right to erasure)
 *   - CCPA / CPRA right to delete
 *
 * The backend cascades through Profile, Photo, Swipe, Match, Prompt,
 * Block, Report, LiveStream, LiveChatMessage, TosAcceptance, and
 * RefreshToken before deleting the User row. Photos are also removed
 * from Cloudinary (best-effort). After this call the user must sign
 * up again to use the app.
 */
export function deleteMyAccount(password: string, confirm: 'DELETE') {
  return apiFetch<{ ok: true }>('/account/me', {
    method: 'DELETE',
    body: JSON.stringify({ password, confirm }),
  });
}
