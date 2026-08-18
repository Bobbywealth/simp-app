import crypto from 'node:crypto';
import type { AuthTokenType, Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { AppError } from '../utils/errors.js';

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function createAuthActionToken(
  userId: string,
  type: AuthTokenType,
  ttlMs: number,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.$transaction([
    prisma.authActionToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authActionToken.create({ data: { userId, type, tokenHash, expiresAt } }),
  ]);

  return token;
}

export async function consumeAuthActionToken<T>(
  token: string,
  type: AuthTokenType,
  action: (tx: Prisma.TransactionClient, userId: string) => Promise<T>,
): Promise<T> {
  const tokenHash = hashToken(token);
  return prisma.$transaction(async (tx) => {
    const record = await tx.authActionToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
      throw new AppError(
        type === 'PASSWORD_RESET' ? 'invalid_reset_token' : 'invalid_verification_token',
        400,
        'This link is invalid or has expired.',
      );
    }

    const consumed = await tx.authActionToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AppError('token_already_used', 409, 'This link has already been used.');
    }
    return action(tx, record.userId);
  });
}
