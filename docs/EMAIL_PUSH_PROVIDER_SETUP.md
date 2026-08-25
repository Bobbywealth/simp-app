# Email + push provider setup

SIMP's backend already implements every email and push path you'll
need in production — the only reason the live `/health/ready` endpoint
reports `email: false` and `emailWebhook: false` is that no provider
credentials are set yet. This document is the walkthrough for the
two cheap/free providers we recommend and the env vars to wire them in.

> Cost-conscious defaults: Resend free tier (3,000 emails/month,
> 100/day) + Firebase Cloud Messaging Spark (free, unlimited push).
> Apple Developer Program fee ($99/year) is already paid for iOS
> distribution.

---

## 1. Email delivery — Resend

Why Resend over SendGrid / Postmark / SMTP:

- Generous free tier (3,000/month) covers a dating app's verification
  + reset traffic during launch.
- React-style API and SDK, no SMTP debugging.
- Built-in deliverability tooling (bounce/complaint webhooks) that
  maps 1:1 to the SIMP backend's webhook handler.
- DKIM/SPF/DMARC auto-configured once you verify a sending domain.

### 1a. Create the account (5 min)

1. Go to https://resend.com/signup
2. Sign up with the SIMP-owner email (recommend
   `bobby@wolfpaqmarketing.com` or whatever Bobby wants as the
   long-term owner).
3. Verify your email; Resend drops you into the dashboard.

### 1b. Add a sending domain (10 min)

> If you don't have `simp.app` yet, you can use the staging domain
> `simp.app.resend.app` for testing (Resend auto-issues one). When you
> buy a real domain, come back and add it; the migration is just an
> env-var swap.

1. In the Resend dashboard: **Domains → Add Domain**.
2. Enter `simp.app` (or your final domain).
3. Resend shows 3 DNS records you need to add at your registrar:
   - DKIM (TXT)
   - SPF (TXT)
   - Return-path / MAIL FROM (CNAME or MX depending on registrar)
4. Add them at GoDaddy / Cloudflare / wherever the domain lives.
5. Back in Resend, click **Verify**. Status flips from `Pending` to
   `Verified` within a few minutes (DNS propagation).
6. (Optional but recommended) **Domains → Domain → DKIM/DMARC**:
   also add a DMARC record (`v=DMARC1; p=none; rua=mailto:dmarc@simp.app`)
   so mailbox providers trust the domain.

### 1c. Generate an API key (1 min)

1. **API Keys → Create API Key**.
2. Name: `simp-backend-prod`
3. Permission: **Sending access** (full access not needed).
4. Copy the key (`re_xxxxxxxx...`). It is shown once — store it in
   your password manager immediately.
5. Save it under Apple Passwords / 1Password for `Resend (SIMP)`.

### 1d. Set Render env vars

Render dashboard → `simp-backend` → **Environment** → add or update:

| Key | Value |
|---|---|
| `EMAIL_PROVIDER` | `resend` |
| `EMAIL_FROM` | `SIMP <hello@simp.app>` |
| `RESEND_API_KEY` | `re_xxxxxxxx...` (from 1c) |
| `RESEND_WEBHOOK_SECRET` | _leave blank for now, set in 1e_ |

> **`EMAIL_FROM` must use a domain you've verified in 1b**, otherwise
> Resend returns `403 domain_not_allowed`. Use the format
> `Display Name <address@domain>` — both pieces are required by RFC 5322.

Trigger a redeploy after saving, or wait for the next push.

### 1e. Configure the bounce/complaint webhook (5 min)

Without this, `/health/ready` will keep reporting `emailWebhook: false`
and bounce tracking won't fire.

1. In Resend: **Webhooks → Add Webhook**.
2. **Endpoint URL**: `https://api.mysimp.com/webhooks/resend`
3. **Events to send**: tick at minimum `email.bounced`,
   `email.complained`, `email.delivered`. `email.opened` /
   `email.clicked` are optional analytics.
4. Click **Add**. Resend generates a signing secret
   (`whsec_xxxxxxxx...`) — copy it.
5. In Render env vars: set `RESEND_WEBHOOK_SECRET=whsec_xxxxxxxx...`.
6. Save. Backend redeploys automatically.

### 1f. Verify it's live (2 min)

After redeploy, hit these in a terminal or browser:

```bash
curl https://api.mysimp.com/health/ready
```

Expected: `"email": true, "emailWebhook": true`, and
`degradedFeatures` no longer contains the email warning.

Send a test verification email:

```bash
# 1. Sign up a test user (the API call you already know).
# 2. Watch Render logs — you'll see
#    `{"event":"resend_webhook_received","type":"email.delivered","recipient":"...","userId":"..."}`
#    within a few seconds of the send.
```

You can also send a real test via the Resend dashboard:
**Emails → Send Test Email** — enter a Gmail address you control
and check the inbox.

### 1g. Cost

| Tier | Price | Volume |
|---|---|---|
| Free | $0 | 3,000 emails/month, 100/day |
| Pro | $20/month | 50,000 emails/month |
| Scale | $90/month | 100,000 emails/month |

SIMP verification + password reset traffic during launch is well
under the free tier. Apple requires a transactional reset flow but
not bulk marketing email — for launch, free is enough.

---

## 2. Mobile push — Firebase Cloud Messaging

The backend already imports `firebase-admin` and handles the per-user
FCM send in `backend/src/services/push.service.ts`. The only piece
missing is the Firebase project + service-account credentials.

### 2a. Create a Firebase project (5 min)

1. https://console.firebase.google.com → **Add project**.
2. Name: `simp-prod` (or `simp-staging` for dev).
3. Disable Google Analytics unless you actively want it (defaults to
   on — costs nothing but adds a popup).
4. After creation, in the project dashboard: **Project settings →
   General → Your apps → Add app → iOS**.
5. Bundle ID: `app.simp.client` (matches `APPLE_BUNDLE_ID` in env).
6. Repeat: **Add app → Android**, package name `app.simp.client`.
7. **Project settings → Service accounts → Generate new private key**.
   This downloads a JSON file (`serviceAccountKey.json`) — store it
   in your password manager / secure notes, never commit it.

### 2b. APNs key (Apple — for iOS push delivery)

> Without this, FCM will accept iOS tokens but never actually push to
> devices. Android works without any further setup.

1. In the Firebase console: **Project settings → Cloud Messaging →
   Apple configuration → Upload**.
2. It will ask for an **APNs Authentication Key** (.p8 file). Generate
   one at https://developer.apple.com/account/resources/authkeys/list
   - Key name: `FCM APNs (SIMP)`
   - Enable: APNs
   - Register, then download the .p8 file. Note the **Key ID** and
     your **Team ID** (`47YG85NX53` — visible at the top of the page).
3. Back in Firebase, upload the .p8 and enter the Key ID + Team ID.
4. Optionally also upload the iOS push certificate (.p12) — Firebase
   supports either auth method, the .p8 key is the modern one.

### 2c. Set Render env vars

| Key | Value |
|---|---|
| `PUSH_PROVIDER` | `firebase` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | _contents of the JSON from 2a, OR its base64 encoding_ |

> The backend accepts both formats: a raw JSON string, or a base64-
> encoded JSON string. base64 is recommended for env-var sanity
> (newlines + quotes in raw JSON break some deploy workflows).

To base64-encode:

```bash
base64 -i serviceAccountKey.json | tr -d '\n' > serviceAccountKey.b64
# Copy the contents of serviceAccountKey.b64 into the env var.
```

Save → backend redeploys.

### 2d. Verify it's live (2 min)

```bash
curl https://api.mysimp.com/health/ready
```

Expected: `"push": true`, no `push:` warning in `degradedFeatures`.

To smoke-test from the iOS/Android app: register a push token via
the existing `/users/me/push-tokens` endpoint, then trigger any
notification (e.g. a match from a second test account). Check Render
logs for `firebase` event names — a `messaging/registration-token-not-registered`
warning means the token is stale and got marked `active=false`.

### 2e. Cost

Firebase Cloud Messaging is **free, unlimited**, no quotas at any
realistic dating-app volume. The only cost is whatever Firebase
charges for other products you may have enabled (Analytics, Crashlytics,
etc.) — none of which are required.

---

## 3. Web Push (VAPID) — already live, no action needed

`PUSH_PROVIDER=webpush` is the default in `render.yaml` and the live
service already shows `push: true` in `/health/ready`. VAPID keys
were generated and rotated into env vars on 2026-08-18.

If you ever want to reset them:

```bash
cd /Users/bobbyc/simp-app/backend
npm run generate:vapid
# Copy the printed keys into Render:
#   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

---

## 4. End-to-end check (one-time, after both providers are wired)

1. Sign up a new account on the deployed frontend.
2. Confirm:
   - Verification email arrives in Gmail within 30s.
   - Backend log shows `resend_webhook_received` for `email.delivered`.
3. Request a password reset.
4. Confirm:
   - Reset email arrives.
   - Tapping the link opens the reset-password screen on the frontend.
5. Sign up on the iOS app (when Bobby builds it locally), grant
   notification permission, like another test account.
6. Confirm:
   - Push notification arrives on the iOS device.
   - Backend log shows `firebase` provider delivering.
7. Send to a deliberately-bad address (`bounce@simulator.com` — a
   Resend test bounce address). Confirm:
   - Backend log shows `email_bounce_recorded`.
   - The user's `emailBounceAt` is set in the database.
   - `recipientBounced()` returns true on the next send attempt
     (visible as `verification_email_skipped_bounced` log line).
8. Send a real message to that bounced address. Confirm the send is
   skipped (no Resend API call) until the user updates their email.

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/health/ready` shows `email: false` | `RESEND_API_KEY` or `EMAIL_FROM` missing | Set both, redeploy |
| `emailWebhook: false` | `RESEND_WEBHOOK_SECRET` missing | Set per 1e |
| Resend returns `403 domain_not_allowed` | `EMAIL_FROM` uses an unverified domain | Verify the domain in Resend per 1b |
| Verification email never arrives | Email queued but bounce fired | Check Render logs for `email_bounce_recorded` |
| iOS push silently dropped | APNs key not uploaded to Firebase | Per 2b |
| Android push works but iOS doesn't | Same — APNs auth needed | Per 2b |
| Push tokens marked `active=false` rapidly | App uninstall / token rotation | Normal — backend will keep stale tokens out of the way |
| `messaging/registration-token-not-registered` log spam | Stale tokens after reinstall | Already handled — token is set inactive, no further sends |

---

## 6. What's still not covered (for follow-up)

- **Apple Server Notifications V2 webhook** for IAP — separate from
  Resend, lives at `/billing/apple/notifications`. Documented in
  `docs/APP_STORE_IAP_SETUP.md`.
- **Email digest / re-engagement campaigns** — not in the current
  templates. Would require a new `notification_digest_email.ts`
  template + a scheduled job. Defer until after App Store launch.
- **Resend audience / contact management** — for marketing email;
  Resend also has a free Audience product. Not currently wired.
- **Per-region email providers** — Resend is US-based but routes
  globally. If a future Bobby project needs EU-only delivery, add
  a second provider and pick by recipient country.

---

**Owner:** Bobby (Apple Developer account holder, Resend account
holder, Firebase project owner). The backend treats these providers
as pluggable; rotating to a different email or push provider later
is an env-var swap + a small provider implementation, no schema
change.
