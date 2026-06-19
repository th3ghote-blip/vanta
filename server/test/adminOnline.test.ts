/**
 * 21.13 — Online-users monitor.
 *
 * Covers GET /api/admin/online + the throttled stampLastSeen() presence helper:
 *   - 403 for non-admin / unauthenticated callers
 *   - lists accounts whose last_seen is within the window, newest first,
 *     stitched to display_name + is_admin, with seconds_ago
 *   - excludes accounts seen outside the window and never-seen accounts
 *   - the `minutes` param narrows the window and is clamped to 1..1440
 *   - stampLastSeen writes once then throttles, and stamps every account a
 *     user owns
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
import {
  resetDb,
  seed,
  getTable,
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
const { stampLastSeen, _resetPresence } = await import('../src/lib/presence.js');

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

function isoAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe('GET /api/admin/online (21.13)', () => {
  beforeEach(() => {
    resetDb();
    _resetPresence();
  });

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/online' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/online',
      headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('lists in-window accounts newest-first, stitches profile, excludes stale/never-seen', async () => {
    const admin = seed.user({ id: 'admin-1' });
    seed.profile({ id: admin.id, is_admin: true, display_name: 'Boss' });

    const a = seed.user({ id: 'u-a' });
    seed.profile({ id: a.id, is_admin: false, display_name: 'Alice' });
    seed.account({ id: 'acct-a', user_id: a.id, login: 80000010, balance: 5000, last_seen: isoAgo(30) });

    const b = seed.user({ id: 'u-b' });
    seed.profile({ id: b.id, is_admin: false, display_name: 'Bob' });
    seed.account({ id: 'acct-b', user_id: b.id, login: 80000011, balance: 2000, last_seen: isoAgo(120) });

    // Stale — seen 10 minutes ago (outside the default 5-min window).
    const c = seed.user({ id: 'u-c' });
    seed.profile({ id: c.id, is_admin: false, display_name: 'Carol' });
    seed.account({ id: 'acct-c', user_id: c.id, login: 80000012, balance: 999, last_seen: isoAgo(600) });

    // Never seen — no last_seen at all.
    const d = seed.user({ id: 'u-d' });
    seed.profile({ id: d.id, is_admin: false, display_name: 'Dave' });
    seed.account({ id: 'acct-d', user_id: d.id, login: 80000013, balance: 1 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/online',
      headers: authHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.window_minutes).toBe(5);
    expect(body.count).toBe(2);
    const logins = body.online.map((r: any) => r.login);
    expect(logins).toEqual([80000010, 80000011]); // newest (30s) before older (120s)
    expect(logins).not.toContain(80000012); // stale excluded
    expect(logins).not.toContain(80000013); // never-seen excluded

    const alice = body.online[0];
    expect(alice.display_name).toBe('Alice');
    expect(alice.is_admin).toBe(false);
    expect(alice.balance).toBe(5000);
    expect(alice.seconds_ago).toBeGreaterThanOrEqual(29);
    expect(alice.seconds_ago).toBeLessThanOrEqual(40);
    await app.close();
  });

  it('the minutes param narrows the window (and is clamped)', async () => {
    const admin = seed.user({ id: 'admin-2' });
    seed.profile({ id: admin.id, is_admin: true });
    const u = seed.user({ id: 'win-u' });
    seed.profile({ id: u.id, is_admin: false });
    // Seen 3 minutes ago: in a 5-min window, out of a 1-min window.
    seed.account({ id: 'win-acct', user_id: u.id, login: 80000020, last_seen: isoAgo(180) });

    const app = await buildApp();

    const wide = await app.inject({ method: 'GET', url: '/api/admin/online?minutes=5', headers: authHeaders(admin.id) });
    expect(wide.json().count).toBe(1);

    const narrow = await app.inject({ method: 'GET', url: '/api/admin/online?minutes=1', headers: authHeaders(admin.id) });
    expect(narrow.json().count).toBe(0);

    // Clamp: absurd values land in [1, 1440].
    const tooBig = await app.inject({ method: 'GET', url: '/api/admin/online?minutes=99999', headers: authHeaders(admin.id) });
    expect(tooBig.json().window_minutes).toBe(1440);
    const tooSmall = await app.inject({ method: 'GET', url: '/api/admin/online?minutes=0', headers: authHeaders(admin.id) });
    expect(tooSmall.json().window_minutes).toBe(1);
    await app.close();
  });

  it('stampLastSeen writes once, throttles the second call, and stamps all of a user\'s accounts', async () => {
    const u = seed.user({ id: 'stamp-u' });
    seed.profile({ id: u.id, is_admin: false });
    seed.account({ id: 'stamp-1', user_id: u.id, login: 80000030 });
    seed.account({ id: 'stamp-2', user_id: u.id, login: 80000031 });

    const wrote1 = await stampLastSeen(u.id);
    expect(wrote1).toBe(true);

    const accts = getTable('accounts').filter((a) => a.user_id === u.id);
    expect(accts.every((a) => typeof a.last_seen === 'string')).toBe(true); // both stamped

    // Immediate second call within the throttle window → no write.
    const wrote2 = await stampLastSeen(u.id);
    expect(wrote2).toBe(false);

    // No userId → no write.
    expect(await stampLastSeen(null)).toBe(false);

    // The just-stamped account is now visible in the online monitor.
    const admin = seed.user({ id: 'admin-3' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/online', headers: authHeaders(admin.id) });
    const logins = res.json().online.map((r: any) => r.login).sort();
    expect(logins).toContain(80000030);
    expect(logins).toContain(80000031);
    await app.close();
  });
});
