/**
 * 21.15 — Analytics CSV export (admin "Report export").
 *
 * Covers `?format=csv` on the three analytics endpoints:
 *   - 403 for unauthenticated / non-admin callers
 *   - text/csv content-type + attachment Content-Disposition with a dated name
 *   - header row + one data row per item, values reconciling cell-for-cell with
 *     the SAME endpoint's JSON payload (i.e. the export matches the on-screen rows)
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
import { csvCell } from '../src/lib/csv.js';

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

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Parse CSV body into a header row + data rows, honoring quoted fields. */
function parseCsv(body: string): { header: string[]; rows: string[][] } {
  const lines = body.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const [h, ...rest] = lines;
  return { header: parseLine(h), rows: rest.map(parseLine) };
}

/** Rebuild the expected CSV cells for a JSON row given column keys. */
function expectedCells(jsonRow: any, keys: string[]): string[] {
  return keys.map((k) => csvCell(jsonRow[k]));
}

describe('Analytics CSV export (21.15)', () => {
  beforeEach(() => resetDb());

  it('rejects unauthenticated callers (403)', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/by-symbol?format=csv' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects non-admin users (403)', async () => {
    const user = seed.user();
    seed.profile({ id: user.id, is_admin: false });
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/admin/analytics/accounts?format=csv', headers: authHeaders(user.id),
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('by-symbol CSV reconciles cell-for-cell with the JSON payload', async () => {
    const admin = seed.user({ id: 'admin-x' });
    seed.profile({ id: admin.id, is_admin: true });
    const acct = seed.account({ id: 'acct-A', user_id: admin.id, login: 80001234 });
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01,
      open_price: 70000, close_price: 70500, status: 'closed', profit: 50,
      open_time: iso(2 * HOUR), close_time: iso(HOUR) });
    seed.trade({ account_id: acct.id, symbol: 'ETHUSD', side: 'sell', volume: 0.1,
      open_price: 2000, status: 'open', open_time: iso(30 * MIN) });

    const app = await buildApp();
    const jsonRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/by-symbol?window=all', headers: authHeaders(admin.id),
    });
    const csvRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/by-symbol?window=all&format=csv', headers: authHeaders(admin.id),
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(String(csvRes.headers['content-disposition'])).toMatch(
      /attachment; filename="vanta-analytics-by-symbol-all-\d{4}-\d{2}-\d{2}\.csv"/,
    );

    const keys = ['symbol','trade_count','open_count','closed_count','volume_lots','volume_notional',
      'open_buy_lots','open_sell_lots','net_open_lots','net_open_notional','realized_client_pnl',
      'realized_house_pnl','win_rate','avg_hold_seconds','over_exposure'];
    const { header, rows } = parseCsv(csvRes.body);
    expect(header).toEqual(keys);

    const symbols = (jsonRes.json() as any).symbols as any[];
    expect(rows).toHaveLength(symbols.length);
    // each CSV row matches its JSON symbol row, in the same order
    symbols.forEach((srow, i) => {
      expect(rows[i]).toEqual(expectedCells(srow, keys));
    });
    await app.close();
  });

  it('overview CSV has one row per day and matches the series', async () => {
    const admin = seed.user({ id: 'admin-o' });
    seed.profile({ id: admin.id, is_admin: true, created_at: iso(0) });
    const acct = seed.account({ id: 'acct-O', user_id: admin.id, login: 80002222 });
    seed.trade({ account_id: acct.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01,
      open_price: 70000, close_price: 70500, status: 'closed', profit: 50,
      open_time: iso(2 * HOUR), close_time: iso(HOUR) });
    seed.transaction({ account_id: acct.id, type: 'deposit', amount: 1000, status: 'completed', created_at: iso(HOUR) });

    const app = await buildApp();
    const jsonRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview?days=7', headers: authHeaders(admin.id),
    });
    const csvRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/overview?days=7&format=csv', headers: authHeaders(admin.id),
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(String(csvRes.headers['content-disposition'])).toContain('vanta-analytics-overview-7d-');

    const keys = ['date','new_users','trade_count','trade_volume','deposits','withdrawals','house_pnl'];
    const { header, rows } = parseCsv(csvRes.body);
    expect(header).toEqual(keys);
    const series = (jsonRes.json() as any).series as any[];
    expect(rows).toHaveLength(7);
    expect(rows).toHaveLength(series.length);
    series.forEach((b, i) => expect(rows[i]).toEqual(expectedCells(b, keys)));
    await app.close();
  });

  it('accounts CSV reconciles cell-for-cell with the JSON leaderboard', async () => {
    const admin = seed.user({ id: 'admin-a2' });
    seed.profile({ id: admin.id, is_admin: true });
    const a1 = seed.account({ id: 'acct-1', user_id: 'u1', login: 80003333, balance: 5000 });
    const a2 = seed.account({ id: 'acct-2', user_id: 'u2', login: 80004444, balance: 8000 });
    seed.trade({ account_id: a1.id, symbol: 'BTCUSD', side: 'buy', volume: 0.01,
      open_price: 70000, close_price: 70500, status: 'closed', profit: 120 });
    seed.trade({ account_id: a2.id, symbol: 'ETHUSD', side: 'buy', volume: 0.1,
      open_price: 2000, close_price: 1990, status: 'closed', profit: -10 });
    seed.transaction({ account_id: a1.id, type: 'deposit', amount: 5000, status: 'completed' });

    const app = await buildApp();
    const jsonRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/accounts?sort=pnl', headers: authHeaders(admin.id),
    });
    const csvRes = await app.inject({
      method: 'GET', url: '/api/admin/analytics/accounts?sort=pnl&format=csv', headers: authHeaders(admin.id),
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(String(csvRes.headers['content-disposition'])).toContain('vanta-analytics-accounts-pnl-');

    const keys = ['login','account_id','user_id','balance','equity','current_equity','margin_used',
      'leverage','deposits','withdrawals','net_deposits','realized_pnl','unrealized_pnl',
      'trade_count','closed_count','win_rate'];
    const { header, rows } = parseCsv(csvRes.body);
    expect(header).toEqual(keys);
    const accounts = (jsonRes.json() as any).accounts as any[];
    expect(rows).toHaveLength(accounts.length);
    accounts.forEach((acc, i) => expect(rows[i]).toEqual(expectedCells(acc, keys)));
    await app.close();
  });
});
