import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { AppError } from '../src/utils/errors.js';

const { prismaMock, txMock } = vi.hoisted(() => {
  const many = () => vi.fn().mockResolvedValue({ count: 0 });
  const txMock: any = {
    report: { updateMany: many() }, moderationAction: { updateMany: many() }, liveStream: { updateMany: many() },
    message: { updateMany: many() }, liveChatMessage: { updateMany: many() }, swipe: { deleteMany: many() },
    experience: { updateMany: many() }, experienceRequest: { updateMany: many() }, match: { updateMany: many() },
    notification: { deleteMany: many() }, refreshToken: { deleteMany: many() }, pushToken: { deleteMany: many() },
    photo: { deleteMany: many() }, prompt: { deleteMany: many() }, userInterest: { deleteMany: many() },
    tosAcceptance: { deleteMany: many() }, dailyUsage: { deleteMany: many() }, analyticsEvent: { deleteMany: many() },
    emailEvent: { deleteMany: many() }, socialIdentity: { deleteMany: many() }, authActionToken: { deleteMany: many() },
    accountDeletionReceipt: { create: vi.fn().mockResolvedValue({}) },
    // update() throws P2025 when the row is missing, exactly like Prisma.
    profile: {
      update: vi.fn().mockRejectedValue(Object.assign(new Error('Record to update not found.'), { code: 'P2025' })),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
  };
  const prismaMock: any = {
    user: { findUnique: vi.fn() },
    photo: { findMany: vi.fn() },
    liveStream: { findMany: vi.fn() },
    experience: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prismaMock, txMock };
});

vi.mock('../src/config/env.js', () => ({ env: { IP_HASH_SECRET: 'x'.repeat(16), JWT_ACCESS_SECRET: 'y'.repeat(32) } }));
vi.mock('../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = 'user-1'; next(); },
}));
vi.mock('../src/services/asset-cleanup.service.js', () => ({ enqueueAssetDeletion: vi.fn() }));
vi.mock('../src/services/photo.service.js', () => ({ deleteStoredPhoto: vi.fn().mockResolvedValue(true) }));
vi.mock('../src/sockets/realtime.js', () => ({ getRealtimeServer: () => null }));
vi.mock('../src/services/notification.service.js', () => ({ notify: vi.fn().mockResolvedValue({}) }));

const { accountRouter } = await import('../src/routes/account.routes.js');

const app = express();
app.use(express.json());
app.use(accountRouter);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'validation_error' });
  if (err instanceof AppError) return res.status(err.status).json({ error: err.code });
  return res.status(err?.code === 'P2025' ? 404 : 500).json({ error: err?.code === 'P2025' ? 'not_found' : 'internal' });
});

const PASSWORD = 'CorrectHorse!2026';
let passwordHash: string;

beforeEach(async () => {
  vi.clearAllMocks();
  passwordHash ??= await bcrypt.hash(PASSWORD, 4);
  prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash, socialIdentities: [] });
  prismaMock.photo.findMany.mockResolvedValue([]);
  prismaMock.liveStream.findMany.mockResolvedValue([]);
  prismaMock.experience.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));
  txMock.profile.updateMany.mockResolvedValue({ count: 0 });
});

describe('DELETE /account/me', () => {
  it('deletes an account that never created a profile (regression: used to 404 with P2025)', async () => {
    const res = await request(app).delete('/account/me').send({ password: PASSWORD, confirm: 'DELETE' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(txMock.profile.updateMany).toHaveBeenCalled();
    expect(txMock.profile.update).not.toHaveBeenCalled();
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: expect.objectContaining({ status: 'DELETED' }) }),
    );
  });

  it('anonymises the profile when one exists', async () => {
    txMock.profile.updateMany.mockResolvedValue({ count: 1 });
    const res = await request(app).delete('/account/me').send({ password: PASSWORD, confirm: 'DELETE' });
    expect(res.status).toBe(200);
    expect(txMock.profile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: '[Deleted]', bio: null }) }),
    );
  });

  it('rejects a wrong password and deletes nothing', async () => {
    const res = await request(app).delete('/account/me').send({ password: 'nope', confirm: 'DELETE' });
    expect(res.status).toBe(401);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('requires the typed DELETE confirmation', async () => {
    const res = await request(app).delete('/account/me').send({ password: PASSWORD, confirm: 'yes' });
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('requires a password for email accounts', async () => {
    const res = await request(app).delete('/account/me').send({ confirm: 'DELETE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('password_required');
  });

  it('lets an Apple-only account delete with just the confirmation', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'random', socialIdentities: [{ provider: 'APPLE' }] });
    const res = await request(app).delete('/account/me').send({ confirm: 'DELETE' });
    expect(res.status).toBe(200);
  });
});
