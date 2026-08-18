import { env } from '../config/env.js';
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
  await sendEmail({
    to,
    subject: 'Verify your SIMP email',
    text: `Verify your SIMP email by opening this link: ${url}\n\nThis link expires in 24 hours.`,
    html: `<h1>Welcome to SIMP</h1><p>Verify your email to finish setting up your account.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const url = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: 'Reset your SIMP password',
    text: `Reset your SIMP password by opening this link: ${url}\n\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
    html: `<h1>Reset your password</h1><p><a href="${url}">Choose a new password</a></p><p>This link expires in 30 minutes. If you did not request it, ignore this email.</p>`,
  });
}
