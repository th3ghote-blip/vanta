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

const ACCT = 'acct-risk-0001-0000-0000-000000000001';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
  sendPushBatch: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../src/lib/workerHealth.js', () => ({
  recordTick: vi.fn(),
}));

const { _riskInternals } = await import('../src/workers/risk.js');

async function mkApp() {
  const app = Fastify({ logger: false });
  await app.ready();
  return app;
}

// ── SL / TP tests ─────────────────────────────────────────────────────────────

describe('Risk worker — stop-loss', () => {
  beforeEach(() => {
    resetDb();
  });

  it('buy trade: mid ≤ SL → closes at SL price', async () => {
    const user = seed.user({ id: 'user-sl-buy' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 760, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 76001,
      status: 'open',
      stop_loss: 74000,
    });
    // mid = (73999 + 74001) / 2 = 74000 ≤ SL(74000) → hit
    setQuote({ symbol: 'BTCUSD', bid: 73999, ask: 74001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('closed');
    expect(t.close_price).toBe(74000);
    expect(t.reason).toBe('stopout');
  });

  it('buy trade: mid above SL → stays open', async () => {
    const user = seed.user({ id: 'user-sl-no-hit' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 760, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 76001,
      status: 'open',
      stop_loss: 74000,
    });
    // mid = 76000 > SL(74000) → no hit
    setQuote({ symbol: 'BTCUSD', bid: 75999, ask: 76001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('open');
  });

  it('sell trade: mid ≥ SL → closes', async () => {
    const user = seed.user({ id: 'user-sl-sell' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 760, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 75999,
      status: 'open',
      stop_loss: 78000,
    });
    // mid = 78000 ≥ SL(78000) for sell → hit
    setQuote({ symbol: 'BTCUSD', bid: 77999, ask: 78001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('closed');
    expect(t.close_price).toBe(78000);
    expect(t.reason).toBe('stopout');
  });
});

describe('Risk worker — take-profit', () => {
  beforeEach(() => {
    resetDb();
  });

  it('buy trade: mid ≥ TP → closes at TP price', async () => {
    const user = seed.user({ id: 'user-tp-buy' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 760, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 76001,
      status: 'open',
      take_profit: 78000,
    });
    // mid = 78000 ≥ TP(78000) → hit
    setQuote({ symbol: 'BTCUSD', bid: 77999, ask: 78001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('closed');
    expect(t.close_price).toBe(78000);
    expect(t.reason).toBe('stopout');
  });

  it('sell trade: mid ≤ TP → closes at TP price', async () => {
    const user = seed.user({ id: 'user-tp-sell' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 760, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 76001,
      status: 'open',
      take_profit: 74000,
    });
    // mid = 74000 ≤ TP(74000) for sell → hit
    setQuote({ symbol: 'BTCUSD', bid: 73999, ask: 74001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('closed');
    expect(t.close_price).toBe(74000);
  });
});

// ── Trailing stop tests ───────────────────────────────────────────────────────

describe('Risk worker — trailing stop', () => {
  beforeEach(() => {
    resetDb();
  });

  it('price rises → SL ratchets up; price pulls back below new SL → closes', async () => {
    const user = seed.user({ id: 'user-trail' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 750, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 75000,
      status: 'open',
      trail_distance: 500,
      trail_high_water: 75000,
      stop_loss: 74500,
    });

    const app = await mkApp();

    // Tick 1: price rises to 78000 → SL should ratchet to 77500, HW = 78000
    setQuote({ symbol: 'BTCUSD', bid: 77999, ask: 78001, ts: Date.now() });
    await _riskInternals.tick(app);

    const afterTick1 = getTable('trades').find((x) => x.id === trade.id)!;
    expect(afterTick1.status).toBe('open');
    expect(afterTick1.stop_loss).toBe(77500);
    expect(afterTick1.trail_high_water).toBe(78000);

    // Tick 2: price dips to 77400 → mid(77400) ≤ SL(77500) → auto-close
    setQuote({ symbol: 'BTCUSD', bid: 77399, ask: 77401, ts: Date.now() });
    await _riskInternals.tick(app);

    const afterTick2 = getTable('trades').find((x) => x.id === trade.id)!;
    expect(afterTick2.status).toBe('closed');
    expect(afterTick2.close_price).toBe(77500);
    expect(afterTick2.reason).toBe('stopout');

    await app.close();
  });

  it('trailing stop does not ratchet down when price dips (buy trade)', async () => {
    const user = seed.user({ id: 'user-trail-no-down' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 0, margin_used: 750, leverage: 100 });
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 75000,
      status: 'open',
      trail_distance: 500,
      trail_high_water: 78000,
      stop_loss: 77500, // already ratcheted up
    });

    const app = await mkApp();

    // Price dips to 77800 (but still above SL 77500) → HW stays 78000, SL stays 77500
    setQuote({ symbol: 'BTCUSD', bid: 77799, ask: 77801, ts: Date.now() });
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('open');
    // SL must not have dropped below 77500
    expect(t.stop_loss).toBe(77500);
    expect(t.trail_high_water).toBe(78000);
  });
});

// ── Stop-out tests ─────────────────────────────────────────────────────────────

describe('Risk worker — account stop-out', () => {
  beforeEach(() => {
    resetDb();
  });

  it('equity + unrealized_pnl < 0 → closes worst losing trade', async () => {
    const user = seed.user({ id: 'user-stopout' });
    seed.account({
      id: ACCT,
      user_id: user.id,
      balance: 10,
      equity: 10,
      free_margin: 0,
      margin_used: 10,
      leverage: 100,
    });

    // Sell trade going the wrong way (price rose far above open)
    // unrealized for sell: -(80000 - 76001) * 0.01 * 1 = -39.99
    // equity(10) + unrealized(-39.99) = -29.99 < 0 → stop-out triggers
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 76001,
      status: 'open',
    });

    setQuote({ symbol: 'BTCUSD', bid: 79999, ask: 80001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('closed');
    expect(t.reason).toBe('stopout');
    // Sell trade closes at ask (cost to buy back)
    expect(t.close_price).toBe(80001);
  });

  it('equity + unrealized_pnl ≥ 0 → no stop-out', async () => {
    const user = seed.user({ id: 'user-no-stopout' });
    seed.account({
      id: ACCT,
      user_id: user.id,
      balance: 10_000,
      equity: 10_000,
      free_margin: 9000,
      margin_used: 760,
      leverage: 100,
    });

    // Small loss — equity still positive
    const trade = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 76001,
      status: 'open',
    });

    // Slight dip — unrealized ≈ -10, equity(10000) + unrealized(-10) >> 0
    setQuote({ symbol: 'BTCUSD', bid: 74999, ask: 75001, ts: Date.now() });

    const app = await mkApp();
    await _riskInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === trade.id)!;
    expect(t.status).toBe('open');
  });
});
