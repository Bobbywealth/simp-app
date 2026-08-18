import { createServer } from 'node:http';
import { createApp } from './app.js';
import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { seedLegalDocuments } from './legal/seedLegal.js';
import { startAssetCleanupWorker } from './services/asset-cleanup.service.js';
import { attachLiveSocket } from './sockets/live.js';
import { logger } from './utils/logger.js';

const REQUIRED_MIGRATION = '20260818000000_release_candidate_core';

async function assertDatabaseReady() {
  await prisma.$queryRaw`SELECT 1`;
  const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE migration_name = ${REQUIRED_MIGRATION}
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
    LIMIT 1
  `;
  if (!rows.length) {
    throw new Error(
      `Database schema is incompatible. Run prisma migrate deploy before starting (${REQUIRED_MIGRATION}).`,
    );
  }
}

async function main() {
  await assertDatabaseReady();
  await seedLegalDocuments();

  const app = createApp();
  const httpServer = createServer(app);
  const socketServer = attachLiveSocket(httpServer);
  startAssetCleanupWorker();

  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, () => {
      logger.info({
        event: 'server_started',
        port: env.PORT,
        environment: env.NODE_ENV,
        version: env.APP_VERSION,
      });
      resolve();
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ event: 'server_shutdown', signal });
    socketServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main().catch(async (error: unknown) => {
  logger.fatal({
    event: 'startup_failed',
    error: error instanceof Error ? error.message : String(error),
    stack: env.NODE_ENV === 'production' ? undefined : error instanceof Error ? error.stack : undefined,
  });
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
