import { apiFetch } from './client';
import type { LiveStream } from './live';

export interface AdminStats {
  users: number;
  activeMatches: number;
  messages: number;
  liveStreams: number;
  openReports: number;
  pendingVerification: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  emailVerified: boolean;
  role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  statusReason: string | null;
  suspendedUntil: string | null;
  createdAt: string;
  profile: {
    displayName: string | null;
    isVerified: boolean;
    verificationStatus: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  } | null;
  _count: {
    photos: number;
    reportsReceived: number;
    moderationActionsReceived: number;
  };
}

export interface AdminReportRow {
  id: string;
  category: string;
  status: 'OPEN' | 'REVIEWING' | 'ACTIONED' | 'DISMISSED';
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: { id: string; profile: { displayName: string | null } | null };
  reported: { id: string; profile: { displayName: string | null } | null };
  moderator: { id: string; profile: { displayName: string | null } | null } | null;
  stream: { id: string; title: string; status: string } | null;
}

export interface AdminVerificationRow {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  userNote: string | null;
  reviewNote: string | null;
  selfieUrl: string | null;
  poseSequence: string[];
  livenessHints: { framesCaptured?: number; faceMovedBetweenFrames?: boolean } | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    profile: {
      displayName: string | null;
      verificationStatus: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
      isVerified: boolean;
    } | null;
    photos: Array<{ id: string; url: string; thumbnailUrl?: string | null; position: number }>;
  };
}

export interface AdminModerationHistoryRow {
  id: string;
  action: string;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  moderator: { id: string; profile: { displayName: string | null } | null };
}

export interface AdminHealth {
  status: 'ready' | 'degraded' | 'unavailable';
  database?: boolean;
  integrations?: {
    persistentStorage: boolean;
    email: boolean;
    push: boolean;
    turn: boolean;
    livekit: boolean;
    apple: boolean;
  };
  degradedFeatures?: string[];
}

export function getAdminStats() {
  return apiFetch<AdminStats>('/admin/stats');
}

export function listAdminUsers(params: { cursor?: string; limit?: number; query?: string; status?: AdminUserRow['status'] }) {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.query) search.set('query', params.query);
  if (params.status) search.set('status', params.status);
  return apiFetch<{ users: AdminUserRow[]; nextCursor: string | null; hasMore: boolean }>(`/admin/users${search.toString() ? `?${search.toString()}` : ''}`);
}

export function updateAdminUserStatus(
  id: string,
  input: { status: 'ACTIVE' | 'SUSPENDED' | 'BANNED'; reason: string; suspendedUntil?: string | null },
) {
  return apiFetch<{ ok: true; status: string }>(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateAdminUserRole(id: string, input: { role: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN'; reason: string }) {
  return apiFetch<{ ok: true; role: string }>(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function listAdminReports(params: { cursor?: string; limit?: number; status?: AdminReportRow['status'] }) {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.status) search.set('status', params.status);
  return apiFetch<{ reports: AdminReportRow[]; nextCursor: string | null; hasMore: boolean }>(`/admin/reports${search.toString() ? `?${search.toString()}` : ''}`);
}

export function getAdminReport(id: string) {
  return apiFetch<AdminReportRow>(`/admin/reports/${encodeURIComponent(id)}`);
}

export function updateAdminReport(id: string, input: { status: 'REVIEWING' | 'ACTIONED' | 'DISMISSED'; moderatorNotes: string }) {
  return apiFetch<AdminReportRow>(`/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteAdminPhoto(id: string, reason: string) {
  return apiFetch<{ ok: true }>(`/admin/photos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

export function endAdminLiveStream(id: string, reason: string) {
  return apiFetch<{ ok: true }>(`/admin/live/${encodeURIComponent(id)}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function listAdminVerifications(status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING') {
  return apiFetch<{ requests: AdminVerificationRow[] }>(`/admin/verifications?status=${encodeURIComponent(status)}`);
}

export function reviewAdminVerification(id: string, input: { status: 'APPROVED' | 'REJECTED'; reviewNote: string }) {
  return apiFetch<{ ok: true; status: string }>(`/admin/verifications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getAdminModerationHistory(userId: string) {
  return apiFetch<{ actions: AdminModerationHistoryRow[] }>(
    `/admin/users/${encodeURIComponent(userId)}/moderation-history`,
  );
}

export function getBackendHealth() {
  return apiFetch<AdminHealth>('/health/ready', { auth: false });
}

export function listAdminLiveStreams() {
  return apiFetch<{ streams: LiveStream[] }>('/live/streams');
}

// --- Custom broadcasts (admin → user push composer) -----------------------

export type BroadcastAudience =
  | 'all'
  | 'verified'
  | 'pushable'
  | 'role:USER'
  | 'role:MODERATOR'
  | 'role:ADMIN'
  | 'role:SUPER_ADMIN';

export const BROADCAST_AUDIENCES: { value: BroadcastAudience; label: string; description: string }[] = [
  { value: 'all', label: 'All active users', description: 'Every account with status = ACTIVE.' },
  { value: 'verified', label: 'Verified profiles only', description: 'Active users whose profile is verified.' },
  { value: 'pushable', label: 'Users with a push token', description: 'Active users with at least one registered FCM/APNs token — most likely to deliver.' },
  { value: 'role:USER', label: 'Standard users', description: 'Active USER-role accounts only.' },
  { value: 'role:MODERATOR', label: 'Moderators', description: 'Active MODERATOR-role accounts.' },
  { value: 'role:ADMIN', label: 'Admins + super admins', description: 'Active ADMIN and SUPER_ADMIN accounts.' },
  { value: 'role:SUPER_ADMIN', label: 'Super admins only', description: 'Active SUPER_ADMIN accounts.' },
];

export interface AdminBroadcast {
  id: string;
  audience: string;
  title: string;
  body: string;
  route: string | null;
  targeted: number;
  dispatched: number;
  failed: number;
  createdAt: string;
  actor: { id: string; displayName: string } | null;
}

export function sendAdminBroadcast(input: {
  title: string;
  body: string;
  audience: BroadcastAudience;
  route?: string;
}) {
  return apiFetch<{
    broadcastId: string;
    targeted: number;
    dispatched: number;
    failed: number;
    audience: BroadcastAudience;
  }>('/admin/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listAdminBroadcasts(params: { cursor?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  return apiFetch<{ broadcasts: AdminBroadcast[]; nextCursor: string | null }>(
    `/admin/notifications/broadcasts${search.toString() ? `?${search.toString()}` : ''}`,
  );
}

export const BROADCAST_ROUTE_PRESETS: { label: string; route: string }[] = [
  { label: 'Home feed', route: '/home' },
  { label: 'Matches', route: '/matches' },
  { label: 'Messages', route: '/messages' },
  { label: 'Profile', route: '/profile' },
  { label: 'Settings', route: '/settings' },
];
