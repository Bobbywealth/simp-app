import { apiFetch } from './client';

export const REPORT_REASONS = [
  'Fake photos or profile',
  'Inappropriate content',
  'Harassment or hate speech',
  'Spam or scam',
  'Underage',
  'Other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function blockUser(blockedId: string) {
  return apiFetch<{ ok: boolean }>('/blocks', {
    method: 'POST',
    body: JSON.stringify({ blockedId }),
  });
}

export function unblockUser(blockedId: string) {
  return apiFetch<{ ok: boolean }>(`/blocks/${blockedId}`, { method: 'DELETE' });
}

export function reportUser(reportedId: string, reason: ReportReason, details?: string) {
  return apiFetch<{ reportId: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify({ reportedId, reason, details }),
  });
}

export function listBlocks() {
  return apiFetch<{
    blocks: Array<{ blockedId: string; displayName: string; createdAt: string }>;
  }>('/blocks');
}
