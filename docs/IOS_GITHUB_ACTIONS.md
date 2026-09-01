# iOS Build via GitHub Actions

This document covers the one-time setup for building signed SIMP .ipa files
in CI without needing a local Mac. After setup, every push to `main` that
touches `frontend/` produces a signed `SIMP-*.ipa` artifact in the Actions
tab, ready for upload to App Store Connect.

The build runs on the GitHub-hosted `macos-latest` runner. The
`Bobbywealth/simp-app` repo is public, so macOS runner minutes are free.

## Required GitHub Secrets (7 total)

Add these at **Repo → Settings → Secrets and variables → Actions → New
repository secret**:

| Secret name | What it is | Where to get it |
|---|---|---|
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID | developer.apple.com → Membership |
| `APPLE_KEY_ID` | App Store Connect API Key ID | App Store Connect → Users & Access → Keys |
| `APPLE_ISSUER_ID` | App Store Connect API Issuer ID | Same page as Key ID |
| `APPLE_API_KEY_BASE64` | base64 of the `.p8` file | `base64 AuthKey_XXXX.p8 > apikey.b64` |
| `APPLE_DIST_CERT_BASE64` | base64 of the `.p12` cert | `base64 ios_dist.p12 > cert.p12.b64` |
| `APPLE_DIST_CERT_PASSWORD` | The `.p12` export password | Whatever you set when exporting |
| `APPLE_PROVISION_PROFILE_BASE64` | base64 of the `.mobileprovision` | `base64 SIMP_App_Store.mobileprovision > provision.b64` |

Plus one **repo variable** (not a secret):

| Variable name | Value | Effect |
|---|---|---|
| `ENABLE_TESTFLIGHT_UPLOAD` | `true` or unset | `true` → auto-uploads each .ipa to TestFlight via `xcrun altool` |

## One-time Apple-side setup

If you already have an Apple Distribution cert + App Store provisioning
profile for `app.simp.client`, you can skip straight to **Generating the
base64 files**. Otherwise:

### 1. Create a Certificate Signing Request (CSR) on your Mac

```bash
cd ~/Desktop
openssl genrsa -out ios_dist.key 2048
openssl req -new -key ios_dist.key -out ios_dist.csr \
  -subj "/CN=Bobby Wealth/emailAddress=bobby@wolfpaqmarketing.com"
```

Keep `ios_dist.key` somewhere safe. You'll need it again when the cert
expires (Apple Distribution certs last 1 year).

### 2. Create the Apple Distribution certificate

1. Open developer.apple.com → **Certificates, Identifiers & Profiles**.
2. Click the `+` button.
3. Pick **Apple Distribution** (under the Production section).
4. Upload `ios_dist.csr` when prompted.
5. Download the resulting `.cer` file.
6. Double-click the `.cer` to add it to your Mac's Keychain.
7. Open **Keychain Access** → search for the cert by your team name →
   right-click → **Export...** → save as `.p12` with a password.

### 3. Confirm the App ID exists

developer.apple.com → **Identifiers** → confirm `app.simp.client` exists.
Required capabilities: **Push Notifications**, **Sign in with Apple**.

If you need to create it, the format is:
- Description: `SIMP Dating`
- Bundle ID: `app.simp.client` (Explicit)
- Capabilities: enable Push Notifications + Sign in with Apple

### 4. Create the App Store provisioning profile

1. Profiles → `+` → Distribution → **App Store** → Next.
2. Select App ID `app.simp.client` → Next.
3. Select the Apple Distribution cert from step 2 → Next.
4. Name: `SIMP App Store` → Generate.
5. Download the `.mobileprovision` file.

### 5. Create an App Store Connect API key

1. App Store Connect → **Users and Access** → **Keys** → **App Store
   Connect API** → Generate.
2. Access: **App Manager** (minimum) or Admin.
3. Download the `.p8` file (you only see this once).
4. Note the **Key ID** and **Issuer ID** from the page header.

### 6. Generate the base64-encoded files

```bash
cd ~/Desktop
base64 ios_dist.p12 > ios_dist.p12.b64
base64 SIMP_App_Store.mobileprovision > provision.b64
base64 AuthKey_<KEY_ID>.p8 > apikey.b64
```

Copy the contents of each `.b64` file (no newlines, single line of base64)
into the matching GitHub secret.

## Triggering a build

The workflow runs automatically when:
- A commit is pushed to `main` that touches `frontend/**` or
  `.github/workflows/ios-build.yml`.
- You click **Run workflow** from the Actions tab → iOS Build → Run workflow.

First build: ~10–12 minutes (cold cache, downloads Xcode + CocoaPods +
Node). Subsequent builds: ~6–8 minutes with warm caches.

## Downloading the .ipa

1. Go to **Actions** → click the run → scroll to **Artifacts** at the bottom.
2. Download `simp-ios-ipa.zip`.
3. Unzip to get `SIMP-0.3.0.ipa`.

## Uploading to App Store Connect

Three options:

### Option A: TestFlight auto-upload (recommended)
Set the repo variable `ENABLE_TESTFLIGHT_UPLOAD=true`. Every build lands in
TestFlight automatically. You'll need to have created the app in App Store
Connect first (one-time manual step) and the build will appear under
**My Apps → SIMP → TestFlight** within ~5 minutes of the workflow finishing.

### Option B: Manual upload via Transporter
1. Download the `.ipa` from the workflow artifacts.
2. Open **Transporter** (free on the Mac App Store).
3. Sign in with your Apple ID.
4. Drag the `.ipa` in → Deliver.

### Option C: Manual upload via Xcode
1. Open `frontend/ios/App/App.xcworkspace` in Xcode.
2. Window → Organizer → Archives → select the build → Distribute App →
   App Store Connect → Upload.

## Cert rotation (every 12 months)

Apple Distribution certificates expire yearly. When the cert expires, all
builds will fail with `SecKeychainItemCopyAccess: ... The specified item
could not be found in the keychain` or similar.

To rotate:
1. Generate a fresh `.cer` from the existing `ios_dist.key` (re-upload the
   same CSR — Apple will reissue the cert).
2. Re-export to `.p12` with a fresh password.
3. Re-encode as base64, replace `APPLE_DIST_CERT_BASE64` and
   `APPLE_DIST_CERT_PASSWORD` secrets.
4. Re-create the App Store provisioning profile linked to the new cert,
   replace `APPLE_PROVISION_PROFILE_BASE64`.
5. Next workflow run will use the new cert.

**Tip:** Add a calendar reminder for ~11 months out to start the rotation.

## Troubleshooting

### "No signing certificate found"

The .p12 didn't import. Check:
- Password matches what you set in Step 2 of the Apple setup.
- The base64 file has no newlines / wrapping artifacts.

### "Provisioning profile doesn't include signing certificate"

The cert in the profile doesn't match the cert in the .p12. Either:
- Recreate the profile from the current cert.
- Or re-export the .p12 from the cert that's already in the profile.

### "bundle format is ambiguous" / "expected a single .ipa"

The archive step succeeded but the export step failed silently. Check the
ExportOptions.plist — usually a missing or wrong `provisioningProfiles`
entry.

### The build is slow (>15 min)

First build downloads Xcode 16 (~2 GB) and CocoaPods caches. Subsequent
runs are faster. If consistently slow, check the Actions log for pod
install hangups — sometimes a `pod repo update` resolves it.

## How it works

The workflow:
1. Checks out the repo, installs Node deps, typechecks, builds the Vite
   web bundle.
2. Runs `npx cap sync ios` to copy the built web bundle into the iOS
   project.
3. Installs CocoaPods dependencies (cached after first run).
4. Creates a temporary macOS keychain, imports the .p12 cert, installs
   the provisioning profile.
5. Runs `xcodebuild archive` to produce a signed `.xcarchive`.
6. Runs `xcodebuild -exportArchive` to produce the final `.ipa`.
7. Uploads the `.ipa` as a workflow artifact (and optionally uploads to
   TestFlight).

The workflow never logs secret values. The .p12, .p8, and .mobileprovision
files are removed at the end of the job in a `cleanup` step.
