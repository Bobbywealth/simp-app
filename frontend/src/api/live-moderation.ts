import { apiFetch } from './client';

export interface LiveRecording {
  egressId: string;
  status: 'complete' | 'failed' | string;
  url: string | null;
}

export function listLiveRecordings(streamId: string) {
  return apiFetch<{ recordings: LiveRecording[] }>(
    `/admin/live/recordings?streamId=${encodeURIComponent(streamId)}`,
  );
}
