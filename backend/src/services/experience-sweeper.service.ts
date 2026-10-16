import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

/**
 * Expires stale PENDING experience requests. When an experience's start time
 * passes, any requests still PENDING are dead — the event happened without
 * them. We cancel them so host dashboards don't accumulate zombie requests.
 */
async function expireStaleRequests() {
  const now = new Date();
  // Find experiences that have started with stale pending requests.
  const stale = await prisma.experienceRequest.findMany({
    where: {
      status: 'PENDING',
      experience: {
        startsAt: { lte: now },
        status: { in: ['OPEN', 'FULL'] },
      },
    },
    select: { id: true },
  });
  if (!stale.length) return;

  const result = await prisma.experienceRequest.updateMany({
    where: { id: { in: stale.map((r) => r.id) }, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  logger.info({ event: 'experience_stale_requests_expired', count: result.count });
}

export function startExperienceSweeper() {
  const run = () =>
    void expireStaleRequests().catch((error) => {
      logger.error({
        event: 'experience_sweeper_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  const first = setTimeout(run, 30_000);
  first.unref();
  // Hourly is plenty — staleness is measured in hours/days, not minutes.
  const interval = setInterval(run, 60 * 60_000);
  interval.unref();
}
