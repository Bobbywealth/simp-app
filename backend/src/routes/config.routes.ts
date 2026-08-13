import { Router } from 'express';
import { env } from '../config/env.js';

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

configRouter.get('/config/ice-servers', (_req, res) => {
  const stunUrls = env.STUN_URLS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));

  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    ...stunUrls,
  ];

  let turnConfigured = false;
  if (env.TURN_URLS) {
    const turnUrls = env.TURN_URLS.split(',').map((s) => s.trim()).filter(Boolean);
    if (turnUrls.length > 0) {
      const urls: string | string[] = turnUrls.length === 1 ? turnUrls[0]! : turnUrls;
      iceServers.push({
        urls,
        ...(env.TURN_USERNAME ? { username: env.TURN_USERNAME } : {}),
        ...(env.TURN_CREDENTIAL ? { credential: env.TURN_CREDENTIAL } : {}),
      });
      turnConfigured = true;
    }
  }

  res.json({
    iceServers,
    turnConfigured,
    turnProvider: env.TURN_PROVIDER ?? null,
    /// Hint surfaced in /config/ice-servers so the frontend can show a
    /// "TURN not configured — some viewers may not connect" banner when
    /// appropriate (e.g. on the broadcaster's preview screen).
    recommendation: turnConfigured
      ? null
      : 'TURN server not configured. Most cross-network viewers will see a black screen. See README for setup.',
  });
});
