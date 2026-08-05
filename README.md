# SIMP — Superior · Intelligent · Male · Pleasers

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
