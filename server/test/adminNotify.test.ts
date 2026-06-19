/**
 * 21.16 — Operator broadcast / direct client notification.
 *
 * Covers POST /api/admin/notify:
 *   - 403 for unauthenticated / non-admin callers
 *   - 400 invalid_input when title/body are missing or blank
 *   - single-account targeting by login → one notifications row for that owner
 *   - 404 account_not_found for an unknown login
 *   - 400 missing_target when audience=account but neither login nor userId given
 *   - targeting by explicit userId
 *   - audience=all → one row per distinct client (deduped by user_id)
 *   - persisted rows carry kind='system', title, body, and broadcast flag
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

function authHeaders(userId: string) {
  return { authorization: `Bearer ${issueToken(userId)}` };
}

function post(app: any, payload: any, userId?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/admin/notify',
    headers: userId ? authHeaders(userId) : undefined,
    payload,
  });
}

describe('POST /api/admin/notify (21.16)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await post(app, { title: 'Hi', body: 'There', audience: 'all' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const u = seed.user();
    seed.profile({ id: u.id, is_admin: false });
    const app = await buildApp();
    const res = await post(app, { title: 'Hi', body: 'There', audience: 'all' }, u.id);
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 400 invalid_input when title/body are missing or blank', async () => {
    const admin = seed.user({ id: 'admin-1' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();

    const r1 = await post(app, { body: 'no title', audience: 'all' }, admin.id);
    expect(r1.statusCode).toBe(400);
    expect(r1.json().error).toBe('invalid_input');

    const r2 = await post(app, { title: '   ', body: '   ', audience: 'all' }, admin.id);
    expect(r2.statusCode).toBe(400);
    await app.close();
  });

  it('targets a single account by login and persists one system notification', async () => {
    const admin = seed.user({ id: 'admin-2' });
    seed.profile({ id: admin.id, is_admin: true });
    const client = seed.user({ id: 'client-a' });
    seed.profile({ id: client.id, is_admin: false });
    seed.account({ id: 'acct-a', user_id: client.id, login: 80000010 });

    const app = await buildApp();
    const res = await post(
      app,
      { title: 'Margin call', body: 'Top up your account', audience: 'account', login: 80000010 },
      admin.id,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.audience).toBe('account');
    expect(body.recipients).toBe(1);

    const notifs = getTable('notifications');
    expect(notifs.length).toBe(1);
    const n = notifs[0];
    expect(n.user_id).toBe('client-a');
    expect(n.kind).toBe('system');
    expect(n.title).toBe('Margin call');
    expect(n.body).toBe('Top up your account');
    expect(n.data?.broadcast).toBe(false);
    expect(n.data?.from_admin).toBe('admin-2');
    await app.close();
  });

  it('returns 404 account_not_found for an unknown login', async () => {
    const admin = seed.user({ id: 'admin-3' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();
    const res = await post(
      app,
      { title: 'Hi', body: 'There', audience: 'account', login: 99999999 },
      admin.id,
    );
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('account_not_found');
    expect(getTable('notifications').length).toBe(0);
    await app.close();
  });

  it('returns 400 missing_target when audience=account with no login or userId', async () => {
    const admin = seed.user({ id: 'admin-4' });
    seed.profile({ id: admin.id, is_admin: true });
    const app = await buildApp();
    const res = await post(app, { title: 'Hi', body: 'There', audience: 'account' }, admin.id);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('missing_target');
    await app.close();
  });

  it('targets a single client by explicit userId', async () => {
    const admin = seed.user({ id: 'admin-5' });
    seed.profile({ id: admin.id, is_admin: true });
    const client = seed.user({ id: '11111111-1111-1111-1111-111111111111' });
    seed.profile({ id: client.id, is_admin: false });

    const app = await buildApp();
    const res = await post(
      app,
      { title: 'Direct', body: 'message', audience: 'account', userId: client.id },
      admin.id,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().recipients).toBe(1);
    const notifs = getTable('notifications');
    expect(notifs.length).toBe(1);
    expect(notifs[0].user_id).toBe(client.id);
    await app.close();
  });

  it('audience=all sends one notification per distinct client', async () => {
    const admin = seed.user({ id: 'admin-6' });
    seed.profile({ id: admin.id, is_admin: true });
    const a = seed.user({ id: 'cli-1' }); seed.profile({ id: a.id, is_admin: false });
    const b = seed.user({ id: 'cli-2' }); seed.profile({ id: b.id, is_admin: false });
    const c = seed.user({ id: 'cli-3' }); seed.profile({ id: c.id, is_admin: false });
    // cli-3 owns two accounts — must still get exactly one notification.
    seed.account({ id: 'acct-1', user_id: a.id, login: 80000001 });
    seed.account({ id: 'acct-2', user_id: b.id, login: 80000002 });
    seed.account({ id: 'acct-3a', user_id: c.id, login: 80000003 });
    seed.account({ id: 'acct-3b', user_id: c.id, login: 80000004 });

    const app = await buildApp();
    const res = await post(app, { title: 'Maintenance', body: 'Down at 2am', audience: 'all' }, admin.id);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.audience).toBe('all');
    // 4 profiles total (admin + 3 clients) — all profiles are recipients.
    expect(body.recipients).toBe(4);

    const notifs = getTable('notifications');
    expect(notifs.length).toBe(4);
    // exactly one per distinct user_id
    const ids = notifs.map((n: any) => n.user_id).sort();
    expect(ids).toEqual(['admin-6', 'cli-1', 'cli-2', 'cli-3']);
    expect(notifs.every((n: any) => n.kind === 'system' && n.data?.broadcast === true)).toBe(true);
    await app.close();
  });
});
