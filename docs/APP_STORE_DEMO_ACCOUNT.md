# App Store Demo Account — Workflow

The App Store review account is `review@sim-p.app` / `AppleReview2026!`. This is a public, well-known credential — safe to share with Apple reviewers.

## How to seed the demo account

The backend has a one-shot endpoint at `POST /demo/seed` that creates the demo user, completes the profile, verifies the user (blue badge), and grants SIMP+ for one year. The endpoint is **disabled by default** — it returns 404 unless `ENABLE_DEMO_SEED=true` is set in the Render dashboard.

### Steps (operator / Bobby):

1. **Open Render dashboard** → `simp-backend` service → Environment.
2. **Add `ENABLE_DEMO_SEED=true`** (boolean or string — backend only checks for the literal string "true").
3. **Trigger a redeploy** of `simp-backend` (the env var only takes effect on a fresh deploy).
4. **Run the seed**:

   ```bash
   curl -X POST https://api.mysimp.app/demo/seed \
     -H 'Content-Type: application/json' \
     -d '{
       "email": "review@sim-p.app",
       "password": "AppleReview2026!",
       "displayName": "Apple Reviewer",
       "birthDate": "1995-01-15",
       "city": "New York, NY",
       "occupation": "Product designer",
       "heightCm": 170
     }'
   ```

   Response: `{"ok": true, "userId": "...", "email": "review@sim-p.app"}`
5. **Remove `ENABLE_DEMO_SEED=true`** from Render env vars (or set to "false").
6. **Trigger another redeploy** so the endpoint is locked back to 404.

After step 6, the demo account is live and the seed endpoint is closed. To re-seed later (e.g. to reset the demo profile), repeat steps 1-6.

### Why is the endpoint gated by env?

We never want this in production. The endpoint can create a verified account without going through Apple's ID-verification flow — only useful for Apple reviewers, only safe to leave open during a brief reseed.

### Demo account features

After seeding, the demo account has:

| Feature | State |
|---|---|
| `emailVerified` | true |
| `ageConfirmedAt` | set (31 years old) |
| `onboardingCompletedAt` | set |
| Profile | complete: bio, city, occupation, height, gender, lookingFor |
| Verification | blue badge (approved) |
| Photos | 2 placeholder brand-asset URLs (visible in profile) |
| Entitlement | SIMP+ active for 365 days, productId `app.simp.plus.monthly` |
| Push tokens | none (Apple reviewer can re-enroll on device) |

This is enough for an Apple reviewer to:
- Sign in immediately (no email verification required)
- See a complete profile with blue badge
- Exercise the SIMP+ paywall (entitlement is active)
- Send / receive messages, browse discovery, view live streams
- Open Settings → Account → Identity to see Sign in with Apple linked status (if they want to test that flow)

### What reviewers CAN'T do with the demo account

- See real matches — the demo user is the only fully-populated account
- Test payments — they have to use their own sandbox Apple ID to subscribe / cancel / restore
- Test push notifications — they need to enroll their own device token

That's by design. Reviewers are verifying the app works end-to-end, not that it has fake content.
