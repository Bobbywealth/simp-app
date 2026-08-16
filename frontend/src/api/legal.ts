import { apiFetch } from './client';

export interface LegalStatus {
  ageConfirmed: boolean;
  ageConfirmedAt: string | null;
  tosAccepted: boolean;
  tosVersion: string | null;
  tosCurrentVersion: string | null;
  privacyAccepted: boolean;
  privacyVersion: string | null;
  privacyCurrentVersion: string | null;
}

export interface LegalDocument {
  type: 'tos' | 'privacy';
  version: string;
  summary: string;
  /// Full markdown content of the document. Render however you like; the
  /// LegalGateModal uses a simple preformatted block.
  content: string;
  effectiveAt: string;
}

export function getLegalStatus() {
  return apiFetch<LegalStatus>('/legal/status');
}

export function getTos() {
  return apiFetch<LegalDocument>('/legal/tos');
}

export function getPrivacy() {
  return apiFetch<LegalDocument>('/legal/privacy');
}

export function confirmAge() {
  return apiFetch<{ ok: true }>('/legal/confirm-age', {
    method: 'POST',
    body: JSON.stringify({ confirm: true }),
  });
}

export function acceptLegal(type: 'tos' | 'privacy', version: string) {
  return apiFetch<{ ok: true; type: string; version: string }>('/legal/accept', {
    method: 'POST',
    body: JSON.stringify({ type, version }),
  });
}
