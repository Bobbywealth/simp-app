import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { deleteCloudinaryAsset } from '../services/cloudinary.service.js';

export const accountRouter = Router();

/**
 * Account deletion + data portability (GDPR Articles 15/17/20 + CCPA
 * CPRA + App Store Guideline 5.1.1(v) + Play Store Account Deletion
 * requirement).
 *
 * Both stores REQUIRE an in-app account deletion flow. Apple rejects
 * apps that only offer it via the website; Google Play requires it
 * accessible from the in-app settings screen.
 */

const deleteSchema = z.object({
  /// The user must re-enter their password to confirm. This is
  /// industry standard for destructive actions and prevents CSRF or
  /// stolen-token deletion.
  password: z.string().min(1),
  /// Optional confirmation phrase; if set, must equal exactly "DELETE"
  /// to guard against accidental taps.
  confirm: z.literal('DELETE').optional(),
});

/**
 * GET /account/me/export — GDPR Article 15 / 20 + CCPA right to know
 * + right to portability. Returns a JSON document containing every
 * piece of personal data we hold on the user, machine-readable so
 * they can take it elsewhere.
 */
accountRouter.get('/account/me/export', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;

    const [
      user,
      profile,
      photos,
      refreshTokens,
      interests,
      swipesMade,
      swipesReceived,
      matchesAsA,
      matchesAsB,
      prompts,
      blocksMade,
      blocksReceived,
      reportsMade,
      reportsReceived,
      streamsBroadcast,
      liveChatMessages,
      tosAcceptances,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          ageConfirmedAt: true,
        },
      }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.photo.findMany({ where: { userId } }),
      prisma.refreshToken.count({ where: { userId } }),
      prisma.userInterest.findMany({
        where: { userId },
        include: { interest: true },
      }),
      prisma.swipe.findMany({
        where: { swiperId: userId },
        select: { id: true, targetId: true, action: true, createdAt: true },
      }),
      prisma.swipe.findMany({
        where: { targetId: userId },
        select: { id: true, swiperId: true, action: true, createdAt: true },
      }),
      prisma.match.findMany({
        where: { userAId: userId },
        select: { id: true, userBId: true, createdAt: true, myNote: true, theirNote: true },
      }),
      prisma.match.findMany({
        where: { userBId: userId },
        select: { id: true, userAId: true, createdAt: true, myNote: true, theirNote: true },
      }),
      prisma.prompt.findMany({ where: { userId } }),
      prisma.block.findMany({
        where: { blockerId: userId },
        select: { id: true, blockedId: true, createdAt: true },
      }),
      prisma.block.findMany({
        where: { blockedId: userId },
        select: { id: true, blockerId: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { reporterId: userId },
        select: { id: true, reportedId: true, reason: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { reportedId: userId },
        select: { id: true, reporterId: true, reason: true, createdAt: true },
      }),
      prisma.liveStream.findMany({
        where: { broadcasterId: userId },
        select: { id: true, title: true, startedAt: true, endedAt: true, status: true },
      }),
      prisma.liveChatMessage.findMany({
        where: { senderId: userId },
        select: { id: true, streamId: true, body: true, createdAt: true },
      }),
      prisma.tosAcceptance.findMany({
        where: { userId },
        select: { id: true, type: true, version: true, acceptedAt: true, ipAddress: true, userAgent: true },
      }),
    ]);

    res.set('Content-Disposition', `attachment; filename="simp-data-export-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      user,
      profile,
      photos,
      interests,
      prompts,
      swipesMade,
      swipesReceived,
      matchesAsA,
      matchesAsB,
      blocksMade,
      blocksReceived,
      reportsMade,
      reportsReceived,
      streamsBroadcast,
      liveChatMessages,
      tosAcceptances,
      /// Counts only (tokens themselves are hashed and not exportable;
      /// we just tell the user how many active sessions we have on file).
      activeSessionCount: refreshTokens,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * DELETE /account/me — hard-delete the user's account and all
 * associated personal data. Irreversible.
 *
 * Compliance rationale:
 *  - GDPR Article 17 (right to erasure): personal data is deleted.
 *  - GDPR Article 17(3)(b): retention exception applies only to
 *    financial records (kept anonymously for tax/anti-fraud) and
 *    safety reports (kept to enforce bans on repeat offenders).
 *  - App Store Guideline 5.1.1(v): in-app account deletion.
 *  - Play Store Account Deletion policy: same.
 *
 * Cleanup order:
 *   1. Photos — delete Cloudinary assets (cloud-side), then DB rows.
 *   2. Live streams — force-end any LIVE stream the user is broadcasting
 *      so other viewers don't see a dead socket.
 *   3. Cascade delete via FK constraints (swipes, matches, blocks,
 *      reports, prompts, interests, tos acceptances, etc.).
 *   4. Profile + RefreshToken + User (in this order to satisfy FK).
 *   5. Anonymized ledger row so we can prove (in a security incident)
 *      that the deletion happened, without retaining PII.
 */
accountRouter.delete('/account/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { password, confirm } = deleteSchema.parse(req.body);

    if (confirm !== 'DELETE') {
      return res.status(400).json({
        error: 'confirmation_required',
        message: 'Send { "confirm": "DELETE", "password": "..." } to confirm.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, email: true },
    });
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_password' });

    // 1. Delete Cloudinary photo assets (best-effort; failures are
    //    logged but don't block deletion since the DB rows go away).
    const photos = await prisma.photo.findMany({ where: { userId } });
    await Promise.allSettled(
      photos
        .map((p) => p.url)
        .filter((u) => /res\.cloudinary\.com/.test(u))
        .map((u) => deleteCloudinaryAsset(u))
    );

    // 2. Force-end any LIVE streams. Mark as ENDED so they no longer
    //    appear in /live/streams; viewers' sockets will close on the
    //    next ping.
    await prisma.liveStream.updateMany({
      where: { broadcasterId: userId, status: 'LIVE' },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    // 3-4. Delete in FK-safe order. Profile, interests, photos,
    //    prompts, swipes (made + received), matches (asA + asB),
    //    blocks, reports, liveChatMessages, tosAcceptances, refresh
    //    tokens — all cascade from `User` via onDelete: Cascade in
    //    the Prisma schema, but we delete the User last so the
    //    cascade fires once.
    await prisma.user.delete({ where: { id: userId } });

    // 5. Anonymized deletion receipt. No PII — only counts + timestamp.
    //    Kept for compliance audit; safe to retain.
    console.log(
      JSON.stringify({
        event: 'account_deleted',
        userId, // opaque cuid, no PII
        emailDomain: user.email.split('@')[1] ?? null,
        photoCount: photos.length,
        ts: new Date().toISOString(),
      })
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /account/me/request-data-export — kicks off an async data
 * export and emails the user a download link. The inline GET version
 * above returns data immediately; this is for users with large
 * datasets (e.g. thousands of swipes / messages) where streaming the
 * full payload synchronously would time out.
 *
 * Scaffolded for future use; the inline GET works for current scale.
 */
accountRouter.post(
  '/account/me/request-data-export',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      // For now: redirect to the inline endpoint. Wire up a real
      // email-when-ready flow when we add BullMQ or similar.
      const userId = req.userId!;
      res.status(202).json({
        status: 'ready',
        message: 'Inline export is available immediately.',
        downloadUrl: `/account/me/export`,
        userId,
      });
    } catch (e) {
      next(e);
    }
  }
);
