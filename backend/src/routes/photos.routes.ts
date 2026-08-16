import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import crypto from 'node:crypto';
import { prisma } from '../config/db.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { env } from '../config/env.js';

export const photosRouter = Router();

// Eager-init upload dir at module load (sync so we don't need top-level await)
const UPLOAD_DIR_ABS = path.resolve(process.cwd(), env.UPLOAD_DIR);
fsSync.mkdirSync(UPLOAD_DIR_ABS, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR_ABS),
  filename: (req, file, cb) => {
    const userId = (req as AuthedRequest).userId ?? 'anon';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const hash = crypto.randomBytes(8).toString('hex');
    cb(null, `${userId}-${Date.now()}-${hash}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('unsupported_mime_type'));
    }
    cb(null, true);
  },
});

/**
 * POST /photos/upload — upload a photo for the current user
 *
 * multipart/form-data: "photo" file
 * Returns: { photoId, url, position }
 *
 * Files are saved to backend/uploads/ (configured via UPLOAD_DIR).
 * Served at /uploads/{filename} via static middleware.
 *
 * NOTE: On Render's default filesystem, uploaded files are ephemeral
 * (wiped on every redeploy). For production, swap to S3/Cloudflare R2.
 */
photosRouter.post(
  '/photos/upload',
  requireAuth,
  upload.single('photo'),
  async (req: AuthedRequest, res, next) => {
    try {
      const userId = req.userId!;
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'photo_file_required' });
      }

      const last = await prisma.photo.findFirst({
        where: { userId },
        orderBy: { position: 'desc' },
      });
      const nextPosition = (last?.position ?? -1) + 1;

      const url = `${env.PUBLIC_BASE_URL}/uploads/${file.filename}`;

      const photo = await prisma.photo.create({
        data: {
          userId,
          url,
          position: nextPosition,
        },
      });

      res.json({
        photoId: photo.id,
        url: photo.url,
        position: photo.position,
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * DELETE /photos/:id — delete a photo you uploaded
 */
photosRouter.delete('/photos/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const photoId = req.params.id;

    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      return res.status(404).json({ error: 'photo_not_found' });
    }
    if (photo.userId !== userId) {
      return res.status(403).json({ error: 'not_your_photo' });
    }

    // Best-effort delete the file from disk
    try {
      const filename = path.basename(new URL(photo.url).pathname);
      await fs.unlink(path.join(UPLOAD_DIR_ABS, filename));
    } catch {
      // file may already be gone — ignore
    }

    await prisma.photo.delete({ where: { id: photoId } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
