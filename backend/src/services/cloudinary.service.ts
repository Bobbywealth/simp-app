/**
 * Cloudinary helpers. Wrapper around the Cloudinary Admin API for
 * deleting assets by URL when a user deletes their account.
 *
 * Falls back to a no-op if `CLOUDINARY_*` env vars aren't set, so the
 * account-deletion flow works even before the photo upload pipeline
 * is wired up to Cloudinary.
 */
import { env } from '../config/env.js';

/**
 * Best-effort delete of a Cloudinary asset by its public URL.
 * Returns true if the asset was deleted (or was already gone),
 * false if we couldn't reach Cloudinary or the URL isn't ours.
 *
 * Safe to call concurrently with Promise.allSettled — failures are
 * logged but never thrown, because the DB row is the source of truth
 * and will be deleted regardless.
 */
export async function deleteCloudinaryAsset(url: string): Promise<boolean> {
  // Match the public_id from a Cloudinary delivery URL like
  // https://res.cloudinary.com/<cloud>/image/upload/v123/foo/bar.jpg
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
  if (!m) return false;
  const publicId = m[1];

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) {
    // Cloudinary not configured — log and skip. The DB row will be
    // removed by the cascading delete, the orphaned asset can be
    // garbage-collected manually later.
    console.warn(
      `[cloudinary] Skipping delete of ${publicId}: CLOUDINARY_* env vars not set`
    );
    return false;
  }

  // Cloudinary uses HTTP Basic auth with API key + secret for the
  // Admin API. Build the timestamp + signature per the docs.
  const timestamp = Math.floor(Date.now() / 1000);
  const crypto = await import('node:crypto');
  const toSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(toSign + secret)
    .digest('hex');

  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: key,
    signature,
  });

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      console.warn(`[cloudinary] destroy ${publicId} → HTTP ${res.status}`);
      return false;
    }
    const data = (await res.json()) as { result?: string };
    return data.result === 'ok' || data.result === 'not found';
  } catch (e) {
    console.warn(`[cloudinary] destroy ${publicId} failed:`, (e as Error).message);
    return false;
  }
}

// Re-export the validated env so callers don't need to import the
// config module twice.
export { env };
