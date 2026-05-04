# Vanta Architecture

## Model

**B-book, self-funded.** Trades settle internally — you are the counterparty. Money never routes through a liquidity provider. This is the simplest viable architecture for an offshore retail broker at 2,000-trader scale, and it matches the existing operation.

```
┌─────────────────────────────────────────────────────────────┐
│  Mobile (Expo iOS/Android) + Web (Expo Web → Vercel)        │
│  • Auth, Trade screens, Robots, Portfolio, Profile          │
└──────────────┬──────────────────────────────┬───────────────┘
               │ REST + WebSocket             │ Supabase JS
               ▼                              ▼
┌──────────────────────────────┐  ┌──────────────────────────┐
│  Vanta API (Node + Fastify)  │  │  Supabase                │
│  on Railway/Fly              │  │  • Auth                  │
│  • OMS (open/close trades)   │  │  • Postgres              │
│  • Price feed relay (WS)     │  │  • Realtime              │
│  • Robot execution engine    │  │  • Storage (KYC docs)    │
│  • Quote service             │  └──────────────────────────┘
└──────┬───────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Price Feed Provider        │
│  (Twelve Data / Polygon)    │
└─────────────────────────────┘
```

## Why this stack

| Choice | Reason |
|---|---|
| **Expo (RN)** | One codebase → iOS, Android, web. Same patterns we used in WorkScope. |
| **Supabase** | Auth, Postgres, realtime, storage in one. Already proven in our stack. |
| **Fastify** | Lightweight Node server, great WebSocket support, type-safe. |
| **TradingView Lightweight Charts** | Free, open source, fast. Renders in WebView on mobile. |
| **Twelve Data** | Cheap forex/stock/crypto feed ($29–199/month). |
| **Claude API** | Robot compilation + tip generation. |
| **Zustand + TanStack Query** | Local state + server state, minimal boilerplate. |

## Three environments

Driven by `EXPO_PUBLIC_ENV` and `account.type`:

| Env | Use | DB | Money |
|---|---|---|---|
| **staging** | Internal QA | Separate Supabase project | None |
| **demo** | Public demo accounts | Production DB, demo flag | Virtual |
| **live** | Real traders | Production DB | Real |

Demo and live share the same database — separation is at the row level via `accounts.type`. RLS policies prevent cross-type leakage.

## Data flow: opening a trade

```
1. User taps Buy in OrderEntry.tsx
2. POST /api/orders { symbol, side, volume, sl, tp }
3. Server:
   a. Auth check (JWT from Supabase)
   b. Pull current quote from in-memory price cache
   c. Margin check against accounts table
   d. Insert into trades (status='open', open_price=quote)
   e. Update accounts.margin_used
4. Server publishes via Supabase Realtime → client position list updates
5. WebSocket pushes price updates → P&L recomputed client-side
6. SL/TP hit → server-side worker closes the trade
```

## AI Robot lifecycle

```
1. User types prompt: "Buy AMZN at NYSE open every day"
2. POST /api/robots/compile with { prompt }
3. Server calls Claude API:
   - System prompt: "You translate natural-language strategies into config JSON.
                     Return { schedule, symbol, side, volume, conditions }"
   - User: prompt
4. Returns parsed JSON config
5. Save to robots table with status='draft'
6. User reviews, hits Activate → status='active'
7. Cron worker checks robots table every minute, runs eligible ones
8. Each run logged to robot_runs; trades opened via same OMS path
```

## Price feed strategy

- Pull tick-level prices from Twelve Data via WebSocket.
- Maintain in-memory quote cache on the API server.
- Broadcast to connected clients via WebSocket.
- Persist 1-minute bars to Postgres for chart history.

For B-book, prices are **for display only** — execution prices come from the same cache so traders see consistency.

## Build roadmap

### Phase 1 — Scaffold (✅ done in initial session)
- Project structure, theme, schema, screens scaffolded
- Auth + navigation working
- All screens render with demo data

### Phase 2 — Make it real (next 1–2 weeks)
- Wire Supabase migrations, connect auth
- Build Fastify backend (`server/`)
- Twelve Data price feed integration
- Live charts via WebSocket → Chart component
- Real order entry posting to OMS
- Real positions table from `trades` query

### Phase 3 — AI Robots (week 2–3)
- Claude API integration on backend
- Prompt-to-config compiler
- Cron-style robot runner
- Tip generation flow

### Phase 4 — Production readiness
- Sentry / error tracking
- Push notifications via Expo
- KYC integration with existing compliance flow
- Admin panel (separate Next.js app or extend Supabase Studio)
- Live deploy → Railway (server), Vercel (web), TestFlight + Play Internal (mobile)

### Phase 5 — Engagement features
- Streaks, achievements, win animations
- Copy trading (longer term)
- Leaderboards for robots
- Push notifications for price alerts
- Referral system
