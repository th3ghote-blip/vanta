# VANTA

**Trade smarter. Trade faster.**

A modern, AI-powered trading platform with two modes:
- **Pro Mode** — MT4-style charts, orders, positions
- **Fun Mode** — Simple binary-style "buy here, win X" gameplay

Built on a self-funded B-book model, designed for offshore (Marshall Islands) operations.

---

## Stack

| Layer | Tech |
|---|---|
| Mobile + Web | Expo (React Native) + TypeScript |
| State | Zustand + TanStack Query |
| Charts | TradingView Lightweight Charts |
| Backend | Node.js + Fastify (WebSocket relay + OMS) |
| Database | Supabase (Postgres + Realtime + Storage) |
| Auth | Supabase Auth |
| Price Feed | Twelve Data / Polygon.io |
| AI Robots | Claude API |
| Push Notifications | Expo Notifications |
| Hosting | Vercel (web) + Railway (backend) |

---

## Three environments

1. **Live** — real money, production traders
2. **Demo** — virtual balance, real prices, full feature parity (used as both QA and a public product feature)
3. **Staging** — internal testing before deploy

Demo accounts are activated via a flag — same codebase, just `account.type = 'demo'`.

---

## Project Structure

```
vanta/
├── app/                  Expo Router screens
│   ├── (auth)/           Login, signup
│   ├── (tabs)/           Main app: Trade, Robots, Portfolio, Profile
│   └── _layout.tsx       Root layout
├── components/
│   ├── pro/              Pro mode (charts, orders, positions)
│   ├── fun/              Fun mode (binary cards, animations)
│   ├── robots/           AI robot builder + cards
│   └── shared/           Reusable components
├── lib/                  Supabase client, theme, AI client
├── stores/               Zustand state slices
├── server/               Node/Fastify backend
│   └── src/
│       ├── routes/       REST endpoints
│       ├── feed/         WebSocket price feed relay
│       └── ai/           Robot execution engine
├── supabase/migrations/  SQL schema
├── docs/                 Help, architecture, research
└── assets/               Images, fonts
```

---

## Quick Start

```bash
# Install deps
npm install

# Run mobile + web (Expo)
npm run start

# Run backend (separate terminal)
cd server && npm install && npm run dev

# Apply DB migrations (with Supabase CLI)
supabase db push
```

---

## Branding & Credits

**VANTA** — built by [AI App Genius](mailto:info@aiappgenius.com)
Analytics by **Nifield Analytics**

See [BRAND.md](./BRAND.md) for the full brand guide.

---

## Documentation

- [Help Center](./docs/help.md) — End-user help
- [Architecture](./docs/architecture.md) — How it all fits together
- [Engagement Research](./docs/engagement-research.md) — What's working in modern trading apps

---

## Status

Early-stage scaffold. See `docs/architecture.md` for the build roadmap.
