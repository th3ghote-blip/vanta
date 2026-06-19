/**
 * In-memory Supabase mock used by the integration tests.
 *
 * Implements just enough of the supabase-js v2 surface that the routes touch:
 *   - from(table).select/insert/update/delete with eq/gte/maybeSingle/single/order/limit
 *   - rpc(name, params)
 *   - auth.getUser(token) / auth.signInWithPassword / auth.admin.createUser / updateUserById
 *
 * Reset between tests via `resetDb()`. Seed with `seed.user/account/trade/...` helpers.
 */

export interface DbUser {
  id: string;
  email: string;
  password: string;
}
export interface DbAccount {
  id: string;
  user_id: string;
  login: number;
  balance: number;
  equity: number;
  free_margin: number;
  margin_used: number;
  leverage: number;
  hedging_enabled?: boolean;
  last_seen?: string;
  type?: string;
  status?: string;
}
export interface DbTrade {
  id: number;
  account_id: string;
  user_id?: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
  current_price: number;
  status: 'open' | 'closed' | 'pending' | 'cancelled';
  close_price?: number;
  open_time?: string;
  close_time?: string;
  profit?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  reason?: string;
  client_request_id?: string | null;
  order_type?: 'market' | 'limit' | 'stop' | 'stop_limit';
  trigger_price?: number | null;
  limit_price?: number | null;
  trail_distance?: number | null;
  trail_high_water?: number | null;
  oco_group_id?: string | null;
}
export interface DbRound {
  id: number;
  account_id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  stake: number;
  payout_multiplier: number;
  entry_price: number;
  duration_seconds: number;
  closes_at: string;
}
export interface DbProfile {
  id: string;
  created_at?: string;
  display_name?: string | null;
  last_login_date?: string;
  login_streak?: number;
  copy_leader_enabled?: boolean;
  share_trades?: boolean;
  is_admin?: boolean;
}

export interface DbCopyRelationship {
  follower_id: string;
  leader_id: string;
  follower_account_id: string;
  allocation_pct: number;
  started_at?: string;
}

interface Tables {
  accounts: DbAccount[];
  trades: DbTrade[];
  binary_rounds: DbRound[];
  profiles: DbProfile[];
  copy_relationships: DbCopyRelationship[];
  login_attempts: any[];
  achievements: any[];
  robots: any[];
  robot_runs: any[];
  notifications: any[];
  transactions: any[];
}

let users: DbUser[] = [];
let tables: Tables = {
  accounts: [],
  trades: [],
  binary_rounds: [],
  profiles: [],
  copy_relationships: [],
  login_attempts: [],
  achievements: [],
  robots: [],
  robot_runs: [],
  notifications: [],
  transactions: [],
};
let tradeIdCounter = 1;
let roundIdCounter = 1;
let loginSeq = 80_000_000;

export function resetDb() {
  users = [];
  tables = {
    accounts: [],
    trades: [],
    binary_rounds: [],
    profiles: [],
    copy_relationships: [],
    login_attempts: [],
    achievements: [],
    robots: [],
    robot_runs: [],
  notifications: [],
    transactions: [],
  };
  tradeIdCounter = 1;
  roundIdCounter = 1;
  loginSeq = 80_000_000;
}

/** Issue a token for a user; lookups in authUser() will accept this token. */
export function issueToken(userId: string): string {
  return `token-for-${userId}`;
}
export function userIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const cleaned = token.replace(/^Bearer /, '');
  const m = cleaned.match(/^token-for-(.+)$/);
  if (!m) return null;
  const id = m[1];
  return users.find((u) => u.id === id) ? id : null;
}

export const seed = {
  user(overrides: Partial<DbUser> = {}): DbUser {
    const u: DbUser = {
      id: overrides.id ?? `user-${users.length + 1}`,
      email: overrides.email ?? `${80_000_001 + users.length}@vanta.account`,
      password: overrides.password ?? 'pw-' + (users.length + 1),
    };
    users.push(u);
    return u;
  },
  account(overrides: Partial<DbAccount> = {}): DbAccount {
    loginSeq += 1;
    const balance = overrides.balance ?? 10_000;
    const a: DbAccount = {
      id: overrides.id ?? `acct-${tables.accounts.length + 1}`,
      user_id: overrides.user_id ?? 'user-1',
      login: overrides.login ?? loginSeq,
      balance,
      equity: overrides.equity ?? balance,
      free_margin: overrides.free_margin ?? 10_000,
      margin_used: overrides.margin_used ?? 0,
      leverage: overrides.leverage ?? 100,
      hedging_enabled: overrides.hedging_enabled ?? false,
      last_seen: overrides.last_seen,
      type: overrides.type,
      status: overrides.status,
    };
    tables.accounts.push(a);
    return a;
  },
  profile(overrides: Partial<DbProfile> = {}): DbProfile {
    const p: DbProfile = {
      id: overrides.id ?? 'user-1',
      created_at: overrides.created_at,
      display_name: overrides.display_name ?? null,
      last_login_date: overrides.last_login_date,
      login_streak: overrides.login_streak ?? 0,
      copy_leader_enabled: overrides.copy_leader_enabled ?? false,
      share_trades: overrides.share_trades ?? true,
      is_admin: overrides.is_admin ?? false,
    };
    tables.profiles.push(p);
    return p;
  },
  trade(overrides: Partial<DbTrade> = {}): DbTrade {
    const t: DbTrade = {
      id: overrides.id ?? tradeIdCounter++,
      account_id: overrides.account_id ?? 'acct-1',
      user_id: overrides.user_id,
      symbol: overrides.symbol ?? 'EURUSD',
      side: overrides.side ?? 'buy',
      volume: overrides.volume ?? 0.1,
      open_price: overrides.open_price ?? 1.1,
      current_price: overrides.current_price ?? 1.1,
      status: overrides.status ?? 'open',
      close_price: overrides.close_price,
      open_time: overrides.open_time ?? new Date().toISOString(),
      close_time: overrides.close_time,
      profit: overrides.profit,
      client_request_id: overrides.client_request_id ?? null,
      reason: overrides.reason ?? 'mobile',
      stop_loss: overrides.stop_loss ?? null,
      take_profit: overrides.take_profit ?? null,
      // Pass-through fields for pending / stop_limit / trailing / OCO tests.
      order_type: overrides.order_type,
      trigger_price: overrides.trigger_price ?? null,
      limit_price: overrides.limit_price ?? null,
      trail_distance: overrides.trail_distance ?? null,
      trail_high_water: overrides.trail_high_water ?? null,
      oco_group_id: overrides.oco_group_id ?? null,
    };
    tables.trades.push(t);
    return t;
  },
  transaction(overrides: { id?: string; account_id?: string; type?: string; amount?: number; status?: string; created_at?: string } = {}): any {
    const tx = {
      id: overrides.id ?? `tx-${tables.transactions.length + 1}`,
      account_id: overrides.account_id ?? 'acct-1',
      type: overrides.type ?? 'deposit',
      amount: overrides.amount ?? 0,
      status: overrides.status ?? 'completed',
      created_at: overrides.created_at ?? new Date().toISOString(),
    };
    tables.transactions.push(tx);
    return tx;
  },
  copyRelationship(overrides: Partial<DbCopyRelationship> & { follower_id: string; leader_id: string; follower_account_id: string; allocation_pct: number }): DbCopyRelationship {
    const r: DbCopyRelationship = {
      follower_id: overrides.follower_id,
      leader_id: overrides.leader_id,
      follower_account_id: overrides.follower_account_id,
      allocation_pct: overrides.allocation_pct,
      started_at: overrides.started_at ?? new Date().toISOString(),
    };
    tables.copy_relationships.push(r);
    return r;
  },
};

export function getTable<K extends keyof Tables>(name: K): Tables[K] {
  return tables[name];
}

// ── Query builder ──────────────────────────────────────────────────────────

interface Filter {
  col: string;
  op: 'eq' | 'gte' | 'lte' | 'in' | 'not_null';
  val: any;
}

class Query {
  private filters: Filter[] = [];
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = undefined;
  private updatePayload: any = undefined;
  private orderCol?: string;
  private orderAsc: boolean = true;
  private limitN?: number;
  private wantArray: boolean = true;
  // For embed-like joins: routes do "accounts!inner(user_id, leverage)".
  // We don't parse it — instead, on resolve we attach the related account row.
  private embedAccount: boolean = false;
  // After insert/update, supabase-js v2 lets you chain `.select()` to get the rows back.
  // We treat such a select as a no-op modifier so the original mode (insert/update) still drives exec().
  private selectAfterMutation: boolean = false;
  // count: 'exact' / head: true support (used by max_concurrent + admin counters)
  private countMode: boolean = false;
  private headMode: boolean = false;

  constructor(private table: keyof Tables) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode === 'insert' || this.mode === 'update') {
      this.selectAfterMutation = true;
    } else {
      this.mode = 'select';
    }
    if (cols && cols.includes('accounts!inner')) this.embedAccount = true;
    if (opts?.count) this.countMode = true;
    if (opts?.head) this.headMode = true;
    return this;
  }
  insert(payload: any) {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.mode = 'update';
    this.updatePayload = payload;
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push({ col, op: 'gte', val });
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push({ col, op: 'lte', val });
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push({ col, op: 'in', val: vals });
    return this;
  }
  // Supports the supabase `.not(col, 'is', null)` form → keep rows where col is not null.
  not(col: string, op: string, val: any) {
    if (op === 'is' && val === null) this.filters.push({ col, op: 'not_null', val: null });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.wantArray = false;
    return this.exec(true);
  }
  maybeSingle() {
    this.wantArray = false;
    return this.exec(false);
  }
  // The chained build supports both `await query` (returns array) and `.single()` etc.
  then<T1, T2>(
    onFulfilled?: (v: { data: any; error: any }) => T1,
    onRejected?: (r: any) => T2,
  ): Promise<T1 | T2> {
    return (this.exec(false) as Promise<{ data: any; error: any }>).then(
      onFulfilled,
      onRejected,
    );
  }

  private match(row: any): boolean {
    return this.filters.every((f) => {
      if (f.op === 'eq') return row[f.col] === f.val;
      if (f.op === 'gte') return row[f.col] >= f.val;
      if (f.op === 'lte') return row[f.col] <= f.val;
      if (f.op === 'in') return Array.isArray(f.val) && (f.val as any[]).includes(row[f.col]);
      if (f.op === 'not_null') return row[f.col] !== null && row[f.col] !== undefined;
      return false;
    });
  }

  private async exec(strictSingle: boolean): Promise<{ data: any; error: any }> {
    const arr = tables[this.table] as any[];

    if (this.mode === 'insert') {
      const rowsIn = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted: any[] = [];
      for (const r of rowsIn) {
        const row: any = { ...r };
        if (this.table === 'trades') {
          row.id = row.id ?? tradeIdCounter++;
          row.status = row.status ?? 'open';
        }
        if (this.table === 'binary_rounds') {
          row.id = row.id ?? roundIdCounter++;
        }
        if (this.table === 'robots') {
          row.id = row.id ?? `robot-${(tables.robots.length + 1).toString()}`;
          row.created_at = new Date().toISOString();
        }
        arr.push(row);
        inserted.push(row);
      }
      if (this.wantArray) return { data: inserted, error: null };
      const data = inserted[0] ?? null;
      if (strictSingle && data == null) return { data: null, error: new Error('no rows') };
      return { data, error: null };
    }

    let matching = arr.filter((r) => this.match(r));

    if (this.mode === 'update') {
      for (const r of matching) Object.assign(r, this.updatePayload);
      if (this.wantArray) return { data: matching, error: null };
      const data = matching[0] ?? null;
      if (strictSingle && data == null) return { data: null, error: new Error('no rows') };
      return { data, error: null };
    }

    if (this.mode === 'delete') {
      tables[this.table] = (arr.filter((r) => !this.match(r)) as any) as any;
      return { data: null, error: null };
    }

    // select
    if (this.orderCol) {
      matching = [...matching].sort((a, b) => {
        const av = a[this.orderCol!];
        const bv = b[this.orderCol!];
        return (av > bv ? 1 : av < bv ? -1 : 0) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitN != null) matching = matching.slice(0, this.limitN);

    // count: 'exact' (with optional head: true) → return row count, no rows when head.
    if (this.countMode) {
      return {
        data: this.headMode ? null : matching,
        error: null,
        count: matching.length,
      } as any;
    }

    // attach embed if requested (used by orders.close → trades.accounts!inner)
    if (this.embedAccount && this.table === 'trades') {
      matching = matching
        .map((t) => {
          const a = tables.accounts.find((x) => x.id === t.account_id);
          return a
            ? {
                ...t,
                accounts: {
                  user_id: a.user_id,
                  login: a.login,
                  balance: a.balance,
                  margin_used: a.margin_used,
                  leverage: a.leverage,
                },
              }
            : { ...t, accounts: null };
        })
        // accounts!inner → drop trades whose account is missing
        .filter((t) => (t as any).accounts !== null);
    }
    if (this.embedAccount && this.table === 'robots') {
      matching = matching
        .map((r) => {
          const a = tables.accounts.find((x) => x.id === r.account_id);
          return a
            ? {
                ...r,
                accounts: {
                  id: a.id,
                  user_id: a.user_id,
                  balance: a.balance,
                  free_margin: a.free_margin,
                  margin_used: a.margin_used,
                  leverage: a.leverage,
                },
              }
            : null;
        })
        // accounts!inner → rows with no matching account are dropped
        .filter((r) => r !== null) as any[];
    }

    if (this.wantArray) return { data: matching, error: null };
    const data = matching[0] ?? null;
    if (strictSingle && data == null) return { data: null, error: new Error('no rows') };
    return { data, error: null };
  }
}

// ── RPC handlers ───────────────────────────────────────────────────────────

async function rpc(name: string, params: any): Promise<{ data: any; error: any }> {
  if (name === 'reserve_margin') {
    const acc = tables.accounts.find((a) => a.id === params.p_account_id);
    if (!acc) return { data: false, error: null };
    if (acc.free_margin < params.p_amount) return { data: false, error: null };
    acc.free_margin = +(acc.free_margin - params.p_amount).toFixed(2);
    acc.margin_used = +(acc.margin_used + params.p_amount).toFixed(2);
    return { data: true, error: null };
  }
  if (name === 'release_margin') {
    const acc = tables.accounts.find((a) => a.id === params.p_account_id);
    if (!acc) return { data: null, error: null };
    const release = Math.min(params.p_amount, acc.margin_used);
    acc.margin_used = +(acc.margin_used - release).toFixed(2);
    acc.free_margin = +(acc.free_margin + release).toFixed(2);
    return { data: null, error: null };
  }
  if (name === 'apply_trade_pnl') {
    const acc = tables.accounts.find((a) => a.id === params.p_account_id);
    if (!acc) return { data: null, error: { message: 'no account' } };
    acc.balance = +(acc.balance + params.p_amount).toFixed(2);
    acc.free_margin = +(acc.free_margin + params.p_amount).toFixed(2);
    return { data: null, error: null };
  }
  return { data: null, error: { message: `unmocked rpc: ${name}` } };
}

// ── Auth surface ───────────────────────────────────────────────────────────

const auth = {
  async getUser(token: string) {
    const id = userIdFromToken(token);
    if (!id) return { data: { user: null }, error: { message: 'invalid' } };
    return { data: { user: { id } }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const u = users.find((x) => x.email === email && x.password === password);
    if (!u) {
      return {
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      };
    }
    return {
      data: {
        session: {
          access_token: issueToken(u.id),
          refresh_token: 'refresh-' + u.id,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
        user: { id: u.id },
      },
      error: null,
    };
  },
  admin: {
    async createUser({ email, password }: { email: string; password: string }) {
      if (users.some((u) => u.email === email)) {
        return { data: { user: null }, error: { message: 'A user with this email address has already been registered' } };
      }
      const id = `user-${users.length + 1}`;
      users.push({ id, email, password });
      // mimic auth trigger: auto-create an account row for this user with next login
      loginSeq += 1;
      tables.accounts.push({
        id: `acct-auto-${tables.accounts.length + 1}`,
        user_id: id,
        login: loginSeq,
        balance: 0,
        free_margin: 0,
        margin_used: 0,
        leverage: 100,
      });
      tables.profiles.push({ id, login_streak: 0 });
      return { data: { user: { id, email } }, error: null };
    },
    async updateUserById(id: string, patch: { email?: string; password?: string }) {
      const u = users.find((x) => x.id === id);
      if (!u) return { data: null, error: { message: 'not found' } };
      if (patch.email) u.email = patch.email;
      if (patch.password) u.password = patch.password;
      return { data: { user: u }, error: null };
    },
  },
};

export const supabaseAdmin = {
  from(table: keyof Tables) {
    return new Query(table);
  },
  rpc,
  auth,
};

/** Stand-in for `authUser()` in `../lib/supabase.js`. */
export async function authUser(token: string | undefined): Promise<string | null> {
  return userIdFromToken(token);
}

/** Stand-in for `signInWithPassword()` in `../lib/supabase.js`. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ session: { access_token: string; refresh_token: string; expires_at?: number; user_id: string } | null; error: string | null }> {
  const u = users.find((x) => x.email === email && x.password === password);
  if (!u) {
    return { session: null, error: 'Invalid login credentials' };
  }
  return {
    session: {
      access_token: issueToken(u.id),
      refresh_token: 'refresh-' + u.id,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user_id: u.id,
    },
    error: null,
  };
}
