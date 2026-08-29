import { createServer } from 'node:http';
import { createApp } from './app.js';
import { prisma } from './config/db.js';
import { env } from './config/env.js';
import { seedLegalDocuments } from './legal/seedLegal.js';
import { startAssetCleanupWorker } from './services/asset-cleanup.service.js';
import { startLivekitUsageWorker } from './services/livekit-usage.service.js';
import { captureException, initSentry } from './services/sentry.service.js';
import { attachLiveSocket } from './sockets/live.js';
import { logger } from './utils/logger.js';

// Initialize Sentry as the first thing at startup. initSentry() is a
// no-op if SENTRY_DSN is unset, so this is always safe to call.
initSentry();

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

// One-time startup shim: the live DB is missing User.presence and
// Message.imageUrl columns that schema.prisma declares. Adding the
// columns to the existing prisma migrations (in 2026083000*) is
// correct, but preDeployCommand on this Render service is not
// reliably running prisma migrate deploy, so the migrations never
// apply. This shim runs the equivalent SQL on every boot — all
// statements are idempotent.
//
// SAFE TO REMOVE once the deploy pipeline reliably runs
// `prisma migrate deploy` (the underlying migrations already exist
// in backend/prisma/migrations/2026083000*).
async function applyPendingColumnShims() {
  // User.presence: add column if missing, fill any nulls, enforce
  // NOT NULL to match schema.prisma's `presence String @default("online")`.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'presence'
      ) THEN
        ALTER TABLE "User" ADD COLUMN "presence" TEXT NOT NULL DEFAULT 'online';
      END IF;
    END $$;
  `);
  // Existing rows from earlier broken migration runs may be NULL.
  // Backfill, then enforce NOT NULL.
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "presence" = 'online' WHERE "presence" IS NULL`,
  );
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'presence'
          AND is_nullable = 'YES'
      ) THEN
        ALTER TABLE "User" ALTER COLUMN "presence" SET NOT NULL;
        ALTER TABLE "User" ALTER COLUMN "presence" SET DEFAULT 'online';
      END IF;
    END $$;
  `);

  // Message.imageUrl: add nullable column if missing.
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Message' AND column_name = 'imageUrl'
      ) THEN
        ALTER TABLE "Message" ADD COLUMN "imageUrl" TEXT;
      END IF;
    END $$;
  `);
}

async function main() {
  await assertDatabaseReady();
  await applyPendingColumnShims();
  await seedLegalDocuments();

  const app = createApp();
  const httpServer = createServer(app);
  const socketServer = attachLiveSocket(httpServer);
  startAssetCleanupWorker();
  startLivekitUsageWorker();

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
  captureException(error, { phase: 'startup' });
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
