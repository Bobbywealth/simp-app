# SIMP — App Store Review Notes

Paste this into the **Review Notes** field in App Store Connect when
submitting. Keep it concise but cover every policy-sensitive feature
so the reviewer doesn't have to guess.

---

## Test account for review

- **Email:** `apple-review@simp-seed.demo`
- **Password:** `ReviewPass2026!`
- **Display name:** `Apple Reviewer`

This account is pre-seeded with a complete profile (photo, bio,
prompts, interests) and has access to every feature.

---

## Feature walkthrough

1. **Onboarding** — Tap "Get Started" → 4 swipe-through intro screens
   → sign up or log in. The test account above can log in directly.
2. **Live streaming** — Tap the "Live" tab → "Start streaming" →
   type a title → tap "Go Live". The legal gate appears on first use;
   after accepting, the broadcaster sees a camera preview and can
   broadcast. Other users see the stream in the LIVE NOW grid and can
   join, watch, chat, and send hearts.
3. **Reporting** — On any live stream, tap the 🚩 icon (top right of
   the chat panel) to report. Pick a reason and optionally add details.
   Submitted reports go to our moderation queue and the stream is
   immediately hidden from the reporter's view; 3+ reports within
   24h hide the stream from everyone.
4. **Discovery** — Tap "Discover" → swipe left/right on profiles.
   Like (right) and Super Like (up) actions are recorded server-side.
5. **Matches** — Tap "Matches" → tap a match to view details and
   chat history.
6. **Settings → Privacy & Data** — "Download my data" returns a JSON
   export of every piece of personal data we hold on the user.
   "Delete account" requires typing `DELETE` and the user's password
   to confirm; once submitted, the account and all associated data
   are hard-deleted within 30 seconds.
7. **Legal gate** — First live stream attempt requires explicit 18+
   confirmation and scroll-to-bottom acceptance of Terms of Service
   v1.0 and Privacy Policy v1.0. The acceptance is recorded with
   timestamp + IP for compliance.

---

## Why we use specific permissions

| Permission | Why |
| --- | --- |
| Camera | Live streaming requires the camera to capture video. |
| Microphone | Live streaming requires the microphone for audio. |
| Photo Library | Users pick profile photos from their library. |
| Location | Optional; used for distance-based matching. Never shared. |

---

## Data collection disclosures

We collect:
- **Email** for login + account recovery
- **Display name, photos, bio, prompts, interests** for profiles
- **Approximate location** for distance matching (optional)
- **Birth date** for 18+ age verification (required by law)
- **Live stream content** for safety moderation + ToS enforcement
- **Legal acceptance records** (ToS / Privacy version, timestamp, IP)
  for compliance audit

We do NOT:
- Sell data to third parties
- Track users across apps
- Use IDFA / advertising identifiers
- Share precise location
- Store payment info directly (StoreKit IAP handles billing)

---

## Third-party SDKs

| SDK | Purpose |
| --- | --- |
| Capacitor | Native app wrapper (iOS + Android) |
| Socket.IO | Real-time chat + WebRTC signaling for live streams |
| Framer Motion | UI animations |
| Tailwind CSS | Styling |
| React | UI framework |

No third-party tracking SDKs (no Facebook SDK, no Google Analytics,
no AdMob, etc.).

---

## Encryption declaration

**ITSAppUsesNonExemptEncryption = false.** We use only standard
HTTPS/TLS for network traffic — no custom ciphers, no proprietary
encryption schemes.

---

## Content moderation plan

1. **Proactive:** Auto-flag streams with 3+ reports within 24h; they
   disappear from the LIVE NOW feed immediately.
2. **Reactive:** Reports go to our moderation queue (admin dashboard,
   internal). We review within 24 hours.
3. **Appeals:** Users can appeal a moderation decision by emailing
   safety@mysimp.com.
4. **Repeat offenders:** Users with 3+ upheld reports are permanently
   banned.

---

## Questions?

Contact: review@mysimp.com
