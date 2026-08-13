import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { attachLiveSocket } from './sockets/live.js';
import { seedLegalDocuments } from './legal/seedLegal.js';

async function main() {
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
