import crypto from 'node:crypto';
import { prisma } from '../config/db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, refreshTtlMs, verifyRefreshToken } from '../utils/jwt.js';
import type { SignupInput, LoginInput } from '../validation/auth.js';

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) {
    throw new AuthError('email_taken', 409, 'Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
    },
  });

  return issueTokens(user.id);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) throw new AuthError('invalid_credentials', 401, 'Invalid email or password');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new AuthError('invalid_credentials', 401, 'Invalid email or password');

  return issueTokens(user.id);
}

export async function refresh(refreshToken: string) {
  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('invalid_refresh_token', 401);
  }
  if (claims.typ !== 'refresh') throw new AuthError('invalid_refresh_token', 401);

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AuthError('invalid_refresh_token', 401);
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(claims.sub);
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function issueTokens(userId: string) {
  const accessToken = signAccessToken(userId);
  const jti = crypto.randomUUID();
  const refreshJwt = signRefreshToken(userId, jti);

  const tokenHash = hashToken(refreshJwt);
  const expiresAt = new Date(Date.now() + refreshTtlMs());
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { accessToken, refreshToken: refreshJwt };
}
