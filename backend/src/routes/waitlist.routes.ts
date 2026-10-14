import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/db.js';
import { sendEmail } from '../services/email.service.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { WAITLIST_PAGE_HTML } from './waitlist-page.js';

/**
 * Prelaunch waitlist. Two endpoints:
 *  - GET  /prelaunch (and /, /waitlist)  — serves the landing HTML.
 *  - POST /api/waitlist                  — captures {name, email},
 *    stores in WaitlistEntry (idempotent on email), and emails Bobby.
 *
 * The HTML page is inlined (compiled into the bundle) so Render doesn't
 * need to ship the public dir separately. Rate-limited at 5/15min per IP
 * to keep the form from being a vector for spam. Bobby authorized
 * 2026-10-14.
 */

export const waitlistRouter = Router();

const submitLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'rate_limited',
    message: 'Too many signups from this connection. Try again in a few minutes.',
    fieldErrors: {},
  },
});

const waitlistSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  source: z.string().trim().max(80).optional(),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendWaitlistPage(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short browser cache so the page can be iterated quickly during
  // launch. No CDN edge cache; this is a single-tenant landing page.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.send(WAITLIST_PAGE_HTML);
}

// Landing page. Mounted at /prelaunch so the existing /api/* routes
// remain unaffected. Root (/) is reserved for the future API root.
waitlistRouter.get(['/prelaunch', '/waitlist'], sendWaitlistPage);

waitlistRouter.post('/api/waitlist', submitLimiter, async (req, res, next) => {
  try {
    const parsed = waitlistSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return res.status(400).json({
        error: first?.message ?? 'Invalid input',
        field: first?.path?.[0],
      });
    }
    const { name, email, source } = parsed.data;

    // Capture light context (no PII besides the form submission
    // itself). Bobby may want to spot referral sources later.
    const ipAddress =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : req.ip) ?? null;
    const userAgent = (req.headers['user-agent'] ?? '').slice(0, 500) || null;

    // Idempotent on email — duplicates update name + bump updatedAt.
    const entry = await prisma.waitlistEntry.upsert({
      where: { email },
      create: {
        name,
        email,
        source: source ?? null,
        ipAddress,
        userAgent,
      },
      update: {
        name,
        source: source ?? undefined,
      },
    });

    // Best-effort notification. Failures are logged but do NOT block
    // the user-facing success response — the row is the durable
    // record, and Resend's outbound log keeps an audit trail even
    // when the SMTP send itself fails.
    const submittedAt = entry.createdAt.toISOString();
    const notifyTo = process.env.WAITLIST_NOTIFY_EMAIL || 'business@wolfpaqmarketing.com';

    try {
      await sendEmail({
        to: notifyTo,
        subject: `New SIMP waitlist signup — ${name}`,
        text:
          `New SIMP prelaunch signup\n` +
          `--------------------------\n` +
          `Name:  ${name}\n` +
          `Email: ${email}\n` +
          `Source:${source ? ' ' + source : ' (direct)'}\n` +
          `At:    ${submittedAt}\n` +
          `IP:    ${ipAddress ?? '-'}\n`,
        html:
          `<h2 style="font-family:Inter,system-ui,sans-serif;margin:0 0 12px">` +
          `New SIMP prelaunch signup</h2>` +
          `<table style="font-family:Inter,system-ui,sans-serif;border-collapse:collapse">` +
          `<tr><td style="color:#999;padding:2px 12px 2px 0">Name</td>` +
          `<td><strong>${escapeHtml(name)}</strong></td></tr>` +
          `<tr><td style="color:#999;padding:2px 12px 2px 0">Email</td>` +
          `<td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>` +
          (source
              ? `<tr><td style="color:#999;padding:2px 12px 2px 0">Source</td>` +
                `<td>${escapeHtml(source)}</td></tr>`
              : '') +
          `<tr><td style="color:#999;padding:2px 12px 2px 0">Submitted</td>` +
          `<td>${submittedAt}</td></tr>` +
          `<tr><td style="color:#999;padding:2px 12px 2px 0">IP</td>` +
          `<td>${escapeHtml(ipAddress ?? '-')}</td></tr>` +
          `</table>`,
      });
    } catch (err) {
      logger.warn(
        { event: 'waitlist_notify_failed', email, err: (err as Error).message },
        'waitlist notification email failed; signup still recorded',
      );
    }

    return res.status(200).json({ ok: true, id: entry.id });
  } catch (err) {
    return next(err);
  }
});