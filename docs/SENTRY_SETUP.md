# Sentry Setup — Crash + Error Monitoring

SIMP's backend (Node/Express) and frontend (PWA + Capacitor iOS/Android webviews)
both have Sentry wired with the **graceful-fallback pattern** the rest of the
paid integrations use: if `SENTRY_DSN` / `VITE_SENTRY_DSN` are unset, the
service runs normally without crash reporting. The `/health/ready` endpoint
exposes `integrations.sentry: true|false` so you can verify at a glance.

**Why Sentry is non-negotiable for App Store submission:** Apple's App
Review Guidelines §2.1 require apps to behave reasonably in failure
modes. Sentry (or equivalent) lets you find and fix crashes before
reviewers report them. It also unlocks the "Reply to App Review" flow
with concrete stack traces instead of hand-waving.

**Why we want it for Play Store too:** Google Play Console's
Android Vitals crash reporting only surfaces aggregate crash counts.
Sentry gives per-device, per-session, per-stack-trace context.

---

## 1. Create the Sentry project

1. Sign up at https://sentry.io/signup/ (Google SSO works — `bobbycraig1293@gmail.com`
   is on Bobby's other Bobbywealth apps; if you want a dedicated workspace, use a
   fresh email like `alerts@mysimp.com` once that's wired)
2. Create a new project:
   - **Platform**: "Node" → name it `simp-backend`
   - **Platform**: "React" or "Browser JavaScript" → name it `simp-frontend`
3. Sentry creates both with a default `production` alert + Slack/email integration
   (skip the Slack wiring until you have a workspace)

---

## 2. Grab the DSNs

Each project has its own DSN — looks like
`https://<public-key>@o<org-id>.ingest.sentry.io/<project-id>`.

- `simp-backend` DSN → goes to backend env var `SENTRY_DSN`
- `simp-frontend` DSN → goes to frontend env var `VITE_SENTRY_DSN`

You can also wire these through `SENTRY_AUTH_TOKEN` for release tracking,
but that's optional for v1.

---

## 3. Set the env vars on Render (Bobby)

Open the Render dashboard for each service, **Environment** tab, add:

| Service | Key | Value |
|---|---|---|
| `simp-backend` | `SENTRY_DSN` | (DSN from step 2) |
| `simp-web` | `VITE_SENTRY_DSN` | (frontend DSN from step 2) |

Both are already declared in `render.yaml` as `sync: false`, so a dashboard
add is the cleanest path. Either way, the code only activates Sentry once
the value is set — no restart timing concerns.

---

## 4. Verify it's wired

After the next deploy, hit:

```bash
curl -sS https://api.mysimp.com/health/ready | jq .integrations
```

Should include `"sentry": true`. Same for `https://mysimp.com/` (open
DevTools → Console → look for the `[sentry]` log line; if it says
"disabled", `VITE_SENTRY_DSN` isn't set).

For a real smoke test, hit a 500-returning endpoint or throw a test
exception:

```bash
# Force a 500 in production by hitting an endpoint with a payload
# that breaks a Zod schema — easiest path is to send malformed JSON:
curl -X POST https://api.mysimp.com/auth/login -H 'Content-Type: application/json' -d '{not json'
```

The 400 (validation_error) is expected and won't fire to Sentry. To
test 5xx capture, edit the smoke-test script to POST a deliberately
broken request OR temporarily uncomment a `throw new Error('test')` in
a route handler.

---

## 5. Source-map upload (release tracking)

For Sentry to show readable stack traces instead of minified JS, you
need to upload source maps. We have the `vite-plugin-pwa` build that
minifies — the cleanest path is `@sentry/vite-plugin` (already in
`frontend/package.json`). To enable:

```bash
# Once per repo (Bobby's machine):
export SENTRY_AUTH_TOKEN=...    # from Sentry Settings → API → Auth Tokens
export SENTRY_ORG=...
export SENTRY_PROJECT=simp-frontend
cd frontend && npm run build
# source maps upload automatically via the Vite plugin
```

The backend doesn't need source maps (Node runs TypeScript-transpiled
JS — the stack traces are already readable). Add the backend release
to Sentry manually via `Sentry.captureMessage` if you want
release-tracking breadcrumbs.

---

## 6. PII / privacy note

The `beforeSend` hook in both `services/sentry.service.ts` and
`lib/sentry.ts` already strips:
- `user.email`
- `user.username`
- `user.ip_address`
- URL query parameters (so auth tokens in reset/verify URLs aren't sent)

We send only the user **id** as a Sentry breadcrumb via `setSentryUser`,
which is opaque to Sentry without a backend join. If you ever add more
identifying context, prefer Sentry's `tags`/`extra` over `user.*`.

---

## 7. Cost note (per Bobby's cost-conscious pattern)

Sentry's free tier:
- 5,000 errors / month
- 10,000 performance transactions / month
- 50 session replays / month
- 7-day data retention

For SIMP's launch profile (~hundreds to low-thousands of DAU), the
free tier is plenty. If you cross 5K errors/mo, the Team plan is
$26/month — still under any paid infra tier, so easy to justify when
you hit it.

---

## Files touched by this integration

- `backend/src/services/sentry.service.ts` (new)
- `backend/src/app.ts` (sentry request + error handlers)
- `backend/src/server.ts` (init at startup, capture fatal errors)
- `backend/src/routes/health.routes.ts` (expose `integrations.sentry`)
- `backend/package.json` (+ `@sentry/node`, `@sentry/profiling-node`)
- `frontend/src/lib/sentry.ts` (new)
- `frontend/src/main.tsx` (init + ErrorBoundary wrap)
- `frontend/src/store/auth.ts` (setSentryUser on login/logout)
- `frontend/package.json` (+ `@sentry/react`, `@sentry/vite-plugin`)
- `frontend/src/vite-env.d.ts` (VITE_SENTRY_DSN already declared)
- `render.yaml` (SENTRY_DSN + VITE_SENTRY_DSN already declared as `sync: false`)
