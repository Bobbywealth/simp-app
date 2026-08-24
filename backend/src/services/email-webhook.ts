// Signature verification + event parsing for transactional email
// provider webhooks (Resend, currently). Resend uses Svix for signing,
// so the verification routine is the same as any other Svix-protected
// webhook endpoint: HMAC-SHA256 of `${id}.${timestamp}.${body}` keyed
// by the base64-decoded webhook secret (after stripping the `whsec_`
// prefix), compared in constant time against the `v1,<base64>` header.
//
// Verification is best-effort: if no RESEND_WEBHOOK_SECRET is set we
// accept the request (logged as a warning) so development environments
// without a configured webhook can still hit the endpoint. Production
// must always set the secret — the warning is surfaced on
// /health/ready as a degraded feature.

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Logger } from 'pino';

export type EmailEventType =
  | 'email.delivered'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'
  | 'email.sent'
  | 'email.delivery_delayed'
  | 'email.failed';

export type EmailEventPayload = {
  type: EmailEventType | string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    bounced?: boolean;
    bounce_type?: 'hard' | 'soft' | string;
    complaint?: boolean;
    delivery_delay?: number;
    smtp_response?: string;
    [key: string]: unknown;
  };
};

export type VerificationResult =
  | { verified: true }
  | { verified: false; reason: 'missing_secret' | 'missing_header' | 'bad_signature' | 'malformed_signature' };

export function verifyResendSignature(opts: {
  body: string;
  headers: Record<string, string | string[] | undefined>;
  secret: string | undefined;
}): VerificationResult {
  const { body, headers, secret } = opts;
  if (!secret) return { verified: false, reason: 'missing_secret' };

  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatureHeader = headers['svix-signature'];
  if (!id || !timestamp || !signatureHeader) return { verified: false, reason: 'missing_header' };

  const signed = `${id}.${timestamp}.${body}`;
  const expected = createHmac('sha256', base64DecodeSecret(secret)).update(signed).digest();
  const provided = parseSignatureHeader(String(signatureHeader));
  if (!provided) return { verified: false, reason: 'malformed_signature' };

  for (const candidate of provided) {
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return { verified: true };
    }
  }
  return { verified: false, reason: 'bad_signature' };
}

function base64DecodeSecret(secret: string): Buffer {
  // Resend hands out secrets as `whsec_<base64>`. We strip the prefix
  // and base64-decode the rest so the HMAC key is the raw bytes.
  const stripped = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  return Buffer.from(stripped, 'base64');
}

function parseSignatureHeader(header: string): Buffer[] {
  // Format: "v1,<base64> v1,<base64>" (space-separated, multiple
  // rotations supported). Only v1 is accepted today.
  const out: Buffer[] = [];
  for (const part of header.split(' ')) {
    const [version, value] = part.split(',', 2);
    if (version !== 'v1' || !value) continue;
    try {
      out.push(Buffer.from(value, 'base64'));
    } catch {
      // Skip malformed entries; we'll fail verification if all are.
    }
  }
  return out;
}

export function parseEmailEvent(body: string, logger?: Logger): EmailEventPayload | null {
  try {
    const parsed = JSON.parse(body) as EmailEventPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.type) return null;
    return parsed;
  } catch (error) {
    logger?.warn({
      event: 'webhook_payload_unparseable',
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
