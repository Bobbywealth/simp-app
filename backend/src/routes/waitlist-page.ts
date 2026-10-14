// SIMP prelaunch landing page. Served by the existing publicRouter
// routes (mounted at /prelaunch and /). Static HTML — no React build
// step, served straight from this compiled string. Bobby authorized
// 2026-10-14.

export const WAITLIST_PAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0a0a" />
    <meta name="description" content="SIMP — join the prelaunch waitlist. Real connections for intentional people." />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="SIMP — Join the waitlist" />
    <meta property="og:description" content="Be first in line when SIMP opens. Real connections. Real intent." />
    <meta property="og:url" content="https://mysimp.com" />
    <meta property="og:site_name" content="SIMP" />

    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230a0a0a'/%3E%3Ctext x='32' y='44' font-family='Georgia,serif' font-size='38' font-weight='700' text-anchor='middle' fill='%23d4a93a'%3ES%3C/text%3E%3C/svg%3E" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

    <title>SIMP — Join the waitlist</title>

    <style>
      :root {
        --bg: #0a0a0a;
        --bg-2: #111111;
        --line: rgba(255, 255, 255, 0.08);
        --line-strong: rgba(255, 255, 255, 0.18);
        --ink: #f4f4f5;
        --ink-2: #a1a1aa;
        --gold: #d4a93a;
        --gold-2: #f0c766;
        --gold-soft: rgba(212, 169, 58, 0.12);
        --gold-glow: rgba(212, 169, 58, 0.35);
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        background: var(--bg);
        color: var(--ink);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        min-height: 100vh;
        overflow-x: hidden;
      }

      body::before {
        content: '';
        position: fixed;
        inset: 0;
        background:
          radial-gradient(circle at 20% 0%, rgba(212, 169, 58, 0.10), transparent 45%),
          radial-gradient(circle at 80% 100%, rgba(212, 169, 58, 0.06), transparent 50%);
        pointer-events: none;
        z-index: 0;
      }

      .page {
        position: relative;
        z-index: 1;
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 24px 80px;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 32px;
        border-bottom: 1px solid var(--line);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-weight: 700;
        font-size: 28px;
        letter-spacing: 0.04em;
      }
      .brand .mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px; height: 38px;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--gold), var(--gold-2));
        color: #0a0a0a;
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-weight: 700;
        font-size: 22px;
        box-shadow: 0 6px 18px var(--gold-glow);
      }
      .brand .name { color: var(--ink); }

      .nav-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--ink-2);
      }
      .nav-status .dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.18);
      }

      main {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 64px;
        align-items: center;
        margin-top: 72px;
        flex: 1;
      }

      .hero .eyebrow {
        display: inline-block;
        padding: 6px 14px;
        border-radius: 999px;
        background: var(--gold-soft);
        color: var(--gold-2);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 24px;
      }
      .hero h1 {
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-weight: 600;
        font-size: clamp(40px, 6vw, 76px);
        line-height: 1.04;
        letter-spacing: -0.01em;
        margin: 0 0 24px;
        color: var(--ink);
      }
      .hero h1 .accent {
        color: var(--gold);
        font-style: italic;
      }
      .hero .lede {
        font-size: 19px;
        line-height: 1.55;
        color: var(--ink-2);
        max-width: 520px;
        margin: 0 0 36px;
      }
      .hero .bullets {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .hero .bullets li {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        color: var(--ink-2);
        font-size: 15px;
        line-height: 1.5;
      }
      .hero .bullets li::before {
        content: '';
        flex-shrink: 0;
        margin-top: 7px;
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--gold);
        box-shadow: 0 0 12px var(--gold-glow);
      }

      .card {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
        border: 1px solid var(--line-strong);
        border-radius: 24px;
        padding: 40px;
        backdrop-filter: blur(8px);
        box-shadow:
          0 24px 60px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
      .card h2 {
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-weight: 600;
        font-size: 32px;
        margin: 0 0 8px;
        line-height: 1.15;
      }
      .card .sub {
        color: var(--ink-2);
        font-size: 15px;
        margin: 0 0 28px;
      }

      form { display: flex; flex-direction: column; gap: 16px; }
      label.field-label {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--ink-2);
        margin-bottom: -8px;
      }
      .input {
        width: 100%;
        padding: 16px 18px;
        background: var(--bg-2);
        color: var(--ink);
        border: 1px solid var(--line-strong);
        border-radius: 14px;
        font: inherit;
        font-size: 16px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
      }
      .input::placeholder { color: rgba(244, 244, 245, 0.35); }
      .input:focus {
        border-color: var(--gold);
        background: #131313;
        box-shadow: 0 0 0 4px var(--gold-soft);
      }
      .input[disabled] { opacity: 0.55; cursor: not-allowed; }

      .submit {
        margin-top: 8px;
        padding: 16px 20px;
        border-radius: 14px;
        border: 0;
        cursor: pointer;
        font: inherit;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: #0a0a0a;
        background: linear-gradient(135deg, var(--gold), var(--gold-2));
        box-shadow:
          0 10px 28px rgba(212, 169, 58, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
        transition: transform 0.1s ease, box-shadow 0.15s ease, opacity 0.15s ease;
      }
      .submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow:
          0 14px 32px rgba(212, 169, 58, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
      }
      .submit:active:not(:disabled) { transform: translateY(0); }
      .submit:disabled { opacity: 0.55; cursor: wait; }

      .msg {
        min-height: 22px;
        margin-top: 14px;
        font-size: 14px;
        text-align: center;
        line-height: 1.4;
      }
      .msg.ok { color: #6ee7a3; }
      .msg.err { color: #fca5a5; }

      .fineprint {
        margin-top: 18px;
        color: rgba(244, 244, 245, 0.45);
        font-size: 12px;
        line-height: 1.5;
        text-align: center;
      }

      footer {
        margin-top: 80px;
        padding-top: 28px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        color: var(--ink-2);
        font-size: 13px;
      }
      footer a { color: var(--ink-2); text-decoration: none; }
      footer a:hover { color: var(--ink); }

      @media (max-width: 880px) {
        main {
          grid-template-columns: 1fr;
          gap: 40px;
          margin-top: 48px;
        }
        .hero h1 { font-size: 44px; }
        .hero .lede { font-size: 17px; }
        .card { padding: 28px; }
        .card h2 { font-size: 26px; }
        .nav-status { display: none; }
      }
      @media (max-width: 480px) {
        .page { padding: 24px 18px 60px; }
        .hero h1 { font-size: 38px; }
        .card { padding: 24px; border-radius: 18px; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <div class="brand">
          <span class="mark">S</span>
          <span class="name">SIMP</span>
        </div>
        <div class="nav-status" aria-live="polite">
          <span class="dot" aria-hidden="true"></span>
          <span>Prelaunch · Open soon</span>
        </div>
      </header>

      <main>
        <section class="hero">
          <span class="eyebrow">Be first in line</span>
          <h1>Real connections <br />for <span class="accent">intentional</span> people.</h1>
          <p class="lede">
            SIMP is a private community for people who show up on purpose.
            Curated profiles, verified members, and conversations worth having.
            Join the waitlist to lock in your spot before we open the doors.
          </p>
          <ul class="bullets">
            <li>Hand-vetted profiles — every member is reviewed.</li>
            <li>Built-in video, voice, and live experiences from day one.</li>
            <li>No bots, no spam, no endless swiping.</li>
          </ul>
        </section>

        <section class="card" aria-label="Join the waitlist">
          <h2>Join the waitlist</h2>
          <p class="sub">Drop your name and email — we'll let you know the moment your spot opens.</p>

          <form id="waitlist-form" novalidate>
            <label class="field-label" for="wl-name">Your name</label>
            <input
              id="wl-name"
              class="input"
              name="name"
              type="text"
              autocomplete="name"
              maxlength="80"
              required
              placeholder="e.g. Alex Rivera"
            />

            <label class="field-label" for="wl-email">Email address</label>
            <input
              id="wl-email"
              class="input"
              name="email"
              type="email"
              autocomplete="email"
              inputmode="email"
              maxlength="200"
              required
              placeholder="you@example.com"
            />

            <button id="wl-submit" class="submit" type="submit">Reserve my spot</button>
          </form>

          <div id="wl-msg" class="msg" role="status" aria-live="polite"></div>
          <p class="fineprint">By joining you agree to receive launch updates from SIMP. Unsubscribe anytime.</p>
        </section>
      </main>

      <footer>
        <span>&copy; 2026 SIMP. All rights reserved.</span>
        <span><a href="mailto:hello@mysimp.com">hello@mysimp.com</a></span>
      </footer>
    </div>

    <script>
      (function () {
        var form = document.getElementById('waitlist-form');
        var msg = document.getElementById('wl-msg');
        var submit = document.getElementById('wl-submit');
        var nameInput = document.getElementById('wl-name');
        var emailInput = document.getElementById('wl-email');

        function setMsg(text, kind) {
          msg.textContent = text;
          msg.className = 'msg' + (kind ? ' ' + kind : '');
        }

        function setBusy(busy) {
          submit.disabled = busy;
          nameInput.disabled = busy;
          emailInput.disabled = busy;
          submit.textContent = busy ? 'Reserving\u2026' : 'Reserve my spot';
        }

        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (submit.disabled) return;

          var name = nameInput.value.trim();
          var email = emailInput.value.trim();

          if (!name) { setMsg('Please enter your name.', 'err'); nameInput.focus(); return; }
          if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
            setMsg('Please enter a valid email address.', 'err');
            emailInput.focus();
            return;
          }

          setBusy(true);
          setMsg('');

          fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ name: name, email: email }),
          })
            .then(function (res) {
              return res.json().catch(function () { return {}; }).then(function (body) {
                return { ok: res.ok, body: body };
              });
            })
            .then(function (out) {
              if (out.ok && out.body && out.body.ok) {
                setMsg("You're on the list. Check your inbox for confirmation.", 'ok');
                form.reset();
              } else {
                setMsg((out.body && out.body.error) || 'Something went wrong. Please try again.', 'err');
              }
            })
            .catch(function () {
              setMsg('Network error. Please try again.', 'err');
            })
            .then(function () {
              setBusy(false);
            });
        });
      })();
    </script>
  </body>
</html>`;