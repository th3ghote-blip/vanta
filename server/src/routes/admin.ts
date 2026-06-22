import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getMid } from '../lib/quoteCache.js';
import { calculatePnL, contractSize, notionalUSD } from '../lib/contracts.js';
import { requiredMargin, releaseMargin } from '../lib/margin.js';
import { sendPushBatch } from '../lib/push.js';
import { toCsv, csvFilename, type CsvColumn } from '../lib/csv.js';

/** Verify auth + admin role. Returns userId or null. */
async function authAdmin(token: string | undefined): Promise<string | null> {
  const userId = await authUser(token);
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  if (!data?.is_admin) return null;
  return userId;
}

const RejectSchema = z.object({ reason: z.string().optional() }).optional();

// 21.4 — admin force-close / modify schemas
const PositionIdSchema = z.object({ id: z.coerce.number().int().positive() });
const ModifyPositionSchema = z.object({
  stopLoss: z.number().nullable().optional(),
  takeProfit: z.number().nullable().optional(),
});

// 21.16 — operator broadcast / direct client notification.
const NotifySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  audience: z.enum(['all', 'account']).default('account'),
  login: z.coerce.number().int().positive().optional(),
  userId: z.string().uuid().optional(),
  symbol: z.string().trim().max(32).optional(),
  data: z.record(z.unknown()).optional(),
});


/** 21.15 — CSV report export helpers. */
function wantsCsv(format: string | undefined): boolean {
  return (format ?? '').trim().toLowerCase() === 'csv';
}
function sendCsv(reply: FastifyReply, filename: string, csv: string) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(csv);
}

// Column orders mirror the on-screen analytics tables so an export reconciles
// row-for-row with what the admin sees.
const BY_SYMBOL_COLUMNS: CsvColumn<any>[] = [
  { label: 'symbol', value: (r) => r.symbol },
  { label: 'trade_count', value: (r) => r.trade_count },
  { label: 'open_count', value: (r) => r.open_count },
  { label: 'closed_count', value: (r) => r.closed_count },
  { label: 'volume_lots', value: (r) => r.volume_lots },
  { label: 'volume_notional', value: (r) => r.volume_notional },
  { label: 'open_buy_lots', value: (r) => r.open_buy_lots },
  { label: 'open_sell_lots', value: (r) => r.open_sell_lots },
  { label: 'net_open_lots', value: (r) => r.net_open_lots },
  { label: 'net_open_notional', value: (r) => r.net_open_notional },
  { label: 'realized_client_pnl', value: (r) => r.realized_client_pnl },
  { label: 'realized_house_pnl', value: (r) => r.realized_house_pnl },
  { label: 'win_rate', value: (r) => r.win_rate },
  { label: 'avg_hold_seconds', value: (r) => r.avg_hold_seconds },
  { label: 'over_exposure', value: (r) => r.over_exposure },
];

const OVERVIEW_COLUMNS: CsvColumn<any>[] = [
  { label: 'date', value: (r) => r.date },
  { label: 'new_users', value: (r) => r.new_users },
  { label: 'trade_count', value: (r) => r.trade_count },
  { label: 'trade_volume', value: (r) => r.trade_volume },
  { label: 'deposits', value: (r) => r.deposits },
  { label: 'withdrawals', value: (r) => r.withdrawals },
  { label: 'house_pnl', value: (r) => r.house_pnl },
];

const ACCOUNTS_COLUMNS: CsvColumn<any>[] = [
  { label: 'login', value: (r) => r.login },
  { label: 'account_id', value: (r) => r.account_id },
  { label: 'user_id', value: (r) => r.user_id },
  { label: 'balance', value: (r) => r.balance },
  { label: 'equity', value: (r) => r.equity },
  { label: 'current_equity', value: (r) => r.current_equity },
  { label: 'margin_used', value: (r) => r.margin_used },
  { label: 'leverage', value: (r) => r.leverage },
  { label: 'deposits', value: (r) => r.deposits },
  { label: 'withdrawals', value: (r) => r.withdrawals },
  { label: 'net_deposits', value: (r) => r.net_deposits },
  { label: 'realized_pnl', value: (r) => r.realized_pnl },
  { label: 'unrealized_pnl', value: (r) => r.unrealized_pnl },
  { label: 'trade_count', value: (r) => r.trade_count },
  { label: 'closed_count', value: (r) => r.closed_count },
  { label: 'win_rate', value: (r) => r.win_rate },
];

export async function adminRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/transactions?status=pending|completed|rejected|all
   * Returns up to 100 transactions (most recent first) with nested account info.
   */
  app.get('/transactions', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { status } = req.query as { status?: string };

    let query = supabaseAdmin
      .from('transactions')
      .select('*, accounts!inner(id, user_id, balance, type, currency)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    }

    const { data, error } = await query;
    if (error) {
      app.log.error({ err: error }, 'admin/transactions: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    return reply.send({ transactions: data ?? [] });
  });

  /**
   * POST /api/admin/transactions/:id/approve
   * - deposit → credit balance
   * - withdrawal → debit balance (checks sufficient funds first)
   * - bonus / adjustment → credit balance
   * Sets status = 'completed'.
   */
  app.post('/transactions/:id/approve', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*, accounts!inner(id, user_id, balance, equity, margin_used, free_margin)')
      .eq('id', id)
      .single();

    if (txErr || !tx) return reply.code(404).send({ error: 'transaction_not_found' });
    if (tx.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: tx.status });
    }

    const account = (tx as any).accounts;
    const currentBalance = Number(account.balance);
    const amount = Number(tx.amount);

    let balanceDelta = 0;
    if (tx.type === 'deposit' || tx.type === 'bonus' || tx.type === 'adjustment') {
      balanceDelta = amount;
    } else if (tx.type === 'withdrawal') {
      if (currentBalance < amount) {
        return reply.code(400).send({
          error: 'insufficient_balance',
          available: currentBalance,
          requested: amount,
        });
      }
      balanceDelta = -amount;
    }

    if (balanceDelta !== 0) {
      const newBalance = currentBalance + balanceDelta;
      const marginUsed = Number(account.margin_used ?? 0);
      const { error: balErr } = await supabaseAdmin
        .from('accounts')
        .update({
          balance: newBalance,
          equity: newBalance,
          free_margin: Math.max(0, newBalance - marginUsed),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (balErr) {
        app.log.error({ err: balErr }, 'admin/approve: balance update failed');
        return reply.code(500).send({ error: 'balance_update_failed' });
      }
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/approve: status update failed');
      return reply.code(500).send({ error: 'status_update_failed' });
    }

    app.log.info({ adminId, txId: id, type: tx.type, amount, balanceDelta }, 'admin: transaction approved');
    return reply.send({ transaction: updated, balance_delta: balanceDelta });
  });

  /**
   * POST /api/admin/transactions/:id/reject
   * No balance changes. Sets status = 'rejected'.
   */
  app.post('/transactions/:id/reject', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };
    const parsed = RejectSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data?.reason : undefined;

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('id, status, notes')
      .eq('id', id)
      .single();

    if (txErr || !tx) return reply.code(404).send({ error: 'transaction_not_found' });
    if (tx.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: tx.status });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'rejected',
        notes: reason ? `Rejected: ${reason}` : 'Rejected by admin',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/reject: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, txId: id, reason }, 'admin: transaction rejected');
    return reply.send({ transaction: updated });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // KYC review endpoints
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/kyc?status=pending|approved|rejected|all
   * Returns up to 100 KYC submissions (most recent first) with their documents.
   * Each doc includes a 1-hour signed URL the admin can use to view the image.
   */
  app.get('/kyc', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { status } = req.query as { status?: string };

    let query = supabaseAdmin
      .from('kyc_submissions')
      .select('id, user_id, status, rejection_reason, submitted_at, reviewed_at, created_at, kyc_documents(id, doc_type, storage_path, uploaded_at)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    } else if (!status) {
      // Default to pending
      query = query.eq('status', 'pending' as any);
    }

    const { data, error } = await query;
    if (error) {
      app.log.error({ err: error }, 'admin/kyc: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    // Generate signed URLs for every document (1-hour expiry)
    const submissions = await Promise.all(
      (data ?? []).map(async (sub: any) => {
        const docs = await Promise.all(
          (sub.kyc_documents ?? []).map(async (doc: any) => {
            const { data: signedData } = await supabaseAdmin.storage
              .from('kyc')
              .createSignedUrl(doc.storage_path, 3600);
            return {
              ...doc,
              signed_url: signedData?.signedUrl ?? null,
            };
          }),
        );
        return { ...sub, kyc_documents: docs };
      }),
    );

    return reply.send({ submissions });
  });

  /**
   * POST /api/admin/kyc/:id/approve
   * Sets kyc_submissions.status = 'approved', reviewed_at = now().
   */
  app.post('/kyc/:id/approve', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('kyc_submissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (subErr || !sub) return reply.code(404).send({ error: 'submission_not_found' });
    if (sub.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: sub.status });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('kyc_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/kyc/approve: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, submissionId: id }, 'admin: KYC approved');
    return reply.send({ submission: updated });
  });

  /**
   * POST /api/admin/kyc/:id/reject
   * Sets status = 'rejected', rejection_reason, reviewed_at = now().
   */
  app.post('/kyc/:id/reject', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };
    const parsed = RejectSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data?.reason : undefined;

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('kyc_submissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (subErr || !sub) return reply.code(404).send({ error: 'submission_not_found' });
    if (sub.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: sub.status });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('kyc_submissions')
      .update({
        status: 'rejected',
        rejection_reason: reason ?? 'Rejected by admin',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/kyc/reject: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, submissionId: id, reason }, 'admin: KYC rejected');
    return reply.send({ submission: updated });
  });
  /**
   * GET /api/admin/dashboard
   * Returns aggregate stats: users, accounts, deposits, open trades, exposure, health.
   */
  app.get('/dashboard', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const [
      usersRes,
      accountsRes,
      depositsRes,
      openTradesRes,
      exposureRes,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('accounts').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('transactions')
        .select('amount')
        .eq('type', 'deposit')
        .eq('status', 'completed'),
      supabaseAdmin
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabaseAdmin
        .from('trades')
        .select('volume, open_price')
        .eq('status', 'open'),
    ]);

    const totalDeposits = (depositsRes.data ?? []).reduce(
      (sum: number, tx: any) => sum + parseFloat(tx.amount ?? '0'),
      0,
    );

    const totalExposure = (exposureRes.data ?? []).reduce(
      (sum: number, t: any) =>
        sum + parseFloat(t.volume ?? '0') * parseFloat(t.open_price ?? '0'),
      0,
    );

    return reply.send({
      total_users:    usersRes.count    ?? 0,
      active_accounts: accountsRes.count ?? 0,
      total_deposits: totalDeposits,
      open_trades:    openTradesRes.count ?? 0,
      total_exposure: totalExposure,
      health: {
        status:      'ok',
        server_time: new Date().toISOString(),
      },
    });
  });


  // ────────────────────────────────────────────────────────────────────────────
  // User search + impersonation
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/users?q=<search>
   * Search users by login number (exact) or email (substring).
   * Returns up to 50 matching profiles with their account info.
   */
  app.get('/users', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { q } = req.query as { q?: string };
    const search = (q ?? '').trim();

    // PostgREST can't embed accounts from profiles (and vice-versa): both
    // reference auth.users, so there is no direct FK between them. Fetch the
    // accounts separately and stitch them on by user_id.
    // 21.9: live equity + margin-level % per account. Matches the
    // /analytics/accounts leaderboard definition exactly:
    //   equity           = balance + unrealized P&L (live mid; falls back to open_price)
    //   margin_level_pct = margin_used > 0 ? (equity / margin_used) * 100 : null
    async function equityByAccount(
      rawAccts: any[],
    ): Promise<Record<string, { equity: number; margin_level_pct: number | null }>> {
      const out: Record<string, { equity: number; margin_level_pct: number | null }> = {};
      if (!rawAccts.length) return out;
      const acctIds = rawAccts.map((a) => a.id);
      const { data: openTrades } = await supabaseAdmin
        .from('trades')
        .select('account_id, symbol, side, volume, open_price')
        .in('account_id', acctIds)
        .eq('status', 'open');
      const unrealized: Record<string, number> = {};
      for (const t of (openTrades ?? []) as any[]) {
        const side = t.side === 'sell' ? 'sell' : 'buy';
        const volume = Number(t.volume) || 0;
        const openPrice = Number(t.open_price) || 0;
        const mid = getMid(t.symbol) ?? openPrice;
        unrealized[t.account_id] =
          (unrealized[t.account_id] ?? 0) + calculatePnL(side, volume, openPrice, mid, t.symbol);
      }
      for (const a of rawAccts) {
        const balance = Number(a.balance) || 0;
        const marginUsed = Number(a.margin_used) || 0;
        const equity = balance + (unrealized[a.id] ?? 0);
        const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : null;
        out[a.id] = {
          equity: +equity.toFixed(2),
          margin_level_pct: marginLevel != null ? +marginLevel.toFixed(1) : null,
        };
      }
      return out;
    }

    async function attachAccounts(profs: any[]): Promise<any[]> {
      if (!profs.length) return [];
      const ids = profs.map((p) => p.id);
      const { data: accts } = await supabaseAdmin
        .from('accounts')
        .select('id, login, type, status, balance, currency, margin_used, user_id')
        .in('user_id', ids);
      const rawAccts = accts ?? [];
      const eq = await equityByAccount(rawAccts);
      const byUser: Record<string, any[]> = {};
      for (const a of rawAccts) {
        (byUser[a.user_id] ??= []).push({
          id: a.id, login: a.login, type: a.type, status: a.status, balance: a.balance, currency: a.currency,
          equity: eq[a.id]?.equity ?? (Number(a.balance) || 0),
          margin_level_pct: eq[a.id]?.margin_level_pct ?? null,
        });
      }
      return profs.map((p) => ({ ...p, accounts: byUser[p.id] ?? [] }));
    }

    if (!search) {
      // No query — return most-recently-created 50 users
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, is_admin, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return reply.code(500).send({ error: 'query_failed' });
      return reply.send({ users: await attachAccounts(data ?? []) });
    }

    // Try login number first (numeric exact match)
    const loginNum = parseInt(search, 10);
    if (!isNaN(loginNum) && String(loginNum) === search) {
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('id, login, type, status, balance, currency, margin_used, user_id')
        .eq('login', loginNum)
        .limit(10);
      if (error) return reply.code(500).send({ error: 'query_failed' });
      const accts = data ?? [];
      const eq = await equityByAccount(accts);
      const uids = accts.map((a: any) => a.user_id);
      const { data: profs } = uids.length
        ? await supabaseAdmin
            .from('profiles')
            .select('id, display_name, is_admin, created_at')
            .in('id', uids)
        : { data: [] as any[] };
      const profMap: Record<string, any> = {};
      for (const p of profs ?? []) profMap[p.id] = p;
      // Reshape to profiles-first form
      const users = accts.map((a: any) => ({
        ...(profMap[a.user_id] ?? { id: a.user_id }),
        accounts: [{
          id: a.id, login: a.login, type: a.type, status: a.status, balance: a.balance, currency: a.currency,
          equity: eq[a.id]?.equity ?? (Number(a.balance) || 0),
          margin_level_pct: eq[a.id]?.margin_level_pct ?? null,
        }],
      }));
      return reply.send({ users });
    }

    // Email substring search — look up auth.users via admin API
    // Supabase admin.listUsers doesn't support search; use the accounts join via email stored in auth.users
    // We query auth.users using the admin API pagination to find matching emails, then join profiles
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return reply.code(500).send({ error: 'user_list_failed' });

    const lc = search.toLowerCase();
    const matching = (listData?.users ?? [])
      .filter((u: any) => u.email?.toLowerCase().includes(lc))
      .slice(0, 50);

    if (matching.length === 0) return reply.send({ users: [] });

    const ids = matching.map((u: any) => u.id);
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, is_admin, created_at')
      .in('id', ids);
    if (profErr) return reply.code(500).send({ error: 'profile_query_failed' });

    const withAccounts = await attachAccounts(profiles ?? []);
    // Attach email from auth.users
    const emailMap: Record<string, string> = {};
    for (const u of matching) emailMap[u.id] = u.email ?? '';
    const users = withAccounts.map((p: any) => ({ ...p, email: emailMap[p.id] ?? '' }));
    return reply.send({ users });
  });

  /**
   * GET /api/admin/users/:userId
   * Full profile for a single user: profile, accounts, recent trades, transactions, KYC.
   */
  app.get('/users/:userId', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { userId } = req.params as { userId: string };

    // Auth user (for email)
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authData?.user?.email ?? null;

    const [profileRes, accountsRes, tradesRes, txRes, kycRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin.from('accounts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabaseAdmin.from('trades').select('id, symbol, side, volume, open_price, close_price, profit, status, reason, open_time, close_time')
        .eq('account_id',
          // subselect: we need account_ids for this user
          // workaround: fetch inline below
          '__placeholder__'
        ),
      supabaseAdmin.from('transactions').select('id, type, amount, currency, status, method, created_at, completed_at, notes')
        .eq('account_id', '__placeholder__')
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin.from('kyc_submissions').select('id, status, rejection_reason, submitted_at, reviewed_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    ]);

    // Re-fetch trades + transactions with actual account ids
    const accountIds = (accountsRes.data ?? []).map((a: any) => a.id);
    const [tradesRes2, txRes2] = await Promise.all([
      accountIds.length
        ? supabaseAdmin.from('trades').select('id, symbol, side, volume, open_price, close_price, profit, status, reason, open_time, close_time')
            .in('account_id', accountIds).order('open_time', { ascending: false }).limit(50)
        : { data: [], error: null },
      accountIds.length
        ? supabaseAdmin.from('transactions').select('id, type, amount, currency, status, method, created_at, completed_at, notes')
            .in('account_id', accountIds).order('created_at', { ascending: false }).limit(50)
        : { data: [], error: null },
    ]);

    return reply.send({
      profile:      { ...(profileRes.data ?? {}), email },
      accounts:     accountsRes.data ?? [],
      trades:       tradesRes2.data ?? [],
      transactions: txRes2.data ?? [],
      kyc:          kycRes.data ?? [],
    });
  });

  /**
   * POST /api/admin/users/:userId/impersonate
   * Generates a one-time magic link for the target user (admin use only).
   * Returns { magic_link, email } — admin opens this link in a browser to sign in as the user.
   */
  app.post('/users/:userId/impersonate', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { userId } = req.params as { userId: string };

    // Prevent impersonating another admin
    const { data: target } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).single();
    if (target?.is_admin) {
      return reply.code(400).send({ error: 'cannot_impersonate_admin' });
    }

    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authData?.user?.email;
    if (!email) return reply.code(404).send({ error: 'user_not_found' });

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData) {
      app.log.error({ err: linkErr }, 'admin/impersonate: generate link failed');
      return reply.code(500).send({ error: 'link_generation_failed' });
    }

    app.log.warn({ adminId, targetUserId: userId }, 'admin: impersonation link generated');
    return reply.send({
      magic_link:  (linkData as any).properties?.action_link ?? null,
      token_hash:  (linkData as any).properties?.hashed_token ?? null,
      email,
    });
  });


  /**
   * POST /api/admin/accounts/:id/adjust
   * Manually credit or debit an account balance.
   * Body: { amount: number, reason: string }
   * amount may be negative (debit). Audit trail via transactions row.
   */
  app.post('/accounts/:id/adjust', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };
    const body = req.body as any;
    const amount: number = Number(body?.amount);
    const reason: string = String(body?.reason ?? '').trim();

    if (isNaN(amount) || amount === 0) {
      return reply.code(400).send({ error: 'invalid_amount', message: 'amount must be a non-zero number' });
    }
    if (!reason) {
      return reply.code(400).send({ error: 'reason_required', message: 'reason is required' });
    }

    // Fetch account
    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, balance, margin_used, free_margin, currency')
      .eq('id', id)
      .single();
    if (accErr || !account) return reply.code(404).send({ error: 'account_not_found' });

    const currentBalance = Number(account.balance);
    const marginUsed     = Number(account.margin_used ?? 0);
    const newBalance     = currentBalance + amount;

    // Prevent negative balance on debit
    if (newBalance < 0) {
      return reply.code(400).send({
        error:     'insufficient_balance',
        current:   currentBalance,
        requested: amount,
      });
    }

    // Insert adjustment transaction (immediately completed)
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        account_id:   id,
        type:         'adjustment',
        amount:       Math.abs(amount),
        currency:     account.currency ?? 'USD',
        status:       'completed',
        notes:        `${amount > 0 ? 'Credit' : 'Debit'} by admin (${adminId}): ${reason}`,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (txErr) {
      app.log.error({ err: txErr }, 'admin/adjust: transaction insert failed');
      return reply.code(500).send({ error: 'transaction_failed' });
    }

    // Update account balance
    const { error: balErr } = await supabaseAdmin
      .from('accounts')
      .update({
        balance:     newBalance,
        free_margin: Math.max(0, newBalance - marginUsed),
      })
      .eq('id', id);

    if (balErr) {
      app.log.error({ err: balErr }, 'admin/adjust: balance update failed');
      return reply.code(500).send({ error: 'balance_update_failed' });
    }

    app.log.warn({ adminId, accountId: id, amount, reason }, 'admin: manual balance adjustment');
    return reply.send({ transaction: tx, new_balance: newBalance, delta: amount });
  });



  /**
   * GET /api/admin/risk
   * Risk dashboard: symbol-level exposure, top winning/losing positions,
   * accounts near margin call.
   */
  app.get('/risk', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    // Pull all open trades with account margin info
    interface RawOpenTrade {
      id: number;
      account_id: string;
      symbol: string;
      side: string;
      volume: number | string;
      open_price: number | string;
      stop_loss: number | string | null;
      take_profit: number | string | null;
      open_time: string;
      accounts: {
        user_id: string;
        balance: number | string;
        equity: number | string;
        margin_used: number | string;
        free_margin: number | string;
        leverage: number | string;
      } | null;
    }
    const { data: rawTradesUnsafe, error: tradesErr } = await supabaseAdmin
      .from('trades')
      .select(
        'id, account_id, symbol, side, volume, open_price, stop_loss, take_profit, open_time,' +
        'accounts!inner(user_id, balance, equity, margin_used, free_margin, leverage)',
      )
      .eq('status', 'open')
      .order('open_time', { ascending: false });
    const rawTrades = (rawTradesUnsafe ?? []) as unknown as RawOpenTrade[];

    if (tradesErr) {
      app.log.error({ err: tradesErr }, 'admin/risk: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    const trades = rawTrades;

    // ── 1. Symbol-level net exposure ────────────────────────────────────────
    const symbolMap = new Map<string, { buyVol: number; sellVol: number; midPrice: number }>();
    for (const t of trades) {
      const mid = getMid(t.symbol);
      if (!symbolMap.has(t.symbol)) {
        symbolMap.set(t.symbol, { buyVol: 0, sellVol: 0, midPrice: mid ?? Number(t.open_price) });
      }
      const entry = symbolMap.get(t.symbol)!;
      if (t.side === 'buy') entry.buyVol  += Number(t.volume);
      else                  entry.sellVol += Number(t.volume);
    }

    const symbolExposure = Array.from(symbolMap.entries())
      .map(([symbol, { buyVol, sellVol, midPrice }]) => {
        const cs = contractSize(symbol);
        const netVolume     = buyVol - sellVol;
        const grossExposure = (buyVol + sellVol) * midPrice * cs;
        const netExposure   = netVolume * midPrice * cs;
        return { symbol, buyVol, sellVol, netVolume, midPrice, grossExposure, netExposure };
      })
      .sort((a, b) => Math.abs(b.grossExposure) - Math.abs(a.grossExposure));

    // ── 2. Top winning + losing open positions ───────────────────────────────
    const positionsWithPnL = trades.map((t) => {
      const mid = getMid(t.symbol) ?? Number(t.open_price);
      const pnl = +calculatePnL(
        t.side as 'buy' | 'sell',
        Number(t.volume),
        Number(t.open_price),
        mid,
        t.symbol,
      ).toFixed(2);
      const acc = (t as any).accounts;
      return {
        id:         t.id,
        account_id: t.account_id,
        user_id:    acc?.user_id ?? null,
        symbol:     t.symbol,
        side:       t.side,
        volume:     Number(t.volume),
        open_price: Number(t.open_price),
        mid_price:  mid,
        pnl,
        opened_at:  t.open_time,
      };
    });

    positionsWithPnL.sort((a, b) => b.pnl - a.pnl);
    const topWinning = positionsWithPnL.slice(0, 10);
    const topLosing  = positionsWithPnL.slice(-10).reverse();

    // ── 3. Accounts near margin call ─────────────────────────────────────────
    // Group positions by account_id, compute total unrealized P&L per account
    const accountPnL = new Map<string, number>();
    for (const p of positionsWithPnL) {
      accountPnL.set(p.account_id, (accountPnL.get(p.account_id) ?? 0) + p.pnl);
    }

    const accountsSeen = new Map<string, any>();
    for (const t of trades) {
      if (!accountsSeen.has(t.account_id)) {
        accountsSeen.set(t.account_id, (t as any).accounts);
      }
    }

    const nearMarginCall: {
      account_id: string;
      user_id: string | null;
      balance: number;
      equity: number;
      margin_used: number;
      free_margin: number;
      unrealized_pnl: number;
      margin_level_pct: number;
    }[] = [];

    for (const [accountId, acc] of accountsSeen.entries()) {
      const balance      = Number(acc?.balance ?? 0);
      const marginUsed   = Number(acc?.margin_used ?? 0);
      if (marginUsed <= 0) continue;
      const unrealized   = accountPnL.get(accountId) ?? 0;
      const equity       = balance + unrealized;
      const freeMargin   = equity - marginUsed;
      const marginLevel  = (equity / marginUsed) * 100; // e.g. 200 = 200%
      // Flag if margin level < 150% (approaching the typical 100% call threshold)
      if (marginLevel < 150) {
        nearMarginCall.push({
          account_id:       accountId,
          user_id:          acc?.user_id ?? null,
          balance,
          equity: +equity.toFixed(2),
          margin_used:      +marginUsed.toFixed(2),
          free_margin:      +freeMargin.toFixed(2),
          unrealized_pnl:   +unrealized.toFixed(2),
          margin_level_pct: +marginLevel.toFixed(1),
        });
      }
    }

    nearMarginCall.sort((a, b) => a.margin_level_pct - b.margin_level_pct);

    return reply.send({
      symbol_exposure: symbolExposure,
      top_winning:     topWinning,
      top_losing:      topLosing,
      near_margin_call: nearMarginCall,
      generated_at:    new Date().toISOString(),
    });
  });

  /**
   * GET /api/admin/perf
   * Returns:
   * - p50/p95/p99 latency per route over the last 5 minutes
   * - worker health (last tick per worker, stale if >30s)
   * - price feed health (last tick per symbol, stale if >10s)
   * - WebSocket connection count
   * Admin-only.
   */
  app.get('/perf', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { getTimingStats } = await import('../middleware/timing.js');
    const { getWorkerHealth } = await import('../lib/workerHealth.js');
    const { getPriceFeedHealth } = await import('../lib/quoteCache.js');
    const { getWsConnectionCount } = await import('../feed/pricefeed.js');

    const feedHealth = getPriceFeedHealth();
    const staleSymbols = feedHealth.filter((s) => s.stale).map((s) => s.symbol);

    return reply.send({
      window_minutes: 5,
      generated_at: new Date().toISOString(),
      routes: getTimingStats(),
      workers: getWorkerHealth(),
      price_feed: {
        total_symbols: feedHealth.length,
        stale_count: staleSymbols.length,
        stale_symbols: staleSymbols,
        symbols: feedHealth,
      },
      ws_connections: getWsConnectionCount(),
    });
  });


  /**
   * GET /api/admin/positions
   * Live blotter of EVERY open trade across all users (the MT4 "Open Trades"
   * window). Each row carries the owning account's login plus a live mid price,
   * computed unrealized P&L, and the margin the position is holding. Summary
   * bar totals open count, notional, and buy/sell/net exposure. Admin-only.
   */
  app.get('/positions', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    interface RawOpenTrade {
      id: number;
      account_id: string;
      symbol: string;
      side: string;
      volume: number | string;
      open_price: number | string;
      open_time: string;
      stop_loss: number | string | null;
      take_profit: number | string | null;
      accounts: {
        user_id: string;
        login: number | string | null;
        leverage: number | string;
      } | null;
    }

    const { data: rawUnsafe, error: tradesErr } = await supabaseAdmin
      .from('trades')
      .select(
        'id, account_id, symbol, side, volume, open_price, open_time, stop_loss, take_profit,' +
        'accounts!inner(user_id, login, leverage)',
      )
      .eq('status', 'open')
      .order('open_time', { ascending: false });

    if (tradesErr) {
      app.log.error({ err: tradesErr }, 'admin/positions: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    const raw = (rawUnsafe ?? []) as unknown as RawOpenTrade[];

    let totalNotional = 0;
    let buyNotional = 0;
    let sellNotional = 0;

    const positions = raw.map((t) => {
      const side = (t.side === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell';
      const volume = Number(t.volume);
      const openPrice = Number(t.open_price);
      const mid = getMid(t.symbol) ?? openPrice;
      const acc = t.accounts;
      const leverage = Number(acc?.leverage) || 1;

      const pnl = +calculatePnL(side, volume, openPrice, mid, t.symbol).toFixed(2);
      const notional = +notionalUSD(volume, mid, t.symbol).toFixed(2);
      const margin = +requiredMargin(volume, openPrice, t.symbol, leverage).toFixed(2);

      totalNotional += notional;
      if (side === 'buy') buyNotional += notional;
      else sellNotional += notional;

      return {
        id: t.id,
        account_id: t.account_id,
        user_id: acc?.user_id ?? null,
        login: acc?.login != null ? Number(acc.login) : null,
        symbol: t.symbol,
        side,
        volume,
        open_price: openPrice,
        current_price: mid,
        pnl,
        notional,
        margin,
        open_time: t.open_time,
        stop_loss: t.stop_loss != null ? Number(t.stop_loss) : null,
        take_profit: t.take_profit != null ? Number(t.take_profit) : null,
      };
    });

    // Default ordering: largest absolute P&L first so the most material
    // positions (biggest winners/losers) sit at the top. Client can re-sort.
    positions.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));

    return reply.send({
      positions,
      summary: {
        total_open: positions.length,
        total_notional: +totalNotional.toFixed(2),
        buy_notional: +buyNotional.toFixed(2),
        sell_notional: +sellNotional.toFixed(2),
        net_notional: +(buyNotional - sellNotional).toFixed(2),
      },
      generated_at: new Date().toISOString(),
    });
  });


  /**
   * 21.4 — POST /api/admin/positions/:id/close
   * Force-close any user's open position (MT4 Manager right-click -> Close).
   * Closes at the live mid, settles realized P&L to the owning account,
   * releases the held margin, and stamps reason='admin_close'. Admin-only.
   */
  app.post('/positions/:id/close', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const parsed = PositionIdSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const { id } = parsed.data;

    const { data: trade, error } = await supabaseAdmin
      .from('trades')
      .select('*, accounts!inner(user_id, login, leverage)')
      .eq('id', id)
      .eq('status', 'open')
      .single();

    if (error || !trade) return reply.code(404).send({ error: 'not_found' });

    const acc = (trade as any).accounts;
    const accLeverage = Number(acc?.leverage) || 1;
    const side = ((trade as any).side === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell';

    // Close at the live mid; fall back to open_price if the feed is momentarily empty.
    const closePrice = getMid((trade as any).symbol) ?? Number((trade as any).open_price);

    const profit = +calculatePnL(
      side,
      Number((trade as any).volume),
      Number((trade as any).open_price),
      closePrice,
      (trade as any).symbol,
    ).toFixed(2);

    // CAS guard against a concurrent close (e.g. the client closing the same trade):
    // only the request that actually flips open -> closed settles the P&L/margin.
    const { data: closedRows, error: closeErr } = await supabaseAdmin
      .from('trades')
      .update({
        status: 'closed',
        close_price: closePrice,
        close_time: new Date().toISOString(),
        profit,
        reason: 'admin_close',
      })
      .eq('id', id)
      .eq('status', 'open')
      .select('id');

    if (closeErr) {
      app.log.error({ err: closeErr, tradeId: id }, 'admin force-close: update failed');
      return reply.code(500).send({ error: 'close_failed' });
    }
    if (!closedRows || closedRows.length === 0) {
      return reply.code(409).send({ error: 'already_closed', tradeId: id });
    }

    // Settle realized P&L to balance / equity / free_margin.
    try {
      await supabaseAdmin.rpc('apply_trade_pnl', { p_account_id: (trade as any).account_id, p_amount: profit });
    } catch { /* fire-and-forget; RPC errors are non-fatal to the close */ }

    // Release the margin reserved when the trade was opened.
    const marginReleased = +requiredMargin(
      Number((trade as any).volume),
      Number((trade as any).open_price),
      (trade as any).symbol,
      accLeverage,
    ).toFixed(2);
    try {
      await releaseMargin((trade as any).account_id, marginReleased, app.log);
    } catch (e) {
      app.log.error({ err: e, tradeId: id, marginReleased }, 'admin force-close: failed to release margin');
    }

    app.log.warn(
      { adminId, tradeId: id, login: acc?.login, profit, closePrice },
      'admin: force-closed client position',
    );

    return reply.send({
      tradeId: id,
      status: 'closed',
      close_price: closePrice,
      profit,
      margin_released: marginReleased,
      reason: 'admin_close',
    });
  });

  /**
   * 21.4 — PATCH /api/admin/positions/:id  { stopLoss?, takeProfit? }
   * Admin override of a client's SL/TP (MT4 Manager right-click -> Modify).
   * Either field optional; pass null to clear. At least one must be present.
   * Direction is validated against the live mid when a quote is available.
   * Admin-only.
   */
  app.patch('/positions/:id', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const parsedParams = PositionIdSchema.safeParse(req.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'invalid_input' });
    const { id } = parsedParams.data;

    const parsedBody = ModifyPositionSchema.safeParse(req.body);
    if (!parsedBody.success) return reply.code(400).send({ error: 'invalid_input', issues: parsedBody.error.issues });
    const body = parsedBody.data;

    if (body.stopLoss === undefined && body.takeProfit === undefined) {
      return reply.code(400).send({ error: 'invalid_input', message: 'provide stopLoss or takeProfit' });
    }

    const { data: trade, error } = await supabaseAdmin
      .from('trades')
      .select('*, accounts!inner(login)')
      .eq('id', id)
      .eq('status', 'open')
      .single();

    if (error || !trade) return reply.code(404).send({ error: 'not_found' });

    const side = (trade as any).side === 'sell' ? 'sell' : 'buy';
    const mid = getMid((trade as any).symbol);
    if (mid != null) {
      if (body.stopLoss != null) {
        if (side === 'buy' && body.stopLoss >= mid) {
          return reply.code(400).send({ error: 'invalid_sl', message: 'stop loss for a buy must be below current price', stopLoss: body.stopLoss, price: mid });
        }
        if (side === 'sell' && body.stopLoss <= mid) {
          return reply.code(400).send({ error: 'invalid_sl', message: 'stop loss for a sell must be above current price', stopLoss: body.stopLoss, price: mid });
        }
      }
      if (body.takeProfit != null) {
        if (side === 'buy' && body.takeProfit <= mid) {
          return reply.code(400).send({ error: 'invalid_tp', message: 'take profit for a buy must be above current price', takeProfit: body.takeProfit, price: mid });
        }
        if (side === 'sell' && body.takeProfit >= mid) {
          return reply.code(400).send({ error: 'invalid_tp', message: 'take profit for a sell must be below current price', takeProfit: body.takeProfit, price: mid });
        }
      }
    }

    const updateFields: Record<string, any> = {};
    if (body.stopLoss !== undefined) updateFields.stop_loss = body.stopLoss;
    if (body.takeProfit !== undefined) updateFields.take_profit = body.takeProfit;

    const { error: updErr } = await supabaseAdmin
      .from('trades')
      .update(updateFields)
      .eq('id', id)
      .eq('status', 'open'); // CAS guard: skip if race-closed mid-request

    if (updErr) {
      app.log.error({ err: updErr, tradeId: id }, 'admin modify: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, tradeId: id }, 'admin: modified client position SL/TP');

    return reply.send({
      tradeId: id,
      stopLoss: 'stop_loss' in updateFields ? updateFields.stop_loss : ((trade as any).stop_loss ?? null),
      takeProfit: 'take_profit' in updateFields ? updateFields.take_profit : ((trade as any).take_profit ?? null),
    });
  });

  /**
   * 21.5 — GET /api/admin/analytics/by-symbol
   * Per-asset analytics over a selectable window (24h / 7d / 30d / all).
   * The window filters trades by INCEPTION (`open_time`). For each symbol:
   *   - trade_count / open_count / closed_count
   *   - volume_lots and volume_notional (notional at open_price — deterministic)
   *   - open interest: open_buy_lots / open_sell_lots / net_open_lots,
   *     plus net_open_notional valued at the live mid (B-book exposure)
   *   - realized_client_pnl (sum of closed `profit`); house P&L = −client
   *   - win_rate over closed trades; avg_hold_seconds over closed trades
   *   - top_accounts (most-active by trade count)
   *   - over_exposure flag when |net_open_notional| exceeds the threshold
   * Admin-only. Sorted by volume_notional desc; the client may re-sort.
   */
  app.get('/analytics/by-symbol', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const q = (req.query ?? {}) as { window?: string; threshold?: string; format?: string };
    const windowKey = (['24h', '7d', '30d', 'all'].includes(q.window ?? '')
      ? q.window
      : '7d') as '24h' | '7d' | '30d' | 'all';
    const thr = Number(q.threshold);
    const exposureThreshold = Number.isFinite(thr) && thr > 0 ? thr : 100_000;

    const windowMs: Record<'24h' | '7d' | '30d', number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const since =
      windowKey === 'all' ? null : new Date(Date.now() - windowMs[windowKey]).toISOString();

    interface RawTrade {
      id: number;
      account_id: string;
      symbol: string;
      side: string;
      volume: number | string;
      open_price: number | string;
      status: string;
      profit: number | string | null;
      open_time: string | null;
      close_time: string | null;
      accounts: { user_id: string; login: number | string | null } | null;
    }

    let query = supabaseAdmin
      .from('trades')
      .select(
        'id, account_id, symbol, side, volume, open_price, status, profit, open_time, close_time,' +
          'accounts!inner(user_id, login)',
      );
    if (since) query = query.gte('open_time', since);

    const { data: rawUnsafe, error: tradesErr } = await query;
    if (tradesErr) {
      app.log.error({ err: tradesErr }, 'admin/analytics/by-symbol: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }
    const raw = (rawUnsafe ?? []) as unknown as RawTrade[];

    interface Agg {
      symbol: string;
      trade_count: number;
      open_count: number;
      closed_count: number;
      volume_lots: number;
      volume_notional: number;
      open_buy_lots: number;
      open_sell_lots: number;
      realized_client_pnl: number;
      wins: number;
      hold_seconds_sum: number;
      hold_counted: number;
      accounts: Map<string, { login: number | null; user_id: string | null; trade_count: number }>;
    }

    const map = new Map<string, Agg>();
    const getAgg = (symbol: string): Agg => {
      let a = map.get(symbol);
      if (!a) {
        a = {
          symbol,
          trade_count: 0,
          open_count: 0,
          closed_count: 0,
          volume_lots: 0,
          volume_notional: 0,
          open_buy_lots: 0,
          open_sell_lots: 0,
          realized_client_pnl: 0,
          wins: 0,
          hold_seconds_sum: 0,
          hold_counted: 0,
          accounts: new Map(),
        };
        map.set(symbol, a);
      }
      return a;
    };

    for (const t of raw) {
      const a = getAgg(t.symbol);
      const side = t.side === 'sell' ? 'sell' : 'buy';
      const volume = Number(t.volume);
      const openPrice = Number(t.open_price);

      a.trade_count += 1;
      a.volume_lots += volume;
      a.volume_notional += notionalUSD(volume, openPrice, t.symbol);

      if (t.status === 'open') {
        a.open_count += 1;
        if (side === 'buy') a.open_buy_lots += volume;
        else a.open_sell_lots += volume;
      } else if (t.status === 'closed') {
        a.closed_count += 1;
        const profit = Number(t.profit ?? 0);
        a.realized_client_pnl += profit;
        if (profit > 0) a.wins += 1;
        if (t.open_time && t.close_time) {
          const held = (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 1000;
          if (Number.isFinite(held) && held >= 0) {
            a.hold_seconds_sum += held;
            a.hold_counted += 1;
          }
        }
      }

      // Most-active accounts per symbol (count every trade, any status).
      const acc = t.accounts;
      const login = acc?.login != null ? Number(acc.login) : null;
      const key = acc?.user_id ?? `acct:${t.account_id}`;
      const ar = a.accounts.get(key) ?? { login, user_id: acc?.user_id ?? null, trade_count: 0 };
      ar.trade_count += 1;
      a.accounts.set(key, ar);
    }

    let totalTradeCount = 0;
    let totalVolumeNotional = 0;
    let totalRealizedClientPnl = 0;

    const symbols = Array.from(map.values())
      .map((a) => {
        const mid = getMid(a.symbol) ?? 0;
        const cs = contractSize(a.symbol);
        const netOpenLots = a.open_buy_lots - a.open_sell_lots;
        const netOpenNotional = netOpenLots * (mid || 0) * cs;
        const winRate = a.closed_count > 0 ? a.wins / a.closed_count : 0;
        const avgHoldSeconds =
          a.hold_counted > 0 ? Math.round(a.hold_seconds_sum / a.hold_counted) : null;
        const realizedClient = +a.realized_client_pnl.toFixed(2);

        totalTradeCount += a.trade_count;
        totalVolumeNotional += a.volume_notional;
        totalRealizedClientPnl += realizedClient;

        const topAccounts = Array.from(a.accounts.values())
          .sort((x, y) => y.trade_count - x.trade_count)
          .slice(0, 3);

        return {
          symbol: a.symbol,
          trade_count: a.trade_count,
          open_count: a.open_count,
          closed_count: a.closed_count,
          volume_lots: +a.volume_lots.toFixed(4),
          volume_notional: +a.volume_notional.toFixed(2),
          open_buy_lots: +a.open_buy_lots.toFixed(4),
          open_sell_lots: +a.open_sell_lots.toFixed(4),
          net_open_lots: +netOpenLots.toFixed(4),
          net_open_notional: +netOpenNotional.toFixed(2),
          realized_client_pnl: realizedClient,
          realized_house_pnl: +(-realizedClient).toFixed(2),
          win_rate: +winRate.toFixed(4),
          avg_hold_seconds: avgHoldSeconds,
          top_accounts: topAccounts,
          over_exposure: Math.abs(netOpenNotional) > exposureThreshold,
        };
      })
      .sort((x, y) => y.volume_notional - x.volume_notional);

    if (wantsCsv(q.format)) {
      return sendCsv(reply, csvFilename(`analytics-by-symbol-${windowKey}`), toCsv(BY_SYMBOL_COLUMNS, symbols));
    }

    return reply.send({
      window: windowKey,
      since,
      exposure_threshold: exposureThreshold,
      symbols,
      totals: {
        symbols: symbols.length,
        trade_count: totalTradeCount,
        volume_notional: +totalVolumeNotional.toFixed(2),
        realized_client_pnl: +totalRealizedClientPnl.toFixed(2),
        realized_house_pnl: +(-totalRealizedClientPnl).toFixed(2),
      },
      generated_at: new Date().toISOString(),
    });
  });

  /**
   * GET /api/admin/analytics/overview?days=30
   * Platform-wide daily time-series for the last N days (default 30, max 90) plus
   * lifetime totals that reconcile with GET /api/admin/dashboard.
   *
   * Daily buckets (UTC date YYYY-MM-DD):
   *   - new_users:     profiles created that day (profiles.created_at)
   *   - trade_count:   trades OPENED that day (trades.open_time)
   *   - trade_volume:  notional (at open_price) of trades opened that day
   *   - deposits:      Sum of completed deposit transactions created that day
   *   - withdrawals:   Sum of completed withdrawal transactions created that day
   *   - house_pnl:     -Sum of profit of trades CLOSED that day (trades.close_time)
   *
   * `totals` mirrors the dashboard aggregates (total_users / total_deposits /
   * open_trades / total_exposure — computed identically) so the two screens agree.
   */
  app.get('/analytics/overview', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const q = (req.query ?? {}) as { days?: string; format?: string };
    const reqDays = Number(q.days);
    const days = Number.isFinite(reqDays) ? Math.min(Math.max(Math.trunc(reqDays), 1), 90) : 30;

    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const startUTC = todayUTC - (days - 1) * DAY_MS;
    const sinceIso = new Date(startUTC).toISOString();

    const dayKey = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      const t = Date.parse(iso);
      if (!Number.isFinite(t)) return null;
      return new Date(t).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    };

    const [profilesRes, tradesRes, txRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, created_at'),
      supabaseAdmin
        .from('trades')
        .select('symbol, volume, open_price, status, profit, open_time, close_time'),
      supabaseAdmin.from('transactions').select('type, amount, status, created_at'),
    ]);

    if (profilesRes.error || tradesRes.error || txRes.error) {
      app.log.error(
        { profErr: profilesRes.error, tradeErr: tradesRes.error, txErr: txRes.error },
        'admin/analytics/overview: query failed',
      );
      return reply.code(500).send({ error: 'query_failed' });
    }

    interface Bucket {
      date: string;
      new_users: number;
      trade_count: number;
      trade_volume: number;
      deposits: number;
      withdrawals: number;
      house_pnl: number;
    }
    const buckets = new Map<string, Bucket>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startUTC + i * DAY_MS).toISOString().slice(0, 10);
      buckets.set(date, {
        date, new_users: 0, trade_count: 0, trade_volume: 0, deposits: 0, withdrawals: 0, house_pnl: 0,
      });
    }
    const bump = (date: string | null, fn: (b: Bucket) => void) => {
      if (!date) return;
      const b = buckets.get(date);
      if (b) fn(b);
    };

    // New users (also the lifetime user count → matches dashboard total_users).
    let totalUsers = 0;
    for (const p of (profilesRes.data ?? []) as any[]) {
      totalUsers += 1;
      bump(dayKey(p.created_at), (b) => { b.new_users += 1; });
    }

    // Trades: volume by open day, house P&L by close day; lifetime open exposure.
    let openTradeCount = 0;
    let totalExposure = 0; // dashboard formula: volume * open_price (no contractSize)
    for (const t of (tradesRes.data ?? []) as any[]) {
      const volume = Number(t.volume) || 0;
      const openPrice = Number(t.open_price) || 0;
      bump(dayKey(t.open_time), (b) => {
        b.trade_count += 1;
        b.trade_volume += notionalUSD(volume, openPrice, t.symbol);
      });
      if (t.status === 'closed') {
        const profit = Number(t.profit ?? 0);
        bump(dayKey(t.close_time), (b) => { b.house_pnl += -profit; });
      } else if (t.status === 'open') {
        openTradeCount += 1;
        totalExposure += volume * openPrice;
      }
    }

    // Completed deposits / withdrawals by created day (+ lifetime totals).
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    for (const tx of (txRes.data ?? []) as any[]) {
      if (tx.status !== 'completed') continue;
      const amount = Math.abs(Number(tx.amount) || 0);
      if (tx.type === 'deposit') {
        totalDeposits += amount;
        bump(dayKey(tx.created_at), (b) => { b.deposits += amount; });
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amount;
        bump(dayKey(tx.created_at), (b) => { b.withdrawals += amount; });
      }
    }

    const series = Array.from(buckets.values())
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((b) => ({
        date: b.date,
        new_users: b.new_users,
        trade_count: b.trade_count,
        trade_volume: +b.trade_volume.toFixed(2),
        deposits: +b.deposits.toFixed(2),
        withdrawals: +b.withdrawals.toFixed(2),
        house_pnl: +b.house_pnl.toFixed(2),
      }));

    const windowTotals = series.reduce(
      (acc, b) => {
        acc.new_users += b.new_users;
        acc.trade_count += b.trade_count;
        acc.trade_volume += b.trade_volume;
        acc.deposits += b.deposits;
        acc.withdrawals += b.withdrawals;
        acc.house_pnl += b.house_pnl;
        return acc;
      },
      { new_users: 0, trade_count: 0, trade_volume: 0, deposits: 0, withdrawals: 0, house_pnl: 0 },
    );

    if (wantsCsv(q.format)) {
      return sendCsv(reply, csvFilename(`analytics-overview-${days}d`), toCsv(OVERVIEW_COLUMNS, series));
    }

    return reply.send({
      days,
      since: sinceIso,
      series,
      window_totals: {
        new_users: windowTotals.new_users,
        trade_count: windowTotals.trade_count,
        trade_volume: +windowTotals.trade_volume.toFixed(2),
        deposits: +windowTotals.deposits.toFixed(2),
        withdrawals: +windowTotals.withdrawals.toFixed(2),
        house_pnl: +windowTotals.house_pnl.toFixed(2),
      },
      // Lifetime aggregates — computed exactly like GET /api/admin/dashboard.
      totals: {
        total_users: totalUsers,
        total_deposits: +totalDeposits.toFixed(2),
        total_withdrawals: +totalWithdrawals.toFixed(2),
        net_deposits: +(totalDeposits - totalWithdrawals).toFixed(2),
        open_trades: openTradeCount,
        total_exposure: +totalExposure.toFixed(2),
      },
      generated_at: new Date().toISOString(),
    });
  });

  /**
   * GET /api/admin/analytics/accounts?sort=pnl|net|equity|volume|trades|deposits&limit=200
   * Per-account leaderboard. For every account:
   *   - login / user_id / balance / equity (stored) / margin_used / leverage
   *   - lifetime deposits / withdrawals / net_deposits  (completed transactions)
   *   - realized_pnl   (Sum of closed-trade profit — reconciles with that account's history)
   *   - trade_count / closed_count / win_rate
   *   - unrealized_pnl + current_equity (= balance + unrealized; live mid, falls back to open_price)
   */
  app.get('/analytics/accounts', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const q = (req.query ?? {}) as { sort?: string; limit?: string; format?: string };
    const sortKey = (['pnl', 'net', 'equity', 'volume', 'trades', 'deposits'].includes(q.sort ?? '')
      ? q.sort
      : 'pnl') as 'pnl' | 'net' | 'equity' | 'volume' | 'trades' | 'deposits';
    const reqLimit = Number(q.limit);
    const limitN = Number.isFinite(reqLimit) ? Math.min(Math.max(Math.trunc(reqLimit), 1), 1000) : 200;

    const [accountsRes, tradesRes, txRes] = await Promise.all([
      supabaseAdmin
        .from('accounts')
        .select('id, user_id, login, balance, equity, margin_used, leverage'),
      supabaseAdmin
        .from('trades')
        .select('account_id, symbol, side, volume, open_price, status, profit'),
      supabaseAdmin.from('transactions').select('account_id, type, amount, status'),
    ]);

    if (accountsRes.error || tradesRes.error || txRes.error) {
      app.log.error(
        { acctErr: accountsRes.error, tradeErr: tradesRes.error, txErr: txRes.error },
        'admin/analytics/accounts: query failed',
      );
      return reply.code(500).send({ error: 'query_failed' });
    }

    interface Row {
      account_id: string;
      user_id: string | null;
      login: number | null;
      balance: number;
      stored_equity: number;
      margin_used: number;
      leverage: number;
      deposits: number;
      withdrawals: number;
      realized_pnl: number;
      unrealized_pnl: number;
      trade_count: number;
      closed_count: number;
      wins: number;
    }

    const map = new Map<string, Row>();
    for (const a of (accountsRes.data ?? []) as any[]) {
      map.set(a.id, {
        account_id: a.id,
        user_id: a.user_id ?? null,
        login: a.login != null ? Number(a.login) : null,
        balance: Number(a.balance) || 0,
        stored_equity: a.equity != null ? Number(a.equity) : Number(a.balance) || 0,
        margin_used: Number(a.margin_used) || 0,
        leverage: Number(a.leverage) || 0,
        deposits: 0,
        withdrawals: 0,
        realized_pnl: 0,
        unrealized_pnl: 0,
        trade_count: 0,
        closed_count: 0,
        wins: 0,
      });
    }

    for (const t of (tradesRes.data ?? []) as any[]) {
      const r = map.get(t.account_id);
      if (!r) continue;
      const side = t.side === 'sell' ? 'sell' : 'buy';
      const volume = Number(t.volume) || 0;
      const openPrice = Number(t.open_price) || 0;
      r.trade_count += 1;
      if (t.status === 'closed') {
        const profit = Number(t.profit ?? 0);
        r.closed_count += 1;
        r.realized_pnl += profit;
        if (profit > 0) r.wins += 1;
      } else if (t.status === 'open') {
        const mid = getMid(t.symbol) ?? openPrice;
        r.unrealized_pnl += calculatePnL(side, volume, openPrice, mid, t.symbol);
      }
    }

    for (const tx of (txRes.data ?? []) as any[]) {
      if (tx.status !== 'completed') continue;
      const r = map.get(tx.account_id);
      if (!r) continue;
      const amount = Math.abs(Number(tx.amount) || 0);
      if (tx.type === 'deposit') r.deposits += amount;
      else if (tx.type === 'withdrawal') r.withdrawals += amount;
    }

    const accounts = Array.from(map.values()).map((r) => {
      const netDeposits = r.deposits - r.withdrawals;
      const winRate = r.closed_count > 0 ? r.wins / r.closed_count : 0;
      const currentEquity = r.balance + r.unrealized_pnl;
      return {
        account_id: r.account_id,
        user_id: r.user_id,
        login: r.login,
        balance: +r.balance.toFixed(2),
        equity: +r.stored_equity.toFixed(2),
        current_equity: +currentEquity.toFixed(2),
        margin_used: +r.margin_used.toFixed(2),
        leverage: r.leverage,
        deposits: +r.deposits.toFixed(2),
        withdrawals: +r.withdrawals.toFixed(2),
        net_deposits: +netDeposits.toFixed(2),
        realized_pnl: +r.realized_pnl.toFixed(2),
        unrealized_pnl: +r.unrealized_pnl.toFixed(2),
        trade_count: r.trade_count,
        closed_count: r.closed_count,
        win_rate: +winRate.toFixed(4),
      };
    });

    const sortFns: Record<typeof sortKey, (a: any, b: any) => number> = {
      pnl: (a, b) => b.realized_pnl - a.realized_pnl,
      net: (a, b) => b.net_deposits - a.net_deposits,
      equity: (a, b) => b.current_equity - a.current_equity,
      volume: (a, b) => b.trade_count - a.trade_count,
      trades: (a, b) => b.trade_count - a.trade_count,
      deposits: (a, b) => b.deposits - a.deposits,
    };
    accounts.sort(sortFns[sortKey]);
    const limited = accounts.slice(0, limitN);

    const totals = accounts.reduce(
      (acc, a) => {
        acc.deposits += a.deposits;
        acc.withdrawals += a.withdrawals;
        acc.realized_pnl += a.realized_pnl;
        acc.unrealized_pnl += a.unrealized_pnl;
        acc.balance += a.balance;
        acc.current_equity += a.current_equity;
        acc.trade_count += a.trade_count;
        return acc;
      },
      { deposits: 0, withdrawals: 0, realized_pnl: 0, unrealized_pnl: 0, balance: 0, current_equity: 0, trade_count: 0 },
    );

    if (wantsCsv(q.format)) {
      return sendCsv(reply, csvFilename(`analytics-accounts-${sortKey}`), toCsv(ACCOUNTS_COLUMNS, limited));
    }

    return reply.send({
      sort: sortKey,
      count: accounts.length,
      accounts: limited,
      totals: {
        accounts: accounts.length,
        deposits: +totals.deposits.toFixed(2),
        withdrawals: +totals.withdrawals.toFixed(2),
        net_deposits: +(totals.deposits - totals.withdrawals).toFixed(2),
        realized_client_pnl: +totals.realized_pnl.toFixed(2),
        realized_house_pnl: +(-totals.realized_pnl).toFixed(2),
        unrealized_pnl: +totals.unrealized_pnl.toFixed(2),
        balance: +totals.balance.toFixed(2),
        current_equity: +totals.current_equity.toFixed(2),
        trade_count: totals.trade_count,
      },
      generated_at: new Date().toISOString(),
    });
  });

  /**
   * 21.10 — GET /api/admin/trades
   * Global filtered closed-trades blotter (MT4 Manager "Trade History").
   * Query params (all optional):
   *   from, to   ISO datetime bounds on close_time (gte / lte)
   *   symbol     exact symbol match (e.g. BTCUSD)
   *   account    login NUMBER (resolved to account_id) or a raw account_id
   *   reason     exact close reason (mobile|web|admin_close|stopout|partial_close|...)
   *   sort       close_time|open_time|profit|volume|symbol  (default close_time)
   *   dir        asc|desc                                    (default desc)
   *   limit      page size 1..500                            (default 100)
   *   offset     page offset >= 0                            (default 0)
   * `totals` is computed over the FULL filtered set (not just the page) so it
   * reconciles against raw closed `trades`; `trades` is the sorted page slice.
   * Admin-only.
   */
  app.get('/trades', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const q = (req.query ?? {}) as {
      from?: string; to?: string; symbol?: string; account?: string;
      reason?: string; sort?: string; dir?: string; limit?: string; offset?: string;
    };

    const from = q.from && q.from.trim() ? q.from.trim() : null;
    const to = q.to && q.to.trim() ? q.to.trim() : null;
    const symbol = q.symbol && q.symbol.trim() ? q.symbol.trim() : null;
    const reason = q.reason && q.reason.trim() ? q.reason.trim() : null;
    const accountParam = q.account && q.account.trim() ? q.account.trim() : null;

    const sortKey = (['close_time', 'open_time', 'profit', 'volume', 'symbol'].includes(q.sort ?? '')
      ? q.sort
      : 'close_time') as 'close_time' | 'open_time' | 'profit' | 'volume' | 'symbol';
    const dir = q.dir === 'asc' ? 'asc' : 'desc';

    const reqLimit = Number(q.limit);
    const limitN = Number.isFinite(reqLimit) ? Math.min(Math.max(Math.trunc(reqLimit), 1), 500) : 100;
    const reqOffset = Number(q.offset);
    const offsetN = Number.isFinite(reqOffset) && reqOffset > 0 ? Math.trunc(reqOffset) : 0;

    // Resolve an account filter. A numeric value is treated as a login and
    // resolved to its account_id; a non-numeric value is treated as a raw id.
    let accountIdFilter: string | null = null;
    if (accountParam) {
      const loginNum = Number(accountParam);
      if (Number.isFinite(loginNum) && /^[0-9]+$/.test(accountParam)) {
        const { data: accRow } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('login', loginNum)
          .maybeSingle();
        if (!accRow) {
          // Unknown login -> empty result set (not an error).
          return reply.send({
            trades: [],
            count: 0,
            limit: limitN,
            offset: offsetN,
            filters: { from, to, symbol, account: accountParam, reason },
            sort: sortKey,
            dir,
            totals: {
              count: 0, volume_lots: 0, gross_profit: 0, gross_loss: 0,
              net_profit: 0, realized_client_pnl: 0, realized_house_pnl: 0,
              wins: 0, win_rate: 0,
            },
            generated_at: new Date().toISOString(),
          });
        }
        accountIdFilter = (accRow as any).id;
      } else {
        accountIdFilter = accountParam;
      }
    }

    interface RawClosedTrade {
      id: number;
      account_id: string;
      symbol: string;
      side: string;
      volume: number | string;
      open_price: number | string;
      close_price: number | string | null;
      profit: number | string | null;
      open_time: string | null;
      close_time: string | null;
      reason: string | null;
      accounts: { user_id: string; login: number | string | null } | null;
    }

    let query = supabaseAdmin
      .from('trades')
      .select(
        'id, account_id, symbol, side, volume, open_price, close_price, profit, open_time, close_time, reason,' +
          'accounts!inner(user_id, login)',
      )
      .eq('status', 'closed');
    if (from) query = query.gte('close_time', from);
    if (to) query = query.lte('close_time', to);
    if (symbol) query = query.eq('symbol', symbol);
    if (reason) query = query.eq('reason', reason);
    if (accountIdFilter) query = query.eq('account_id', accountIdFilter);

    const { data: rawUnsafe, error: tradesErr } = await query;
    if (tradesErr) {
      app.log.error({ err: tradesErr }, 'admin/trades: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }
    const raw = (rawUnsafe ?? []) as unknown as RawClosedTrade[];

    const rows = raw.map((t) => {
      const side = (t.side === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell';
      const volume = Number(t.volume);
      const openPrice = Number(t.open_price);
      const closePrice = t.close_price != null ? Number(t.close_price) : null;
      const profit = +Number(t.profit ?? 0).toFixed(2);
      const acc = t.accounts;
      let durationSeconds: number | null = null;
      if (t.open_time && t.close_time) {
        const d = (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 1000;
        if (Number.isFinite(d) && d >= 0) durationSeconds = Math.round(d);
      }
      return {
        id: t.id,
        account_id: t.account_id,
        user_id: acc?.user_id ?? null,
        login: acc?.login != null ? Number(acc.login) : null,
        symbol: t.symbol,
        side,
        volume,
        open_price: openPrice,
        close_price: closePrice,
        profit,
        reason: t.reason ?? null,
        open_time: t.open_time ?? null,
        close_time: t.close_time ?? null,
        duration_seconds: durationSeconds,
      };
    });

    // Totals over the FULL filtered set (so they reconcile against raw trades).
    let grossProfit = 0;
    let grossLoss = 0;
    let volumeLots = 0;
    let wins = 0;
    for (const r of rows) {
      volumeLots += r.volume;
      if (r.profit > 0) {
        grossProfit += r.profit;
        wins += 1;
      } else {
        grossLoss += r.profit;
      }
    }
    const netProfit = grossProfit + grossLoss;
    const winRate = rows.length > 0 ? wins / rows.length : 0;

    const cmpStr = (a: string | null, b: string | null): number => {
      const av = a ?? '';
      const bv = b ?? '';
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const sorters: Record<typeof sortKey, (a: typeof rows[number], b: typeof rows[number]) => number> = {
      close_time: (a, b) => cmpStr(a.close_time, b.close_time),
      open_time: (a, b) => cmpStr(a.open_time, b.open_time),
      profit: (a, b) => a.profit - b.profit,
      volume: (a, b) => a.volume - b.volume,
      symbol: (a, b) => cmpStr(a.symbol, b.symbol),
    };
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const primary = sorters[sortKey](a, b) * mult;
      if (primary !== 0) return primary;
      // Stable tiebreaker by id (desc) so paging is deterministic.
      return b.id - a.id;
    });

    const page = rows.slice(offsetN, offsetN + limitN);

    return reply.send({
      trades: page,
      count: rows.length,
      limit: limitN,
      offset: offsetN,
      filters: { from, to, symbol, account: accountParam, reason },
      sort: sortKey,
      dir,
      totals: {
        count: rows.length,
        volume_lots: +volumeLots.toFixed(4),
        gross_profit: +grossProfit.toFixed(2),
        gross_loss: +grossLoss.toFixed(2),
        net_profit: +netProfit.toFixed(2),
        realized_client_pnl: +netProfit.toFixed(2),
        realized_house_pnl: +(-netProfit).toFixed(2),
        wins,
        win_rate: +winRate.toFixed(4),
      },
      generated_at: new Date().toISOString(),
    });
  });

  /**
   * 18.8a — GET /api/admin/robot-runs
   * Operator robot-run log (the "Robot Runs" page of the MT4-style manager
   * panel). Lists `robot_runs` rows stitched to their robot's name and the
   * owning account's login/user_id. robot_runs -> robots(account_id) ->
   * accounts(login) is a two-hop relation, so the join is stitched in-route
   * (the same approach used wherever there's no direct FK to embed).
   * Query params (all optional):
   *   from, to   ISO datetime bounds on triggered_at (gte / lte)
   *   action     exact run action  (open_trade|close_trade|tip|noop)
   *   robot      exact robot_id (uuid)
   *   account    login NUMBER (resolved to its account_id) or a raw account_id
   *   dir        asc|desc on triggered_at                     (default desc)
   *   limit      page size 1..500                             (default 100)
   *   offset     page offset >= 0                             (default 0)
   * `totals` (count + per-action breakdown + trades_opened) is computed over
   * the FULL filtered set so it reconciles against raw `robot_runs`; `runs` is
   * the sorted page slice. Admin-only.
   */
  app.get('/robot-runs', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const q = (req.query ?? {}) as {
      from?: string; to?: string; action?: string; robot?: string;
      account?: string; dir?: string; limit?: string; offset?: string;
    };

    const from = q.from && q.from.trim() ? q.from.trim() : null;
    const to = q.to && q.to.trim() ? q.to.trim() : null;
    const action = q.action && q.action.trim() ? q.action.trim() : null;
    const robotId = q.robot && q.robot.trim() ? q.robot.trim() : null;
    const accountParam = q.account && q.account.trim() ? q.account.trim() : null;
    const dir = q.dir === 'asc' ? 'asc' : 'desc';

    const reqLimit = Number(q.limit);
    const limitN = Number.isFinite(reqLimit) ? Math.min(Math.max(Math.trunc(reqLimit), 1), 500) : 100;
    const reqOffset = Number(q.offset);
    const offsetN = Number.isFinite(reqOffset) && reqOffset > 0 ? Math.trunc(reqOffset) : 0;

    const emptyResponse = () =>
      reply.send({
        runs: [],
        count: 0,
        limit: limitN,
        offset: offsetN,
        filters: { from, to, action, robot: robotId, account: accountParam },
        dir,
        totals: { count: 0, trades_opened: 0, by_action: {} as Record<string, number> },
        generated_at: new Date().toISOString(),
      });

    // Resolve an optional account filter. A numeric value is a login resolved
    // to its account_id; a non-numeric value is treated as a raw account_id.
    let accountIdFilter: string | null = null;
    if (accountParam) {
      const loginNum = Number(accountParam);
      if (Number.isFinite(loginNum) && /^[0-9]+$/.test(accountParam)) {
        const { data: accRow } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('login', loginNum)
          .maybeSingle();
        if (!accRow) return emptyResponse(); // unknown login -> empty, not an error
        accountIdFilter = (accRow as any).id;
      } else {
        accountIdFilter = accountParam;
      }
    }

    // Build the robot -> {name, account_id} map. Scope to the filtered account
    // when present so we can both name the runs and restrict the run query.
    interface RawRobot { id: string; name: string | null; account_id: string }
    let robotQuery = supabaseAdmin.from('robots').select('id, name, account_id');
    if (accountIdFilter) robotQuery = robotQuery.eq('account_id', accountIdFilter);
    const { data: robotsUnsafe, error: robotsErr } = await robotQuery;
    if (robotsErr) {
      app.log.error({ err: robotsErr }, 'admin/robot-runs: robots query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }
    const robots = (robotsUnsafe ?? []) as unknown as RawRobot[];
    const robotMap = new Map<string, RawRobot>();
    for (const r of robots) robotMap.set(r.id, r);

    // If an account filter is set and it owns no robots, there can be no runs.
    if (accountIdFilter && robots.length === 0) return emptyResponse();

    // Account map for login/user_id stitching.
    const { data: accountsUnsafe, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, login, user_id');
    if (accErr) {
      app.log.error({ err: accErr }, 'admin/robot-runs: accounts query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }
    interface RawAcct { id: string; login: number | string | null; user_id: string }
    const accountMap = new Map<string, RawAcct>();
    for (const a of (accountsUnsafe ?? []) as unknown as RawAcct[]) accountMap.set(a.id, a);

    interface RawRun {
      id: number;
      robot_id: string;
      triggered_at: string | null;
      action: string | null;
      trade_id: number | null;
      notes: string | null;
    }

    let runQuery = supabaseAdmin
      .from('robot_runs')
      .select('id, robot_id, triggered_at, action, trade_id, notes');
    if (from) runQuery = runQuery.gte('triggered_at', from);
    if (to) runQuery = runQuery.lte('triggered_at', to);
    if (action) runQuery = runQuery.eq('action', action);
    if (robotId) runQuery = runQuery.eq('robot_id', robotId);
    if (accountIdFilter) runQuery = runQuery.in('robot_id', robots.map((r) => r.id));

    const { data: runsUnsafe, error: runsErr } = await runQuery;
    if (runsErr) {
      app.log.error({ err: runsErr }, 'admin/robot-runs: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }
    const raw = (runsUnsafe ?? []) as unknown as RawRun[];

    const rows = raw.map((run) => {
      const robot = robotMap.get(run.robot_id) ?? null;
      const acc = robot ? accountMap.get(robot.account_id) ?? null : null;
      return {
        id: run.id,
        robot_id: run.robot_id,
        robot_name: robot?.name ?? null,
        account_id: robot?.account_id ?? null,
        login: acc?.login != null ? Number(acc.login) : null,
        user_id: acc?.user_id ?? null,
        triggered_at: run.triggered_at ?? null,
        action: run.action ?? null,
        trade_id: run.trade_id ?? null,
        notes: run.notes ?? null,
      };
    });

    // Totals over the FULL filtered set (reconcile against raw robot_runs).
    const byAction: Record<string, number> = {};
    let tradesOpened = 0;
    for (const r of rows) {
      const key = r.action ?? 'unknown';
      byAction[key] = (byAction[key] ?? 0) + 1;
      if (r.action === 'open_trade' && r.trade_id != null) tradesOpened += 1;
    }

    const cmpStr = (a: string | null, b: string | null): number => {
      const av = a ?? '';
      const bv = b ?? '';
      return av < bv ? -1 : av > bv ? 1 : 0;
    };
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const primary = cmpStr(a.triggered_at, b.triggered_at) * mult;
      if (primary !== 0) return primary;
      return b.id - a.id; // stable tiebreak by id desc
    });

    const page = rows.slice(offsetN, offsetN + limitN);

    return reply.send({
      runs: page,
      count: rows.length,
      limit: limitN,
      offset: offsetN,
      filters: { from, to, action, robot: robotId, account: accountParam },
      dir,
      totals: { count: rows.length, trades_opened: tradesOpened, by_action: byAction },
      generated_at: new Date().toISOString(),
    });
  });

  /**
   * GET /api/admin/online?minutes=N
   * 21.13 — Online-users monitor. Lists every account whose `last_seen` falls
   * within the last N minutes (default 5, clamped 1..1440). `last_seen` is
   * stamped (throttled) from authUser() on every authenticated request.
   * Each row carries the owning user's display_name + is_admin (stitched by
   * user_id, since profiles<->accounts have no direct FK) and seconds_ago.
   * Sorted most-recently-seen first.
   */
  app.get('/online', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { minutes } = req.query as { minutes?: string };
    let windowMin = parseInt(minutes ?? '', 10);
    if (isNaN(windowMin)) windowMin = 5;
    windowMin = Math.max(1, Math.min(1440, windowMin));

    const now = Date.now();
    const cutoff = new Date(now - windowMin * 60_000).toISOString();

    const { data: accts, error } = await supabaseAdmin
      .from('accounts')
      .select('id, login, user_id, last_seen, balance, type, status')
      .gte('last_seen', cutoff)
      .order('last_seen', { ascending: false })
      .limit(500);
    if (error) {
      app.log.error({ err: error }, 'admin/online: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    const rows = accts ?? [];

    // Stitch display_name + is_admin from profiles by user_id.
    const uids = Array.from(new Set(rows.map((a: any) => a.user_id).filter(Boolean)));
    const profMap: Record<string, { display_name: string | null; is_admin: boolean }> = {};
    if (uids.length) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, is_admin')
        .in('id', uids);
      for (const p of (profs ?? []) as any[]) {
        profMap[p.id] = { display_name: p.display_name ?? null, is_admin: Boolean(p.is_admin) };
      }
    }

    const online = rows.map((a: any) => {
      const seen = a.last_seen ? new Date(a.last_seen).getTime() : null;
      const secondsAgo = seen != null ? Math.max(0, Math.round((now - seen) / 1000)) : null;
      const prof = profMap[a.user_id] ?? { display_name: null, is_admin: false };
      return {
        account_id: a.id,
        login: a.login ?? null,
        user_id: a.user_id ?? null,
        display_name: prof.display_name,
        is_admin: prof.is_admin,
        balance: Number(a.balance) || 0,
        type: a.type ?? null,
        status: a.status ?? null,
        last_seen: a.last_seen ?? null,
        seconds_ago: secondsAgo,
      };
    });

    return reply.send({
      online,
      count: online.length,
      window_minutes: windowMin,
      generated_at: new Date(now).toISOString(),
    });
  });

  /**
   * POST /api/admin/notify
   * 21.16 — operator broadcast / direct client notification.
   * Compose a message to ONE client (by account `login` or `userId`) or to ALL
   * clients (`audience: 'all'`). Each recipient gets a row in the `notifications`
   * table (kind='system') — the in-app feed is the source of truth — and a
   * best-effort Expo push on top. Push failures never fail the request.
   */
  app.post('/notify', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const parsed = NotifySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    }
    const { title, body, audience, login, userId, symbol, data } = parsed.data;

    // Resolve the set of recipient user_ids.
    let userIds: string[] = [];
    if (audience === 'all') {
      const { data: profs, error } = await supabaseAdmin
        .from('profiles')
        .select('id');
      if (error) {
        app.log.error({ err: error }, 'admin/notify: profiles query failed');
        return reply.code(500).send({ error: 'query_failed' });
      }
      userIds = Array.from(
        new Set((profs ?? []).map((p: any) => p.id).filter(Boolean) as string[]),
      );
    } else {
      // Single client — resolve by explicit userId, else by account login.
      let targetUserId: string | null = null;
      if (userId) {
        targetUserId = userId;
      } else if (login != null) {
        const { data: acc, error } = await supabaseAdmin
          .from('accounts')
          .select('user_id')
          .eq('login', login)
          .maybeSingle();
        if (error) {
          app.log.error({ err: error }, 'admin/notify: account lookup failed');
          return reply.code(500).send({ error: 'query_failed' });
        }
        targetUserId = (acc?.user_id as string | undefined) ?? null;
        if (!targetUserId) return reply.code(404).send({ error: 'account_not_found' });
      } else {
        return reply.code(400).send({
          error: 'missing_target',
          message: 'Provide login or userId, or set audience=all.',
        });
      }
      userIds = [targetUserId];
    }

    if (userIds.length === 0) {
      return reply.send({ ok: true, audience, recipients: 0 });
    }

    // Persist one in-app notification per recipient (source of truth).
    const meta = { ...(data ?? {}), broadcast: audience === 'all', from_admin: adminId };
    const rows = userIds.map((uid) => ({
      user_id: uid,
      kind: 'system',
      title,
      body,
      symbol: symbol ?? null,
      data: meta,
    }));
    const { error: insErr } = await supabaseAdmin.from('notifications').insert(rows);
    if (insErr) {
      app.log.error({ err: insErr }, 'admin/notify: insert failed');
      return reply.code(500).send({ error: 'insert_failed' });
    }

    // Best-effort push (mobile bonus). sendPushBatch never throws and silently
    // skips users without a registered token.
    await sendPushBatch(
      userIds.map((uid) => ({
        userId: uid,
        payload: { title, body, data: { ...meta, kind: 'system' } },
      })),
    );

    return reply.send({ ok: true, audience, recipients: userIds.length });
  });

}
