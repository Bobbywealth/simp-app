# Apple IAP (In-App Purchase) — Production Setup

SIMP's backend has full Apple App Store Server API integration wired
(`backend/src/services/billing.service.ts` + `apple-iap.service.ts`):
ES256 JWT bearer minting, App Store Server Notifications V2 webhook
handling, transaction refresh, restore purchases. **All that's
missing is App Store Connect product setup + matching Render env
vars.** This doc walks through it.

Time estimate: **30 minutes** if Apple Developer + App Store Connect
accounts are verified.

---

## 1. App Store Connect — app record

1. https://appstoreconnect.apple.com → My Apps → **"+"** → **New App**
2. Platforms: iOS
3. Name: **SIMP** (or whatever you want; the user-visible App Store name)
4. Primary language: English (U.S.)
5. Bundle ID: **Select from dropdown → `app.simp.client`** (the App ID
   you created in APPLE_SIGNIN_PRODUCTION.md step 1)
6. SKU: `simp-001` (any unique string)
7. User access: Full Access
8. Create

You won't be able to submit until you've uploaded a build via Xcode
(Phase 13-14), but you CAN create the in-app purchases now while
the app record exists.

---

## 2. Create the subscription group

In App Store Connect → your app → **Subscriptions** →

1. Click **Create Subscription Group**
2. Reference name: `SIMP Premium`
3. Create

Inside the group, create two auto-renewable subscriptions:

### 2a. SIMP+ monthly

| Field | Value |
|---|---|
| Reference name | `SIMP+ Monthly` |
| Product ID | `app.simp.plus.monthly` |
| Subscription Duration | 1 Month |
| Subscription Price | (your choice — recommended $9.99) |
| Free Trial | Optional (e.g. 3 days) |
| App Store Localization (display name) | `SIMP+ Monthly` |
| App Store Localization (description) | `Unlimited swipes, see who liked you, 1 super like per day` |
| Review screenshot | (upload — required for review) |

### 2b. SIMP+ yearly

| Field | Value |
|---|---|
| Reference name | `SIMP+ Yearly` |
| Product ID | `app.simp.plus.yearly` |
| Subscription Duration | 1 Year |
| Subscription Price | (your choice — recommended $59.99, ~50% off monthly) |
| App Store Localization | Similar to monthly, emphasize savings |

### 2c. SIMP Elite monthly

| Field | Value |
|---|---|
| Reference name | `SIMP Elite Monthly` |
| Product ID | `app.simp.elite.monthly` |
| Subscription Duration | 1 Month |
| Subscription Price | (your choice — recommended $19.99) |
| Description | `Everything in SIMP+, plus priority matching, profile boost, unlimited super likes` |

### 2d. SIMP Elite yearly

Same structure as 2c with `Product ID: app.simp.elite.yearly`,
`Duration: 1 Year`, recommended $119.99.

---

## 3. Generate the App Store Connect API key

The backend calls the App Store Server API to verify transactions
+ receive Server Notifications V2. Both require a .p8 key.

1. App Store Connect → **Users and Access** → **Integrations** → **In-App Purchase** tab
2. Click **"+"** → Generate API Key
3. Name: `SIMP IAP Verification`
4. Access: **App Manager** (sufficient for App Store Server API + Server Notifications)
5. Generate
6. **Download the .p8** (one-time — Apple only shows it once)
7. Note the **Issuer ID** (top of the page, looks like `57246542-96fe-1a63-e053-0824d011072a`)
8. Note the **Key ID** (looks like `2X9R4HXF62`)

**Three values to keep safe:**
- `.p8 file contents` (a long PEM-formatted string)
- Issuer ID (UUID)
- Key ID (10-char alphanumeric)

---

## 4. Render environment variables

Open Render dashboard for each service, **Environment** tab, add:

| Service | Key | Value |
|---|---|---|
| `simp-backend` | `APPLE_IAP_ISSUER_ID` | The Issuer ID UUID from step 7 |
| `simp-backend` | `APPLE_IAP_KEY_ID` | The Key ID (10-char) from step 8 |
| `simp-backend` | `APPLE_IAP_PRIVATE_KEY` | The full .p8 file contents, **with `\n` escape sequences** in the BEGIN/END lines |

### Pasting the .p8 key correctly

Apple's .p8 file looks like:
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
... 50+ more lines ...
-----END PRIVATE KEY-----
```

For Render, paste the entire content with `\n` escaped:
```
-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n...rest of key...\n-----END PRIVATE KEY-----\n
```

The backend's `verifyAppleTransaction` already handles this:
```ts
const privateKey = env.APPLE_IAP_PRIVATE_KEY.replace(/\\n/g, '\n');
```

If pasting via dashboard, paste the literal newlines (Render's
secret editor should preserve them). If editing render.yaml, use
literal newlines (which the YAML parser will preserve as `\n` in
the env value). Test by hitting `/health/ready` after deploy and
checking `integrations.billingApple: true`.

---

## 5. Configure App Store Server Notifications V2

In App Store Connect → your app → **General** → **App Information**:

1. Scroll to **App Store Server Notifications** section
2. URL: `https://api.mysimp.com/billing/apple/notifications`
3. Click **Save**

The backend already has `POST /billing/apple/notifications` wired
in `backend/src/routes/billing.routes.ts`. It accepts Apple's V2
signed payload format (`{ signedPayload: "eyJraWQ..." }`).

### How the verification flow works

Apple POSTs a signed JWS containing `notificationType` +
`data.signedTransactionInfo`. The backend:

1. Reads `signedPayload` from the request body (or raw body if
   `Content-Type: application/jwt`)
2. Verifies Apple's signature using the cert chain fetched from
   Apple's JWKS (same as the SIWA verifier in
   `apple-auth.service.ts`)
3. Decodes the payload to get `notificationType` (one of
   `INITIAL_BUY`, `DID_RENEW`, `DID_FAIL_TO_RENEW`, `DID_CANCEL`,
   `EXPIRED`, `REFUND`, etc.)
4. Calls the appropriate handler:
   - `INITIAL_BUY` / `DID_RENEW` → `verifyAppleTransaction` →
     upsert `Entitlement` row → mark profile `isPremium: true`
   - `DID_FAIL_TO_RENEW` → mark `status: GRACE_PERIOD`, profile
     stays premium until `expiresAt` passes
   - `DID_CANCEL` / `EXPIRED` → mark `status: EXPIRED`, profile
     `isPremium: false`
   - `REFUND` → mark `status: REVOKED`, profile `isPremium: false`

### Idempotency

Apple retries webhooks until they get a 2xx response. The backend
**responds 202 for permanently-bad payloads** so Apple doesn't
infinite-retry on malformed data. For valid payloads that succeed,
it returns 200. For DB errors (transient), it returns 500 and Apple
retries. Re-deliveries of the same `notificationUUID` are deduped
by Prisma's `transactionId` unique constraint on `Entitlement` —
duplicate upserts are no-ops.

---

## 6. Verify IAP is wired correctly

After deploy:

```bash
# Check that IAP env vars are loaded
curl -sS https://api.mysimp.com/health/ready | jq .integrations.billingApple
# Expect: true

# If false:
# - Check that all 3 env vars are set (APPLE_IAP_ISSUER_ID,
#   APPLE_IAP_KEY_ID, APPLE_IAP_PRIVATE_KEY)
# - Check that the .p8 key is correctly pasted (no extra quotes,
#   literal newlines OR escaped \n)
curl -sS https://api.mysimp.com/billing/products | jq .
# Expect: [{ "productId": "app.simp.plus.monthly", "tier": "SIMP_PLUS", ... }, ...]
```

---

## 7. Test scenarios (the full Phase 9 matrix)

You need a **real iPhone with a sandbox Apple ID** for these. Apple
provides TestFlight internal testers for pre-production testing
(see Phase 14).

| Scenario | Expected outcome |
|---|---|
| Buy SIMP+ monthly | `Entitlement` row created with `status: ACTIVE`, profile `isPremium: true`, transactionId stored |
| Buy SIMP Elite | Same, tier `SIMP_ELITE` |
| Restore purchases | All active Apple entitlements re-claimed, response includes list |
| Upgrade SIMP+ → Elite | Old entitlement cancelled, new entitlement created, Apple server notification fires `DID_CHANGE_RENEWAL_PREFERENCE` |
| Downgrade Elite → SIMP+ | Same flow in reverse |
| Cancel (Settings → Subscriptions) | `DID_CANCEL` fires, status becomes `EXPIRED` at period end |
| Renew (auto-renewal succeeds) | `DID_RENEW` fires, `expiresAt` extended, profile stays premium |
| Renew fails (card declined) | `DID_FAIL_TO_RENEW` fires, status `GRACE_PERIOD`, profile stays premium for Apple's grace window (typically 16 days) |
| Refund (via App Store support) | `REFUND` fires, status `REVOKED`, profile `isPremium: false`, analytics `purchase_failed` (counterintuitive but consistent — Apple tracks refunds) |
| Expired after cancel + period end | `EXPIRED` fires, status `EXPIRED`, profile `isPremium: false` |

---

## 8. Privacy / refund UX

When Apple refunds a purchase via App Store support, the user sees
no UI change in SIMP — we just silently flip `isPremium: false`. Per
Apple's App Review Guidelines, this is acceptable as long as the
subscription terms disclose the refund policy. Your EULA and the
in-app Subscription disclosures should mention:
- Subscriptions auto-renew unless cancelled 24h before period end
- Manage subscriptions in iOS Settings → Apple ID → Subscriptions
- Refund requests go through Apple Support (https://support.apple.com/en-us/HT207594)
- SIMP cannot issue refunds directly because we never see payment info

The `billing.service.ts` handler logs refund events but does NOT
attempt to claw back SIMP+ features retroactively (e.g. matches made
during the premium period stay). This matches Apple's expected
behavior.

---

## 9. Files that participate

### Backend
- `backend/src/services/billing.service.ts` — JWT bearer minting, transaction upsert
- `backend/src/services/apple-iap.service.ts` — App Store Server API + restore + refresh
- `backend/src/routes/billing.routes.ts` — `/billing/apple/verify`,
  `/billing/apple/refresh`, `/billing/apple/restore`, `/billing/apple/notifications`

### Frontend
- `frontend/src/lib/storekit.ts` — Capacitor StoreKit bridge + web fallback
- `frontend/src/pages/Premium.tsx` — `purchaseSubscription` + `restorePurchases`

### Env vars
- `render.yaml` — `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_ID`, `APPLE_IAP_PRIVATE_KEY` (all `sync: false`)
- `render.yaml` — `SIMP_PLUS_PRODUCT_IDS=app.simp.plus.monthly,app.simp.plus.yearly` and `SIMP_ELITE_PRODUCT_IDS=app.simp.elite.monthly,app.simp.elite.yearly`

### External services (Bobby's)
- App Store Connect — App record + subscription group + 4 products
- Apple Developer Portal — App ID + Services ID + .p8 key
- Render — 3 env vars on `simp-backend`
