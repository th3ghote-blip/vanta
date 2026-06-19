import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  issueToken,
} from './helpers/supabaseMock.js';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

const aiMessagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = { create: aiMessagesCreate };
    constructor(_opts?: any) {}
  }
  return { default: Anthropic };
});

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
vi.mock('../src/lib/achievements.js', () => ({
  awardAchievement: vi.fn(async () => true),
  checkFirstTrade: vi.fn(async () => {}),
  checkFiveWins: vi.fn(async () => {}),
  checkRiskMaster: vi.fn(async () => {}),
  checkBalance1000: vi.fn(async () => {}),
  checkRobotEngineer: vi.fn(async () => {}),
  // Phase 22.1
  checkVolumeMilestones: vi.fn(async () => {}),
  checkTradeCountMilestones: vi.fn(async () => {}),
  checkDiversified: vi.fn(async () => {}),
  checkProfitMilestones: vi.fn(async () => {}),
  checkGain10pct: vi.fn(async () => {}),
  checkTakeProfitPlanner: vi.fn(async () => {}),
  checkRobotMaster: vi.fn(async () => {}),
}));
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
  sendPushBatch: vi.fn(async () => ({ ok: true })),
}));

const { buildApp } = await import('./helpers/app.js');

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

describe('POST /api/robots/compile', () => {
  beforeEach(() => {
    resetDb();
    aiMessagesCreate.mockReset();
  });

  it('compiles a natural-language prompt into a valid JSON config', async () => {
    const u = seed.user({ id: 'user-1' });
    const fakeConfig = {
      kind: 'trade',
      name: 'EURUSD RSI bot',
      description: 'Buys EURUSD when RSI < 30',
      schedule: { type: 'interval', value: '300000' },
      symbols: ['EURUSD'],
      side: 'buy',
      volume: 0.01,
      conditions: [{ type: 'rsi', operator: 'lt', value: 30 }],
      risk: { stop_loss_pct: 1.0, take_profit_pct: 2.0, max_concurrent: 1 },
    };
    aiMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(fakeConfig) }],
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/robots/compile',
      headers: authHeaders(u.id),
      payload: { prompt: 'Buy EURUSD when RSI under 30, 0.01 lot, 1% stop, 2% target.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.config).toMatchObject({
      kind: 'trade',
      name: 'EURUSD RSI bot',
      symbols: ['EURUSD'],
    });
    expect(body.raw).toBe(JSON.stringify(fakeConfig));
    await app.close();
  });

  it('returns 422 compile_failed when the model emits non-JSON', async () => {
    const u = seed.user({ id: 'user-1' });
    aiMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'sorry I cannot help with that' }],
    });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/robots/compile',
      headers: authHeaders(u.id),
      payload: { prompt: 'something something' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe('compile_failed');
    await app.close();
  });

  it('returns 401 unauthorized without auth header', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/robots/compile',
      payload: { prompt: 'buy euro when rsi low' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 400 invalid_input on prompt < 5 chars', async () => {
    const u = seed.user({ id: 'user-1' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/robots/compile',
      headers: authHeaders(u.id),
      payload: { prompt: 'hi' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 500 ai_error when the Anthropic SDK throws', async () => {
    const u = seed.user({ id: 'user-1' });
    aiMessagesCreate.mockRejectedValueOnce(new Error('upstream down'));
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/robots/compile',
      headers: authHeaders(u.id),
      payload: { prompt: 'a long enough prompt please' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error).toBe('ai_error');
    await app.close();
  });
});
