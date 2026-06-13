import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
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

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));

const { buildApp } = await import('./helpers/app.js');

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

describe('POST /api/account/risk-accept (18.10)', () => {
  beforeEach(() => {
    resetDb();
  });

  it('rejects unauthenticated requests (401)', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/account/risk-accept',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('records risk_accepted_at and returns it for an authed user', async () => {
    const user = seed.user();
    seed.profile({ id: user.id });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/account/risk-accept',
      headers: authHeaders(user.id),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { risk_accepted_at: string };
    expect(body.risk_accepted_at).toBeTruthy();
    // No exception thrown parsing → it's a valid ISO timestamp.
    expect(Number.isNaN(Date.parse(body.risk_accepted_at))).toBe(false);

    // Persisted to the profile row.
    const profile = getTable('profiles').find((p) => p.id === user.id) as
      | { risk_accepted_at?: string }
      | undefined;
    expect(profile?.risk_accepted_at).toBe(body.risk_accepted_at);
  });
});
