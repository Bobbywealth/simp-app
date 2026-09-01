import { Prisma } from '@prisma/client';
import type { VerificationStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { deleteCloudinaryAsset, cloudinaryDeliveryUrl } from './cloudinary.service.js';
import { processAndStoreVerificationSelfie, type StoredPhoto } from './photo.service.js';
import { enqueueAssetDeletion } from './asset-cleanup.service.js';

// Allowed pose prompts shown in the verification UI. We keep the set small
// and stable so the stored poseSequence is meaningful and comparable across
// submissions.
export const ALLOWED_POSES = new Set([
  'center',
  'left',
  'right',
  'smile',
  'eyes-open',
]);

type LivenessHints = {
  // Total number of frames captured during the verification flow. The
  // client should capture at least 3 (center + 2 movement prompts).
  framesCaptured?: number;
  // Whether the client-side liveness proxy detected that the face moved
  // between frames. Free-form from the client; moderators may ignore.
  faceMovedBetweenFrames?: boolean;
  // Capture timestamps in ISO-8601. Optional.
  capturedAt?: string[];
};

export type SubmitSelfieInput = {
  userId: string;
  file: Express.Multer.File;
  poseSequence: string[];
  livenessHints?: LivenessHints | null;
  userNote?: string | null;
};

export type VerificationStatusResponse = {
  status: VerificationStatus;
  isVerified: boolean;
  pendingRequest: {
    id: string;
    selfieUrl: string | null;
    poseSequence: string[];
    livenessHints: LivenessHints | null;
    createdAt: string;
    userNote: string | null;
  } | null;
  lastDecision: {
    id: string;
    status: VerificationStatus;
    reviewNote: string | null;
    reviewedAt: string;
  } | null;
  // Whether the user can submit a new request right now. False if they
  // already have a PENDING request with a selfie, or if their last
  // decision was REJECTED within the cooldown window.
  canResubmit: boolean;
  cooldownEndsAt: string | null;
};

// 24-hour cooldown after a REJECTED verification so users don't spam
// resubmissions with the same selfie. Approved verifications don't have
// a cooldown — users can re-verify if their photos change.
const REJECTED_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

export async function submitVerificationSelfie({
  userId,
  file,
  poseSequence,
  livenessHints,
  userNote,
}: SubmitSelfieInput): Promise<{ requestId: string; selfieUrl: string }> {
  // User must already have a profile before requesting verification.
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) {
    throw new AppError('profile_required', 409, 'Complete your profile before requesting verification.');
  }

  // User must have at least one approved profile photo for moderators to
  // compare the selfie against. Without one, the request is meaningless.
  const approvedPhotoCount = await prisma.photo.count({
    where: { userId, status: 'APPROVED' },
  });
  if (approvedPhotoCount === 0) {
    throw new AppError(
      'profile_photo_required',
      409,
      'Upload at least one profile photo before requesting verification.',
    );
  }

  // Sanitize pose sequence. We cap at 5 entries to match the UI prompt set.
  const sanitizedPoses: string[] = [];
  for (const pose of poseSequence) {
    const normalized = String(pose).trim().toLowerCase();
    if (ALLOWED_POSES.has(normalized)) sanitizedPoses.push(normalized);
    if (sanitizedPoses.length >= 5) break;
  }
  if (sanitizedPoses.length < 2) {
    throw new AppError(
      'insufficient_pose_sequence',
      400,
      'Complete at least two pose prompts before submitting.',
    );
  }

  // Store the selfie to Cloudinary (or local disk in non-prod).
  let stored: StoredPhoto;
  try {
    stored = await processAndStoreVerificationSelfie(file, userId);
  } catch (error) {
    logger.error({
      event: 'verification_selfie_upload_failed',
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // If the user already has a PENDING request with a selfie, replace it:
  // delete the old selfie from storage (best-effort) and update the row
  // in place. Otherwise create a fresh request.
  const previousPending = await prisma.profileVerificationRequest.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true, selfiePublicId: true, selfieUrl: true },
  });

  const hintsJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = livenessHints
    ? (livenessHints as unknown as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  const request = await prisma.$transaction(async (tx) => {
    if (previousPending) {
      const updated = await tx.profileVerificationRequest.update({
        where: { id: previousPending.id },
        data: {
          selfieUrl: stored.url,
          selfiePublicId: stored.publicId,
          poseSequence: sanitizedPoses,
          livenessHints: hintsJson,
          userNote: userNote?.trim().slice(0, 500) ?? null,
          createdAt: new Date(),
        },
        select: { id: true },
      });
      await tx.profile.update({
        where: { userId },
        data: { verificationStatus: 'PENDING', isVerified: false },
      });
      return updated;
    }
    const created = await tx.profileVerificationRequest.create({
      data: {
        userId,
        selfieUrl: stored.url,
        selfiePublicId: stored.publicId,
        poseSequence: sanitizedPoses,
        livenessHints: hintsJson,
        userNote: userNote?.trim().slice(0, 500) ?? null,
      },
      select: { id: true },
    });
    await tx.profile.update({
      where: { userId },
      data: { verificationStatus: 'PENDING', isVerified: false },
    });
    return created;
  });

  // Best-effort: delete the old selfie from storage after the DB swap.
  if (previousPending?.selfiePublicId || previousPending?.selfieUrl) {
    const old = { publicId: previousPending.selfiePublicId, url: previousPending.selfieUrl ?? '' };
    deleteVerificationSelfie(old).catch((error) => {
      logger.warn({
        event: 'verification_selfie_swap_cleanup_failed',
        previousId: previousPending.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  logger.info({
    event: 'verification_selfie_submitted',
    userId,
    requestId: request.id,
    poses: sanitizedPoses,
  });

  return { requestId: request.id, selfieUrl: cloudinaryDeliveryUrl(stored.url, 1_280) };
}

export async function cancelPendingVerification(userId: string): Promise<{ ok: true }> {
  const pending = await prisma.profileVerificationRequest.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true, selfieUrl: true, selfiePublicId: true },
  });
  if (!pending) return { ok: true };

  await prisma.$transaction([
    prisma.profileVerificationRequest.delete({ where: { id: pending.id } }),
    prisma.profile.update({
      where: { userId },
      data: { verificationStatus: 'NOT_REQUESTED', isVerified: false },
    }),
  ]);

  if (pending.selfiePublicId || pending.selfieUrl) {
    await deleteVerificationSelfie({ publicId: pending.selfiePublicId, url: pending.selfieUrl ?? '' });
  }
  return { ok: true };
}

export async function getVerificationStatus(userId: string): Promise<VerificationStatusResponse> {
  const [profile, pending, lastDecision] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { isVerified: true, verificationStatus: true },
    }),
    prisma.profileVerificationRequest.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.profileVerificationRequest.findFirst({
      where: { userId, status: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: { reviewedAt: 'desc' },
    }),
  ]);

  const status: VerificationStatus = profile?.verificationStatus ?? 'NOT_REQUESTED';
  const isVerified = Boolean(profile?.isVerified);

  let canResubmit = true;
  let cooldownEndsAt: string | null = null;

  if (pending?.selfieUrl) {
    canResubmit = false;
  } else if (lastDecision?.status === 'REJECTED' && lastDecision.reviewedAt) {
    const ends = new Date(lastDecision.reviewedAt.getTime() + REJECTED_COOLDOWN_MS);
    if (ends > new Date()) {
      canResubmit = false;
      cooldownEndsAt = ends.toISOString();
    }
  }

  return {
    status,
    isVerified,
    pendingRequest: pending
      ? {
          id: pending.id,
          selfieUrl: pending.selfieUrl ? cloudinaryDeliveryUrl(pending.selfieUrl, 1_280) : null,
          poseSequence: pending.poseSequence,
          livenessHints: (pending.livenessHints as LivenessHints | null) ?? null,
          createdAt: pending.createdAt.toISOString(),
          userNote: pending.userNote,
        }
      : null,
    lastDecision: lastDecision
      ? {
          id: lastDecision.id,
          status: lastDecision.status,
          reviewNote: lastDecision.reviewNote,
          reviewedAt: lastDecision.reviewedAt?.toISOString() ?? new Date(0).toISOString(),
        }
      : null,
    canResubmit,
    cooldownEndsAt,
  };
}

// Delete a verification selfie from Cloudinary (or enqueue fallback).
// Used both by the cancel flow and by admin rejection cleanup.
export async function deleteVerificationSelfie(selfie: {
  publicId: string | null;
  url: string;
}): Promise<boolean> {
  if (!selfie.publicId && !selfie.url) return false;
  const deleted = await deleteCloudinaryAsset(selfie.publicId ?? selfie.url, {
    isPublicId: Boolean(selfie.publicId),
  });
  if (!deleted) {
    await enqueueAssetDeletion({ publicId: selfie.publicId, url: selfie.url });
  }
  return deleted;
}