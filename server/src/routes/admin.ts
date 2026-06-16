import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getMid } from '../lib/quoteCache.js';
import { calculatePnL, contractSize, notionalUSD } from '../lib/contracts.js';
import { requiredMargin, releaseMargin } from '../lib/margin.js';

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
    async function attachAccounts(profs: any[]): Promise<any[]> {
      if (!profs.length) return [];
      const ids = profs.map((p) => p.id);
      const { data: accts } = await supabaseAdmin
        .from('accounts')
        .select('id, login, type, status, balance, currency, user_id')
        .in('user_id', ids);
      const byUser: Record<string, any[]> = {};
      for (const a of accts ?? []) {
        (byUser[a.user_id] ??= []).push({
          id: a.id, login: a.login, type: a.type, status: a.status, balance: a.balance, currency: a.currency,
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
        .select('id, login, type, status, balance, currency, user_id')
        .eq('login', loginNum)
        .limit(10);
      if (error) return reply.code(500).send({ error: 'query_failed' });
      const accts = data ?? [];
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
        accounts: [{ id: a.id, login: a.login, type: a.type, status: a.status, balance: a.balance, currency: a.currency }],
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

}
