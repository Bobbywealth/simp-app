# SIMP — Pre-Submission Checklist

Run through this before hitting "Submit for Review" in App Store
Connect or "Send for review" in Play Console.

## 1. Accounts & agreements

- [ ] Apple Developer Program account active ($99/yr, paid)
- [ ] Google Play Console account active ($25 one-time, paid)
- [ ] App Store Connect: Agreements, Tax, and Banking complete
- [ ] Google Play Console: Merchant account linked (if charging)
- [ ] Firebase project created (for push notifications)
- [ ] APNs key generated + downloaded (.p8 file)

## 2. Legal documents

- [ ] Privacy Policy live at `https://mysimp.com/legal/privacy`
- [ ] Terms of Service live at `https://mysimp.com/legal/tos`
- [ ] Support page live at `https://mysimp.com/legal/support`
- [ ] All three URLs return 200 and render correctly in Safari
- [ ] Documents match the app's actual behavior (no dead references
  to features that don't exist)

## 3. Compliance features (in-app)

- [ ] 18+ age gate opens on first live stream attempt
- [ ] ToS + Privacy acceptance recorded server-side
- [ ] Account deletion reachable from Settings → Privacy & Data
- [ ] Data export reachable from Settings → Privacy & Data
- [ ] Block user works (Profile → ⋯ → Block)
- [ ] Report user works (Profile → ⋯ → Report)
- [ ] Report stream works (Live stream → 🚩)
- [ ] Streams with 3+ reports auto-hide from LIVE NOW

## 4. Technical setup

- [ ] `capacitor.config.ts` has correct `appId` (`app.simp.client`)
- [ ] `capacitor.config.ts` has correct `appName` (`SIMP`)
- [ ] `ios/App/App/Info.plist` has all required NS*UsageDescription
- [ ] `ios/App/App/PrivacyInfo.xcprivacy` is present and valid
- [ ] `ios/App/App/AppDelegate.swift` has Capacitor bridge methods
- [ ] `android/app/src/main/AndroidManifest.xml` has all permissions
- [ ] `android/app/build.gradle` has signing config for release
- [ ] `ios/App/App/GoogleService-Info.plist` placed (from Firebase)
- [ ] `android/app/google-services.json` placed (from Firebase)
- [ ] App icons generated for iOS (1024×1024 marketing, 180/120/87/60/40)
- [ ] App icons generated for Android (192/144/96/72/48 + adaptive)
- [ ] Splash screen assets generated

## 5. Build & sign

- [ ] `cd frontend && npm install && npm run build` succeeds
- [ ] `npx cap sync` succeeds (copies dist → native projects)
- [ ] Xcode opens `ios/App/App.xcworkspace` without errors
- [ ] Xcode → Product → Archive produces a valid .ipa
- [ ] .ipa uploaded to App Store Connect via Xcode or Transporter
- [ ] Android Studio opens `android/` without errors
- [ ] Android Studio → Build → Generate Signed Bundle / APK produces .aab
- [ ] .aab uploaded to Play Console

## 6. Store listings

- [ ] App Store: all screenshots captured (see screenshots.md)
- [ ] App Store: description, subtitle, keywords filled
- [ ] App Store: age rating questionnaire submitted (17+ Mature)
- [ ] App Store: privacy nutrition label filled (see privacy-nutrition-label.md)
- [ ] App Store: review notes pasted (see review-notes.md)
- [ ] App Store: test account credentials added
- [ ] Play Store: all screenshots captured
- [ ] Play Store: short + full description filled
- [ ] Play Store: data safety form filled (see data-safety-form.md)
- [ ] Play Store: content rating questionnaire submitted
- [ ] Play Store: target audience set to 18+
- [ ] Play Store: sensitive category set to Dating

## 7. Testing

- [ ] TestFlight (iOS): invite 5+ testers, all flows work
- [ ] Internal testing (Android): invite 5+ testers, all flows work
- [ ] Test account login works on real iPhone
- [ ] Test account login works on real Android phone
- [ ] Live stream works on real iPhone (broadcaster + viewer)
- [ ] Live stream works on real Android phone (broadcaster + viewer)
- [ ] Push notifications arrive on both platforms
- [ ] Account deletion works end-to-end
- [ ] Data export produces a downloadable JSON

## 8. Final review

- [ ] All "Review Notes" answered honestly
- [ ] App works offline (graceful degradation, shows error)
- [ ] App handles airplane mode (no crash, shows "offline" state)
- [ ] App handles slow network (loading states, no infinite spinners)
- [ ] App handles permission denial gracefully (camera/mic/location
  "don't allow" → friendly message, not a crash)
- [ ] No broken links in the app (every button does something)
- [ ] No console.log output visible in release builds

## 9. Post-submission

- [ ] Set up App Store Connect / Play Console email notifications
- [ ] Watch for review feedback (Apple typically responds in 24-48h,
  Google in 3-7 days)
- [ ] Have the demo account credentials ready in case reviewer asks
- [ ] Be ready to re-submit quickly if rejected — Apple's feedback
  loop is fast if you respond within 24 hours
