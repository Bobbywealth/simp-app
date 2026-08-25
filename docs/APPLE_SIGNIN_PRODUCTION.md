# Sign in with Apple — Production Setup

SIMP's backend already has full Sign in with Apple (SIWA) verification
wired (`backend/src/services/apple-auth.service.ts`) plus the 3-flow
merge architecture (new user, returning user, link-to-existing). What
remains is **Apple Developer Portal configuration** + matching Render
environment variables. Once both are set, SIWA works end-to-end
across iOS, Android (via Web), and PWA.

This doc walks through the Apple side step-by-step. Time estimate:
**15 minutes** if your Apple Developer account is already verified.

---

## 1. Apple Developer Portal — App ID setup

1. Go to https://developer.apple.com/account/resources/identifiers
2. Click the blue **"+"** next to "Identifiers" to register a new App ID
3. Platform: **App IDs** → Continue
4. Type: **App** → Continue
5. Description: `SIMP — Superior · Intentional · Male · Providers`
6. Bundle ID: **Explicit** → `app.simp.client` (must match
   `ios.bundleIdentifier` in `frontend/capacitor.config.ts`)
7. Capabilities — check **Sign in with Apple** → Continue
8. Register

> If `app.simp.client` is already taken (you created it for the
> native build earlier), reuse that ID. Don't create a second App ID
> for the same bundle.

---

## 2. Apple Developer Portal — Services ID setup (for web + Android)

The App ID from step 1 is used for **iOS native** SIWA. For **web
(PWA)** and **Android Capacitor webview** SIWA, you need a separate
Services ID. This is what Bobby pastes into `APPLE_CLIENT_ID`.

1. Go back to https://developer.apple.com/account/resources/identifiers
2. Click **"+"** → Type: **Services IDs** → Continue
3. Description: `SIMP Web SIWA`
4. Identifier: `app.simp.client.web` (must be unique under your team,
   reverse-DNS, no underscores — Apple is strict about this)
5. Continue → Register
6. Click the new Services ID row to configure it
7. Check **Sign in with Apple** → Configure
8. Primary App ID: select `app.simp.client` (the one from step 1)
9. Web Domain configuration:
   - Domains and Subdomains: `mysimp.app` and `www.mysimp.app`
     (do NOT include `api.mysimp.app` — Apple doesn't allow
     backend domains here)
   - Return URLs:
     - `https://mysimp.app/auth/apple/callback`
     - `https://www.mysimp.app/auth/apple/callback`
10. Save → Continue → Save

**Copy the Services ID** — that's your `APPLE_CLIENT_ID` and
`VITE_APPLE_CLIENT_ID`. Looks like `app.simp.client.web`.

---

## 3. Generate an Apple ID Key for token verification (optional but recommended)

For high-volume production, Apple lets you download a **.p8 key** to
verify SIWA JWTs locally instead of fetching Apple's JWKS every time.
For SIMP's launch profile (~hundreds of DAU), the existing
`createRemoteJWKSet` is fine. Skip this step unless you start hitting
Apple's rate limits (~10K verifications/hour).

If you need it later:
1. https://developer.apple.com/account/resources/authkeys/list
2. Click **"+"** → name `SIMP SIWA Verification` → continue
3. Download the .p8 once — Apple only shows it once
4. The .p8 goes into `APPLE_SIWA_PRIVATE_KEY` (NOT the IAP key in
   step 1 of the IAP doc — those are separate keys for separate APIs)

---

## 4. Render environment variables

Open Render dashboard for each service, **Environment** tab, add:

| Service | Key | Value |
|---|---|---|
| `simp-backend` | `APPLE_CLIENT_ID` | `app.simp.client.web` (Services ID from step 2) |
| `simp-web` | `VITE_APPLE_CLIENT_ID` | (same value) |

Both are already declared in `render.yaml` as `sync: false`. Either
add via the dashboard (cleaner) or edit `render.yaml` and push.

---

## 5. Verify SIWA is wired correctly

After the next deploy:

```bash
# Backend: check that APPLE_CLIENT_ID is set
render env get simp-backend --key APPLE_CLIENT_ID

# Should print: app.simp.client.web
# If empty, the Apple button is hidden client-side (graceful fallback)
```

In the browser:
1. Open https://mysimp.app → tap "Continue with Apple"
2. Should open Apple's hosted auth sheet (lightbox with "Sign in" +
   Apple ID + Hide My Email checkbox)
3. After auth, redirects back to https://mysimp.app/auth/apple/callback
   with `id_token` + (on first auth only) `user` (name blob)
4. SIMP creates the account or signs you in

If Apple says "invalid_client" — the Services ID mismatch. Re-check
step 2's identifier matches `APPLE_CLIENT_ID` exactly.

If Apple says "invalid_request" — the redirect URI doesn't match.
Re-check step 9's return URLs exactly:
- `https://mysimp.app/auth/apple/callback`
- `https://www.mysimp.app/auth/apple/callback`

If the button is hidden entirely — `VITE_APPLE_CLIENT_ID` env var is
empty. Add it via dashboard.

---

## 6. Test scenarios (verify each before App Store submission)

The full test matrix from the Phase 8 spec — re-verify each pass:

| Scenario | Expected outcome |
|---|---|
| Brand-new Apple account | Creates SIMP account, sends verification email |
| Returning Apple account | Logs in, links to existing SocialIdentity |
| Hide My Email chosen | Stores `private-relay@privaterelay.appleid.com` on SocialIdentity, generates synthetic `apple-${subject.slice(0,12)}@mysimp.app` for canonical User.email |
| Returning user with verified email who taps Apple | Triggers merge-token flow — frontend collects merge-token via existing password re-auth, posts back as `linkToUserId` + `linkMergeToken` |
| Logout then Apple login again | Same behavior as #2 (re-authorization) |
| Delete Apple-linked account via in-app "Delete account" | Cascade deletes SocialIdentity + User rows |

For the Hide My Email synthetic email — verify by signing in and
checking `GET /auth/me`:
```json
{
  "id": "...",
  "email": "apple-AbCdEfGh1234@mysimp.app",
  "emailVerified": true
}
```

The synthetic email is **unique per Apple user** (12 chars of the
opaque `sub`) so two Apple users who both use Hide My Email don't
collide on `User.email`. The real private-relay email lives on
`SocialIdentity.email` and never reaches `User.email`.

---

## 7. Privacy + retention notes

- Apple's name blob (`firstName`/`lastName`) is delivered to SIMP
  **only on the first authorization**. After that, we keep the
  display name the user typed or the Apple-supplied one. Re-prompts
  return blank.
- We never store Apple's `email_verified` claim separately from
  our own — we re-verify on every login.
- Apple allows the user to revoke SIMP's access at any time from
  https://appleid.apple.com/account/manage. SIMP receives the
  `account_delete` notification via Apple Server Notifications if
  you've wired that webhook (separate setup, optional but
  recommended for compliance).

---

## Files that participate

### Backend
- `backend/src/services/apple-auth.service.ts` — JWT verification via jose
- `backend/src/routes/auth.routes.ts` — `/auth/apple` + `/auth/apple/merge-token`
- `backend/src/services/auth.service.ts` — `appleSignIn` 3-flow merge

### Frontend
- `frontend/src/components/AppleSignInButton.tsx` — visible only when `VITE_APPLE_CLIENT_ID` is set
- `frontend/src/api/auth.ts` — `appleSignIn` call
- `frontend/src/pages/Login.tsx` + `Signup.tsx` — render the button

### Env vars
- `render.yaml` — `APPLE_CLIENT_ID` (backend, `sync: false`) + `VITE_APPLE_CLIENT_ID` (web, `sync: false`)
