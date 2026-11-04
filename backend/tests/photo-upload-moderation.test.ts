import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/utils/errors.js';

const { prismaMock, moderateImage, deleteStoredPhoto, enqueueAssetDeletion } = vi.hoisted(() => {
  const prismaMock: any = {
    photo: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(async (fn: any) =>
    fn({ $executeRaw: vi.fn(), photo: prismaMock.photo }),
  );
  return {
    prismaMock,
    moderateImage: vi.fn(),
    deleteStoredPhoto: vi.fn().mockResolvedValue(true),
    enqueueAssetDeletion: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../src/config/db.js', () => ({ prisma: prismaMock }));
vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = 'user-1'; next(); },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/services/moderation.service.js', () => ({ moderateImage }));
vi.mock('../src/services/photo.service.js', () => ({
  processAndStorePhoto: vi.fn().mockResolvedValue({
    url: 'https://cdn.test/p.jpg', publicId: 'p1', width: 10, height: 10, bytes: 100, mimeType: 'image/jpeg', buffer: Buffer.from('img'),
  }),
  deleteStoredPhoto,
}));
vi.mock('../src/services/cloudinary.service.js', () => ({ cloudinaryThumbnailUrl: (u: string) => u }));
vi.mock('../src/services/profile-completion.service.js', () => ({ getProfileCompletion: vi.fn().mockResolvedValue({}) }));
vi.mock('../src/services/asset-cleanup.service.js', () => ({ enqueueAssetDeletion }));

const { photosRouter } = await import('../src/routes/photos.routes.js');

const app = express();
app.use(express.json());
app.use(photosRouter);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) =>
  res.status(err instanceof AppError ? err.status : 500).json({ error: err.code ?? 'internal' }),
);

const flush = () => new Promise((r) => setTimeout(r, 20));
const upload = () => request(app).post('/photos/upload').attach('photo', Buffer.from('fake-image'), 'x.jpg');
const statusUpdates = () => prismaMock.photo.update.mock.calls.map((c: any[]) => c[0].data.status);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn({ $executeRaw: vi.fn(), photo: prismaMock.photo }));
  prismaMock.photo.findMany.mockResolvedValue([]);
  prismaMock.photo.create.mockResolvedValue({ id: 'photo-1', url: 'https://cdn.test/p.jpg', position: 0, width: 10, height: 10 });
  prismaMock.photo.update.mockResolvedValue({});
  deleteStoredPhoto.mockResolvedValue(true);
});

describe('POST /photos/upload moderation outcome', () => {
  it('approves a photo the classifier actually screened and cleared', async () => {
    moderateImage.mockResolvedValue({ flagged: false, screened: true, categories: [], scores: {} });
    const res = await upload();
    expect(res.status).toBe(201);
    await flush();
    expect(statusUpdates()).toEqual(['APPROVED']);
  });

  it('rejects and deletes a flagged photo', async () => {
    moderateImage.mockResolvedValue({ flagged: true, screened: true, categories: ['Porn'], scores: { Porn: 0.99 } });
    await upload();
    await flush();
    expect(statusUpdates()).toEqual(['REJECTED']);
    expect(deleteStoredPhoto).toHaveBeenCalled();
  });

  it('does NOT silently approve a photo nobody screened - it stays PENDING for the admin queue', async () => {
    moderateImage.mockResolvedValue({ flagged: false, screened: false, categories: [], scores: {} });
    const res = await upload();
    expect(res.status).toBe(201);
    await flush();
    expect(statusUpdates()).toEqual([]);
    expect(prismaMock.photo.create.mock.calls[0][0].data.status).toBe('PENDING');
  });

  it('still returns 201 when the moderation call itself throws', async () => {
    moderateImage.mockRejectedValue(new Error('model exploded'));
    const res = await upload();
    expect(res.status).toBe(201);
    await flush();
    expect(statusUpdates()).toEqual([]);
  });

  it('rejects a request with no file', async () => {
    const res = await request(app).post('/photos/upload');
    expect(res.status).toBe(400);
  });
});
