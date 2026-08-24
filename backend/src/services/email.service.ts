import { env } from '../config/env.js';
import { passwordResetEmail, verificationEmail } from './email-templates.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function emailConfigured(): boolean {
  return env.EMAIL_PROVIDER !== 'disabled';
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.EMAIL_PROVIDER === 'disabled') {
    throw new AppError(
      'email_unavailable',
      503,
      'Email delivery is temporarily unavailable. Please try again later.',
    );
  }

  if (env.EMAIL_PROVIDER === 'console') {
    if (env.NODE_ENV === 'production') {
      throw new AppError('email_unavailable', 503, 'Email delivery is not configured.');
    }
    logger.info({ event: 'development_email', to: message.to, subject: message.subject });
    return;
  }

  if (env.EMAIL_PROVIDER === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      logger.error({ event: 'email_delivery_failed', provider: 'resend', status: response.status });
      throw new AppError('email_delivery_failed', 502, 'We could not send that email. Try again.');
    }
    return;
  }

  const response = await fetch(env.EMAIL_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    logger.error({ event: 'email_delivery_failed', provider: 'webhook', status: response.status });
    throw new AppError('email_delivery_failed', 502, 'We could not send that email. Try again.');
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const url = `${env.FRONTEND_URL.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  if (await recipientBounced(to)) {
    logger.warn({ event: 'verification_email_skipped_bounced', to });
    return;
  }
  const template = verificationEmail({ to, verifyUrl: url });
  await sendEmail({ to, subject: template.subject, text: template.text, html: template.html });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  // Avoid leaking whether the email exists — return early without sending
  // when the address is clearly malformed. We don't validate format here
  // because login already requires a valid email at signup; the worst case
  // is a 4xx from the provider, which we log but don't surface to the
  // caller (requestPasswordReset is intentionally fire-and-forget).
  if (!to.includes('@')) return;
  if (await recipientBounced(to)) {
    logger.warn({ event: 'password_reset_email_skipped_bounced', to });
    return;
  }
  const url = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  const template = passwordResetEmail({ to, resetUrl: url });
  await sendEmail({ to, subject: template.subject, text: template.text, html: template.html });
}

/**
 * Returns true when the recipient has a recent hard bounce or spam
 * complaint and shouldn't receive further transactional mail until
 * they re-verify. The webhook handler clears these flags on the next
 * successful delivery.
 */
export async function recipientBounced(email: string): Promise<boolean> {
  // Lazy import to keep this module free of circular Prisma deps at
  // boot — the service file is loaded before the client in tests.
  const { prisma } = await import('../config/db.js');
  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailBounceAt: true, emailBounceType: true },
  });
  if (!user?.emailBounceAt) return false;
  // Hard bounces and complaints stay sticky for 7 days. After that
  // we re-attempt; a successful delivery clears the flag.
  const ageMs = Date.now() - user.emailBounceAt.getTime();
  return ageMs < 7 * 24 * 60 * 60 * 1_000;
}
