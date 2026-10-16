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
  options: { folder?: string; filename?: string; private?: boolean } = {},
): Promise<{ url: string; publicId: string; width: number; height: number; bytes: number }> {
  if (!cloudinaryConfigured()) {
    throw new AppError(
      'persistent_storage_unavailable',
      503,
      'Photo storage is temporarily unavailable. Please try again later.',
    );
  }

  const folder = options.folder ?? env.CLOUDINARY_FOLDER;
  const filename = options.filename ?? 'profile.webp';
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const publicId = `${userId}/${crypto.randomUUID()}`;
  const params: Record<string, string> = {
    folder,
    public_id: publicId,
    timestamp,
  };
  // Verification selfies are sensitive — upload as private so delivery URLs require signing.
  if (options.private) {
    params.type = 'private';
  }
  const form = new FormData();
  form.set('file', new Blob([buffer], { type: 'image/webp' }), filename);
  form.set('api_key', env.CLOUDINARY_API_KEY!);
  form.set('timestamp', timestamp);
  form.set('folder', folder);
  form.set('public_id', publicId);
  if (options.private) form.set('type', 'private');
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

/**
 * Signed delivery URL for private Cloudinary assets (e.g. verification selfies).
 * Cloudinary requires the s--signature-- component for authenticated delivery.
 */
export function cloudinarySignedDeliveryUrl(publicId: string, width = 1_280): string {
  if (!cloudinaryConfigured()) return '';
  const transformation = `f_auto,q_auto,c_limit,w_${width}`;
  const toSign = `${transformation}/${publicId}`;
  const sig = crypto.createHash('sha1').update(toSign + env.CLOUDINARY_API_SECRET).digest('hex').slice(0, 8);
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/private/s--${sig}--/${transformation}/${publicId}`;
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
  options: { isPublicId?: boolean; private?: boolean } = {},
): Promise<boolean> {
  const match = value.match(/\/upload\/(?:[^/]+\/)*(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  const publicId = options.isPublicId ? value : match?.[1];
  if (!publicId || !cloudinaryConfigured()) return false;

  const timestamp = String(Math.floor(Date.now() / 1_000));
  const params: Record<string, string> = { public_id: publicId, timestamp };
  if (options.private) params.type = 'private';
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp,
    api_key: env.CLOUDINARY_API_KEY!,
    signature: signature(params),
  });
  if (options.private) body.set('type', 'private');

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
