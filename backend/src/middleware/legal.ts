import type { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import type { AuthedRequest } from './auth.js';

/**
 * requireLegalCompliance
 *
 * Blocks the request (HTTP 451 — "Unavailable For Legal Reasons") if the
 * authenticated user has not yet:
 *  1. Explicitly confirmed they are 18+ (or the age of majority in their
 *     jurisdiction) via POST /legal/confirm-age.
 *  2. Accepted the CURRENT published version of the Terms of Service.
 *  3. Accepted the CURRENT published version of the Privacy Policy.
 *
 * The error body includes a `missing` array so the frontend can show
 * exactly which step the user still needs to complete (e.g. just the
 * new ToS, or age + ToS + privacy from a fresh signup).
 *
 * Apply this to any route whose action constitutes "going live" or
 * otherwise producing user-visible content subject to age + ToS gating.
 */
export async function requireLegalCompliance(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId!;

    const [user, currentTos, currentPrivacy, latestTosAccept, latestPrivacyAccept] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { ageConfirmedAt: true },
        }),
        prisma.tosVersion.findFirst({
          where: { type: 'tos' },
          orderBy: { effectiveAt: 'desc' },
        }),
        prisma.tosVersion.findFirst({
          where: { type: 'privacy' },
          orderBy: { effectiveAt: 'desc' },
        }),
        prisma.tosAcceptance.findFirst({
          where: { userId, type: 'tos' },
          orderBy: { acceptedAt: 'desc' },
        }),
        prisma.tosAcceptance.findFirst({
          where: { userId, type: 'privacy' },
          orderBy: { acceptedAt: 'desc' },
        }),
      ]);

    const missing: string[] = [];
    if (!user?.ageConfirmedAt) missing.push('age');
    if (!currentTos || latestTosAccept?.version !== currentTos.version) missing.push('tos');
    if (!currentPrivacy || latestPrivacyAccept?.version !== currentPrivacy.version)
      missing.push('privacy');

    if (missing.length > 0) {
      res.status(451).json({
        error: 'legal_compliance_required',
        missing,
        currentVersions: {
          tos: currentTos?.version ?? null,
          privacy: currentPrivacy?.version ?? null,
        },
      });
      return;
    }

    next();
  } catch (e) {
    next(e);
  }
}
