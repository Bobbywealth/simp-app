import { Router } from 'express';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { refreshTtlMs } from '../utils/jwt.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import {
  appleSignInSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '../validation/auth.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'simp_refresh';
const contextFor = (req: { ip?: string; headers: Record<string, unknown> }, device?: unknown) => ({
  ip: req.ip,
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  device: device as authService.SessionContext['device'],
});

function setRefreshCookie(res: import('express').Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/auth',
    maxAge: refreshTtlMs(),
  });
}

function tokenResponse(
  res: import('express').Response,
  status: number,
  result: { refreshToken: string; [key: string]: unknown },
  platform?: 'IOS' | 'ANDROID' | 'WEB',
) {
  setRefreshCookie(res, result.refreshToken);
  if (platform === 'WEB') {
    const { refreshToken: _refreshToken, ...webSafe } = result;
    void _refreshToken;
    return res.status(status).json(webSafe);
  }
  return res.status(status).json(result);
}

authRouter.post('/signup', async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input, contextFor(req, input.device));
    return tokenResponse(res, 201, result, input.device?.platform);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, contextFor(req, input.device));
    return tokenResponse(res, 200, result, input.device?.platform);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const input = refreshSchema.parse(req.body);
    const refreshToken = input.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new AppError('missing_refresh_token', 401, 'Sign in again to continue.');
    const result = await authService.refresh(refreshToken, contextFor(req, input.device));
    return tokenResponse(res, 200, result, input.device?.platform ?? (input.refreshToken ? undefined : 'WEB'));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const input = refreshSchema.parse(req.body);
    const refreshToken = input.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (refreshToken) await authService.logout(refreshToken);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    res.status(202).json({
      ok: true,
      message: 'If an account exists for that email, a reset link is on its way.',
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, password);
    res.json({ ok: true, message: 'Your password has been reset. Sign in again.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    await authService.verifyEmail(token);
    res.json({ ok: true, message: 'Your email is verified.' });
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/resend-verification',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const result = await authService.resendVerification(req.userId!);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post('/change-password', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(
      req.userId!,
      input.currentPassword,
      input.newPassword,
      input.revokeOtherSessions,
      req.sessionFamilyId,
    );
    res.json({ ok: true, message: 'Password updated.' });
  } catch (error) {
    next(error);
  }
});

// Sign in with Apple. The client posts the JWT returned by
// AuthenticationServices (iOS) or the AppleID JS SDK (web). The
// backend verifies the JWT against Apple's published JWKs and either
// signs the user in, creates a new account, or links the Apple
// identity to an existing email/password account (when a merge token
// is supplied).
authRouter.post('/apple', async (req, res, next) => {
  try {
    const input = appleSignInSchema.parse(req.body);
    const result = await authService.appleSignIn(input, contextFor(req, input.device));
    return tokenResponse(res, result.isNewUser ? 201 : 200, result, input.device?.platform);
  } catch (error) {
    next(error);
  }
});

// Issue a short-lived merge token so a user with an existing SIMP
// account can link Apple to it without a verification email round
// trip. The frontend collects this token after the user proves they
// own the existing account (e.g. by re-entering their password) and
// then posts it on the next /auth/apple call as `linkToUserId` + `linkMergeToken`.
authRouter.post(
  '/apple/merge-token',
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const token = await authService.issueAppleMergeToken(req.userId!);
      res.json({ mergeToken: token, expiresInSeconds: 15 * 60 });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.get('/sessions', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const sessions = await authService.listSessions(req.userId!, req.sessionFamilyId);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

authRouter.delete('/sessions/:familyId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await authService.revokeSession(req.userId!, req.params.familyId!);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout-all', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await authService.logoutAll(req.userId!);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
        profile: true,
        interests: { include: { interest: true } },
        entitlements: {
          where: {
            status: { in: ['ACTIVE', 'GRACE_PERIOD'] },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!user) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Account not found.',
        fieldErrors: {},
      });
    }

    const entitlement = user.entitlements[0];
    res.json({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      role: user.role,
      status: user.status,
      onboardingStep: user.onboardingStep,
      onboardingState: user.onboardingState,
      onboardingCompletedAt: user.onboardingCompletedAt,
      entitlement: entitlement
        ? {
            tier: entitlement.tier,
            status: entitlement.status,
            expiresAt: entitlement.expiresAt,
          }
        : { tier: 'FREE', status: 'ACTIVE', expiresAt: null },
      profile: user.profile
        ? {
            ...user.profile,
            isPremium: Boolean(entitlement),
            interests: user.interests,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});
