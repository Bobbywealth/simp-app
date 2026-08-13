import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  UPLOAD_DIR: z.string().default('./uploads'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),

  /// ICE / WebRTC relay configuration. STUN works for ~50% of users
  /// (same NAT, no symmetric firewall); TURN is required for the rest.
  /// Without TURN, viewers behind corporate firewalls, VPNs, or
  /// symmetric NATs will see a black screen. See README "TURN setup".
  /// STUN_URLS is comma-separated. Defaults to Google's free STUN.
  STUN_URLS: z
    .string()
    .default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  /// TURN_URLS is comma-separated. Leave unset to disable TURN (dev only).
  /// Format examples:
  ///   turn:turn.example.com:3478?transport=udp
  ///   turns:turn.example.com:443?transport=tcp
  TURN_URLS: z.string().optional(),
  /// Short-lived TURN credentials (REST API style). When set with
  /// TURN_URLS, the server embeds them in /config/ice-servers so the
  /// frontend can authenticate against the TURN server. For self-hosted
  /// coturn with static credentials, set TURN_USERNAME / TURN_CREDENTIAL
  /// and the values are passed straight through.
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  /// Optional human-readable label for the TURN provider, surfaced in
  /// /config/ice-servers for debugging. Example: "twilio".
  TURN_PROVIDER: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
