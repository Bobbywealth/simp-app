# SIMP App Store & Google Play Store Metadata

This directory contains everything you need to submit SIMP to the
Apple App Store and Google Play Store. The content is pre-written
and ready to copy-paste into the store consoles.

**⚠ Required before submission:**

1. **Replace `mysimp.com` with your actual domain** (we use `mysimp.com` as
   the canonical domain for SIMP).
2. **Buy the developer accounts:**
   - Apple Developer Program: $99/year → https://developer.apple.com/programs/
   - Google Play Console: $25 one-time → https://play.google.com/console
3. **Create the Firebase project** for push notifications:
   - https://console.firebase.google.com/
   - Create project, add iOS app (bundle ID `app.simp.client`) → download
     `GoogleService-Info.plist` → place at `ios/App/App/GoogleService-Info.plist`
   - Add Android app (package `app.simp.client`) → download
     `google-services.json` → place at `android/app/google-services.json`
4. **Set up APNs key** for iOS push:
   - https://developer.apple.com/account/resources/authkeys/list
   - Download the `.p8` key, note the Key ID and Team ID

## File map

- `app-store-listing.md` — Apple App Store listing copy (title,
  subtitle, description, keywords, age rating)
- `play-store-listing.md` — Google Play listing copy
- `age-rating-questionnaire.md` — Apple's age rating worksheet
- `data-safety-form.md` — Google Play's Data Safety section answers
- `privacy-nutrition-label.md` — Apple's App Privacy section answers
- `screenshots.md` — checklist of screenshots to capture
- `review-notes.md` — what to tell the reviewers
- `submission-checklist.md` — end-to-end pre-submission checklist
