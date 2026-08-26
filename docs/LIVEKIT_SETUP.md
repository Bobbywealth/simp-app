# LiveKit Cloud setup for SIMP live streaming

SIMP's live streaming uses [LiveKit Cloud](https://cloud.livekit.io) as the
SFU (Selective Forwarding Unit). The backend mints a per-room access
token via the LiveKit server SDK; the frontend joins the room with the
official LiveKit client SDK. The backend also kicks off / tears down
composite recording for safety retention.

## 1. Create a LiveKit Cloud project

1. https://cloud.livekit.io → Sign up (free tier is fine).
2. **Create project** → name it `simp` (or whatever you like).
3. Pick a region. Render is in `us-east-1`, so `US East (N. Virginia)`
   is the lowest-latency match. You can change this later.
4. Copy the **WebSocket URL**. It looks like
   `wss://your-project-abc123.livekit.cloud`.

## 2. Create an API key

1. Project → **Settings** → **Keys** → **Create API key**.
2. Name it `simp-backend` so you can tell what it's for later.
3. Save both values somewhere safe:
   - **API Key** (looks like `APIxxxxxxxxxxxxxx`)
   - **API Secret** (a long base64 string)

## 3. Paste the env vars into Render

This is the same GET-merge-PUT pattern Apple billing uses. **Do not
overwrite** your other env vars when you do this.

Render → `simp-backend` → **Environment** → add:

| Key                          | Value                                          |
|------------------------------|------------------------------------------------|
| `LIVEKIT_URL`                | `wss://your-project-abc123.livekit.cloud`       |
| `LIVEKIT_API_KEY`            | the API Key from step 2                         |
| `LIVEKIT_API_SECRET`         | the API Secret from step 2                      |
| `LIVEKIT_RECORDING_ENABLED`  | `true` (after the rest is verified)             |

`LIVEKIT_RECORDING_ENABLED` defaults to `false` so you can ship
streaming without recording while you're testing. Flip it to `true`
once you've confirmed recording lands where you expect.

Render → `simp-web` → **Environment** → add:

| Key                 | Value                                    |
|---------------------|------------------------------------------|
| `VITE_LIVEKIT_URL`  | same wss URL as the backend               |

`VITE_LIVEKIT_URL` is the only LiveKit value the frontend needs;
the secret never leaves the backend.

## 4. (Optional) Recording egress template

LiveKit Cloud has a free built-in recording storage. Skip this section
if you're using the default storage.

If you'd rather dump recordings into your own S3 / Cloudflare R2 /
Backblaze B2 bucket, in the LiveKit Cloud dashboard go to
**Storage** → **Create template**, point it at your bucket, copy the
template id, and set it as `LIVEKIT_RECORDING_TEMPLATE` on the backend.

## 5. Verify

After the backend redeploys with the env vars:

```bash
curl -sS https://api.mysimp.com/config/livekit | jq .
# Expect: { "url": "wss://...", "recordingEnabled": true }

curl -sS https://api.mysimp.com/health/ready | jq '.integrations.livekit'
# Expect: true
```

Open the SIMP app, complete onboarding, and tap **Start streaming**.
After granting camera + mic, your live room should appear in the
Live tab within a few seconds.

## Cost

- LiveKit Cloud free tier: 10,000 participant-minutes/month +
  50 GB recording storage.
- After that: $0.004/participant-minute + $0.07/GB-month storage.
- We do not charge customers for streaming; this is a flat operating
  cost. Watch the dashboard at https://cloud.livekit.io for usage.

## Why LiveKit over rolling our own SFU

The previous implementation did WebRTC mesh (one `RTCPeerConnection`
per viewer). That breaks down at ~25 concurrent viewers, has no
bandwidth adaptation, no recording, no reconnect story, and the iOS
Safari autoplay edge cases are notorious. LiveKit gives us:

- SFU fan-out (one upstream from broadcaster, N downstreams to viewers)
- Simulcast / SVC encoding for variable bandwidth
- Auto-reconnect on socket blips
- Built-in composite MP4 + HLS recording
- Web + iOS + Android SDKs that share the same room semantics
- Free tier that covers the first few months of usage

If we outgrow Cloud later, we can self-host the LiveKit server
(`livekit/livekit-server` Docker image) on Render background workers
without changing any of our application code.
