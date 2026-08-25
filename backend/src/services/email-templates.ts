// Branded transactional email templates for SIMP.
//
// All templates render to plain-text + HTML so we always have a usable
// fallback (DMARC failures, screen-readers, email clients that strip
// CSS). The HTML is intentionally inline-styled — most email clients
// (Gmail, Outlook, Apple Mail) strip <style> blocks, so inline is the
// only reliable way to keep the brand consistent in inbox.
//
// The brand palette mirrors the app:
//   - background: near-black (#0a0a0a)
//   - surface:    charcoal (#161616)
//   - primary:    gold (#d4af37)
//   - accent:     light gold (#f1d98a)
//   - text:       ivory (#f5f5f5)
//   - muted:      warm grey (#9c958a)

const BRAND = {
  appName: 'SIMP',
  appUrl: 'https://mysimp.app',
  supportEmail: 'support@mysimp.app',
  privacyUrl: 'https://mysimp.app/privacy',
  termsUrl: 'https://mysimp.app/terms',
  safetyUrl: 'https://mysimp.app/safety',
  tagline: 'EXPERIENCES > CONNECTIONS > MEMORIES',
} as const;

const PALETTE = {
  bg: '#0a0a0a',
  surface: '#161616',
  border: '#2a2a2a',
  primary: '#d4af37',
  accent: '#f1d98a',
  text: '#f5f5f5',
  muted: '#9c958a',
  danger: '#e76f51',
} as const;

type EmailTemplate = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
};

// ─── Layout helpers ──────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(opts: {
  preheader: string;
  bodyHtml: string;
  footerNote: string;
}): string {
  const { preheader, bodyHtml, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(BRAND.appName)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PALETTE.bg};color:${PALETTE.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:${PALETTE.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${PALETTE.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td align="center" style="padding:16px 0 24px 0;">
                <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:6px;color:${PALETTE.primary};font-weight:bold;">${escapeHtml(BRAND.appName)}</span>
                <div style="font-size:10px;letter-spacing:3px;color:${PALETTE.muted};margin-top:6px;">${escapeHtml(BRAND.tagline)}</div>
              </td>
            </tr>
            <tr>
              <td style="background:${PALETTE.surface};border:1px solid ${PALETTE.border};border-radius:12px;padding:32px 28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 16px 0 16px;">
                <p style="font-size:12px;color:${PALETTE.muted};margin:0 0 12px 0;line-height:1.6;">
                  ${footerNote}
                </p>
                <p style="font-size:12px;color:${PALETTE.muted};margin:0;line-height:1.8;">
                  <a href="${BRAND.privacyUrl}" style="color:${PALETTE.muted};text-decoration:underline;">Privacy</a>
                  &nbsp;·&nbsp;
                  <a href="${BRAND.termsUrl}" style="color:${PALETTE.muted};text-decoration:underline;">Terms</a>
                  &nbsp;·&nbsp;
                  <a href="${BRAND.safetyUrl}" style="color:${PALETTE.muted};text-decoration:underline;">Safety</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:${BRAND.supportEmail}" style="color:${PALETTE.muted};text-decoration:underline;">Support</a>
                </p>
                <p style="font-size:11px;color:${PALETTE.muted};margin:16px 0 0 0;">
                  © ${new Date().getFullYear()} ${escapeHtml(BRAND.appName)}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
    <tr>
      <td align="center" style="background:linear-gradient(135deg,${PALETTE.primary} 0%,${PALETTE.accent} 100%);border-radius:8px;">
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:2px;color:${PALETTE.bg};text-decoration:none;font-weight:bold;text-transform:uppercase;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Public template builders ────────────────────────────────────────────

export function verificationEmail(opts: { to: string; verifyUrl: string }): EmailTemplate {
  const { verifyUrl } = opts;
  const subject = 'Verify your SIMP email';
  const preheader = 'One more step to unlock real connections.';
  const bodyHtml = `
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${PALETTE.text};margin:0 0 8px 0;">Welcome to SIMP</h1>
    <p style="font-size:15px;line-height:1.7;color:${PALETTE.text};margin:0 0 16px 0;">
      Thanks for joining. Verify your email to finish setting up your account and unlock discovery, matches, and live experiences.
    </p>
    <p style="font-size:15px;line-height:1.7;color:${PALETTE.text};margin:0 0 8px 0;">
      Real people. Real connections. It all starts here.
    </p>
    ${ctaButton('Verify email', verifyUrl)}
    <p style="font-size:13px;line-height:1.6;color:${PALETTE.muted};margin:24px 0 0 0;word-break:break-all;">
      Or paste this link into your browser:<br />
      <a href="${verifyUrl}" style="color:${PALETTE.accent};text-decoration:underline;">${escapeHtml(verifyUrl)}</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:${PALETTE.muted};margin:16px 0 0 0;">
      This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.
    </p>`;
  return {
    subject,
    preheader,
    html: layout({ preheader, bodyHtml, footerNote: 'You received this email because someone signed up at ' + BRAND.appName + ' with this address.' }),
    text: [
      'Welcome to SIMP',
      '',
      'Thanks for joining. Verify your email to finish setting up your account.',
      '',
      'Open this link to verify (expires in 24 hours):',
      verifyUrl,
      '',
      "If you didn't sign up, you can safely ignore this email.",
      '',
      '— ' + BRAND.appName,
    ].join('\n'),
  };
}

export function passwordResetEmail(opts: { to: string; resetUrl: string }): EmailTemplate {
  const { resetUrl } = opts;
  const subject = 'Reset your SIMP password';
  const preheader = 'Choose a new password to get back in.';
  const bodyHtml = `
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:${PALETTE.text};margin:0 0 8px 0;">Reset your password</h1>
    <p style="font-size:15px;line-height:1.7;color:${PALETTE.text};margin:0 0 16px 0;">
      We received a request to reset the password for your SIMP account. Tap the button below to choose a new one.
    </p>
    ${ctaButton('Choose new password', resetUrl)}
    <p style="font-size:13px;line-height:1.6;color:${PALETTE.muted};margin:24px 0 0 0;word-break:break-all;">
      Or paste this link into your browser:<br />
      <a href="${resetUrl}" style="color:${PALETTE.accent};text-decoration:underline;">${escapeHtml(resetUrl)}</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:${PALETTE.muted};margin:16px 0 0 0;">
      This link expires in 30 minutes. If you didn't request a password reset, you can safely ignore this email — your password will stay the same.
    </p>`;
  return {
    subject,
    preheader,
    html: layout({ preheader, bodyHtml, footerNote: 'For your security, this reset link expires in 30 minutes and can only be used once.' }),
    text: [
      'Reset your SIMP password',
      '',
      'Open this link to choose a new password (expires in 30 minutes):',
      resetUrl,
      '',
      "If you didn't request this, ignore this email — your password will stay the same.",
      '',
      '— ' + BRAND.appName,
    ].join('\n'),
  };
}
