import { Router } from 'express';
import { prisma } from '../config/db.js';

/**
 * Public, unauthenticated endpoints that serve the legal documents as
 * styled HTML. Required by:
 *  - Apple App Store (each app needs a working privacy policy URL +
 *    terms URL that review can fetch and verify)
 *  - Google Play Store (privacy policy URL is mandatory; ToS strongly
 *    recommended)
 *
 * The /legal/tos.json and /legal/privacy.json variants (auth-required)
 * already exist in legal.routes.ts — this module serves the same
 * content but as a public, cacheable HTML page with the brand styling.
 */

export const publicRouter = Router();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tiny Markdown-to-HTML converter covering only what we use in the
 * seeded ToS / Privacy content (h1-h6, bold, italic, paragraphs,
 * ordered/unordered lists, links, horizontal rule). Not a general
 * Markdown lib — would have been overkill for two hand-authored docs.
 */
function mdToHtml(md: string): string {
  const lines = md.split('\n');
  let out = '';
  let inUl = false;
  let inOl = false;
  let inPara = false;
  const flushPara = () => {
    if (inPara) {
      out += '</p>';
      inPara = false;
    }
  };
  const closeLists = () => {
    if (inUl) {
      out += '</ul>';
      inUl = false;
    }
    if (inOl) {
      out += '</ol>';
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      closeLists();
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      closeLists();
      const lvl = h[1]!.length;
      const text = inline(h[2]!);
      out += `<h${lvl} class="legal-h${lvl}">${text}</h${lvl}>`;
      continue;
    }

    // HR
    if (/^---+$/.test(line.trim())) {
      flushPara();
      closeLists();
      out += '<hr class="legal-hr" />';
      continue;
    }

    // Unordered list
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (inOl) {
        out += '</ol>';
        inOl = false;
      }
      if (!inUl) {
        out += '<ul class="legal-ul">';
        inUl = true;
      }
      out += `<li>${inline(ul[1]!)}</li>`;
      continue;
    }

    // Ordered list
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      if (inUl) {
        out += '</ul>';
        inUl = false;
      }
      if (!inOl) {
        out += '<ol class="legal-ol">';
        inOl = true;
      }
      out += `<li>${inline(ol[1]!)}</li>`;
      continue;
    }

    // Paragraph
    flushPara();
    closeLists();
    if (!inPara) {
      out += '<p class="legal-p">';
      inPara = true;
    } else {
      out += ' ';
    }
    out += inline(line);
  }
  flushPara();
  closeLists();
  return out;
}

function inline(text: string): string {
  let s = escapeHtml(text);
  // bold **x**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *x* or _x_
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  // inline code `x`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function renderPage(opts: {
  title: string;
  type: string;
  version: string;
  effectiveAt: Date;
  content: string;
}): string {
  const formattedDate = opts.effectiveAt.toISOString().slice(0, 10);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(opts.title)} — SIMP</title>
<meta name="description" content="SIMP ${escapeHtml(opts.type)} version ${escapeHtml(opts.version)}, effective ${escapeHtml(formattedDate)}." />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="${escapeHtml(opts.title)} — SIMP" />
<meta property="og:type" content="website" />
<style>
  :root {
    --ink-950: #050505;
    --ink-900: #0a0a0a;
    --ink-800: #141414;
    --gold-300: #f6e6b8;
    --gold-400: #d4a93a;
    --gold-500: #a98320;
    --text: #e6e6e6;
    --muted: #a3a3a3;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--ink-950);
    color: var(--text);
    line-height: 1.65;
  }
  .container { max-width: 760px; margin: 0 auto; padding: 56px 24px 96px; }
  header { border-bottom: 1px solid rgba(212, 169, 58, 0.2); padding-bottom: 32px; margin-bottom: 40px; }
  .brand {
    display: flex; align-items: center; gap: 12px;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 20px; letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--gold-300);
    margin-bottom: 24px;
  }
  .brand-crown { font-size: 28px; }
  h1 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 400;
    font-size: 40px;
    margin: 0 0 8px;
    color: #fff;
  }
  .meta { color: var(--muted); font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; }
  .legal-p { margin: 14px 0; }
  .legal-h1 { font-size: 28px; margin: 32px 0 12px; color: var(--gold-300); font-family: 'Cormorant Garamond', serif; }
  .legal-h2 { font-size: 22px; margin: 28px 0 10px; color: var(--gold-300); }
  .legal-h3 { font-size: 17px; margin: 22px 0 8px; color: #fff; }
  .legal-h4, .legal-h5, .legal-h6 { font-size: 15px; margin: 18px 0 6px; color: #fff; }
  .legal-ul, .legal-ol { padding-left: 24px; margin: 12px 0; }
  .legal-ul li, .legal-ol li { margin: 6px 0; }
  strong { color: var(--gold-300); font-weight: 600; }
  a { color: var(--gold-400); }
  code { background: rgba(212, 169, 58, 0.1); color: var(--gold-300); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  .legal-hr { border: 0; border-top: 1px solid rgba(212, 169, 58, 0.15); margin: 32px 0; }
  footer {
    margin-top: 64px; padding-top: 24px;
    border-top: 1px solid rgba(212, 169, 58, 0.15);
    color: var(--muted); font-size: 13px;
  }
  footer a { color: var(--gold-400); }
  .contact { margin-top: 12px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="brand">
      <span class="brand-crown">♛</span>
      <span>SIMP</span>
    </div>
    <h1>${escapeHtml(opts.title)}</h1>
    <div class="meta">Version ${escapeHtml(opts.version)} · Effective ${escapeHtml(formattedDate)}</div>
  </header>

  <article>
    ${mdToHtml(opts.content)}
  </article>

  <footer>
    <p>SIMP LLC · Operated with intent.</p>
    <p class="contact">
      Questions? <a href="mailto:legal@mysimp.com">legal@mysimp.com</a> ·
      <a href="/legal/privacy">Privacy Policy</a> ·
      <a href="/legal/tos">Terms of Service</a>
    </p>
  </footer>
</div>
</body>
</html>`;
}

/**
 * GET /legal/tos.html — public HTML view of the current Terms of Service.
 *
 * (The auth-required JSON version is at /legal/tos — different route,
 * mounted by legalRouter. The .html suffix keeps the two namespaces
 * distinct so the auth middleware doesn't intercept this one.)
 */
/**
 * GET /terms, /privacy, /support — the canonical public URLs we put in
 * App Store Connect / Play Console. These are unauthenticated, public,
 * and render the same HTML the .html-suffixed variants do. The
 * reason for two paths is that older bookmarks / shared links may use
 * either form.
 */
publicRouter.get(['/terms', '/legal/tos.html'], async (_req, res, next) => {
  try {
    const tos = await prisma.tosVersion.findFirst({
      where: { type: 'tos' },
      orderBy: { effectiveAt: 'desc' },
    });
    if (!tos) {
      res.status(404).type('html').send('<h1>Terms of Service not yet published.</h1>');
      return;
    }
    res
      .type('html')
      .set('Cache-Control', 'public, max-age=300, s-maxage=3600')
      .send(
        renderPage({
          title: 'Terms of Service',
          type: 'Terms of Service',
          version: tos.version,
          effectiveAt: tos.effectiveAt,
          content: tos.content,
        })
      );
  } catch (e) {
    next(e);
  }
});

/**
 * GET /legal/privacy.html — public HTML view of the current Privacy Policy.
 */
publicRouter.get(['/privacy', '/legal/privacy.html'], async (_req, res, next) => {
  try {
    const privacy = await prisma.tosVersion.findFirst({
      where: { type: 'privacy' },
      orderBy: { effectiveAt: 'desc' },
    });
    if (!privacy) {
      res
        .status(404)
        .type('html')
        .send('<h1>Privacy Policy not yet published.</h1>');
      return;
    }
    res
      .type('html')
      .set('Cache-Control', 'public, max-age=300, s-maxage=3600')
      .send(
        renderPage({
          title: 'Privacy Policy',
          type: 'Privacy Policy',
          version: privacy.version,
          effectiveAt: privacy.effectiveAt,
          content: privacy.content,
        })
      );
  } catch (e) {
    next(e);
  }
});

/**
 * GET /legal/support.html — public contact page. Both stores require a
 * working support URL that users (and reviewers) can reach. For now
 * this is a simple page; in production wire it to your real support
 * inbox or helpdesk system (Intercom, Crisp, Zendesk, etc.).
 */
publicRouter.get(['/support', '/legal/support.html'], (_req, res) => {
  res.type('html').set('Cache-Control', 'public, max-age=600').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Support — SIMP</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050505; color: #e6e6e6; line-height: 1.65; }
  .container { max-width: 640px; margin: 0 auto; padding: 56px 24px 96px; }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 400; font-size: 40px; margin: 0 0 16px; color: #fff; }
  .accent { color: #d4a93a; }
  a { color: #d4a93a; }
  .card { border: 1px solid rgba(212, 169, 58, 0.2); border-radius: 16px; padding: 24px; margin: 16px 0; background: #0a0a0a; }
  .btn { display: inline-block; background: #d4a93a; color: #050505; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
  <h1>SIMP <span class="accent">Support</span></h1>
  <p>Need help? We've got you. Pick whichever channel is fastest for you.</p>

  <div class="card">
    <h3 style="margin-top:0">Email</h3>
    <p>For account issues, billing, or anything sensitive — we usually reply within 12 hours.</p>
    <p><a class="btn" href="mailto:support@mysimp.com">support@mysimp.com</a></p>
  </div>

  <div class="card">
    <h3 style="margin-top:0">Privacy &amp; data requests</h3>
    <p>GDPR / CCPA data export, deletion, or opt-out requests. Verified within 30 days per regulation.</p>
    <p><a class="btn" href="mailto:privacy@mysimp.com">privacy@mysimp.com</a></p>
  </div>

  <div class="card">
    <h3 style="margin-top:0">Report abuse or safety concerns</h3>
    <p>For urgent safety issues on a live stream or recent interaction.</p>
    <p><a class="btn" href="mailto:safety@mysimp.com">safety@mysimp.com</a></p>
  </div>

  <div class="card">
    <h3 style="margin-top:0">In-app</h3>
    <p>Most issues can be resolved from <strong>Profile → Settings → Help &amp; Support</strong> in the app.</p>
  </div>
</div>
</body>
</html>`);
});
