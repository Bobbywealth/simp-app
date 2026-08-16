import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const legalRouter = Router();

/**
 * GET /legal/status
 *
 * Returns whether the current user has satisfied all legal requirements
 * to broadcast a live stream:
 *  - `ageConfirmed`     — true once they have explicitly confirmed they are 18+
 *  - `ageConfirmedAt`   — timestamp of that confirmation, or null
 *  - `tosAccepted`      — true once they have accepted the CURRENT ToS version
 *  - `tosVersion`       — the version they accepted, or null
 *  - `privacyAccepted`  — true once they have accepted the CURRENT Privacy Policy version
 *  - `privacyVersion`   — the version they accepted, or null
 *
 * The frontend gate modal uses this to decide whether to show the gate
 * at all (everything already accepted → skip) or to show only the
 * outstanding step (e.g. just age, or just the new ToS).
 */
legalRouter.get('/legal/status', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;

    const [user, currentTos, currentPrivacy, tosAccept, privacyAccept] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { ageConfirmedAt: true } }),
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

    res.json({
      ageConfirmed: !!user?.ageConfirmedAt,
      ageConfirmedAt: user?.ageConfirmedAt ?? null,
      tosAccepted: !!currentTos && !!tosAccept && tosAccept.version === currentTos.version,
      tosVersion: tosAccept?.version ?? null,
      tosCurrentVersion: currentTos?.version ?? null,
      privacyAccepted:
        !!currentPrivacy && !!privacyAccept && privacyAccept.version === currentPrivacy.version,
      privacyVersion: privacyAccept?.version ?? null,
      privacyCurrentVersion: currentPrivacy?.version ?? null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /legal/tos
 *
 * Returns the current ToS document (summary + full markdown content).
 * Used to render the gate modal so the user can actually read what they
 * are agreeing to.
 */
legalRouter.get('/legal/tos', requireAuth, async (_req, res, next) => {
  try {
    const tos = await prisma.tosVersion.findFirst({
      where: { type: 'tos' },
      orderBy: { effectiveAt: 'desc' },
    });
    if (!tos) return res.status(404).json({ error: 'tos_not_found' });
    res.json({
      type: tos.type,
      version: tos.version,
      summary: tos.summary,
      content: tos.content,
      effectiveAt: tos.effectiveAt,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /legal/privacy
 */
legalRouter.get('/legal/privacy', requireAuth, async (_req, res, next) => {
  try {
    const privacy = await prisma.tosVersion.findFirst({
      where: { type: 'privacy' },
      orderBy: { effectiveAt: 'desc' },
    });
    if (!privacy) return res.status(404).json({ error: 'privacy_not_found' });
    res.json({
      type: privacy.type,
      version: privacy.version,
      summary: privacy.summary,
      content: privacy.content,
      effectiveAt: privacy.effectiveAt,
    });
  } catch (e) {
    next(e);
  }
});

const confirmAgeSchema = z.object({
  /// Must be true. Self-attested age gate.
  confirm: z.literal(true),
});

/**
 * POST /legal/confirm-age
 *
 * Records that the current user has confirmed they are 18+ (or the age
 * of majority in their jurisdiction). Persisted with timestamp + IP for
 * legal record-keeping. Required before broadcasting.
 */
legalRouter.post('/legal/confirm-age', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    confirmAgeSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null;

    await prisma.user.update({
      where: { id: userId },
      data: { ageConfirmedAt: new Date(), ageConfirmedIp: ip },
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const acceptDocSchema = z.object({
  type: z.enum(['tos', 'privacy']),
  /// Must match the current version server-side; client cannot pin to an
  /// older or future version.
  version: z.string().min(1).max(32),
});

/**
 * POST /legal/accept
 *
 * Records acceptance of the current ToS or Privacy Policy. The version
 * the client sends must match the currently published version — if it
 * doesn't, the request is rejected with 409 so the client can re-fetch
 * the latest document and re-prompt the user.
 */
legalRouter.post('/legal/accept', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { type, version } = acceptDocSchema.parse(req.body);

    const current = await prisma.tosVersion.findUnique({
      where: { type_version: { type, version } },
    });
    if (!current) {
      return res.status(409).json({
        error: 'version_mismatch',
        message:
          'This version is not the current document. Please reload and accept the latest version.',
      });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null;
    const ua = req.headers['user-agent'] ?? null;

    await prisma.tosAcceptance.create({
      data: {
        userId,
        tosVersionId: current.id,
        type,
        version,
        ipAddress: ip,
        userAgent: ua,
      },
    });

    res.json({ ok: true, type, version });
  } catch (e) {
    next(e);
  }
});
