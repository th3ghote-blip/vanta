/**
 * 18.8e/18.8f — manager-panel Deposits & Withdrawals slices.
 *
 * Covers GET /api/admin/transactions:
 *   - 403 for unauthenticated / non-admin callers
 *   - status filter (existing 4.3 behaviour) still narrows the set
 *   - NEW type filter (deposit|withdrawal|bonus|adjustment) returns just that slice,
 *     so the admin Deposits page can request type=deposit and the Withdrawals page
 *     type=withdrawal without client-side filtering
 *   - status + type compose (e.g. pending withdrawals only)
 *   - an unknown/garbage type is ignored (whitelist guard) — full set, not an error
 *   - each row carries the embedded account (balance shown next to the request)
 *
 * Approve/reject already exist generically (4.3) and branch on tx.type, so no new
 * write routes are needed for deposit vs withdrawal — only the read slice was missing.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
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

vi.mock('../src/lib/supabase.js', () => ({
  supabaseAdmin: mockSupa,
  authUser: mockAuthUser,
}));

const { buildApp } = await import('./helpers/app.js');

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

/**
 * Deterministic fixture (account acct-1, balance 5000):
 *   d1 deposit    / pending   / 100
 *   d2 deposit    / completed / 200
 *   w1 withdrawal / pending   / 50
 *   w2 withdrawal / rejected  / 75
 *   b1 bonus      / completed / 10
 * Total = 5: deposits 2, withdrawals 2, bonus 1; pending 2 (d1, w1).
 */
function seedFixture() {
  const admin = seed.user({ id: 'admin-x' });
  seed.profile({ id: admin.id, is_admin: true });
  const u = seed.user({ id: 'trader-a' });
  seed.account({ id: 'acct-1', user_id: u.id, login: 80001234, balance: 5000 });

  seed.transaction({ id: 'd1', account_id: 'acct-1', type: 'deposit', status: 'pending', amount: 100 });
  seed.transaction({ id: 'd2', account_id: 'acct-1', type: 'deposit', status: 'completed', amount: 200 });
  seed.transaction({ id: 'w1', account_id: 'acct-1', type: 'withdrawal', status: 'pending', amount: 50 });
  seed.transaction({ id: 'w2', account_id: 'acct-1', type: 'withdrawal', status: 'rejected', amount: 75 });
  seed.transaction({ id: 'b1', account_id: 'acct-1', type: 'bonus', status: 'completed', amount: 10 });

  return { admin, u };
}

describe('GET /api/admin/transactions (18.8e/18.8f)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    resetDb();
  });

  it('403s for an unauthenticated caller', async () => {
    seedFixture();
    const res = await app.inject({ method: 'GET', url: '/api/admin/transactions' });
    expect(res.statusCode).toBe(403);
  });

  it('403s for a non-admin caller', async () => {
    const u = seed.user({ id: 'plain' });
    seed.profile({ id: u.id, is_admin: false });
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions',
      headers: authHeaders(u.id),
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns the full set with embedded account info', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions?status=all',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.transactions).toHaveLength(5);
    // account is embedded so the Withdrawals page can show balance next to the ask
    const w1 = body.transactions.find((t: any) => t.id === 'w1');
    expect(w1.accounts.balance).toBe(5000);
    expect(w1.accounts.user_id).toBe('trader-a');
  });

  it('filters by status (pending)', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions?status=pending',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions.every((t: any) => t.status === 'pending')).toBe(true);
    expect(body.transactions.map((t: any) => t.id).sort()).toEqual(['d1', 'w1']);
  });

  it('filters by type=deposit (Deposits page slice)', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions?status=all&type=deposit',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions.every((t: any) => t.type === 'deposit')).toBe(true);
    expect(body.transactions.map((t: any) => t.id).sort()).toEqual(['d1', 'd2']);
  });

  it('filters by type=withdrawal (Withdrawals page slice)', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions?status=all&type=withdrawal',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions.every((t: any) => t.type === 'withdrawal')).toBe(true);
    expect(body.transactions.map((t: any) => t.id).sort()).toEqual(['w1', 'w2']);
  });

  it('composes status + type (pending withdrawals only)', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions?status=pending&type=withdrawal',
      headers: authHeaders(admin.id),
    });
    const body = res.json();
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0].id).toBe('w1');
  });

  it('ignores an unknown/garbage type (whitelist guard) — returns full set', async () => {
    const { admin } = seedFixture();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/transactions?status=all&type=__nope__',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.transactions).toHaveLength(5);
  });
});
