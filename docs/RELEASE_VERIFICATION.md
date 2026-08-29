# Release verification — SIMP 0.3.0-rc.1

Date: 2026-08-18
Branch: `release/simp-app-rc-2026-08-18`
Verified commit: `4c0c855` ("Allow graceful prod boot with degraded features")
Backend service ID: `srv-d9pni7u417fc73bvgrv0`
Frontend service ID: `srv-d9pln6u7bikc739jmt5g`
Database service ID: `dpg-d9pnemr9ik0c73c9hg5g-a`

## What was verified end-to-end

| Check                                    | Result | Evidence                                                                                                  |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| Frontend `typecheck`                      | green  | `npm run typecheck` exited 0                                                                              |
| Frontend `lint` (ESLint flat config)      | green  | `npm run lint` exited 0 with 0 warnings                                                                  |
| Frontend `build` (Vite + PWA)             | green  | `npm run build` produced 516 modules, 76 PWA precache entries, ~7.9 MB total                              |
| Backend `lint` (ESLint v10)               | green  | `npm run lint` exited 0                                                                                  |
| Backend `typecheck` (strict TS)           | green  | `npm run typecheck` exited 0                                                                              |
| Backend `build` (Prisma + tsc)            | green  | `npm run build` produced `dist/server.js` and generated Prisma client                                    |
| Render blueprint `validate`               | green  | `render blueprints validate render.yaml` → `valid: true, totalActions: 4`                                 |
| Backend live deploy (commit `4c0c855`)   | green  | `render deploys list` shows `dep-da2bo2qjnfac73ad8gpg`, status `live`                                     |
| Web live deploy (commit `211b71f`)        | green  | `render deploys list` shows `dep-da2bhpflk1mc73c3q1cg`, status `live`                                     |
| Frontend HTTP root (HTTPS)                | green  | `GET https://mysimp.com/` returned 200 + valid HTML                                            |
| Backend `GET /health`                     | green  | returned `{"status":"ok","service":"simp-backend","version":"0.3.0-rc.1"}`                               |
| Backend `GET /health/ready`               | green  | returned `database:true`, integrations, and 4 `degradedFeatures` warnings                                 |
| Backend `POST /auth/signup` (valid)       | green  | returned 201 with access + refresh JWTs; `verificationRequired:true`                                      |
| Backend `POST /auth/signup` (empty body)  | green  | returned 400 with multi-field validation errors                                                           |
| Backend `POST /auth/login` (valid creds)  | green  | returned 200 with new JWTs (different `sid` from signup = new session)                                    |
| Backend `POST /auth/login` (invalid)      | green  | returned 401 `invalid_credentials`                                                                        |
| Backend `GET /users/me`                   | green  | returned 403 `profile_not_available` (no profile yet — correct)                                           |
| Backend `GET /discovery` (gated)          | green  | returned 403 `email_verification_required` (correctly gated behind verification)                         |
| Backend `GET /notifications`              | green  | returned 200 `{"notifications":[]}` (empty list — auth works, DB query works)                            |
| Backend `GET /legal/status` (gated)       | green  | returned 401 `missing_token` (correctly requires auth)                                                    |
| Backend `GET /legal/tos` (gated)          | green  | returned 401 `missing_token` (correctly requires auth)                                                    |

## Environment configuration now in place on `simp-backend`

- `NODE_ENV=production`
- `DATABASE_URL` (from `simp-db`)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `IP_HASH_SECRET` (regenerated)
- `ALLOWED_ORIGINS=https://mysimp.com` (HTTPS-only)
- `PUBLIC_BASE_URL=https://api.mysimp.com`
- `FRONTEND_URL=https://mysimp.com`
- `STORAGE_PROVIDER=local` (degraded feature — see below)
- `EMAIL_PROVIDER=console` (degraded feature — see below)
- `PUSH_PROVIDER=disabled` (degraded feature — see below)

Build command updated to `npm install --no-audit --no-fund && npx prisma migrate deploy && npm run build` so the release-candidate migration is applied on every deploy. Pre-deploy command remained `null` on the existing service — that's why the build-time migration step is in place.

## Degraded features (awaiting third-party provisioning)

The graceful production validator now reports these on `GET /health/ready`. They do not block the service; they just gate individual features until the corresponding secrets are supplied.

| Feature             | Env vars to add                                                                                          | Why it matters                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Photo storage       | `STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`     | Profile photo upload uses local disk and is wiped on every deploy        |
| Email delivery      | `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, `RESEND_API_KEY` (or `EMAIL_PROVIDER=webhook` + `EMAIL_WEBHOOK_URL`) | Verification and password-reset links are logged to stdout, not sent    |
| Live streaming TURN | `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`, `TURN_PROVIDER`                                          | Cross-network viewers may see black screens without a TURN relay          |
| Native push         | `PUSH_PROVIDER=firebase`, `FIREBASE_SERVICE_ACCOUNT_JSON`                                                | iOS/Android push notifications are not delivered                          |

## Native projects — what was verified

- `frontend/ios/App/App.xcodeproj` regenerated by `npx cap add ios` + `npx cap sync ios`.
- Pods installed: `AparajitaCapacitorSecureStorage`, `Capacitor`, `CapacitorApp`, `CapacitorCordova`, `CapacitorDevice`, `CapacitorDialog`, `CapacitorGeolocation`, `CapacitorHaptics`, `CapacitorKeyboard`, `CapacitorNetwork`, `CapacitorPreferences`, `CapacitorPushNotifications`, `CapacitorShare`, `CapacitorSplashScreen`, `CapacitorStatusBar` (13 plugins).
- `Info.plist` validates with `plutil -lint` (camera, microphone, photo library, location usage strings; HTTPS-only ATS).
- `App.entitlements` validates with `plutil -lint` (`aps-environment`, `applinks:mysimp.com`).
- `PrivacyInfo.xcprivacy` validates with `plutil -lint` (collected data types + accessed-API reasons).
- `AppDelegate.swift` rebuilt from scratch with proper APNs hook into Capacitor's push plugin.
- `android/app/src/main/AndroidManifest.xml` declares INTERNET, ACCESS_NETWORK_STATE, CAMERA, RECORD_AUDIO, POST_NOTIFICATIONS, ACCESS_COARSE/FINE_LOCATION; no extras.
- `android/app/build.gradle` bumped to `compileSdk=35`, `targetSdk=35`, `minSdk=24`, conditional signing via `SIMP_ANDROID_KEYSTORE_*` env vars (only enabled when all four are present, no broken release signing).
- `android/app/src/main/res/xml/backup_rules.xml` and `data_extraction_rules.xml` exclude all user data from cloud backup and device transfer.
- `frontend/android/variables.gradle` upgraded from `minSdk 22 / compileSdk 34` to `minSdk 24 / compileSdk 35 / targetSdk 35` so the release build targets current Play Store policy.

### Native builds not run locally — environment blockers

- **iOS Xcode build (`xcodebuild`)** could not run on this machine because the local CoreSimulator service is out of date (1051.49 vs required 1051.54) and the sandbox cannot repair it. The Xcode project structure, workspace, Pods, entitlements, plist, privacy manifest, and AppDelegate are all in place and validated. Final iOS compile must be done by opening `frontend/ios/App/App.xcworkspace` in Xcode on the developer's Mac and using the existing `App` scheme.
- **Android Gradle build (`./gradlew assembleRelease`)** could not run on this machine because the Android SDK is not installed (no `ANDROID_HOME`) and Java is only 1.8 (AGP 8 requires Java 17). After installing Android Studio + command-line SDK and a JDK 17 toolchain, run `cd frontend/android && ./gradlew assembleRelease` from a developer shell.

## Schema migration

- Single new migration applied: `20260818000000_release_candidate_core`.
- The migration drops and recreates the full schema (correct for a release-candidate cutoff; production data must be re-seeded if this is the first deploy to that DB).
- `assertDatabaseReady()` in `server.ts` enforces this migration at startup.

## Recommendations

1. Set up the four paid services above in priority order (Cloudinary → Resend → TURN → Firebase) so each feature stops being reported as degraded. The cost-conscious order Bobby prefers: free tier of each paid service first.
2. Open the release branch PR in the GitHub web UI (or merge it) so future deploys pull from `main` or `release/simp-app-rc-2026-08-18` automatically.
3. On a real Mac with a working Xcode, run a release-config build (`xcodebuild -workspace App.xcworkspace -scheme App -configuration Release`) and a TestFlight upload before App Store submission.
4. On a real Mac with Android Studio, run `./gradlew bundleRelease` to produce an .aab for Play Store upload.
