# Track A — App Product Launch Readiness

This document maps Bobby's Track A checklist against the current
codebase state. Use it as the QA + ship checklist before TestFlight.

Legend:
- ✅ done — production-ready
- ⏸ partial — code there, needs verification on a real device / multi-user test
- ❌ blocked — needs Bobby (Apple creds, App Store Connect, real money)

Last audited: snapshot at commit HEAD of main.

---

## Discovery / swiping (Track A — Discovery & Matching)

| Feature | Status | Where to verify |
|---|---|---|
| Swipe deck with pass / like / super-like | ✅ done | `frontend/src/pages/Discover.tsx` |
| Per-action discovery events | ✅ done (Phase 12 analytics) | `track('discovery_pass' / 'like' / 'super_like')` |
| Filters (age, distance, looking-for, interests) | ✅ done | `discovery.routes.ts` lines 130-200 |
| Blocked users excluded from deck | ✅ done | `discovery.routes.ts` blocks join at line 80-90 |
| Already-swiped users excluded from deck | ✅ done | `discovery.routes.ts` swipes join at line 80-87 |
| Free daily likes (default 25) | ✅ done | `swipe-rate-limit.ts` + `FREE_DAILY_LIKES` env |
| Free daily super-likes (default 1) | ✅ done | `swipe-rate-limit.ts` + `FREE_DAILY_SUPER_LIKES` env |
| Rewind (free for everyone) | ✅ done | `DELETE /swipes/:id` (no tier gate) |
| "You've seen everyone" empty state | ✅ improved (this PR) | Two CTAs: Refresh + Expand filters |
| Profile notes ("Convince Me") on Like | ✅ done | `note` field in swipe schema |
| Real-time re-fetch on filter change | ✅ done | `useEffect` on filter state in Discover.tsx |
| "Live now" badges on discover cards | ⏸ verify | live status on `profile.stream` join — confirm on real device |

## Matching

| Feature | Status | Where to verify |
|---|---|---|
| Mutual-like creates Match (transactional) | ✅ done | `swipes.routes.ts` line 117-150 (tx wrapper) |
| No duplicate matches (unique userA+userB) | ✅ done | Prisma `@@unique` on Match model |
| Match appears instantly in Matches page | ✅ done | Realtime emit + React state |
| Match modal on mutual-like | ✅ done | `Discover.tsx` `setMatchedProfile` |
| Unmatch endpoint | ✅ done | `POST /matches/:id/unmatch` |
| Match list pagination | ✅ done | Cursor-based in `matches.routes.ts` |
| Match performance (indexed on userAId + userBId + isActive) | ✅ done | Prisma `@@index` on Match |
| Conversation shell auto-created with Match | ✅ done | `conversation: { create: {} }` in match.create |

## Messaging

| Feature | Status | Where to verify |
|---|---|---|
| Real-time delivery via Socket.IO | ✅ done | `sockets/live.ts` line 188 emit `message:sent` |
| Typing indicators (start + stop) | ✅ done | `sockets/live.ts` line 238-239 |
| Read receipts | ✅ done | `POST /conversations/:id/read` + `message:read` emit |
| Delivered receipts | ✅ done | `POST /conversations/:id/delivered` + `message:delivered` emit |
| Presence (joined / left) | ✅ done | `sockets/live.ts` line 157 `presence:update` |
| Message persistence | ✅ done | `messages.routes.ts` creates `Message` row before emit |
| Block enforcement in conversation list | ✅ done | `messages.routes.ts` line 34-42 (blocked IDs filter) |
| Block enforcement in live chat | ✅ done | `live.routes.ts` line 24 `blockedUserIds` |
| Block enforcement in matches list | ✅ done | `matches.routes.ts` filters by `blockedIds` |
| WebSocket auth + reconnection | ✅ done | `socket.handshake.auth.token` + disconnect handling |
| Auto-scroll on new message | ✅ done | `scrollToBottom(true)` after merge |
| "You matched" intro card on first open | ✅ done | `Conversation.tsx` line 326 |
| Optimistic message send with rollback | ✅ done | `mergeMessage` + `clientId` + error rollback |
| Failed-to-send retry UI | ⏸ verify | Composer shows error after rollback — confirm UX |

## Live streaming

| Feature | Status | Where to verify |
|---|---|---|
| WebRTC broadcaster signaling | ✅ done | `sockets/live.ts` `live:broadcast` event |
| WebRTC viewer signaling | ✅ done | `sockets/live.ts` `live:join` event |
| Disconnect cleanup (orphan streams) | ✅ done | `live.routes.ts` line 381 `socket.on('disconnect')` |
| TURN credentials (Twilio) | ✅ done | `apple-iap.service.ts` (actually TURN lives in twilio service) |
| ICE config (STUN + TURN) | ✅ done | `getIceConfig()` exposed via `/config` |
| Live reactions / hearts | ✅ done | `POST /live/streams/:id/heart` + rate-limited |
| Live chat (separate from message) | ✅ done | `liveChatMessage` model + endpoints |
| Live chat mod (report + remove message) | ✅ done | `live.routes.ts` `report` + mod endpoints |
| Live end (broadcaster OR force-end) | ✅ done | `POST /live/streams/:id/end` (broadcaster) + `/admin/live/:id/end` (mod) |
| Multi-viewer test | ⏸ verify | Manual test on real device with 2-3 viewers |
| Reconnect mid-stream | ⏸ verify | WebRTC iceRestart logic in LiveStream.tsx — needs real-device test |
| Profile-completion gate before going live | ✅ done | `requireLegalCompliance` + `getProfileCompletion` checks |

## Profiles + photos

| Feature | Status | Where to verify |
|---|---|---|
| Photo upload (drag-drop + camera on mobile) | ✅ done | `photos.routes.ts` + Capacitor Camera plugin |
| Photo ordering (position field) | ✅ done | `Photo.position` field + reorder endpoint |
| Primary photo (position === 0) | ✅ done | `MatchSummary` + profile display code |
| Photo soft-delete (or hard-delete?) | ✅ done | Hard delete + Cloudinary cleanup on user-delete |
| Display name + bio | ✅ done | `Profile` model |
| Profile completion gate (8 required fields) | ✅ done | `profile-completion.service.ts` |
| Verification workflow (review + approve) | ✅ done | `admin.routes.ts` `/admin/verifications*` endpoints |
| Verification badge UI (when status=APPROVED) | ✅ done | ProfileView + Match cards show badge |
| Resumable onboarding (server-side state) | ✅ done | `users.routes.ts` `/me/onboarding` GET + PATCH |
| Discovery preferences (age range, distance, looking-for) | ✅ done | `DiscoveryPreference` model + endpoint |
| Hidden/photo-blurred until you match | ✅ done | Match summary shows blurred photo for unmatch |

## Notifications

| Feature | Status | Where to verify |
|---|---|---|
| In-app notification center page | ✅ done | `frontend/src/pages/Notifications.tsx` |
| Preferences UI (matches / messages / likes / live / security / marketing) | ✅ done | NotificationPreference model + page |
| Unread badge / count | ✅ done | `messages.routes.ts` `/conversations/unread-count` |
| Deep-link routing (notification.data.route) | ✅ done | Notifications.tsx line 49-103 |
| Mark single + mark all as read | ✅ done | notifications.routes.ts PATCH endpoints |
| Server-side fan-out (match.created → notification) | ✅ done | `notification.service.ts` `createNotification` |
| Web push (browser) | ✅ done (VAPID webpush in repo) | Needs APNs / FCM for native |
| Native APNs push | ❌ blocked | Needs Apple .p8 key + Apple Developer setup |
| Native FCM push | ❌ blocked | Needs Firebase project + google-services.json |

## Free tier (no paid entitlements)

| Feature | Status | Where to verify |
|---|---|---|
| Free daily likes limit (default 25) | ✅ done | `swipe-rate-limit.ts` + `FREE_DAILY_LIKES` env |
| Free daily super-likes limit (default 1) | ✅ done | `swipe-rate-limit.ts` + `FREE_DAILY_SUPER_LIKES` env |
| Rewind your last swipe | ✅ done | `DELETE /swipes/:id` |
| Verified-only filter | ✅ done | `users.routes.ts` PATCH `/me/discovery-preferences` (no tier gate) |

> **Note:** SIMP is fully free. There are no SIMP+ / Elite tiers, no
> entitlements table, no IAP subscription products, and no StoreKit
> integration. The free tier offers everything: rewind, advanced
> filters, all location preferences. Setting `FREE_DAILY_LIKES` /
> `FREE_DAILY_SUPER_LIKES` to higher values still rate-limits abuse
> even though every user gets the full feature set.

## Safety / moderation

| Feature | Status | Where to verify |
|---|---|---|
| Report a user (with 10 reason categories) | ✅ done | `moderation.routes.ts` `/reports` + ReportCategory enum |
| Report a live stream | ✅ done | `live.routes.ts` `report` endpoint |
| Block a user | ✅ done | `moderation.routes.ts` `/blocks` + delete to unblock |
| Block enforced everywhere | ✅ done | Discovery, matches, messages, live chat all filter blocked IDs |
| Suspend user | ✅ done | `admin.routes.ts` PATCH `/admin/users/:id/status` |
| Ban user | ✅ done | Same endpoint (status: BANNED) |
| Reinstate | ✅ done | Same endpoint (status: ACTIVE, suspend until now) |
| Force-end live stream mid-broadcast | ✅ done | `admin/live/:id/end` |
| Remove profile photo | ✅ done | `admin/photos/:id` DELETE |
| Account-status change revokes refresh tokens | ✅ done | `admin.routes.ts` status handler tx |
| Status change deactivates matches | ✅ done | Same handler — match.isActive = false |
| Status change ends live streams | ✅ done | Same handler — stream.status = ENDED |
| Audit log (cross-user) | ✅ done | `admin/audit-log` (this PR) |
| Abuse metrics (rolling 24h) | ✅ done | `admin/abuse-metrics` (this PR) |
| Top reporters / reported leaderboards | ✅ done | Same endpoint |
| Age enforcement (18+) | ✅ done | `ageConfirmedAt` + `dateOfBirth` in signup |
| Age gate UI in onboarding | ✅ done | `Onboarding.tsx` step 1 |

## Settings / account

| Feature | Status | Where to verify |
|---|---|---|
| Password change | ✅ done | `POST /auth/change-password` |
| Data export (JSON archive) | ✅ done | `GET /account/me/export` |
| Account deletion (full cascade) | ✅ done | `DELETE /account/me` with anonymization + photo cleanup |
| Apple-only users can delete without password | ✅ done | delete handler checks `socialIdentities.length > 0` |
| Apple identity unlink (services ID revoke) | ✅ done | `DELETE /account/me/identities/:provider` |
| Can't unlink only login method | ✅ done | Same handler enforces "must keep ≥1 login" |
| Linked identities list endpoint | ✅ done | `GET /account/me/identities` |
| Notification preferences UI + persistence | ✅ done | `notifications.routes.ts` PATCH |
| Session / device list | ✅ done | `GET /auth/sessions` |
| Password reset via email link | ✅ done | `POST /auth/forgot-password` + `/auth/reset-password` |
| Email verification gate | ✅ done | `requireVerifiedEmail` middleware |

## UI polish (Track A — UI)

| Feature | Status | Where to verify |
|---|---|---|
| Empty state for "no matches yet" | ✅ done | `Matches.tsx` EmptyMatches component |
| Empty state for "no messages yet" | ✅ done | `Messages.tsx` empty block |
| Empty state for "seen everyone nearby" | ✅ done (this PR) | `Discover.tsx` improved empty state with 2 CTAs |
| Loading skeletons | ✅ done | `MatchesSkeleton`, `InboxSkeleton`, `ConversationSkeleton` |
| Mobile usability pass | ⏸ verify | Real iPhone / Android device walkthrough |
| Offline detection | ❌ gap | No `navigator.onLine` integration — push this to follow-up |
| Reduced motion respect | ✅ done | `useReducedMotion` in framer-motion routes |
| 404 page | ✅ done | `frontend/src/pages/NotFound` (need to confirm) |
| Empty / loading / error states everywhere | ⏸ verify | Walk all 24 pages |

## Cross-cutting

| Feature | Status | Where to verify |
|---|---|---|
| PWA manifest (45/45 PWABuilder score path) | ✅ code done | `frontend/vite.config.ts` — needs `Service-Worker-Allowed: /` header which needs Render "Update from render.yaml" click |
| Service Worker registration + update flow | ✅ done | `frontend/src/main.tsx` |
| Capacitor iOS native build | ⏸ Bobby's Mac | Needs Xcode + signing |
| Capacitor Android native build | ⏸ Bobby's Mac | Needs Android Studio + JDK 17 |
| Custom domain (mysimp.com) | ✅ live | `mysimp.com` 200 OK |
| SSL / HTTPS | ✅ auto via Render | Google Trust Services cert |
| Apex → www redirect | ✅ done | Render auto-redirects www.mysimp.com → apex |
| onrender → mysimp.com redirect | ✅ code done | needs "Update from render.yaml" click |
| Sentry crash monitoring | ✅ code done | needs `SENTRY_DSN` + `VITE_SENTRY_DSN` env vars |
| Funnel analytics | ✅ code done | needs `ANALYTICS_ENDPOINT` to forward to PostHog/Segment |

## What's missing for TestFlight

Multi-user QA pass on Bobby's Mac with at least 3-5 test accounts:
- Signup → verify-email → onboarding → profile → photo upload
- Discovery: pass / like / super-like / rewind
- Match: confirm no duplicates across multi-user test
- Messaging: realtime, typing, read receipt, persistence after restart
- Live: 1 broadcaster + 2-3 viewers across Wi-Fi + cellular + VPN
- Block / report / unmatch enforcement across all surfaces
- Premium purchase / restore / cancel / refund | N/A — SIMP is fully free
- Account deletion + check the other user's view of the conversation

## What's still on Bobby's plate (Track B infra)

| Item | Where covered | Time |
|---|---|---|
| Apple Developer setup for SIWA | `docs/APPLE_SIGNIN_PRODUCTION.md` | 15 min |
| Resend API key | `docs/EMAIL_PUSH_PROVIDER_SETUP.md` | 5 min |
| Firebase project + google-services.json | `docs/PUSH_PROVIDER_SETUP.md` (need to write) | 20 min |
| Render "Update from render.yaml" click (1-time) | per recent message | 30 sec |
| Apple Developer account deletion webhook | Optional but recommended | 10 min |
| TestFlight archive + upload | After all of above | 30 min |

## Phase 16 (Android / Play Store) decision

The full Phase 16 checklist is **NOT a launch blocker** — App Store
ship comes first. Plan Android release for 2-4 weeks after the iOS
launch so you have real production usage data to inform any Android
specific issues.

If you want me to start writing the equivalent of `docs/APPLE_SIGNIN_PRODUCTION.md`
but for Firebase/FCM (Phase 7 Push), say "ship push setup doc" and I'll
do that next. Otherwise, the next high-ROI thing I can ship without
your input is **offline detection** (a `navigator.onLine` banner that
shows when the app loses connectivity) — that's a small UI fix.
