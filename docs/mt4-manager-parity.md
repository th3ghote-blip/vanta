# MT4 Manager — Feature-Parity Checklist

> **Purpose.** Track Vanta's admin/back-office surface against the capabilities a broker operator
> expects from the classic **MT4 Manager** terminal. Each capability is rated **Have / Partial /
> Missing**, with the route or screen that provides it and the TODO item that closes any gap.
>
> Last updated: 2026-06-18 (auto run, item 21.8). Grounded in `server/src/routes/admin.ts`,
> `app/admin/*`, and `server/src/workers/*` as they exist on `main` at this commit. Live behaviour
> is verified per-feature in the linked 21.x items; this doc is the map, not the live audit (that's
> 21.1).

## Legend

- **Have** ✅ — implemented end-to-end (backend route + admin screen, or an automated worker), unit-tested.
- **Partial** 🟡 — core exists but a sub-capability is missing, best-effort, or unverified live.
- **Missing** ❌ — no implementation; needs a new TODO sub-item.

## Parity matrix

| # | MT4 Manager capability | Status | Where it lives in Vanta | Gap / follow-up |
|---|---|---|---|---|
| 1 | **Live positions** (all open trades across accounts) | ✅ Have | `GET /api/admin/positions` → `app/admin/positions.tsx`. Every `status='open'` trade joined to its `login`, with live mid, unrealized P&L, notional, held margin; summary bar (total open / notional / net long-short); sort by P&L/symbol/age. | Built in **21.3**. Live verify pending (21.1). |
| 2 | **Account list** w/ balance · equity · margin · margin-level · free margin | 🟡 Partial | `GET /api/admin/users` → `app/admin/users.tsx` (list); `GET /api/admin/users/:userId` → `app/admin/user/` (detail w/ balance, margin_used, free_margin). `GET /api/admin/dashboard` aggregates. Per-account **equity + margin-level %** is computed in the leaderboard (`/api/admin/analytics/accounts`, 21.6) but not shown as a column on the main account list. | Surface `equity` + `margin_level_pct` columns directly on `app/admin/users.tsx`. → **new 21.9**. |
| 3 | **Order / trade history** (closed trades, per account & global) | 🟡 Partial | Per-account closed trades visible via the user detail screen and the client blotter; global realized P&L aggregated in `analytics/by-symbol` (21.5) and `analytics/accounts` (21.6). | No dedicated global **closed-trades blotter** with filters (date range, symbol, account, reason). → **new 21.10**. |
| 4 | **Force-close any position** | ✅ Have | `POST /api/admin/positions/:id/close` → per-row "Force close" in `app/admin/positions.tsx`. Closes at live mid, settles P&L via `apply_trade_pnl`, releases margin, stamps `reason='admin_close'`, CAS-guarded against races. | Built in **21.4**. Live verify pending (21.1). |
| 5 | **Modify any position** (SL/TP) | ✅ Have | `PATCH /api/admin/positions/:id { stopLoss?, takeProfit? }` → "SL/TP" modal in `app/admin/positions.tsx`. Directional validation vs live mid; null clears a level. | Built in **21.4**. No admin-side **modify open price / volume** (rarely used; intentionally omitted). |
| 6 | **Balance operations** (deposit / withdraw / credit / debit / adjust) | 🟡 Partial | `POST /api/admin/accounts/:id/adjust` — signed amount, mandatory `reason`, writes an `adjustment` transaction + updates balance & free_margin; rejects debits below zero. Client-initiated deposits/withdrawals flow through `GET /api/admin/transactions` + approve/reject. | One generic `adjustment` type covers credit/debit; **no separate non-withdrawable "credit" bucket** like MT4's credit field. → **new 21.11** (only if a credit/bonus concept is wanted). |
| 7 | **Transaction approval queue** (deposit/withdrawal review) | ✅ Have | `GET /api/admin/transactions` + `POST /api/admin/transactions/:id/approve` / `:id/reject` → `app/admin/transactions.tsx`. | — (not a classic MT4 feature; Vanta-specific, complete). |
| 8 | **Margin-call & stop-out monitor** | ✅ Have | Monitoring: `GET /api/admin/risk` → `app/admin/risk.tsx` lists accounts `near_margin_call` sorted by `margin_level_pct`. Enforcement: `server/src/workers/risk.ts` auto-closes at stop-out (`reason='stopout'`) and triggers SL/TP. | Built across risk route + worker. No configurable per-account/group **stop-out level** (single global threshold). → covered by group work, **new 21.12**. |
| 9 | **Exposure by symbol** (net long/short, B-book risk) | ✅ Have | `GET /api/admin/analytics/by-symbol` → `app/admin/analytics.tsx` (By Asset view): per-symbol open interest (net long/short lots + notional at live mid), `over_exposure` flag past a threshold. | Built in **21.5**. Live reconcile pending (21.1). |
| 10 | **Online-users monitor** (who's connected right now) | ❌ Missing | Only `profiles.last_login_date` is tracked (for login streaks, `server/src/routes/auth.ts`). No real-time presence / connected-sessions view. | Add a lightweight presence ping (`accounts.last_seen` updated on authed requests) + an "Online now" panel. → **new 21.13**. |
| 11 | **Per-group spread / markup** (account groups, group-level pricing) | ❌ Missing | No `groups` concept. Spreads/markups are global (pricing layer), accounts are flat. | Introduce account groups + per-group spread/markup/leverage/stop-out. Large; → **new 21.14** (scope as its own mini-phase). |
| 12 | **Reporting** (P&L per account / symbol / day) | ✅ Have | Per symbol: `analytics/by-symbol` (21.5). Per account: `analytics/accounts` leaderboard (21.6). Per day: `analytics/overview?days=N` daily time-series — new users, trade volume, deposits/withdrawals, house P&L (21.6). | Built. No **CSV/PDF export** of reports. → **new 21.15** (export). |
| 13 | **Client notifications** (operator → client messages / alerts) | 🟡 Partial | In-app notifications exist (`notifications` table, migration 029; `app/notifications.tsx`) driven by robots/price alerts (22.0); push is best-effort via `lib/push.ts`. | No **operator-composed broadcast/direct message** to a client or all clients from the admin UI. → **new 21.16**. |
| 14 | **Impersonate / log in as client** (support) | ✅ Have | `POST /api/admin/users/:userId/impersonate` (admin-only). | Beyond classic MT4; useful for support. Live verify pending (21.1). |
| 15 | **Performance / server health** | ✅ Have | `GET /api/admin/perf` → `app/admin/perf.tsx`. | Vanta-specific ops view. |

## Summary

- **Have ✅:** live positions, force-close, modify SL/TP, transaction queue, margin-call & stop-out
  monitor, exposure by symbol, reporting (account/symbol/day), impersonate, perf. — **9**
- **Partial 🟡:** account list (no equity/margin-level column), trade history (no global filtered
  blotter), balance ops (no separate credit bucket), client notifications (no operator broadcast). — **4**
- **Missing ❌:** online-users monitor, per-group spread/markup. — **2**

Core MT4-Manager intervention surface (see / force-close / modify / settle / monitor risk / report)
is **present**. The remaining gaps are operational depth (groups, presence, broadcasts, exports),
not core trading control.

## Follow-up items spawned from this checklist

These should be appended to `TODO.md` under Phase 21 (ordered by leverage; pick offline-completable
backend pieces first):

- **21.9** — Add `equity` + `margin_level_pct` columns to the admin account list (`app/admin/users.tsx`).
  Backend already returns the inputs; mostly client. *(Offline-completable.)*
- **21.10** — Global closed-trades blotter: `GET /api/admin/trades?from&to&symbol&account&reason` +
  `app/admin/trades.tsx`. Aggregate over `trades` where `status='closed'`. *(Offline unit-testable.)*
- **21.11** — Optional non-withdrawable **credit** bucket (separate from balance) + adjust UI. Needs a
  migration (`accounts.credit`) + P&L/margin rules. *(Migration — Supabase API reachable offline.)*
- **21.12** — Per-account configurable **stop-out level** (currently a single global threshold). Likely
  folds into 21.14 (groups). *(Depends on 21.14.)*
- **21.13** — **Online-users monitor:** stamp `accounts.last_seen` on authed requests + "Online now"
  admin panel. Needs a migration + middleware. *(Migration + backend.)*
- **21.14** — **Account groups** with per-group spread / markup / leverage / stop-out. Large; scope as
  its own mini-phase before estimating. *(Design first; partly network/visual.)*
- **21.15** — **Report export** (CSV/PDF) for the analytics screens. *(Offline-completable, backend.)*
- **21.16** — **Operator broadcast/direct notification** to a client or all clients from the admin UI,
  reusing the `notifications` table + push plumbing from 22.0. *(Offline unit-testable backend.)*
