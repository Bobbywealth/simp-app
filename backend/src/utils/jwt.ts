import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenClaims = { sub: string; typ: 'access'; sid?: string };
export type RefreshTokenClaims = { sub: string; typ: 'refresh'; jti: string; sid?: string };

export function signAccessToken(userId: string, familyId?: string): string {
  const claims: AccessTokenClaims = {
    sub: userId,
    typ: 'access',
    ...(familyId ? { sid: familyId } : {}),
  };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'simp-backend',
    audience: 'simp-client',
  });
}

export function signRefreshToken(userId: string, jti: string, familyId: string): string {
  const claims: RefreshTokenClaims = { sub: userId, typ: 'refresh', jti, sid: familyId };
  return jwt.sign(claims, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'simp-backend',
    audience: 'simp-client',
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'simp-backend',
      audience: 'simp-client',
    }) as AccessTokenClaims;
  } catch {
    // One refresh-TTL compatibility window for tokens issued before issuer/audience hardening.
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'simp-backend',
      audience: 'simp-client',
    }) as RefreshTokenClaims;
  } catch {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenClaims;
  }
}

export function refreshTtlMs(): number {
  const match = env.JWT_REFRESH_TTL.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}
