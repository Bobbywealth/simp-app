import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { attachLiveSocket } from './sockets/live.js';

const app = createApp();
const httpServer = createServer(app);

attachLiveSocket(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`[simp-backend] listening on :${env.PORT} (${env.NODE_ENV})`);
});
