import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { cloudinaryThumbnailUrl } from '../services/cloudinary.service.js';
import { deleteStoredPhoto, processAndStorePhoto } from '../services/photo.service.js';
import { getProfileCompletion } from '../services/profile-completion.service.js';
import { enqueueAssetDeletion } from '../services/asset-cleanup.service.js';

export const photosRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
});

const reorderSchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(6).refine((ids) => new Set(ids).size === ids.length, {
    message: 'Photo IDs must be unique',
  }),
});

const serialize = (photo: {
  id: string;
  url: string;
  position: number;
  width: number | null;
  height: number | null;
}) => ({
  id: photo.id,
  photoId: photo.id,
  url: photo.url,
  thumbnailUrl: cloudinaryThumbnailUrl(photo.url),
  position: photo.position,
  width: photo.width,
  height: photo.height,
  isPrimary: photo.position === 0,
});

photosRouter.post(
  '/photos/upload',
  requireAuth,
  upload.single('photo'),
  async (req: AuthedRequest, res, next) => {
    let stored: Awaited<ReturnType<typeof processAndStorePhoto>> | null = null;
    try {
      if (!req.file) throw new AppError('photo_file_required', 400, 'Choose a photo to upload.');
      const userId = req.userId!;
      stored = await processAndStorePhoto(req.file, userId);

      const photo = await prisma.$transaction(async (tx) => {
        // Serializes concurrent uploads for this user without locking other users.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
        const current = await tx.photo.findMany({
          where: { userId },
          orderBy: { position: 'asc' },
          select: { position: true },
        });
        if (current.length >= 6) {
          throw new AppError('max_photos_reached', 409, 'You can have up to 6 profile photos.');
        }
        const position = current.length === 0 ? 0 : Math.max(...current.map((item) => item.position)) + 1;
        return tx.photo.create({
          data: {
            userId,
            url: stored!.url,
            publicId: stored!.publicId,
            position,
            width: stored!.width,
            height: stored!.height,
            bytes: stored!.bytes,
            mimeType: stored!.mimeType,
          },
        });
      });

      await getProfileCompletion(userId);
      res.status(201).json(serialize(photo));
    } catch (error) {
      if (stored) {
        const deleted = await deleteStoredPhoto(stored).catch(() => false);
        if (!deleted) await enqueueAssetDeletion(stored).catch(() => undefined);
      }
      next(error);
    }
  },
);

photosRouter.put('/photos/reorder', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { photoIds } = reorderSchema.parse(req.body);
    const owned = await prisma.photo.findMany({ where: { userId }, select: { id: true } });
    if (owned.length !== photoIds.length || owned.some((photo) => !photoIds.includes(photo.id))) {
      throw new AppError('invalid_photo_order', 400, 'Include each of your photos exactly once.');
    }

    await prisma.$transaction(
      photoIds.map((id, position) => prisma.photo.update({ where: { id }, data: { position } })),
    );
    const photos = await prisma.photo.findMany({ where: { userId }, orderBy: { position: 'asc' } });
    res.json({ photos: photos.map(serialize) });
  } catch (error) {
    next(error);
  }
});

photosRouter.patch('/photos/:id/primary', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const photos = await prisma.photo.findMany({ where: { userId }, orderBy: { position: 'asc' } });
    const selected = photos.find((photo) => photo.id === req.params.id);
    if (!selected) throw new AppError('photo_not_found', 404, 'Photo not found.');
    const order = [selected, ...photos.filter((photo) => photo.id !== selected.id)];
    await prisma.$transaction(
      order.map((photo, position) =>
        prisma.photo.update({ where: { id: photo.id }, data: { position } }),
      ),
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

photosRouter.delete('/photos/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) throw new AppError('photo_not_found', 404, 'Photo not found.');
    if (photo.userId !== userId) {
      throw new AppError('not_your_photo', 403, 'You cannot delete this photo.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.photo.delete({ where: { id: photo.id } });
      const remaining = await tx.photo.findMany({ where: { userId }, orderBy: { position: 'asc' } });
      await Promise.all(
        remaining.map((item, position) =>
          item.position === position
            ? Promise.resolve(item)
            : tx.photo.update({ where: { id: item.id }, data: { position } }),
        ),
      );
    });
    const deleted = await deleteStoredPhoto(photo);
    if (!deleted) await enqueueAssetDeletion(photo);
    await getProfileCompletion(userId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
