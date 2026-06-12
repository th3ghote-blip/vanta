import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  getTable,
} from './helpers/supabaseMock.js';
import { setQuote } from '../src/lib/quoteCache.js';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

const sendPushMock = vi.fn(async () => true);

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: sendPushMock,
  sendPushBatch: vi.fn(async () => {}),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
}));

const { _robotInternals } = await import('../src/ai/robotEngine.js');
const { shouldFire, matchesCron, processRobot, openRobotTrade, tick } = _robotInternals;

const ACCT = 'acct-robot-0001';

async function mkApp() {
  const app = Fastify({ logger: false });
  await app.ready();
  return app;
}

// Build a robot object the way the engine sees it (robot row + embedded account).
function mkRobot(over: any = {}) {
  const account = over.accounts ?? getTable('accounts').find((a) => a.id === ACCT);
  return {
    id: over.id ?? 'robot-x',
    user_id: over.user_id ?? 'user-robot',
    account_id: over.account_id ?? ACCT,
    status: over.status ?? 'active',
    name: over.name ?? 'Test Robot',
    total_trades: over.total_trades ?? 0,
    last_run_at: over.last_run_at ?? null,
    accounts: account,
    config: over.config ?? {},
  };
}

// ── shouldFire — interval ──────────────────────────────────────────────────────
describe('shouldFire — interval', () => {
  it('fires when now - last_run >= interval', () => {
    const now = new Date();
    const lastRun = new Date(now.getTime() - 120_000).toISOString(); // 2 min ago
    const sched = { type: 'interval', value: 60_000 };               // 1 min interval
    expect(shouldFire('r-int-fire', sched, lastRun, now)).toBe(true);
  });

  it('does not fire when called too soon', () => {
    const now = new Date();
    const lastRun = new Date(now.getTime() - 10_000).toISOString();   // 10s ago
    const sched = { type: 'interval', value: 60_000 };
    expect(shouldFire('r-int-soon', sched, lastRun, now)).toBe(false);
  });

  it('returns false for a zero / missing interval', () => {
    const now = new Date();
    expect(shouldFire('r-int-zero', { type: 'interval', value: 0 }, null, now)).toBe(false);
    expect(shouldFire('r-int-none', { type: 'interval' }, null, now)).toBe(false);
  });
});

// ── shouldFire — cron ───────────────────────────────────────────────────────────
describe('shouldFire — cron "0 9 * * 1-5"', () => {
  const sched = { type: 'cron', value: '0 9 * * 1-5' };

  it('fires at 09:00 UTC on a weekday (Mon)', () => {
    const mon0900 = new Date('2026-06-01T09:00:00Z'); // Monday
    expect(mon0900.getUTCDay()).toBe(1);
    expect(shouldFire('r-cron-1', sched, null, mon0900)).toBe(true);
    expect(matchesCron('0 9 * * 1-5', mon0900)).toBe(true);
  });

  it('does not fire at 09:01 (minute mismatch)', () => {
    const mon0901 = new Date('2026-06-01T09:01:00Z');
    expect(shouldFire('r-cron-2', sched, null, mon0901)).toBe(false);
  });

  it('does not fire on Saturday', () => {
    const sat0900 = new Date('2026-06-06T09:00:00Z'); // Saturday
    expect(sat0900.getUTCDay()).toBe(6);
    expect(shouldFire('r-cron-3', sched, null, sat0900)).toBe(false);
  });
});

// ── shouldFire — defensive ──────────────────────────────────────────────────────
describe('shouldFire — defensive', () => {
  it('returns false for missing/unknown schedule type', () => {
    const now = new Date();
    expect(shouldFire('r-def-1', {}, null, now)).toBe(false);
    expect(shouldFire('r-def-2', { type: 'banana', value: 'x' }, null, now)).toBe(false);
  });
});

// ── processRobot — trade (always) ───────────────────────────────────────────────
describe('processRobot — active trade robot with "always" condition', () => {
  beforeEach(() => {
    resetDb();
    sendPushMock.mockClear();
  });

  it('opens a trade, logs robot_runs, increments total_trades', async () => {
    seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000, margin_used: 0, leverage: 100 });
    getTable('robots').push({ id: 'robot-always', account_id: ACCT, total_trades: 0 } as any);
    setQuote({ symbol: 'BTCUSD', bid: 69999, ask: 70000, ts: Date.now() });

    const robot = mkRobot({
      id: 'robot-always',
      total_trades: 0,
      last_run_at: new Date(Date.now() - 120_000).toISOString(),
      config: {
        schedule: { type: 'interval', value: 60_000 },
        kind: 'trade',
        symbols: ['BTCUSD'],
        side: 'buy',
        volume: 0.01,
        conditions: [{ type: 'always' }],
      },
    });

    const app = await mkApp();
    await processRobot(app, robot, new Date());
    await app.close();

    const trades = getTable('trades').filter((t) => t.account_id === ACCT);
    expect(trades).toHaveLength(1);
    expect(trades[0].reason).toBe('robot');
    expect(trades[0].symbol).toBe('BTCUSD');
    expect(trades[0].side).toBe('buy');
    expect(trades[0].volume).toBe(0.01);
    expect(trades[0].open_price).toBe(70000); // buy → ask

    const runs = getTable('robot_runs');
    expect(runs).toHaveLength(1);
    expect(runs[0].action).toBe('trade_opened');
    expect(runs[0].trade_id).toBe(trades[0].id);

    const robotRow = getTable('robots').find((r) => r.id === 'robot-always')!;
    expect(robotRow.total_trades).toBe(1);
    expect(robotRow.last_run_at).toBeTruthy();
  });

  it('respects max_concurrent=1 — skips opening a second trade', async () => {
    seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000, margin_used: 0, leverage: 100 });
    // one open robot trade already exists
    seed.trade({ account_id: ACCT, symbol: 'BTCUSD', side: 'buy', volume: 0.01, status: 'open', reason: 'robot' });
    setQuote({ symbol: 'BTCUSD', bid: 69999, ask: 70000, ts: Date.now() });

    const robot = mkRobot({
      id: 'robot-maxconc',
      last_run_at: new Date(Date.now() - 120_000).toISOString(),
      config: {
        schedule: { type: 'interval', value: 60_000 },
        kind: 'trade',
        symbols: ['BTCUSD'],
        side: 'buy',
        volume: 0.01,
        conditions: [{ type: 'always' }],
        risk: { max_concurrent: 1 },
      },
    });

    const app = await mkApp();
    await processRobot(app, robot, new Date());
    await app.close();

    // no NEW trade — still just the pre-seeded one
    const robotTrades = getTable('trades').filter((t) => t.account_id === ACCT && t.reason === 'robot');
    expect(robotTrades).toHaveLength(1);

    const runs = getTable('robot_runs');
    expect(runs).toHaveLength(1);
    expect(runs[0].action).toBe('trade_failed');
    expect(runs[0].notes).toContain('max_concurrent');
  });

  it('tip robot persists an in-app notification, best-effort pushes, opens no trade', async () => {
    seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000, margin_used: 0, leverage: 100 });
    getTable('robots').push({ id: 'robot-tip', account_id: ACCT, total_trades: 0 } as any);

    const robot = mkRobot({
      id: 'robot-tip',
      user_id: 'user-robot',
      name: 'Morning Tipper',
      last_run_at: new Date(Date.now() - 120_000).toISOString(),
      config: {
        schedule: { type: 'interval', value: 60_000 },
        kind: 'tip',
        tip_text: 'Watch BTC support at 68k',
        conditions: [{ type: 'always' }],
      },
    });

    const app = await mkApp();
    await processRobot(app, robot, new Date());
    await app.close();

    // In-app notification is the source of truth (works on web + mobile)
    const notes = getTable('notifications');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ user_id: 'user-robot', kind: 'robot_tip', body: 'Watch BTC support at 68k' });

    // Push is a best-effort bonus
    expect(sendPushMock).toHaveBeenCalledTimes(1);
    expect(sendPushMock.mock.calls[0][0]).toBe('user-robot');

    expect(getTable('trades')).toHaveLength(0);
    const runs = getTable('robot_runs');
    expect(runs).toHaveLength(1);
    expect(runs[0].action).toBe('tip');
  });

  it('price_move_pct condition: no fire until the symbol moves enough', async () => {
    seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000, margin_used: 0, leverage: 100 });
    getTable('robots').push({ id: 'robot-move', account_id: ACCT, total_trades: 0 } as any);

    const robot = mkRobot({
      id: 'robot-move',
      user_id: 'user-robot',
      name: 'BTC 3% Mover',
      last_run_at: new Date(Date.now() - 120_000).toISOString(),
      config: {
        schedule: { type: 'interval', value: 60_000 },
        kind: 'tip',
        symbols: ['BTCUSD'],
        tip_text: 'BTC moved 3%',
        conditions: [{ type: 'price_move_pct', pct: 3 }],
      },
    });

    const app = await mkApp();
    // Tick 1: sets the baseline, no alert.
    await processRobot(app, robot, new Date());
    expect(getTable('notifications')).toHaveLength(0);

    // Tick 2 (mocked quote unchanged) → still under threshold, no alert.
    await processRobot(app, robot, new Date());
    expect(getTable('notifications')).toHaveLength(0);
    await app.close();
  });
});

// ── openRobotTrade — direct ─────────────────────────────────────────────────────
describe('openRobotTrade', () => {
  beforeEach(() => resetDb());

  it('inserts a trade with reason=robot and the right symbol/side/volume', async () => {
    const account = seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000, margin_used: 0, leverage: 100 });
    setQuote({ symbol: 'BTCUSD', bid: 69990, ask: 70010, ts: Date.now() });

    const robot = mkRobot({
      id: 'robot-direct',
      accounts: account,
      config: { symbols: ['BTCUSD'], side: 'sell', volume: 0.02 },
    });

    const app = await mkApp();
    const res = await openRobotTrade(app, robot);
    await app.close();

    expect(res.ok).toBe(true);
    expect(res.tradeId).toBeTruthy();
    expect(res.price).toBe(69990); // sell → bid

    const t = getTable('trades').find((x) => x.id === res.tradeId)!;
    expect(t.reason).toBe('robot');
    expect(t.symbol).toBe('BTCUSD');
    expect(t.side).toBe('sell');
    expect(t.volume).toBe(0.02);
  });

  it('fails when there is no quote for the symbol', async () => {
    const account = seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000 });
    const robot = mkRobot({ id: 'robot-noquote', accounts: account, config: { symbols: ['NOPEUSD'], side: 'buy', volume: 0.01 } });

    const app = await mkApp();
    const res = await openRobotTrade(app, robot);
    await app.close();

    expect(res.ok).toBe(false);
    expect(res.error).toContain('no_quote');
    expect(getTable('trades')).toHaveLength(0);
  });
});

// ── tick — paused robots never fire ─────────────────────────────────────────────
describe('tick — status filter', () => {
  beforeEach(() => {
    resetDb();
    sendPushMock.mockClear();
  });

  it('processes active robots but never a paused one', async () => {
    seed.account({ id: ACCT, user_id: 'user-robot', free_margin: 10_000_000, margin_used: 0, leverage: 100 });
    setQuote({ symbol: 'BTCUSD', bid: 69999, ask: 70000, ts: Date.now() });

    const baseConfig = {
      schedule: { type: 'interval', value: 60_000 },
      kind: 'trade',
      symbols: ['BTCUSD'],
      side: 'buy',
      volume: 0.01,
      conditions: [{ type: 'always' }],
    };
    getTable('robots').push({
      id: 'robot-active', account_id: ACCT, status: 'active', total_trades: 0,
      last_run_at: new Date(Date.now() - 120_000).toISOString(), config: baseConfig,
    } as any);
    getTable('robots').push({
      id: 'robot-paused', account_id: ACCT, status: 'paused', total_trades: 0,
      last_run_at: new Date(Date.now() - 120_000).toISOString(), config: baseConfig,
    } as any);

    const app = await mkApp();
    await tick(app);
    await app.close();

    const runs = getTable('robot_runs');
    expect(runs.some((r) => r.robot_id === 'robot-active')).toBe(true);
    expect(runs.some((r) => r.robot_id === 'robot-paused')).toBe(false);
  });
});
