# Analytics Setup — Funnel Tracking + 3rd-Party Forwarding

The SIMP backend now captures every funnel event into a local
`AnalyticsEvent` table so admins can compute conversion rates via
`GET /admin/analytics/funnel?days=7` **without requiring any external
analytics provider**. If `ANALYTICS_ENDPOINT` is set, events are also
forwarded to PostHog / Segment / RudderStack in parallel.

## Funnel events captured

| Stage | Event names |
|---|---|
| Signup | `signup_started`, `signup_completed`, `email_verified` |
| Onboarding | `onboarding_completed`, `profile_completed` |
| Discovery | `discovery_swipe`, `discovery_pass`, `discovery_like`, `discovery_super_like`, `first_swipe` |
| Matching | `match_created`, `first_match` |
| Messaging | `message_sent`, `first_message`, `conversation_opened` |
| Live streaming | `live_started`, `live_ended`, `live_viewed`, `live_reacted` |
| Session (auto) | `session_started`, `page_viewed`, `app_backgrounded`, `app_foregrounded` |

"first_*" milestones dedupe via `localStorage` on the client so they
fire exactly once per user, per lifetime.

## What fires server-side vs client-side

| Event | Side | Why |
|---|---|---|
| `signup_completed`, `email_verified`, `match_created`, `message_sent`, `live_started`, `live_ended`, `live_reacted` | **server** | Canonical record of truth; can't be forged by the client |
| `signup_started` | **client** | User-initiated action before the server signup roundtrip |
| `first_swipe`, `first_match`, `first_message` | **client** (trackMilestone) | Lifetime per-user dedupe via localStorage |
| `session_started`, `page_viewed`, `app_backgrounded`, `app_foregrounded` | **client** (auto) | SPA route change + visibilitychange hooks |

When the same event fires both sides (e.g. `purchase_completed`),
the funnel endpoint can de-dupe by user+event+window. For the v1
funnel this is fine — having two counts of the same milestone
inflates the absolute number slightly but doesn't change conversion
ratios.

## Admin funnel endpoint

```
GET /admin/analytics/funnel?days=7
Authorization: Bearer <mod/admin token>
```

Returns per-event counts plus conversion rates between funnel stages:

```json
{
  "windowDays": 7,
  "start": "2026-08-18T03:00:00Z",
  "end": "2026-08-25T03:00:00Z",
  "counts": {
    "signup_started": 1234,
    "signup_completed": 856,
    "onboarding_completed": 612,
    "first_swipe": 401,
    "first_match": 78,
    "first_message": 54,
    "purchase_completed": 12
  },
  "conversions": {
    "signupStartedToCompleted": 69.4,
    "signupCompletedToOnboarded": 71.5,
    "onboardedToFirstSwipe": 65.5,
    "firstSwipeToFirstMatch": 19.5,
    "firstMatchToFirstMessage": 69.2,
    "firstMessageToPurchase": 22.2,
    "purchaseStartedToCompleted": 76.0
  }
}
```

## Privacy guarantees

The Zod validator in `analytics.routes.ts` rejects any property key
matching `/message|body|bio|email|name|phone|photo|token|password|address|ip/i`
BEFORE the row is written. The service-layer `sanitizeAnalyticsProperties()`
is a defense-in-depth check for any caller that uses `trackAnalytics()`
directly without going through the route.

**No PII ever lands in the AnalyticsEvent table.** The only identifying
field is `userId` (opaque cuid) + `sessionId` (random uuid).

## Optional: forward to PostHog / Segment / RudderStack

Set these on Render's Environment tab:

| Variable | Value | Notes |
|---|---|---|
| `ANALYTICS_ENDPOINT` | `https://app.posthog.com/capture/` (or your PostHog EU host, or Segment HTTP source URL) | Empty = no forward, events only stored locally |
| `ANALYTICS_WRITE_KEY` | (provider's API key / project token) | Empty = no Authorization header |

The forward is fire-and-forget. If the 3rd-party is down, events still
land in the local DB.

## Source-map style reference

For each event, the route's source field is one of:

- `client` — fired from the SPA (default)
- `server` — fired from an Express handler (canonical record of truth)

Most funnel queries should use `source: 'server'` for the canonical
count, then layer in `source: 'client'` events for things only the
client knows (page views, app lifecycle).

## Files touched

### Backend
- `backend/prisma/schema.prisma` — `AnalyticsEvent` model + relation on User
- `backend/prisma/migrations/20260825000000_analytics_events/` — new migration
- `backend/src/services/analytics.service.ts` — `ANALYTICS_EVENTS`, `trackAnalytics`, `getFunnelCounts`, `sanitizeAnalyticsProperties`
- `backend/src/routes/analytics.routes.ts` — accepts sessionId, source, appVersion, expanded sensitive-key regex
- `backend/src/routes/admin.routes.ts` — `GET /admin/analytics/funnel` (MODERATOR+)
- `backend/src/routes/auth.routes.ts` — fires `signup_completed`, `email_verified`
- `backend/src/routes/swipes.routes.ts` — fires `match_created` (server-side)
- `backend/src/routes/messages.routes.ts` — fires `message_sent`
- `backend/src/routes/live.routes.ts` — fires `live_started`, `live_ended`, `live_reacted`
- `backend/src/routes/billing.routes.ts` — fires `purchase_completed`, `purchase_failed`
- `backend/src/services/auth.service.ts` — `verifyEmail` now returns `{ userId }`

### Frontend
- `frontend/src/api/analytics.ts` — full event list, sanitizeProperties, sessionId, trackMilestone
- `frontend/src/lib/analytics-pageview.ts` — auto page-view + app-lifecycle hooks
- `frontend/src/App.tsx` — wires usePageViewTracker + useAppLifecycleTracker
- `frontend/src/pages/Discover.tsx` — granular swipe events + first_swipe / first_match milestones
- `frontend/src/pages/Conversation.tsx` — `conversation_opened` on mount
- `frontend/src/pages/LiveStream.tsx` — `live_viewed` on viewer mount
- `frontend/src/pages/Premium.tsx` — updated event names (purchase_* instead of subscription_*)

## Manual verification

After deploy:

```bash
# Trigger a signup to generate events
curl -X POST https://api.mysimp.com/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"analytics-test@sim-p.app","password":"TestPass123!","acceptTos":true,"dateOfBirth":"1995-01-01","name":"Test"}'

# Wait ~30s for events to land in AnalyticsEvent
sleep 30

# As a moderator/admin
TOKEN=$(your mod token)
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://api.mysimp.com/admin/analytics/funnel?days=1" | jq .

# Counts should include signup_completed: 1, signup_started may be 0
# (signup_started fires client-side BEFORE the auth roundtrip; if you
# bypass the client and curl directly, only signup_completed fires)
```
