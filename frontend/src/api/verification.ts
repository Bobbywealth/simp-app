import { apiFetch } from './client';

export type VerificationPose = 'center' | 'left' | 'right' | 'smile' | 'eyes-open';

export type LivenessHints = {
  framesCaptured?: number;
  faceMovedBetweenFrames?: boolean;
  capturedAt?: string[];
};

export type VerificationStatus = {
  status: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  pendingRequest: {
    id: string;
    selfieUrl: string | null;
    poseSequence: VerificationPose[];
    livenessHints: LivenessHints | null;
    createdAt: string;
    userNote: string | null;
  } | null;
  lastDecision: {
    id: string;
    status: 'APPROVED' | 'REJECTED';
    reviewNote: string | null;
    reviewedAt: string;
  } | null;
  canResubmit: boolean;
  cooldownEndsAt: string | null;
};

export function getVerificationStatus() {
  return apiFetch<VerificationStatus>('/me/verification/status');
}

export function submitVerificationSelfie(input: {
  file: Blob;
  poseSequence: VerificationPose[];
  livenessHints?: LivenessHints | null;
  userNote?: string | null;
}) {
  const form = new FormData();
  form.append('selfie', input.file, 'selfie.webp');
  form.append('poseSequence', JSON.stringify(input.poseSequence));
  if (input.livenessHints) form.append('livenessHints', JSON.stringify(input.livenessHints));
  if (input.userNote) form.append('userNote', input.userNote);
  return apiFetch<{ ok: true; requestId: string; selfieUrl: string }>('/me/verification/selfie', {
    method: 'POST',
    body: form,
  });
}

export function cancelVerificationSelfie() {
  return apiFetch<{ ok: true }>('/me/verification/selfie', { method: 'DELETE' });
}