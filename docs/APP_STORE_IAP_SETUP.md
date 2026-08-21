# App Store IAP Setup — SIMP

This doc walks through everything you (the App Store Connect owner) need to wire up so that SIMP+ / SIMP Elite subscriptions actually bill users and unlock features.

## What the code does (already shipped)

The full StoreKit IAP integration is already live:

**Backend** (`backend/src/services/apple-iap.service.ts`):
- App Store Server API client with JWS bearer-token minting
- `verifyAppleTransaction` (existing) — verify a transaction by ID
- `refreshAppleEntitlementByOriginalTransaction` — re-validate against Apple
- `restoreApplePurchases` — bulk re-validate from cached originalTransactionIds
- `handleAppStoreServerNotification` — App Store Server Notifications V2 webhook handler (renewal, refund, cancel, etc.)
- `persistAppleTransaction` — shared persistence path that all entry points funnel through

**Backend routes** (`backend/src/routes/billing.routes.ts`):
- `POST /billing/apple/verify` — initial purchase verification (existing)
- `POST /billing/apple/refresh` — re-validate from App Store
- `POST /billing/apple/restore` — restore purchases from cached originalTransactionIds
- `POST /billing/apple/notifications` — Apple Server Notifications V2 webhook

**Frontend** (`frontend/src/lib/storekit.ts`, `pages/Premium.tsx`):
- Platform-agnostic purchase service (iOS native / Android native / web fallback)
- Premium page with SIMP+ + SIMP Elite tier cards, Restore Purchases, Refresh Status, Manage in App Store

## What you need to do (5 steps)

### Step 1: Create in-app purchase products in App Store Connect

1. Open App Store Connect → My Apps → SIMP → Subscriptions
2. Create a Subscription Group named "SIMP Membership"
3. Add two auto-renewable subscriptions inside that group:
   - **SIMP+ Monthly** — product ID `app.simp.plus.monthly` — tier `SIMP_PLUS` — price tier 2 ($9.99/mo)
   - **SIMP+ Yearly** — product ID `app.simp.plus.yearly` — tier `SIMP_PLUS` — price tier 14 ($99.99/yr)
   - **SIMP Elite Monthly** — product ID `app.simp.elite.monthly` — tier `SIMP_ELITE` — price tier 4 ($24.99/mo)
   - **SIMP Elite Yearly** — product ID `app.simp.elite.yearly` — tier `SIMP_ELITE` — price tier 17 ($199.99/yr)
4. Each product needs:
   - Reference name (what you see in App Store Connect)
   - Product ID (what the app uses — match exactly)
   - Subscription duration (1 month or 1 year)
   - Subscription prices (auto-renewable)
   - Localized display names + descriptions for each language
   - Receipt validation: enabled (Apple handles this server-side automatically; we re-verify with our .p8 key)

### Step 2: Generate App Store Connect API key

1. App Store Connect → Users → Keys → In-App Purchase
2. Click "Generate" under "In-App Purchase" keys (NOT "App Store Connect API")
3. Name: `SIMP Backend Receipt Validation`
4. Access: In-App Purchase
5. Download the `.p8` file — **you only get to download this once**. Save it securely.
6. Note the **Key ID** (10-character alphanumeric)
7. Note the **Issuer ID** (UUID, listed at the top of the Keys page)

### Step 3: Set Render env vars

In Render dashboard → `simp-backend` service → Environment:

| Key | Value |
|---|---|
| `APPLE_IAP_ISSUER_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `APPLE_IAP_KEY_ID` | `XXXXXXXXXX` (10 chars) |
| `APPLE_IAP_PRIVATE_KEY` | (full contents of the .p8 file, with newlines preserved as `\n`) |

**Important**: never edit `render.yaml` to set the private key — secrets must be set in the dashboard, not committed. The render.yaml already has these as `sync: false` placeholders.

To paste the .p8 contents, use the multi-line editor in Render:
```
-----BEGIN PRIVATE KEY-----
...base64-encoded content...
-----END PRIVATE KEY-----
```

Render accepts the literal newline characters.

### Step 4: Configure App Store Server Notifications V2

1. App Store Connect → My Apps → SIMP → Subscriptions → App Store Server Notifications
2. **Production Server URL**: `https://simp-backend-b8nz.onrender.com/billing/apple/notifications`
3. **Sandbox Server URL**: same URL (Apple routes both to the same endpoint; we auto-detect environment from the JWS payload)
4. **Version**: 2 (Notification V2)
5. Apple will start POSTing JWS-signed payloads to this endpoint whenever any of these events happen:
   - `INITIAL_BUY` — new subscription purchase
   - `DID_RENEW` — successful auto-renewal
   - `DID_FAIL_TO_CONSUME` — billing retry needed
   - `EXPIRED` — subscription lapsed
   - `GRACE_PERIOD_EXPIRED` — billing-retry grace period over
   - `REFUND` — user got a refund
   - `REFUND_DECLINED`, `REFUND_REVERSED` — refund lifecycle
   - `RENEWAL_EXTENDED`, `RENEWAL_EXTENSION` — promotional extensions
   - `DID_CHANGE_RENEWAL_STATUS` — auto-renew on/off
   - `DID_CHANGE_RENEWAL_PREFERENCES` — user changed tier
   - `OFFER_REDEEMED` — promotional offer used
   - `SUBSCRIBER_PAUSED` — Apple allows pausing for some groups
   - `UNCANCEL` — user un-paused
6. Our handler is **idempotent** — re-receiving the same notification is safe.

### Step 5: Set product IDs in Render

The product IDs above (`app.simp.plus.monthly`, etc.) need to be set as env vars so the backend knows which products are SIMP+ vs SIMP Elite:

| Key | Value |
|---|---|
| `SIMP_PLUS_PRODUCT_IDS` | `app.simp.plus.monthly,app.simp.plus.yearly` |
| `SIMP_ELITE_PRODUCT_IDS` | `app.simp.elite.monthly,app.simp.elite.yearly` |
| `VITE_BILLING_ENABLED` | `true` |

The first two are already in `render.yaml`. Toggle `VITE_BILLING_ENABLED` from `false` to `true` in the dashboard so the Premium page link is visible in the app.

## Local testing

### Sandbox Apple ID

1. App Store Connect → Users → Sandbox Testers → add your Apple ID
2. On the iOS simulator / device, sign out of your real Apple ID → Settings → App Store → sign in with the sandbox tester
3. SIMP Premium → tap Subscribe → confirm with the sandbox Apple ID
4. The backend should accept the sandbox receipt and grant the entitlement

### Test scenarios

| Scenario | Expected |
|---|---|
| Buy SIMP+ | `verifyAppleTransaction` returns entitlement with `tier=SIMP_PLUS`, `status=ACTIVE`, `autoRenewing=true`, `expiresAt` = 1 month from now |
| Auto-renewal | Apple fires `DID_RENEW` notification → `handleAppStoreServerNotification` extends `expiresAt` by 1 month |
| Cancel in App Store → Apple fires `DID_CHANGE_RENEWAL_STATUS` (subtype `AUTO_RENEW_DISABLED`) → on next refresh, `expiresAt` stays in the past, entitlement becomes `EXPIRED` |
| Refund → Apple fires `REFUND` → our handler marks entitlement `REVOKED`, user loses premium immediately |
| New device → tap "Restore purchases" → `restoreApplePurchases` re-validates each cached originalTransactionId |
| Reinstall / cleared cache | `restoreApplePurchases` returns 0 → app shows "open App Store subscription page" deep link |

## Cost summary

- **Apple Developer Program**: $99/year (required for any App Store submission)
- **App Store commission**: 30% on subscription revenue (15% for the App Store Small Business Program if eligible, i.e. < $1M/year revenue)
- **No additional SIMP-side cost** for receipt validation (App Store Server API is free; .p8 key is issued once)

## What the webhook needs from your network

Apple POSTs to `/billing/apple/notifications` from the IP ranges listed in their docs:
- [docs](https://developer.apple.com/documentation/appstoreservernotifications/enabling_app_store_server_notifications)

If Render is behind Cloudflare, make sure Cloudflare does not block POST requests without a User-Agent header (Apple's notifications include one, but some Cloudflare rules strip them).

## What if the .p8 key is rotated?

Apple lets you have up to 50 active keys at once. If you rotate, generate a new one, update Render env vars with the new Issuer ID + Key ID + Private Key, redeploy. Old keys can be revoked in App Store Connect → Keys once the new one is verified working.

## Troubleshooting

### "Apple billing not configured (503)"

Either `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, or `APPLE_IAP_PRIVATE_KEY` is missing. Check Render env vars.

### "Apple could not verify that purchase (HTTP 401)"

The .p8 file content is wrong, or the Key ID doesn't match the .p8 file. Re-download the .p8 and re-copy.

### "Apple could not verify that purchase (HTTP 404)"

Wrong transaction ID. The transaction was on a different Apple ID / sandbox, or it's been > 1 year since the transaction (Apple purges transactions older than that from the API).

### Server notifications 503

Apple is hitting the endpoint but our handler is failing. Check Render logs for `apple_billing_not_configured` — same fix as 503 above.

### "The transaction does not belong to the SIMP app"

The `APPLE_BUNDLE_ID` (default `app.simp.client`) doesn't match the actual bundle ID registered in App Store Connect. Update the env var to match.
