import { Router } from 'express';
import { resolveIceServers } from '../services/twilio-turn.service.js';
import { livekitPublicConfig } from '../services/livekit.service.js';

/**
 * GET /config/ice-servers
 *
 * Returns the ICE server configuration (STUN + TURN) that the frontend
 * should use when constructing `new RTCPeerConnection({ iceServers })`.
 *
 * The endpoint is intentionally unauthenticated — ICE configuration is not
 * sensitive (the URLs and even credentials are by definition handed to
 * every WebRTC client) and there's no PII in the response. Keeping it
 * unauthenticated lets the frontend fetch it at app start before any
 * login flow has run.
 *
 * Defaults: STUN-only (Google's free servers). Without TURN, ~50% of
 * cross-network viewers will fail to connect. See README "TURN setup"
 * for how to plug in Twilio Network Traversal, Cloudflare Calls, or a
 * self-hosted coturn.
 */
export const configRouter = Router();

configRouter.get('/config/ice-servers', async (_req, res) => {
  const config = await resolveIceServers();
  res.json(config);
});

/**
 * GET /config/livekit
 *
 * Public, unauthenticated — returns just the LiveKit WebSocket URL and
 * whether recording is enabled. The API secret never leaves the server.
 * The room-scoped access token is issued by the auth-gated /live/token
 * route.
 */
configRouter.get('/config/livekit', (_req, res) => {
  const config = livekitPublicConfig();
  if (!config) {
    // 204 No Content is the right shape for "feature not configured" — the
    // frontend falls back to the legacy WebRTC mesh path until the env
    // vars are set.
    return res.status(204).end();
  }
  res.json(config);
});
