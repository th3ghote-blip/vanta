import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

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

    if (!search) {
      // No query — return most-recently-created 50 users
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, is_admin, created_at, accounts(id, login, type, status, balance, currency)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return reply.code(500).send({ error: 'query_failed' });
      return reply.send({ users: data ?? [] });
    }

    // Try login number first (numeric exact match)
    const loginNum = parseInt(search, 10);
    if (!isNaN(loginNum) && String(loginNum) === search) {
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('id, login, type, status, balance, currency, profiles!inner(id, display_name, is_admin, created_at)')
        .eq('login', loginNum)
        .limit(10);
      if (error) return reply.code(500).send({ error: 'query_failed' });
      // Reshape to profiles-first form
      const users = (data ?? []).map((a: any) => ({
        ...a.profiles,
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
      .select('id, display_name, is_admin, created_at, accounts(id, login, type, status, balance, currency)')
      .in('id', ids);
    if (profErr) return reply.code(500).send({ error: 'profile_query_failed' });

    // Attach email from auth.users
    const emailMap: Record<string, string> = {};
    for (const u of matching) emailMap[u.id] = u.email ?? '';
    const users = (profiles ?? []).map((p: any) => ({ ...p, email: emailMap[p.id] ?? '' }));
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


}
