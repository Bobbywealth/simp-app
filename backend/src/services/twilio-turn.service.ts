import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

type TwilioTokenResponse = {
  ice_servers?: Array<{
    urls?: string | string[];
    url?: string;
    username?: string;
    credential?: string;
  }>;
  ttl?: number;
};

type CachedTwilioToken = {
  iceServers: IceServer[];
  expiresAt: number;
};

let cachedTwilioToken: CachedTwilioToken | null = null;

export function hasTwilioTurnCredentials() {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
}

export function hasStaticTurnCredentials() {
  return Boolean(env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL);
}

function normalizeIceServers(input: Array<{ urls?: string | string[]; url?: string | string[]; username?: string; credential?: string }>) {
  return input
    .map((server) => {
      const urls = server.urls ?? server.url;
      if (!urls) return null;
      return {
        urls,
        ...(server.username ? { username: server.username } : {}),
        ...(server.credential ? { credential: server.credential } : {}),
      } satisfies IceServer;
    })
    .filter((server): server is IceServer => Boolean(server));
}

function mergeIceServers(base: IceServer[], extra: IceServer[]) {
  const seen = new Set<string>();
  const next: IceServer[] = [];
  for (const server of [...base, ...extra]) {
    const key = JSON.stringify(server);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(server);
  }
  return next;
}

async function fetchTwilioIceServers(): Promise<CachedTwilioToken> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new AppError('turn_not_configured', 503, 'TURN is not configured.');
  }

  if (cachedTwilioToken && cachedTwilioToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedTwilioToken;
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Tokens.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Ttl: '43200' }),
    },
  );

  const result = (await response.json()) as TwilioTokenResponse & { message?: string };
  if (!response.ok || !Array.isArray(result.ice_servers)) {
    logger.warn({
      event: 'twilio_turn_token_failed',
      status: response.status,
      message: result.message,
    });
    throw new AppError('turn_unavailable', 503, 'TURN relay is temporarily unavailable.');
  }

  const iceServers = normalizeIceServers(result.ice_servers);
  const ttlMs = Math.max(30 * 60_000, (result.ttl ?? 43_200) * 1_000);
  cachedTwilioToken = {
    iceServers,
    expiresAt: Date.now() + ttlMs,
  };
  return cachedTwilioToken;
}

export async function resolveIceServers() {
  const stunUrls = env.STUN_URLS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ urls: url }));

  const staticTurn = hasStaticTurnCredentials()
    ? [{ urls: env.TURN_URLS!.split(',').map((s) => s.trim()).filter(Boolean), username: env.TURN_USERNAME!, credential: env.TURN_CREDENTIAL! }]
    : [];

  if (env.TURN_PROVIDER === 'twilio') {
    try {
      const token = await fetchTwilioIceServers();
      return {
        iceServers: mergeIceServers(stunUrls, token.iceServers),
        turnConfigured: token.iceServers.some((server) => String(server.urls).startsWith('turn')),
        turnProvider: 'twilio',
        recommendation: null,
      };
    } catch {
      return {
        iceServers: mergeIceServers(stunUrls, staticTurn),
        turnConfigured: staticTurn.length > 0,
        turnProvider: 'twilio',
        recommendation: 'TURN relay is not available right now. Some viewers may see a black screen.',
      };
    }
  }

  return {
    iceServers: mergeIceServers(stunUrls, staticTurn),
    turnConfigured: staticTurn.length > 0,
    turnProvider: env.TURN_PROVIDER ?? null,
    recommendation: staticTurn.length > 0 ? null : 'TURN server not configured. Most cross-network viewers will see a black screen. See README for setup.',
  };
}
