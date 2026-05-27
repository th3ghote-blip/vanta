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

const ACCT = 'acct-trig-0001-0000-0000-000000000001';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
vi.mock('../src/lib/workerHealth.js', () => ({
  recordTick: vi.fn(),
}));

const { _ordersTriggerInternals } = await import('../src/workers/ordersTrigger.js');

async function mkApp() {
  const app = Fastify({ logger: false });
  await app.ready();
  return app;
}

// ── Limit orders ──────────────────────────────────────────────────────────────

describe('Orders trigger — limit', () => {
  beforeEach(() => {
    resetDb();
  });

  it('buy-limit: ask drops to trigger → flips to open at trigger_price', async () => {
    const user = seed.user({ id: 'user-lim-1' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 760, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 74000,
    });
    // buy-limit fills when ask ≤ trigger → ask=74000 ≤ 74000 → fill
    setQuote({ symbol: 'BTCUSD', bid: 73999, ask: 74000, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('open');
    expect(t.open_price).toBe(74000);
  });

  it('buy-limit: ask still above trigger → stays pending', async () => {
    const user = seed.user({ id: 'user-lim-2' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 760, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 74000,
    });
    // ask=74100 > trigger(74000) → no fill
    setQuote({ symbol: 'BTCUSD', bid: 74099, ask: 74100, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('pending');
  });

  it('sell-limit: bid rises to trigger → flips to open', async () => {
    const user = seed.user({ id: 'user-lim-3' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 760, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 79000,
    });
    // sell-limit fills when bid ≥ trigger → bid=79000 ≥ 79000 → fill
    setQuote({ symbol: 'BTCUSD', bid: 79000, ask: 79001, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('open');
    expect(t.open_price).toBe(79000);
  });
});

// ── Stop orders ───────────────────────────────────────────────────────────────

describe('Orders trigger — stop', () => {
  beforeEach(() => {
    resetDb();
  });

  it('sell-stop: bid drops to/below trigger → flips to open at trigger_price', async () => {
    const user = seed.user({ id: 'user-stop-1' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 760, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'stop',
      trigger_price: 78000,
    });
    // sell-stop fires when bid ≤ trigger → bid=77999 ≤ 78000 → fill
    setQuote({ symbol: 'BTCUSD', bid: 77999, ask: 78001, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('open');
    expect(t.open_price).toBe(78000); // fills at trigger_price
  });

  it('buy-stop: ask rises to/above trigger → flips to open', async () => {
    const user = seed.user({ id: 'user-stop-2' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 760, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'stop',
      trigger_price: 80000,
    });
    // buy-stop fires when ask ≥ trigger → ask=80001 ≥ 80000 → fill
    setQuote({ symbol: 'BTCUSD', bid: 79999, ask: 80001, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('open');
    expect(t.open_price).toBe(80000);
  });
});

// ── Stop-limit orders ─────────────────────────────────────────────────────────

describe('Orders trigger — stop_limit', () => {
  beforeEach(() => {
    resetDb();
  });

  it('stop fires but limit not yet hit → converts to plain limit order', async () => {
    const user = seed.user({ id: 'user-sl-1' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 0, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'stop_limit',
      trigger_price: 76000,
      limit_price: 76100,
    });
    // buy stop_limit: stop fires when ask ≥ trigger(76000) → ask=76200 ✓
    // limit fires when ask ≤ limit_price(76100) → ask=76200 > 76100 → not yet
    // result: convert_to_limit
    setQuote({ symbol: 'BTCUSD', bid: 76199, ask: 76200, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('pending');       // still waiting
    expect(t.order_type).toBe('limit');     // converted to plain limit
    expect(t.trigger_price).toBe(76100);    // trigger is now limit_price
  });

  it('stop fires and limit immediately hit → fills at limit_price', async () => {
    const user = seed.user({ id: 'user-sl-2' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 0, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'stop_limit',
      trigger_price: 76000,
      limit_price: 76100,
    });
    // stop fires (ask=76050 ≥ 76000) and limit immediately met (76050 ≤ 76100) → fill
    setQuote({ symbol: 'BTCUSD', bid: 76049, ask: 76050, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('open');
    expect(t.open_price).toBe(76100); // filled at limit_price, not trigger
  });

  it('stop not yet reached → stays pending', async () => {
    const user = seed.user({ id: 'user-sl-3' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 0, leverage: 100 });
    const order = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'stop_limit',
      trigger_price: 76000,
      limit_price: 76100,
    });
    // ask=75999 < trigger(76000) → stop not fired
    setQuote({ symbol: 'BTCUSD', bid: 75998, ask: 75999, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const t = getTable('trades').find((x) => x.id === order.id)!;
    expect(t.status).toBe('pending');
    expect(t.order_type).toBe('stop_limit'); // unchanged
  });
});

// ── OCO orders ────────────────────────────────────────────────────────────────

describe('Orders trigger — OCO', () => {
  beforeEach(() => {
    resetDb();
  });

  it('when one OCO order fills, its sibling is cancelled', async () => {
    const user = seed.user({ id: 'user-oco' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 0, leverage: 100 });
    const ocoGroupId = 'oco-group-test-001';

    // Bracket: buy-limit at 74000 OR sell-limit at 79000 (take one side, cancel other)
    const buyOrder = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 74000,
      oco_group_id: ocoGroupId,
    });
    const sellOrder = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 79000,
      oco_group_id: ocoGroupId,
    });

    // Price drops to 74000: buy-limit fills (ask=74000 ≤ 74000)
    // sell-limit does NOT fire (bid=73999 < 79000)
    setQuote({ symbol: 'BTCUSD', bid: 73999, ask: 74000, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const buy = getTable('trades').find((x) => x.id === buyOrder.id)!;
    const sell = getTable('trades').find((x) => x.id === sellOrder.id)!;

    expect(buy.status).toBe('open');        // filled
    expect(sell.status).toBe('cancelled');  // OCO sibling cancelled
  });

  it('neither OCO order fires → both stay pending', async () => {
    const user = seed.user({ id: 'user-oco-2' });
    seed.account({ id: ACCT, user_id: user.id, free_margin: 5000, margin_used: 0, leverage: 100 });
    const ocoGroupId = 'oco-group-test-002';

    const buyOrder = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'buy',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 74000,
      oco_group_id: ocoGroupId,
    });
    const sellOrder = seed.trade({
      account_id: ACCT,
      symbol: 'BTCUSD',
      side: 'sell',
      volume: 0.01,
      open_price: 0,
      status: 'pending',
      order_type: 'limit',
      trigger_price: 79000,
      oco_group_id: ocoGroupId,
    });

    // Flat market — neither fires
    setQuote({ symbol: 'BTCUSD', bid: 76000, ask: 76001, ts: Date.now() });

    const app = await mkApp();
    await _ordersTriggerInternals.tick(app);
    await app.close();

    const buy = getTable('trades').find((x) => x.id === buyOrder.id)!;
    const sell = getTable('trades').find((x) => x.id === sellOrder.id)!;

    expect(buy.status).toBe('pending');
    expect(sell.status).toBe('pending');
  });
});
