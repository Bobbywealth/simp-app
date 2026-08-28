# App Review Notes — SIMP

This is the text to paste into App Store Connect → SIMP → App Review → Notes when submitting for review. Apple reviewers read these before testing.

## Review notes (paste verbatim)

```
Hello App Review team,

Thank you for reviewing SIMP. Below is everything you need to verify the app end-to-end.

DEMO ACCOUNT (no signup required — please use this to skip onboarding)
Username: review@sim-p.app
Password: <stored in App Store Connect Notes field only — DO NOT commit>

This account is fully set up: profile complete, age-verified, 1 verified badge, several messages already in the inbox. Please use it instead of creating a new account so you can see the full app quickly.

APP OVERVIEW
SIMP is a dating, messaging, and live-streaming app for adults 18+. It is built as a PWA wrapped in a Capacitor native shell so we can ship the same product to iOS, Android, and web. The native shell uses WKWebView (no UIWebView), APNs for push notifications, and Apple's StoreKit for subscriptions. All network calls are TLS 1.2+.

AGE GATING
SIMP enforces 18+ at signup. We collect a date of birth AND a self-attested age confirmation timestamp. Users under 18 cannot proceed. Reviewers can verify by tapping any "Create account" path.

VERIFICATION
SIMP offers two-tier verification: photo-only (a moderator reviews profile photos for plausibility) and photo+ID (a moderator reviews a selfie against the user's profile photos). The ID image and selfie are permanently deleted after review and never stored.

SIGN IN WITH APPLE
We have implemented Sign in with Apple as required by guideline 4.8 (any app offering a third-party login must offer Sign in with Apple). Tap "Sign in with Apple" on the login or signup screen. The identity token is verified server-side against Apple's published JWKS (audience = our App ID).

ACCOUNT DELETION
Per guideline 5.1.1(v), users can delete their account from Settings → Privacy → Delete account. They must type "DELETE" to confirm. Deletion completes within 30 days. Hard-deletion is performed by the backend; backups rotate within 90 days. We retain anonymized moderation records (no PII) to prevent ban-evasion.

SUBSCRIPTIONS (SIMP+ and SIMP Elite)
We use Apple's StoreKit for all in-app purchases. The sandbox Apple ID can be used to test:
1. Settings → SIMP+ → Subscribe — sandbox shows the confirm sheet.
2. Settings → SIMP+ → Restore purchases — works against sandbox receipts.

REPORTING & BLOCKING
Every profile has a Report and Block action. Reports go to a human moderator queue and are reviewed within 24 hours. Block prevents the user from seeing your profile, messaging you, or appearing in your discovery.

PRIVACY POLICY & EULA
Privacy Policy: https://mysimp.com/privacy/
Support: https://mysimp.com/support/
Safety Center: https://mysimp.com/safety/

DATA COLLECTION
We do not sell user data. We do not use third-party tracking SDKs. We do not request IDFA (so App Tracking Transparency prompt is not shown). The only data linked to user identity is what App Store Connect's Privacy Nutrition Labels describe. Full inventory in docs/APP_STORE_PRIVACY_NUTRITION_LABELS.md.

LIVE STREAMING
SIMP supports live streaming via WebRTC. TURN relay uses Twilio's NTS service (Network Traversal Service). Cross-NAT connectivity is handled by TURN; same-network users use STUN. Reviewers can tap the Live tab to view public streams. Broadcasting requires SIMP+ or SIMP Elite.

NOTIFICATIONS
Push notifications use APNs. We request permission via a soft-prompt in onboarding. Reviewers should approve notifications to see push messages (or skip — the app works without them).

TESTING NOTES
- iOS minimum version: 16.0
- We test on iPhone 15 Pro Max and iPhone SE (3rd gen) simulators
- The Capacitor native shell is built from the same codebase as the PWA — no separate iOS-only features
- WebRTC live streaming is best on WiFi but works on cellular

QUESTIONS
If you need anything during review, contact Bobby at appstore@sim-p.app or via App Store Connect's resolution center. We typically reply within 4 hours during weekdays.

Thank you for your time and your review.
— Keenan, MySimp LLC
```

## Field-by-field checklist before submitting

- [ ] Demo account credentials are set in App Store Connect → App Review → Notes (replace the placeholder above)
- [ ] Sign-in required toggle is set to "Yes" and demo account is provided
- [ ] App Review contact info (`appstore@sim-p.app`) is configured
- [ ] Privacy Policy URL is reachable (`/privacy/`)
- [ ] Support URL is reachable (`/support/`)
- [ ] Marketing URL is reachable (optional)
- [ ] All required screenshots uploaded for each device class
- [ ] Age rating questionnaire completed
- [ ] App Privacy questionnaire completed
- [ ] Export compliance (encryption) answered
- [ ] Content rights answered
- [ ] Pricing and availability configured (all territories)
- [ ] First-time subscriber promo pricing set (optional but recommended)
- [ ] TestFlight beta testing info filled (if applicable)
- [ ] Internal testing notes filled (if applicable)

## Common review rejection reasons to pre-empt

| Reason | How we pre-empt |
|---|---|
| Guideline 4.8 — Sign in with Apple missing | Implemented and verified; demo account supports Apple login |
| Guideline 5.1.1(v) — Account deletion missing | Implemented in app + backend; demo confirms |
| Guideline 2.1 — App completeness | All flows functional; demo account has populated data |
| Guideline 4.0 — Spam/minimum functionality | SIMP is not a wrapper; has full dating, messaging, live, safety, billing |
| Guideline 1.4.3 — Dating app requires 17+ + reporting/blocking | Both implemented and verified |
| Guideline 5.1.1 — Privacy policy URL | https://mysimp.com/privacy/ |
| Guideline 2.3 — Accurate metadata | Names, screenshots, descriptions all real and accurate |
| Guideline 3.1 — IAP for digital content | All SIMP+ / Elite subscriptions go through StoreKit |
| Tracking / ATT | We don't track; ATT prompt not shown |
| App is just a web wrapper | Capacitor + WKWebView + APNs + StoreKit + native biometric login (capability) |

## Review SLA expectation

Apple's standard review SLA is 24-48 hours. If rejected, we have 90 days to address and resubmit. The most common fix is a screenshot or metadata update (24 hours).
