import { Router, type Request, type Response } from 'express';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  parseEmailEvent,
  verifyResendSignature,
  type EmailEventPayload,
} from '../services/email-webhook.js';

// Resend webhook receiver.
//
// Resend retries the request until it gets a 2xx, so we always return
// 200 once we've recorded the event. Verification failures still
// return 200 with a structured log entry — that prevents Resend from
// storming the endpoint while we investigate, and the log gives us
// everything we need to reconcile.
//
// We use express.raw() (see app.ts mount) so the signature can be
// computed against the exact bytes Resend signed. After verification
// we hand the body to JSON.parse ourselves via parseEmailEvent.

export const webhooksRouter = Router();

webhooksRouter.post('/webhooks/resend', async (req: Request, res: Response) => {
  // The /webhooks mount point in app.ts uses express.raw(), so req.body
  // arrives here as a Buffer (not a parsed object). That preserves the
  // exact bytes Resend signed, which we need for HMAC verification.
  const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer) : Buffer.from('');
  const bodyString = rawBody.toString('utf8');

  const verification = verifyResendSignature({
    body: bodyString,
    headers: req.headers as Record<string, string | string[] | undefined>,
    secret: env.RESEND_WEBHOOK_SECRET,
  });

  if (!verification.verified) {
    logger.warn({
      event: 'resend_webhook_unverified',
      reason: verification.reason,
      hasSecret: Boolean(env.RESEND_WEBHOOK_SECRET),
    });
    // Return 200 so Resend stops retrying; the warning log is the
    // reconciliation signal. A 4xx here would just amplify the noise.
    return res.status(200).json({ received: false, reason: verification.reason });
  }

  const event = parseEmailEvent(bodyString, logger);
  if (!event) {
    return res.status(200).json({ received: false, reason: 'unparseable' });
  }

  await recordEvent(event);
  return res.status(200).json({ received: true, type: event.type });
});

async function recordEvent(event: EmailEventPayload): Promise<void> {
  const recipient = firstRecipient(event.data?.to);
  const user = recipient ? await findUserByEmail(recipient) : null;

  await prisma.emailEvent.create({
    data: {
      userId: user?.id ?? null,
      email: recipient ?? 'unknown@unknown',
      type: String(event.type),
      provider: 'resend',
      subject: typeof event.data?.subject === 'string' ? event.data.subject : null,
      messageId: typeof event.data?.email_id === 'string' ? event.data.email_id : null,
      payload: event as unknown as object,
    },
  });

  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    const bounceType = event.type === 'email.complained'
      ? 'complaint'
      : (event.data?.bounce_type as string | undefined) ?? (event.data?.bounced ? 'hard' : 'unknown');

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailBounceAt: new Date(), emailBounceType: bounceType },
      });
    }

    logger.warn({
      event: 'email_bounce_recorded',
      recipient,
      bounceType,
      userId: user?.id ?? null,
      messageId: event.data?.email_id ?? null,
    });
    return;
  }

  if (event.type === 'email.delivered') {
    if (user?.emailBounceAt) {
      // A successful delivery after a bounce means the address is
      // healthy again — clear the bounce flag so we resume normal
      // transactional sends.
      await prisma.user.update({
        where: { id: user.id },
        data: { emailBounceAt: null, emailBounceType: null },
      });
    }
    return;
  }

  logger.info({
    event: 'resend_webhook_received',
    type: event.type,
    recipient,
    userId: user?.id ?? null,
  });
}

function firstRecipient(value: unknown): string | null {
  if (typeof value === 'string') return value.toLowerCase();
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0].toLowerCase();
  }
  return null;
}

async function findUserByEmail(email: string): Promise<{ id: string; emailBounceAt: Date | null } | null> {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, emailBounceAt: true },
  });
}
