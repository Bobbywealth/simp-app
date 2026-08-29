import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import {
  cloudinaryDeliveryUrl,
  deleteCloudinaryAsset,
  uploadCloudinaryImage,
} from './cloudinary.service.js';

const MAX_BYTES = 10 * 1024 * 1024;
const MIN_DIMENSION = 320;
const MAX_DIMENSION = 12_000;
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export type StoredPhoto = {
  url: string;
  publicId: string | null;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'image/webp';
  buffer?: Buffer;
};

function hasKnownSignature(buffer: Buffer): boolean {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const heif =
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(buffer.subarray(8, 12).toString('ascii'));
  return jpeg || png || webp || heif;
}

export async function processAndStorePhoto(
  file: Express.Multer.File,
  userId: string,
): Promise<StoredPhoto> {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONS.has(extension) || !MIME_TYPES.has(file.mimetype) || !hasKnownSignature(file.buffer)) {
    throw new AppError('unsupported_image', 400, 'Upload a valid JPEG, PNG, WebP, HEIC, or HEIF image.');
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new AppError('image_too_large', 413, 'Photos must be 10 MB or smaller.');
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(file.buffer, { failOn: 'error', limitInputPixels: 144_000_000 }).metadata();
  } catch {
    throw new AppError('invalid_image_payload', 400, 'That file is not a readable image.');
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new AppError(
      'invalid_image_dimensions',
      400,
      `Photos must be between ${MIN_DIMENSION}px and ${MAX_DIMENSION}px on each side.`,
    );
  }

  const processed = await sharp(file.buffer, { failOn: 'error', limitInputPixels: 144_000_000 })
    .rotate()
    .resize({ width: 1_600, height: 2_000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  if (env.STORAGE_PROVIDER === 'cloudinary') {
    const stored = await uploadCloudinaryImage(processed.data, userId);
    return {
      url: cloudinaryDeliveryUrl(stored.url),
      publicId: stored.publicId,
      width: stored.width,
      height: stored.height,
      bytes: stored.bytes,
      mimeType: 'image/webp',
      buffer: processed.data,
    };
  }

  if (env.NODE_ENV === 'production') {
    throw new AppError('persistent_storage_unavailable', 503, 'Photo storage is not configured.');
  }
  const directory = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await fs.mkdir(directory, { recursive: true });
  const filename = `${userId}-${crypto.randomUUID()}.webp`;
  await fs.writeFile(path.join(directory, filename), processed.data, { flag: 'wx' });
  return {
    url: `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/uploads/${filename}`,
    publicId: filename,
    width: processed.info.width,
    height: processed.info.height,
    bytes: processed.info.size,
    mimeType: 'image/webp',
    buffer: processed.data,
  };
}

export async function deleteStoredPhoto(photo: { url: string; publicId: string | null }) {
  if (env.STORAGE_PROVIDER === 'cloudinary' || /res\.cloudinary\.com/.test(photo.url)) {
    return deleteCloudinaryAsset(photo.publicId ?? photo.url, { isPublicId: Boolean(photo.publicId) });
  }
  if (!photo.publicId) return false;
  const safeName = path.basename(photo.publicId);
  if (safeName !== photo.publicId) return false;
  try {
    await fs.unlink(path.join(path.resolve(process.cwd(), env.UPLOAD_DIR), safeName));
    return true;
  } catch {
    return false;
  }
}
