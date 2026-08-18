import crypto from 'node:crypto';
import { prisma } from '../config/db.js';
import { deleteCloudinaryAsset } from './cloudinary.service.js';
import { logger } from '../utils/logger.js';

export async function enqueueAssetDeletion(photo: { publicId: string | null; url: string }) {
  const key = photo.publicId ?? `url_${crypto.createHash('sha256').update(photo.url).digest('hex')}`;
  await prisma.assetDeletionJob.upsert({
    where: { publicId: key },
    create: { publicId: key, url: photo.url },
    update: { completedAt: null, nextAttemptAt: new Date(), lastError: null },
  });
}

export async function processAssetDeletionJobs(limit = 25) {
  const jobs = await prisma.assetDeletionJob.findMany({
    where: { completedAt: null, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  for (const job of jobs) {
    const value = job.publicId.startsWith('url_') ? job.url : job.publicId;
    if (!value) continue;
    const deleted = await deleteCloudinaryAsset(value, { isPublicId: !job.publicId.startsWith('url_') });
    if (deleted) {
      await prisma.assetDeletionJob.update({
        where: { id: job.id },
        data: { completedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });
    } else {
      const attempts = job.attempts + 1;
      const delayMinutes = Math.min(24 * 60, 2 ** Math.min(attempts, 10));
      await prisma.assetDeletionJob.update({
        where: { id: job.id },
        data: {
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          lastError: 'provider_delete_failed',
        },
      });
    }
  }
  if (jobs.length) logger.info({ event: 'asset_cleanup_batch', processed: jobs.length });
}

export function startAssetCleanupWorker() {
  const run = () => void processAssetDeletionJobs().catch((error) => {
    logger.error({ event: 'asset_cleanup_worker_failed', error: error instanceof Error ? error.message : String(error) });
  });
  const first = setTimeout(run, 15_000);
  first.unref();
  const interval = setInterval(run, 10 * 60_000);
  interval.unref();
}
