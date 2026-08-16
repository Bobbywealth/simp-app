# SIMP — Successful · Intentional · Male · Providers

A PWA-first dating app built with modern web technologies. Designed for mobile-first experiences with eventual native iOS/Android support via Capacitor.

**Experiences > Connections > Memories**

## Tech Stack

### Frontend (PWA)
- Vite + React 18 + TypeScript
- Tailwind CSS (luxe black + gold theme)
- Framer Motion (animations)
- React Router (routing)
- Zustand (auth state)
- React Hook Form (forms)
- vite-plugin-pwa (service worker, install prompt)
- Capacitor (iOS/Android wrapper ready)

### Backend (Node.js)
- Express + TypeScript
- Prisma + PostgreSQL
- JWT auth (access + refresh tokens)
- bcryptjs (password hashing)
- Zod (validation)
- Helmet (security headers)

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL
- Git

### Local Development

```bash
git clone https://github.com/Bobbywealth/simp-app.git
cd simp-app

# Install deps
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Set up env vars
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your Postgres URL and JWT secrets

# Set up database
cd backend && npx prisma generate && npx prisma migrate dev && cd ..

# Run dev servers
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

Visit http://localhost:5173

## Features (MVP)

- **Onboarding flow** (4 screens matching your design)
- **Signup / Login** with email + password
- **Profile setup** (multi-step: basics, story, interests)
- **Authentication** (JWT, refresh tokens, protected routes)
- **PWA** (service worker, install prompt, offline shell)
- **Luxe UI** (black + gold theme, Framer animations)

## Project Structure

```
simp-app/
├── frontend/         # Vite + React PWA
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   └── styles/
│   ├── public/icons/
│   └── vite.config.ts
├── backend/          # Express API
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── validation/
│   └── prisma/schema.prisma
└── render.yaml       # Render deployment config
```

## API Endpoints

### Auth
- `POST /auth/signup` — Register
- `POST /auth/login` — Log in
- `POST /auth/refresh` — Refresh token
- `POST /auth/logout` — Revoke token
- `GET /auth/me` — Get current user

### Users
- `GET /users/me/profile` — Get profile
- `PUT /users/me/profile` — Upsert profile
- `GET /users/interests` — List interests

## Deployment

### Render Blueprint

The `render.yaml` includes:
- **Backend** (Node.js web service + Postgres)
- **Frontend** (PWA static site)
- Auto-deploy from GitHub

Just push to GitHub and Render deploys automatically.

## TURN Setup (Required for Cross-Network Viewers)

The live streaming feature uses WebRTC. Without a TURN server, ~50% of
cross-network viewers (corporate firewalls, VPNs, symmetric NATs, hotel
WiFi, etc.) will see a **black screen** because their browser can't
establish a peer-to-peer path to the broadcaster.

The app ships with STUN-only defaults (Google's free servers), which work
for open-network viewers. To support cross-network viewers, configure a
TURN server via env vars on the backend Render service:

| Env var | Example | Notes |
| --- | --- | --- |
| `TURN_URLS` | `turn:global.turn.twilio.com:3478?transport=udp` | Comma-separated for multiple |
| `TURN_USERNAME` | `...` | Provider-issued |
| `TURN_CREDENTIAL` | `...` | Provider-issued (short-lived is fine) |
| `TURN_PROVIDER` | `twilio` | Human-readable label for debugging |

Set them via Render dashboard → simp-backend → Environment → add
each key/value pair. The app reads them on boot and serves the merged
STUN + TURN config at `GET /config/ice-servers` (which the frontend
caches and uses for every `new RTCPeerConnection`).

### Provider comparison

| Provider | Cost (low scale) | Setup | Best for |
| --- | --- | --- | --- |
| **Twilio Network Traversal Service** | $0.0004/GB; 100 GB free trial | Create account, generate API key, hit `Tokens` endpoint for short-lived credentials | Quick start, no infra to manage |
| **Cloudflare Calls** | Free tier (SFU + TURN) | Cloudflare account, dashboard config | Lowest cost at scale; bundles SFU if you migrate off WebRTC mesh |
| **Self-hosted coturn** | Free (your VM) | Docker image, 30 min setup, manage credentials yourself | Tight budget, full control |

### Twilio NTS quick start

```bash
# Install twilio-cli or just use the REST API directly
curl -u "ACCOUNT_SID:AUTH_TOKEN" \
  https://api.twilio.com/2010-04-01/Accounts/ACCOUNT_SID/Tokens.json
# returns iceServers with username + credential valid for 24h
```

Paste the returned `username` / `credential` into Render's environment
for the simp-backend service. Credentials auto-rotate; redeploy isn't
required if you wire this through a refresh-on-deploy cron.

### coturn (self-hosted) quick start

```bash
docker run -d --network=host \
  -e TURN_USERNAME=simproducer \
  -e TURN_CREDENTIAL=$(openssl rand -hex 32) \
  -e TURN_REALM=turn.simp.app \
  coturn/coturn \
  -n --logfile=stdout \
  --realm=turn.simp.app \
  --static-auth-secret=simproducer:$(openssl rand -hex 32) \
  --listening-port=3478 \
  --min-port=49152 --max-port=65535 \
  --use-auth-secret \
  --no-tls --no-dtls
```

Then set `TURN_URLS=turn:turn.simp.app:3478?transport=udp`,
`TURN_USERNAME`, `TURN_CREDENTIAL` on Render.

## Next Steps

- Discovery (swipe profiles)
- Matching (mutual likes)
- Messaging (real-time chat)
- Live streaming
- Experiences (curated events)
- Premium features
- Native apps (iOS/Android via Capacitor)

## Security

- ✅ HTTPS (Render enforces)
- ✅ CORS by origin
- ✅ Helmet security headers
- ✅ Password hashing (bcryptjs)
- ✅ JWT secrets in env
- ✅ SQL injection protection (Prisma)

## Development

```bash
# Typecheck
cd frontend && npm run typecheck && cd ..
cd backend && npm run typecheck && cd ..

# Build
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# Prisma Studio (explore DB)
cd backend && npx prisma studio
```

## Troubleshooting

**Build fails:** `rm -rf node_modules package-lock.json && npm install`
**DB connection fails:** Check `DATABASE_URL` in `.env`
**Frontend can't reach backend:** Check `VITE_API_BASE_URL` in `frontend/.env`
**PWA not installing:** Ensure HTTPS (or localhost for dev)

## License

Proprietary — SIMP Dating App (Bobby / Bobbywealth)

---

**Built with ❤️ for meaningful connections and unforgettable experiences.**
