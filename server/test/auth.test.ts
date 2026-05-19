import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  resetDb,
  seed,
  supabaseAdmin as mockSupa,
  authUser as mockAuthUser,
  issueToken,
  getTable,
} from './helpers/supabaseMock.js';

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://localhost:0/fake';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.ANTHROPIC_API_KEY = 'fake-anthropic-key';
});

// Mock supabase BEFORE app.ts is imported.
vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));
// Achievements: fire-and-forget, no-op for tests
vi.mock('../src/lib/achievements.js', () => ({
  awardAchievement: vi.fn(async () => true),
  checkFirstTrade: vi.fn(async () => {}),
  checkFiveWins: vi.fn(async () => {}),
  checkRiskMaster: vi.fn(async () => {}),
  checkBalance1000: vi.fn(async () => {}),
  checkRobotEngineer: vi.fn(async () => {}),
}));
// Push: fire-and-forget, no-op for tests
vi.mock('../src/lib/push.js', () => ({
  sendPush: vi.fn(async () => ({ ok: true })),
  sendPushChecked: vi.fn(async () => ({ ok: true })),
  sendPushBatch: vi.fn(async () => ({ ok: true })),
}));

const { buildApp } = await import('./helpers/app.js');

describe('POST /api/auth/register', () => {
  beforeEach(() => resetDb());

  it('creates a user, returns a login + session, auto-creates an account row', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.login).toBeTypeOf('number');
    expect(body.password).toBeTypeOf('string');
    expect(body.password.length).toBeGreaterThanOrEqual(8);
    expect(body.session.access_token).toMatch(/^token-for-/);
    // Account auto-created by mocked createUser path
    expect(getTable('accounts').length).toBe(1);
    await app.close();
  });

  it('accepts an optional contactEmail', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { contactEmail: 'a@b.com' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('rejects malformed contactEmail with 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { contactEmail: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => resetDb());

  it('logs in with correct credentials and returns a session', async () => {
    const u = seed.user({ id: 'user-1', email: '80000001@vanta.account', password: 'secret' });
    seed.profile({ id: u.id, login_streak: 0 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 80000001, password: 'secret' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.session.user_id).toBe(u.id);
    expect(body.login_streak).toBeGreaterThanOrEqual(1);
    await app.close();
  });

  it('returns 401 on wrong password', async () => {
    seed.user({ id: 'user-1', email: '80000001@vanta.account', password: 'right' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 80000001, password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_credentials');
    await app.close();
  });

  it('returns 401 for unknown login number', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 99999999, password: 'anything' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('extends login_streak when last_login_date was yesterday', async () => {
    const u = seed.user({ id: 'user-1', email: '80000001@vanta.account', password: 'secret' });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    seed.profile({ id: u.id, last_login_date: yesterday, login_streak: 3 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 80000001, password: 'secret' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().login_streak).toBe(4);
    await app.close();
  });

  it('resets login_streak to 1 after a gap > 1 day', async () => {
    const u = seed.user({ id: 'user-1', email: '80000001@vanta.account', password: 'secret' });
    seed.profile({ id: u.id, last_login_date: '2020-01-01', login_streak: 10 });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 80000001, password: 'secret' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().login_streak).toBe(1);
    await app.close();
  });
});

describe('POST /api/auth/change-password', () => {
  beforeEach(() => resetDb());

  it('rejects requests without an Authorization header (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { newPassword: 'new-strong-pw' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('changes the password for an authenticated user', async () => {
    const u = seed.user({ id: 'user-1', email: '80000001@vanta.account', password: 'old' });
    const token = issueToken(u.id);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { newPassword: 'new-stronger' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    await app.close();
  });

  it('rejects passwords shorter than 8 chars with 400', async () => {
    const u = seed.user({ id: 'user-1', email: '80000001@vanta.account', password: 'old' });
    const token = issueToken(u.id);
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: `Bearer ${token}` },
      payload: { newPassword: 'short' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
