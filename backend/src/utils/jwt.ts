import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AccessTokenClaims = { sub: string; typ: 'access' };
export type RefreshTokenClaims = { sub: string; typ: 'refresh'; jti: string };

export function signAccessToken(userId: string): string {
  const claims: AccessTokenClaims = { sub: userId, typ: 'access' };
  return jwt.sign(
    claims,
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] }
  );
}

export function signRefreshToken(userId: string, jti: string): string {
  const claims: RefreshTokenClaims = { sub: userId, typ: 'refresh', jti };
  return jwt.sign(
    claims,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims;
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenClaims;
}

export function refreshTtlMs(): number {
  // Approximate: parse "30d" → ms. Supports s/m/h/d suffixes.
  const m = env.JWT_REFRESH_TTL.match(/^(\d+)([smhd])$/);
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === 's' ? 1e3 : unit === 'm' ? 60e3 : unit === 'h' ? 3600e3 : 86400e3;
  return n * mult;
}
