import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  cancelPendingVerification,
  getVerificationStatus,
  submitVerificationSelfie,
} from '../services/verification.service.js';

export const verificationRouter = Router();

// Verification selfies are limited to 5 MB and a single file per submission.
// Lower than profile photos because moderator review only needs a clear
// face shot, not full-resolution imagery.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8 },
});

// Throttle selfie uploads to 5 per hour per IP. Stops abuse where someone
// spams the endpoint to bloat Cloudinary storage while pending.
const selfieUploadLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'rate_limited',
    message: 'You can submit at most 5 verification selfies per hour.',
    fieldErrors: {},
  },
});

const submitSelfieSchema = z.object({
  poseSequence: z
    .array(z.string().trim().min(1).max(20))
    .min(2, 'Complete at least two pose prompts.')
    .max(5),
  livenessHints: z
    .object({
      framesCaptured: z.number().int().min(1).max(20).optional(),
      faceMovedBetweenFrames: z.boolean().optional(),
      capturedAt: z.array(z.string().min(8).max(40)).max(20).optional(),
    })
    .optional()
    .nullable(),
  userNote: z.string().trim().max(500).optional().nullable(),
});

verificationRouter.post(
  '/me/verification/selfie',
  requireAuth,
  selfieUploadLimiter,
  upload.single('selfie'),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('selfie_required', 400, 'Capture a selfie to submit.');
      }
      // Reject obviously tiny uploads (camera produced empty frames).
      if (req.file.size < 4_000) {
        throw new AppError('selfie_too_small', 400, 'That selfie looks empty. Try again.');
      }
      const body = submitSelfieSchema.parse({
        poseSequence: req.body.poseSequence
          ? Array.isArray(req.body.poseSequence)
            ? req.body.poseSequence
            : JSON.parse(req.body.poseSequence)
          : undefined,
        livenessHints: req.body.livenessHints
          ? typeof req.body.livenessHints === 'string'
            ? JSON.parse(req.body.livenessHints)
            : req.body.livenessHints
          : undefined,
        userNote: req.body.userNote,
      });
      const result = await submitVerificationSelfie({
        userId: req.userId!,
        file: req.file,
        poseSequence: body.poseSequence,
        livenessHints: body.livenessHints,
        userNote: body.userNote,
      });
      res.status(201).json({
        ok: true,
        requestId: result.requestId,
        selfieUrl: result.selfieUrl,
      });
    } catch (error) {
      next(error);
    }
  },
);

verificationRouter.get('/me/verification/status', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const status = await getVerificationStatus(req.userId!);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

verificationRouter.delete(
  '/me/verification/selfie',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      await cancelPendingVerification(req.userId!);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);