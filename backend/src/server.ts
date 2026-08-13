import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { attachLiveSocket } from './sockets/live.js';
import { seedLegalDocuments } from './legal/seedLegal.js';

const execFileAsync = promisify(execFile);

/**
 * Apply pending Prisma migrations on boot. Idempotent — `migrate deploy`
 * is a no-op when there are no pending migrations. Done in-process so
 * the deploy doesn't depend on the build/start command including the
 * `prisma migrate deploy` step.
 */
async function applyMigrations(): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (stdout.trim()) console.log(`[migrate] ${stdout.trim()}`);
    if (stderr.trim()) console.warn(`[migrate] ${stderr.trim()}`);
  } catch (e) {
    // Don't crash the whole server on migration failure — log loudly and
    // continue. The seed step below will then log a clear warning so the
    // operator knows what to fix.
    console.error('[migrate] failed:', (e as Error).message);
  }
}

async function main() {
  await applyMigrations();

  // Idempotent on every boot: inserts new legal-document versions, leaves
  // existing rows alone so the historical record of what each user agreed
  // to stays intact.
  await seedLegalDocuments();

  const app = createApp();
  const httpServer = createServer(app);
  attachLiveSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`[simp-backend] listening on :${env.PORT} (${env.NODE_ENV})`);
  });
}

void main();
