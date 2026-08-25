# App Store Connect Metadata — SIMP

This is the source-of-truth for every text field in App Store Connect → SIMP → App Store tab. Cut and paste these verbatim into the form fields.

## Required App Information

### App name (≤ 30 chars)
```
SIMP
```

### Subtitle (≤ 30 chars)
```
Curated dating for intentional men
```

### Category

- **Primary**: Social
- **Secondary**: Lifestyle

### Content rights
- Contains third-party content: **No**
- Uses encryption: **Yes** (TLS only — exempt per iTunes Connect guidelines §2.3.1)

### Age rating
Use the answers in `APP_STORE_AGE_RATING_QUESTIONNAIRE.md`. Expected rating: **17+**.

## Description (≤ 4000 chars)

```
SIMP — Successful · Intentional · Male · Providers

Curated dating for men who show up with intent. SIMP is a private, vetted community where ambitious, emotionally-aware men meet ambitious, intentional women. No swipe-and-pray. No bots. No escort economy.

REAL PEOPLE, REAL CONNECTIONS
Every member is verified. Photos, age, and identity are checked before you ever see a profile. Blue-verified members have completed selfie + ID verification reviewed by humans — their photos are never used to train any model.

EXPERIENCES OVER EVERYTHING
SIMP is built around real-world meetups: dinner, travel, events, exclusive access. Browse upcoming experiences in your area, RSVP, and meet people who share your pace of life.

LIVE. CONNECT. BE SEEN.
Tune into live streams from verified members. Hear their voice, see their face, send a heart or a tip. Skip the awkward first text — start with presence.

YOUR EXPERIENCE, YOUR RULES
Granular privacy controls. Hide your distance, hide your age, go invisible. Verified-only filter. Block and report in one tap. Your data is yours — export or delete your account at any time.

SIMP+ AND SIMP ELITE
Free: 25 daily likes, 1 super-like per day, browse and match verified members.
SIMP+: Unlimited likes, see who liked you, 5 super-likes per day, message before matching.
SIMP Elite: Everything in SIMP+ plus priority placement, exclusive events, verified badge included, and a dedicated matchmaker.

SAFETY FIRST
SIMP Trust & Safety is on call 24/7. Every report is reviewed by a human moderator within 24 hours. Zero tolerance for payment-for-intimacy, scams, or minors. Tap the in-app Help button for the National Domestic Violence Hotline and other regional resources.

PRIVACY
We do not sell your data. We do not use advertising trackers. We use Apple ID, Apple Push Notifications, and Apple's App Store for everything that touches your identity, your device, and your wallet. See our full Privacy Policy in the app or at mysimp.app/privacy.

—-
SIMP is for adults 18+. Photo verification and human moderation are required for SIMP Elite. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period; manage in iOS Settings → Apple ID → Subscriptions. Payment will be charged to your Apple ID account. Terms: mysimp.app/terms. Privacy: mysimp.app/privacy.
```

## Promotional text (≤ 170 chars)

```
Real dating for real adults. Verified members, curated experiences, live streams, and a 24/7 Trust & Safety team.
```

## Keywords (≤ 100 chars, comma-separated, no spaces)

```
dating,verified,curated,meet,experience,livestream,intentional,serious,adult,respect
```

(Field has 100 chars. The above is exactly 99.)

## What's New / Release Notes (current version 0.3.0)

```
Welcome to SIMP.

SIMP is the curated dating app for ambitious, intentional adults. This is our first public release.

What's inside:
• Profile setup with full customization (bio, prompts, photos, interests)
• Verified-only filter so you only see members who completed identity verification
• Daily match suggestions based on your preferences
• Direct messaging with rich-media support
• Live streaming — host or watch, with hearts and tips
• SIMP+ and SIMP Elite subscriptions for unlimited likes, super-likes, and priority placement
• Block, report, and granular privacy controls in one tap
• Sign in with Apple and email/password
• 24/7 Trust & Safety team

We'd love your feedback. Tap Settings → Help & Support to get in touch.
```

## Support URL

```
https://mysimp.app/support/
```

## Marketing URL (optional)

```
https://mysimp.app/
```

## Privacy Policy URL

```
https://mysimp.app/privacy/
```

## Terms of Service URL (EULA / custom)

```
https://mysimp.app/terms/
```

(Note: the `/terms/` page needs to be written. See TODO list item — for now use the link below.)

```
https://mysimp.app/terms-of-service/
```

## App icon

- 1024×1024 PNG
- No transparency / no alpha channel
- Must be the same icon used across all device classes
- Apple applies the rounded-corner mask — do not pre-round
- Use `frontend/public/icons/icon-1024.png` (already in repo) — verify it meets App Store icon requirements before upload

## Screenshots (required per device class)

App Store Connect requires screenshots for:
- **6.7" iPhone 15 Pro Max** (1290×2796) — required
- **6.5" iPhone 11 Pro Max** (1242×2688) — required (older)
- **5.5" iPhone 8 Plus** (1242×2208) — required if supporting iOS 12+
- **iPad Pro 12.9"** (2048×2732) — required if universal iPad app; optional otherwise

Real screenshots must come from the running app, not mockups. See `docs/SCREENSHOTS_CAPTURE_GUIDE.md`.

## App Review information

- **Sign-in required**: Yes — provide demo account (see review notes)
- **Demo account username**: review@sim-p.app
- **Demo account password**: stored in App Store Connect → App Review → Notes only (do NOT commit)

## Versioning

- Initial release version: `0.3.0` (matches `frontend/package.json` and `backend/package.json`)
- Build number: increments with each TestFlight upload
- Marketing version: visible to users (e.g. "0.3.0 — first public release")
