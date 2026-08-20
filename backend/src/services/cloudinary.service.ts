import crypto from 'node:crypto';
import { Blob } from 'node:buffer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

type CloudinaryUpload = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  error?: { message?: string };
};

function signature(params: Record<string, string>): string {
  const value = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${key}=${item}`)
    .join('&');
  return crypto.createHash('sha1').update(value + env.CLOUDINARY_API_SECRET).digest('hex');
}

export function cloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

export async function uploadCloudinaryImage(
  buffer: Buffer,
  userId: string,
): Promise<{ url: string; publicId: string; width: number; height: number; bytes: number }> {
  if (!cloudinaryConfigured()) {
    throw new AppError(
      'persistent_storage_unavailable',
      503,
      'Photo storage is temporarily unavailable. Please try again later.',
    );
  }

  const timestamp = String(Math.floor(Date.now() / 1_000));
  const publicId = `${userId}/${crypto.randomUUID()}`;
  const params = {
    folder: env.CLOUDINARY_FOLDER,
    public_id: publicId,
    timestamp,
  };
  const form = new FormData();
  form.set('file', new Blob([buffer], { type: 'image/webp' }), 'profile.webp');
  form.set('api_key', env.CLOUDINARY_API_KEY!);
  form.set('timestamp', timestamp);
  form.set('folder', env.CLOUDINARY_FOLDER);
  form.set('public_id', publicId);
  form.set('signature', signature(params));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form },
  );
  const result = (await response.json()) as CloudinaryUpload;
  if (!response.ok || !result.secure_url || !result.public_id) {
    logger.error({
      event: 'cloudinary_upload_failed',
      status: response.status,
      providerMessage: result.error?.message,
    });
    throw new AppError('photo_upload_failed', 502, 'We could not save that photo. Try again.');
  }

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
}

export function cloudinaryDeliveryUrl(url: string, width = 1_600): string {
  if (!/res\.cloudinary\.com/.test(url) || url.includes('/upload/f_auto,')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}

export function cloudinaryThumbnailUrl(url: string, size = 320): string {
  if (!/res\.cloudinary\.com/.test(url)) return url;
  return url.replace(
    /\/image\/upload\/(?:f_auto,q_auto,c_limit,w_\d+\/)?/,
    `/image/upload/f_auto,q_auto,c_fill,g_auto,w_${size},h_${size}/`,
  );
}

export async function deleteCloudinaryAsset(
  value: string,
  options: { isPublicId?: boolean } = {},
): Promise<boolean> {
  const match = value.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  const publicId = options.isPublicId ? value : match?.[1];
  if (!publicId || !cloudinaryConfigured()) return false;

  const timestamp = String(Math.floor(Date.now() / 1_000));
  const params = { public_id: publicId, timestamp };
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY!,
    signature: signature(params),
  });

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as { result?: string };
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    logger.warn({
      event: 'cloudinary_delete_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
