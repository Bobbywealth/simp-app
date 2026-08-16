# SIMP — Screenshot Checklist

Both stores require screenshots for every device class you support.
Capture these on the actual device (or simulator) running the latest
build, then upload to App Store Connect / Play Console.

## iPhone (required)

Apple requires screenshots for every supported device size. Modern
Apple supports only 6.5" and 6.7" iPhone sizes — capture on both.

### iPhone 6.7" (iPhone 14 Pro Max, 15 Pro Max, 16 Pro Max)

Resolution: **1290 × 2796 px** (portrait)

1. **Welcome screen** — gold crown + tagline on black satin background
2. **Discovery feed** — a profile card with photo + bio + interests
3. **Live stream viewer** — a streamer's video with chat overlay + hearts
4. **Live stream broadcaster** — Go Live modal + camera preview
5. **Match screen** — a match detail with prompt answers + photo carousel
6. **Profile** — own profile with photos + prompts + interests
7. **Settings** — privacy & data section showing Download my data +
   Delete account buttons

### iPhone 6.5" (iPhone 11 Pro Max, XS Max)

Resolution: **1242 × 2688 px** (portrait)

Same 7 screenshots as 6.7".

## iPad (optional but recommended)

If you support iPad (the Capacitor build does by default), you also
need iPad screenshots. Capture on:

### iPad Pro 12.9"

Resolution: **2048 × 2732 px** (portrait)

Same 7 screenshots as iPhone.

### iPad Pro 11"

Resolution: **1668 × 2388 px** (portrait)

Same 7 screenshots.

## Android (Google Play)

Google Play requires:
- **2 minimum** screenshots
- **8 maximum** screenshots

Capture on a phone (Pixel 7 Pro / Samsung Galaxy S23+):

### Phone

Resolution: **1080 × 2400 px** (portrait) minimum

Same 7 screenshots as iPhone.

## Tips for clean captures

1. **Use a real device** — simulator screenshots look obviously fake
   to reviewers and Apple has been rejecting them lately.
2. **Light status bar** — make sure the status bar shows a normal
   time (9:41 AM is Apple's marketing standard, but anything clean
   works), full battery, and good signal.
3. **No placeholder data** — don't show "Lorem ipsum" or empty states.
   Use a fully populated test account (Kenji seed user works).
4. **Match the brand** — black background, gold accents, no white
   text on white.
5. **Add a caption strip** (optional but recommended) — Apple allows
   up to 10 screenshots per device size, with text overlay at the top.
   Use the extra slots for short captions like "Verified members only"
   or "Real-time chat + hearts."

## Where to capture

- **iOS simulator:** Xcode → Open Simulator → ⌘S to save to desktop
- **Real iPhone:** Volume up + Side button, then share via AirDrop
- **Android emulator:** Android Studio → screenshot toolbar icon
- **Real Android phone:** Power + Volume down, then share via Nearby Share
