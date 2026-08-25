import crypto from 'node:crypto';
import type { PushPlatform } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { createAuthActionToken, consumeAuthActionToken } from './auth-token.service.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './email.service.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { verifyAppleIdentityToken } from './apple-auth.service.js';
import {
  signAccessToken,
  signRefreshToken,
  refreshTtlMs,
  verifyRefreshToken,
} from '../utils/jwt.js';
import type { DeviceInput, LoginInput, SignupInput } from '../validation/auth.js';

export class AuthError extends AppError {
  constructor(code: string, status = 400, message?: string) {
    super(code, status, message ?? code);
  }
}

export type SessionContext = {
  ip?: string;
  userAgent?: string;
  device?: DeviceInput;
};

const DUMMY_PASSWORD_HASH = '$2a$12$QJ8f/6I0iDq2aOrxcmrKQ.O8t/p8SFVxZSI2ldmEwKdSoK7VglsSa';
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const hashIp = (ip: string | undefined) =>
  ip
    ? crypto
        .createHmac('sha256', env.IP_HASH_SECRET ?? env.JWT_ACCESS_SECRET)
        .update(ip)
        .digest('hex')
    : undefined;

function assertAccountCanAuthenticate(user: {
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  suspendedUntil: Date | null;
}) {
  if (user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil <= new Date()) {
    return;
  }
  if (user.status === 'BANNED') {
    throw new AuthError('account_banned', 403, 'This account has been banned.');
  }
  if (user.status !== 'ACTIVE') {
    throw new AuthError('account_suspended', 403, 'This account is currently suspended.');
  }
}

export async function signup(input: SignupInput, context: SessionContext = {}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError('email_taken', 409, 'Email is already registered.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      onboardingState: { displayName: input.displayName },
      onboardingStep: 1,
      notificationPreference: { create: {} },
      discoveryPreference: { create: {} },
    },
  });

  const verificationToken = await createAuthActionToken(
    user.id,
    'EMAIL_VERIFICATION',
    24 * 60 * 60 * 1_000,
  );
  let verificationEmailSent = true;
  try {
    await sendVerificationEmail(user.email, verificationToken);
  } catch (error) {
    verificationEmailSent = false;
    logger.warn({
      event: 'verification_email_deferred',
      userId: user.id,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  return {
    ...(await issueTokens(user.id, { ...context, device: input.device ?? context.device })),
    user: { id: user.id, email: user.email },
    verificationRequired: true,
    verificationEmailSent,
  };
}

export async function login(input: LoginInput, context: SessionContext = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH).catch(() => false);
    throw new AuthError('invalid_credentials', 401, 'Invalid email or password.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError(
      'account_temporarily_locked',
      429,
      'Too many failed attempts. Try again in a few minutes.',
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts >= 5 ? 0 : attempts,
        lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1_000) : null,
      },
    });
    throw new AuthError('invalid_credentials', 401, 'Invalid email or password.');
  }

  assertAccountCanAuthenticate(user);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      status:
        user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil <= new Date()
          ? 'ACTIVE'
          : user.status,
      suspendedUntil:
        user.status === 'SUSPENDED' && user.suspendedUntil && user.suspendedUntil <= new Date()
          ? null
          : user.suspendedUntil,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  return issueTokens(user.id, { ...context, device: input.device ?? context.device });
}

export async function refresh(refreshToken: string, context: SessionContext = {}) {
  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('invalid_refresh_token', 401, 'Your session has expired.');
  }
  if (claims.typ !== 'refresh') {
    throw new AuthError('invalid_refresh_token', 401, 'Your session has expired.');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  const familyId = stored?.familyId ?? claims.sid;

  if (!stored || stored.revokedAt) {
    if (familyId) {
      await prisma.refreshToken.updateMany({
        where: { familyId },
        data: { revokedAt: new Date(), reuseDetectedAt: new Date() },
      });
    }
    throw new AuthError(
      'refresh_token_reused',
      401,
      'This session was revoked. Please sign in again.',
    );
  }
  if (stored.expiresAt <= new Date() || stored.userId !== claims.sub) {
    throw new AuthError('invalid_refresh_token', 401, 'Your session has expired.');
  }

  assertAccountCanAuthenticate(stored.user);
  const nextId = crypto.randomUUID();
  const nextJti = crypto.randomUUID();
  const nextRefreshToken = signRefreshToken(stored.userId, nextJti, stored.familyId);
  const nextTokenHash = hashToken(nextRefreshToken);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now, replacedById: nextId, lastUsedAt: now },
    });
    if (revoked.count !== 1) {
      await tx.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: now, reuseDetectedAt: now },
      });
      throw new AuthError('refresh_token_reused', 401, 'This session was revoked.');
    }

    await tx.refreshToken.create({
      data: {
        id: nextId,
        userId: stored.userId,
        familyId: stored.familyId,
        tokenHash: nextTokenHash,
        expiresAt: new Date(Date.now() + refreshTtlMs()),
        deviceId: context.device?.deviceId ?? stored.deviceId,
        deviceName: context.device?.deviceName ?? stored.deviceName,
        platform: (context.device?.platform ?? stored.platform) as PushPlatform,
        ipHash: hashIp(context.ip) ?? stored.ipHash,
        userAgent: context.userAgent?.slice(0, 500) ?? stored.userAgent,
      },
    });
  });

  return {
    accessToken: signAccessToken(stored.userId, stored.familyId),
    refreshToken: nextRefreshToken,
  };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function listSessions(userId: string, currentFamilyId?: string) {
  const sessions = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });
  return sessions.map((session) => ({
    id: session.familyId,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    platform: session.platform,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: session.familyId === currentFamilyId,
  }));
}

export async function revokeSession(userId: string, familyId: string) {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) {
    throw new AuthError('session_not_found', 404, 'That session is no longer active.');
  }
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError('user_not_found', 404, 'Account not found.');
  if (user.emailVerified) return { alreadyVerified: true };

  const token = await createAuthActionToken(user.id, 'EMAIL_VERIFICATION', 24 * 60 * 60 * 1_000);
  await sendVerificationEmail(user.email, token);
  return { alreadyVerified: false };
}

export async function verifyEmail(token: string): Promise<{ userId: string }> {
  return consumeAuthActionToken(token, 'EMAIL_VERIFICATION', async (tx, userId) => {
    await tx.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
    return { userId };
  });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') return;

  const token = await createAuthActionToken(user.id, 'PASSWORD_RESET', 30 * 60 * 1_000);
  try {
    await sendPasswordResetEmail(user.email, token);
  } catch (error) {
    logger.warn({
      event: 'password_reset_email_deferred',
      userId: user.id,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function resetPassword(token: string, password: string) {
  const passwordHash = await hashPassword(password);
  await consumeAuthActionToken(token, 'PASSWORD_RESET', async (tx, userId) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  revokeOtherSessions: boolean,
  currentFamilyId?: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AuthError('invalid_current_password', 401, 'Current password is incorrect.');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    if (revokeOtherSessions) {
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentFamilyId ? { familyId: { not: currentFamilyId } } : {}),
        },
        data: { revokedAt: new Date() },
      });
    }
  });
}

async function issueTokens(userId: string, context: SessionContext = {}) {
  const familyId = crypto.randomUUID();
  const jti = crypto.randomUUID();
  const refreshJwt = signRefreshToken(userId, jti, familyId);

  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(refreshJwt),
      expiresAt: new Date(Date.now() + refreshTtlMs()),
      deviceId: context.device?.deviceId,
      deviceName: context.device?.deviceName,
      platform: (context.device?.platform ?? 'WEB') as PushPlatform,
      ipHash: hashIp(context.ip),
      userAgent: context.userAgent?.slice(0, 500),
    },
  });

  return {
    accessToken: signAccessToken(userId, familyId),
    refreshToken: refreshJwt,
  };
}

/**
 * Sign in (or sign up) a user via Sign in with Apple.
 *
 * Flow:
 *  1. Verify the identity token (Apple's public keys + audience check).
 *  2. Look up an existing SocialIdentity by (provider=APPLE, subject=sub).
 *     If found, this is a returning user — reuse their User.
 *  3. If not found, check whether the user is trying to LINK Apple to an
 *     existing email-based account: caller passes `linkToUserId` + a
 *     merge token (proves they just proved ownership of that account).
 *  4. Otherwise, create a brand-new User using either the verified
 *     email (first-auth only) or a synthetic relay-safe placeholder.
 *
 * The function returns the standard auth token bundle plus a flag
 * `isNewUser` so the frontend can route into onboarding.
 */
export async function appleSignIn(
  input: {
    identityToken: string;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    rawUser?: unknown;
    linkToUserId?: string | null;
    linkMergeToken?: string | null;
    device?: DeviceInput;
  },
  context: SessionContext = {},
) {
  const expectedAudience = env.APPLE_CLIENT_ID;
  if (!expectedAudience) {
    // The Apple auth flow is misconfigured on the server. Surface a 503
    // (not 401) so the client knows it's a deploy problem, not a bad
    // token.
    throw new AuthError(
      'apple_signin_unavailable',
      503,
      'Sign in with Apple is not configured on this server.',
    );
  }
  const claims = await verifyAppleIdentityToken({
    identityToken: input.identityToken,
    expectedAudience,
  });

  // Returning user: identity is already linked.
  const existing = await prisma.socialIdentity.findUnique({
    where: {
      provider_subject: { provider: 'APPLE', subject: claims.subject },
    },
    include: { user: true },
  });

  if (existing) {
    assertAccountCanAuthenticate(existing.user);
    await prisma.socialIdentity.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return {
      ...(await issueTokens(existing.userId, { ...context, device: input.device ?? context.device })),
      userId: existing.userId,
      isNewUser: false,
      needsOnboarding: existing.user.onboardingCompletedAt == null,
      linked: false,
    };
  }

  // Linking an Apple identity to an existing email/password account.
  if (input.linkToUserId && input.linkMergeToken) {
    try {
      await consumeAuthActionToken(
        input.linkMergeToken,
        'APPLE_ACCOUNT_MERGE',
        async () => {
          /* no-op: we just need to verify and burn the token */
        },
      );
    } catch {
      throw new AuthError(
        'invalid_merge_token',
        401,
        'Merge link expired. Please re-authenticate.',
      );
    }
    const targetUser = await prisma.user.findUnique({ where: { id: input.linkToUserId } });
    if (!targetUser) {
      throw new AuthError('user_not_found', 404, 'Account not found.');
    }
    assertAccountCanAuthenticate(targetUser);
    await prisma.socialIdentity.create({
      data: {
        userId: targetUser.id,
        provider: 'APPLE',
        subject: claims.subject,
        email: input.email ?? claims.email,
        emailVerified: claims.emailVerified,
        displayName: input.fullName ?? ((`${input.firstName ?? ''} ${input.lastName ?? ''}`).trim() || null),
        rawProfile: (input.rawUser as object | null) ?? (claims.rawClaims as object),
      },
    });
    return {
      ...(await issueTokens(targetUser.id, { ...context, device: input.device ?? context.device })),
      userId: targetUser.id,
      isNewUser: false,
      needsOnboarding: targetUser.onboardingCompletedAt == null,
      linked: true,
    };
  }

  // New user: create an account.
  const fallbackEmail = claims.email ?? `${claims.subject}@appleid.sim-p.app`;
  // Apple's relay emails are not safe to expose to other users; for the
  // canonical User.email we use a synthetic internal placeholder so
  // SIMP never shows `@privaterelay.appleid.com` to anyone.
  const canonicalEmail = claims.isPrivateRelay
    ? `apple-${claims.subject.slice(0, 12)}@sim-p.app`
    : (claims.email ?? (fallbackEmail as string));

  const displayName =
    input.fullName?.trim() ||
    [input.firstName, input.lastName].filter(Boolean).join(' ').trim() ||
    'SIMP Member';

  const user = await prisma.user.create({
    data: {
      email: canonicalEmail.toLowerCase(),
      // No password — sign in via Apple only. We still populate the column
      // with a random bcrypt hash so account-takeover via password reset
      // is impossible without also proving Apple identity.
      passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
      emailVerified: claims.emailVerified || !claims.isPrivateRelay,
      onboardingState: { displayName },
      onboardingStep: 1,
      notificationPreference: { create: {} },
      discoveryPreference: { create: {} },
      socialIdentities: {
        create: {
          provider: 'APPLE',
          subject: claims.subject,
          email: input.email ?? claims.email,
          emailVerified: claims.emailVerified,
          displayName,
          rawProfile: (input.rawUser as object | null) ?? (claims.rawClaims as object),
        },
      },
    },
  });

  return {
    ...(await issueTokens(user.id, { ...context, device: input.device ?? context.device })),
    userId: user.id,
    isNewUser: true,
    needsOnboarding: true,
    linked: false,
  };
}

/**
 * Issue a short-lived merge token that lets a returning user prove
 * ownership of an existing account before linking their Apple identity
 * to it. Sent in the verification email when the user picks "Link
 * existing SIMP account" from the Apple sign-in screen.
 */
export async function issueAppleMergeToken(userId: string) {
  return createAuthActionToken(userId, 'APPLE_ACCOUNT_MERGE', 15 * 60 * 1_000);
}
