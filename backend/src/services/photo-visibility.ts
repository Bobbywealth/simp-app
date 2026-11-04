import type { Prisma } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * Prisma `where` for photos that OTHER users may see.
 *
 * - REJECTED photos are never public (their files are deleted, the row is kept
 *   as an audit trail).
 * - When PHOTO_REQUIRE_APPROVAL=true, only APPROVED photos are public, so a
 *   photo that automated screening could not clear stays hidden until a
 *   moderator approves it in the admin photo queue.
 *
 * Owners always see their own photos (use the unfiltered query for that).
 */
export function publicPhotoWhere(): Prisma.PhotoWhereInput {
  return env.PHOTO_REQUIRE_APPROVAL ? { status: 'APPROVED' } : { status: { not: 'REJECTED' } };
}
