import { apiFetch } from './client';

export interface LivekitConfig {
  url: string;
  recordingEnabled: boolean;
}

/**
 * Fetch the public LiveKit WebSocket URL + recording flag. Returns null
 * when the backend hasn't configured LiveKit yet, so the frontend can
 * fall back to the legacy WebRTC mesh path during the rollout.
 */
export async function fetchLivekitConfig(): Promise<LivekitConfig | null> {
  try {
    return await apiFetch<LivekitConfig>('/config/livekit');
  } catch (error) {
    // 204 / network failures all funnel into "no LiveKit" so the page
    // keeps working in legacy mode.
    if ((error as { status?: number })?.status === 204) return null;
    return null;
  }
}

export interface LiveToken {
  token: string;
  url: string;
  roomName: string;
  isBroadcaster: boolean;
}

export function requestLiveToken(streamId: string, isBroadcaster = false) {
  return apiFetch<LiveToken>('/live/token', {
    method: 'POST',
    body: JSON.stringify({ streamId, isBroadcaster }),
  });
}
