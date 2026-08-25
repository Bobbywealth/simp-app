# App Store Screenshots — Capture Guide

App Store Connect requires real screenshots from the running app, not mockups. Below is what to capture and how.

## Required screenshot sizes (iOS)

| Device class | Resolution | Required |
|---|---|---|
| 6.7" iPhone 15 Pro Max | 1290 × 2796 | yes |
| 6.5" iPhone 11 Pro Max | 1242 × 2688 | yes |
| 5.5" iPhone 8 Plus | 1242 × 2208 | if iOS 12+ supported |
| 12.9" iPad Pro | 2048 × 2732 | only if universal iPad |

For a phone-only app, the two iPhone sizes are mandatory.

## Recommended screenshot order (App Store gallery)

Apple lets you upload up to **10 screenshots** per device class. Order matters — first 3 are most visible in search results.

1. **Hero**: full-screen of the Discover deck, showing real profiles (use the seeded test profiles)
2. **Profile detail**: tapping into one of those profiles — shows the full profile + verification badge + prompt answers
3. **Live stream**: a live broadcast in progress (broadcast button visible, hearts flying up)
4. **Messages**: a conversation thread with a match
5. **Paywall**: SIMP+ upgrade sheet (the system StoreKit sheet, not a custom one)
6. **Safety center**: the in-app safety resource page (or /safety/ if it's web)
7. **Settings**: the settings sheet showing Sign in with Apple, account, privacy, support links
8. **Verification**: the selfie + ID upload flow
9. **Live moments grid**: the home feed of active live streams
10. **Empty / loading**: the discovery deck empty state with a friendly CTA

## How to capture

Two paths:

### Option A: iOS Simulator (recommended)

```bash
cd /Users/bobbyc/simp-app/frontend
# Open the iOS simulator + run the app
npx cap run ios --target "iPhone 15 Pro Max"
# Walk through each screen, take screenshots via Cmd+S or xcrun simctl io booted screenshot /tmp/shot.png
```

### Option B: Real device

Use the iPhone connected via Xcode → Window → Devices and Simulators → select the device → Take Screenshot.

### Option C: PWA from a desktop browser

For initial drafts you can capture from the live PWA in Chrome DevTools with the iPhone device emulation. This is faster for early iteration but the resulting PNGs are not always accepted by App Store Connect (they may not include the iOS status bar).

```bash
# Open Chrome → DevTools → Toggle Device Toolbar → iPhone 15 Pro Max → 1290x2796
# Navigate to https://mysimp.app and walk through each flow
# Cmd+Shift+P → "Capture screenshot"
```

## Where to store the captures

Drop them in `frontend/public/store-assets/screenshots/{size}/` so they can be:
1. Used directly in the marketing site (screenshot gallery)
2. Re-rendered as PNGs at exact App Store sizes via sips
3. Compressed with ImageOptim before upload to App Store Connect

## Once captured

For each screenshot:
1. Verify dimensions match the device class table above
2. Strip EXIF metadata (`sips --stripAll`)
3. Add a 1-line caption to `docs/APP_STORE_SCREENSHOTS.md` below this section
4. Upload via App Store Connect → App Store → Screenshots

## Sample captions (paste into App Store Connect caption fields)

1. "Curated profiles. Verified only. Real people."
2. "Profile detail — full bio, photos, prompts, and verified badge"
3. "Live stream — hearts, comments, real presence"
4. "Messages — match and chat in seconds"
5. "SIMP+ — premium features, one tap from your settings"
6. "Safety Center — 24/7 Trust & Safety, scam playbook, regional helplines"
7. "Settings — Sign in with Apple, privacy controls, delete account"
8. "Get verified — selfie + ID, reviewed by humans"
9. "Live moments — see who's broadcasting right now"
10. "You're here — onboarding complete, ready to swipe"

## What NOT to do

- ❌ Don't use mockups or render-fakes — App Store reviewers can tell, and it triggers Guideline 2.3 (accurate metadata)
- ❌ Don't include Apple hardware in the screenshot (the iPhone frame). Apple wants raw device-screen captures only
- ❌ Don't blur or overlay text on screenshots — Apple wants to see what the user actually sees
- ❌ Don't include debug info, error states, or empty states as primary screenshots
