import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { enqueueAssetDeletion } from '../services/asset-cleanup.service.js';
import { deleteStoredPhoto } from '../services/photo.service.js';
import { getRealtimeServer } from '../sockets/realtime.js';
import { AppError } from '../utils/errors.js';

export const accountRouter = Router();

// Account deletion — Apple-only users (no password) are authenticated via
// their existing access token + the typed `DELETE` confirmation. Email
// + password users must also re-enter their password.
const deleteSchema = z
  .object({
    password: z.string().min(1).max(128).optional(),
    confirm: z.literal('DELETE'),
  })
  .refine((value) => value.password !== undefined || value.password === undefined, {
    message: 'password is optional; the access token + confirmation are enough for OAuth-only users',
  });
const userFingerprint = (id: string) =>
  crypto
    .createHmac('sha256', env.IP_HASH_SECRET ?? env.JWT_ACCESS_SECRET)
    .update(id)
    .digest('hex');

accountRouter.get('/account/me/export', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const [
      user,
      photos,
      interests,
      sessions,
      swipesMade,
      swipesReceived,
      matches,
      prompts,
      blocksMade,
      blocksReceived,
      reportsMade,
      reportsReceived,
      streams,
      liveChatMessages,
      liveReactions,
      conversations,
      notifications,
      pushDevices,
      notificationPreference,
      dailyUsage,
      verificationRequests,
      moderationHistory,
      tosAcceptances,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          onboardingStep: true,
          onboardingCompletedAt: true,
          ageConfirmedAt: true,
          profile: true,
          discoveryPreference: true,
        },
      }),
      prisma.photo.findMany({
        where: { userId },
        select: { id: true, url: true, position: true, width: true, height: true, bytes: true, mimeType: true, createdAt: true },
      }),
      prisma.userInterest.findMany({ where: { userId }, include: { interest: true } }),
      prisma.refreshToken.findMany({
        where: { userId },
        select: {
          familyId: true,
          deviceId: true,
          deviceName: true,
          platform: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
      prisma.swipe.findMany({
        where: { swiperId: userId },
        select: { id: true, swipedId: true, action: true, note: true, createdAt: true },
      }),
      prisma.swipe.findMany({
        where: { swipedId: userId },
        select: { id: true, swiperId: true, action: true, note: true, createdAt: true },
      }),
      prisma.match.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: {
          id: true,
          userAId: true,
          userBId: true,
          createdAt: true,
          lastMessageAt: true,
          isActive: true,
          deactivatedAt: true,
          deactivatedById: true,
        },
      }),
      prisma.prompt.findMany({ where: { userId } }),
      prisma.block.findMany({ where: { blockerId: userId } }),
      prisma.block.findMany({ where: { blockedId: userId } }),
      prisma.report.findMany({
        where: { reporterId: userId },
        select: { id: true, reportedId: true, streamId: true, category: true, reason: true, details: true, status: true, createdAt: true },
      }),
      prisma.report.findMany({
        where: { reportedId: userId },
        select: { id: true, reporterId: true, streamId: true, category: true, reason: true, status: true, createdAt: true, reviewedAt: true, actionedAt: true },
      }),
      prisma.liveStream.findMany({ where: { broadcasterId: userId } }),
      prisma.liveChatMessage.findMany({ where: { senderId: userId } }),
      prisma.liveReaction.findMany({ where: { userId } }),
      prisma.conversation.findMany({
        where: { match: { OR: [{ userAId: userId }, { userBId: userId }] } },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.pushToken.findMany({
        where: { userId },
        select: { id: true, deviceId: true, deviceName: true, platform: true, active: true, lastSeenAt: true, createdAt: true },
      }),
      prisma.notificationPreference.findUnique({ where: { userId } }),
      prisma.dailyUsage.findMany({ where: { userId }, orderBy: { day: 'asc' } }),
      prisma.profileVerificationRequest.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.moderationAction.findMany({
        where: { targetUserId: userId },
        select: { id: true, action: true, reason: true, metadata: true, createdAt: true },
      }),
      prisma.tosAcceptance.findMany({
        where: { userId },
        select: { id: true, type: true, version: true, acceptedAt: true, ipAddress: true, userAgent: true },
      }),
    ]);
    if (!user) throw new AppError('user_not_found', 404, 'Account not found.');

    res.set('Content-Disposition', `attachment; filename="simp-data-export-${userId}.json"`);
    res.set('Cache-Control', 'no-store');
    res.json({
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      user,
      photos,
      interests,
      sessions,
      swipesMade,
      swipesReceived,
      matches,
      prompts,
      blocksMade,
      blocksReceived,
      reportsMade,
      reportsReceived,
      streams,
      liveChatMessages,
      liveReactions,
      conversations,
      notifications,
      pushDevices,
      notificationPreference,
      dailyUsage,
      verificationRequests,
      moderationHistory,
      tosAcceptances,
    });
  } catch (error) {
    next(error);
  }
});

accountRouter.delete('/account/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { password } = deleteSchema.parse(req.body);
    const userId = req.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        socialIdentities: { select: { provider: true } },
      },
    });
    if (!user) throw new AppError('user_not_found', 404, 'Account not found.');

    // Password check is only required if the user has a real password
    // (i.e. signed up via email). Apple-only users have a random hash and
    // rely on their access token + typed confirmation as proof.
    const hasSocialLogin = user.socialIdentities.length > 0;
    if (password) {
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new AppError('invalid_password', 401, 'Password is incorrect.');
      }
    } else if (!hasSocialLogin) {
      throw new AppError(
        'password_required',
        400,
        'Please enter your password to confirm account deletion.',
      );
    }

    const photos = await prisma.photo.findMany({ where: { userId } });
    const fingerprint = userFingerprint(userId);
    const liveStreamIds = (
      await prisma.liveStream.findMany({
        where: { broadcasterId: userId, status: 'LIVE' },
        select: { id: true },
      })
    ).map((stream) => stream.id);

    await prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.report.updateMany({
          where: { reporterId: userId },
          data: { reporterFingerprint: fingerprint, reporterId: null },
        }),
        tx.report.updateMany({
          where: { reportedId: userId },
          data: { reportedFingerprint: fingerprint, reportedId: null },
        }),
        tx.moderationAction.updateMany({
          where: { targetUserId: userId },
          data: { targetFingerprint: fingerprint, targetUserId: null },
        }),
        tx.liveStream.updateMany({
          where: { broadcasterId: userId, status: 'LIVE' },
          data: { status: 'ENDED', endedAt: new Date(), viewerCount: 0 },
        }),
        tx.message.updateMany({
          where: { senderId: userId },
          data: { deletedAt: new Date() },
        }),
        tx.liveChatMessage.updateMany({
          where: { senderId: userId },
          data: { deletedAt: new Date() },
        }),
        tx.swipe.deleteMany({ where: { OR: [{ swiperId: userId }, { swipedId: userId }] } }),
        tx.match.updateMany({
          where: { OR: [{ userAId: userId }, { userBId: userId }] },
          data: { isActive: false, deactivatedAt: new Date(), deactivatedById: userId },
        }),
        tx.notification.deleteMany({ where: { userId } }),
        tx.refreshToken.deleteMany({ where: { userId } }),
        tx.pushToken.deleteMany({ where: { userId } }),
        tx.photo.deleteMany({ where: { userId } }),
        tx.prompt.deleteMany({ where: { userId } }),
        tx.userInterest.deleteMany({ where: { userId } }),
        tx.tosAcceptance.deleteMany({ where: { userId } }),
        tx.dailyUsage.deleteMany({ where: { userId } }),
        tx.analyticsEvent.deleteMany({ where: { userId } }),
        tx.emailEvent.deleteMany({ where: { userId } }),
        tx.socialIdentity.deleteMany({ where: { userId } }),
        tx.authActionToken.deleteMany({ where: { userId } }),
        tx.accountDeletionReceipt.create({
          data: {
            userFingerprint: fingerprint,
            photoCount: photos.length,
            metadata: { schemaVersion: 2 },
          },
        }),
        tx.profile.update({
          where: { userId },
          data: {
            displayName: '[Deleted]',
            bio: null,
            customInterests: [],
          },
        }),
        tx.user.update({
          where: { id: userId },
          data: {
            status: 'DELETED',
            deletedAt: new Date(),
            email: `${fingerprint}@deleted`,
            emailVerified: false,
            emailVerifiedAt: null,
            emailBounceAt: null,
            emailBounceType: null,
            passwordHash: crypto.randomBytes(32).toString('hex'),
            onboardingState: {},
            onboardingStep: 0,
            onboardingCompletedAt: null,
            ageConfirmedAt: null,
            ageConfirmedIp: null,
          },
        }),
      ]);
    });

    for (const streamId of liveStreamIds) {
      getRealtimeServer()?.to(`stream:${streamId}`).emit('live:ended', {
        streamId,
        reason: 'account_deleted',
      });
    }
    getRealtimeServer()?.to(`user:${userId}`).emit('account:deleted');

    for (const photo of photos) {
      const deleted = await deleteStoredPhoto(photo);
      if (!deleted) await enqueueAssetDeletion(photo);
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Social identities: list what's currently linked so the user can see
// and unlink providers from the account settings page.
accountRouter.get('/account/me/identities', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const identities = await prisma.socialIdentity.findMany({
      where: { userId: req.userId! },
      select: {
        id: true,
        provider: true,
        email: true,
        displayName: true,
        linkedAt: true,
        lastSeenAt: true,
      },
      orderBy: { linkedAt: 'asc' },
    });
    res.json({ identities });
  } catch (error) {
    next(error);
  }
});

accountRouter.delete(
  '/account/me/identities/:provider',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const provider = String(req.params.provider).toUpperCase();
      if (provider !== 'APPLE' && provider !== 'GOOGLE') {
        throw new AppError('unsupported_provider', 400, 'Unsupported provider.');
      }
      // Don't let a user unlink their ONLY login method — otherwise they
      // can't get back into their account to delete it.
      const remaining = await prisma.socialIdentity.count({
        where: { userId: req.userId!, provider },
      });
      if (remaining === 0) {
        throw new AppError(
          'identity_not_linked',
          404,
          'That account is not linked.',
        );
      }
      const passwordUser = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { passwordHash: true },
      });
      const hasPassword = passwordUser
        ? !passwordUser.passwordHash.startsWith('$2a$12$QJ8f/6I0iDq2aOrxcmrKQ')
        : false;
      const otherIdentities = await prisma.socialIdentity.count({
        where: { userId: req.userId!, NOT: { provider } },
      });
      if (!hasPassword && otherIdentities === 0) {
        throw new AppError(
          'cannot_unlink_only_login',
          400,
          'Set a password before unlinking your only sign-in method.',
        );
      }
      await prisma.socialIdentity.deleteMany({
        where: { userId: req.userId!, provider },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
