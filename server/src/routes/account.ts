import type { FastifyInstance } from 'fastify';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

/**
 * Bootstrap endpoint: ensures the user has at least one account row
 * (and a profile). Idempotent. Useful as a fallback if the auth.users
 * trigger from migration 002 hasn't been applied yet.
 */
export async function accountRoutes(app: FastifyInstance) {
  app.post('/init', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    // Profile (idempotent via on conflict do nothing isn't natively supported in
    // supabase-js, so check-then-insert)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(userId);
      const displayName = userRow.user?.email?.split('@')[0] ?? 'trader';
      await supabaseAdmin.from('profiles').insert({ id: userId, display_name: displayName });
    }

    // Account
    const { data: existingAccount } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingAccount) {
      return { account: existingAccount, created: false };
    }

    const { data: newAccount, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        user_id: userId,
        type: 'demo',
        status: 'active',
        balance: 10_000,
        equity: 10_000,
        free_margin: 10_000,
        currency: 'USD',
      })
      .select()
      .single();

    if (error) {
      app.log.error({ error }, 'account/init: insert failed');
      return reply.code(500).send({ error: error.message });
    }

    return { account: newAccount, created: true };
  });

  /** GET /api/account/profile -- return the caller's profile row (includes is_admin). */
  app.get('/profile', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) return reply.code(404).send({ error: 'profile_not_found' });
    return reply.send({ profile });
  });

  /**
   * PUT /api/account/notification-prefs
   * Update the caller's notification preference flags.
   * Body: { prefs: { price_alerts?: boolean, robot_signals?: boolean,
   *                  trade_results?: boolean, promotional?: boolean } }
   * Unknown keys are silently ignored. Only explicitly provided keys are merged
   * into the existing JSONB value — omitted keys retain their current setting.
   */
  app.put('/notification-prefs', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as { prefs?: unknown };
    if (!body?.prefs || typeof body.prefs !== 'object' || Array.isArray(body.prefs)) {
      return reply.code(400).send({ error: 'invalid_body', message: 'prefs object required' });
    }

    // Whitelist allowed keys and types.
    const allowed = new Set(['price_alerts', 'robot_signals', 'trade_results', 'promotional']);
    const sanitized: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.prefs as Record<string, unknown>)) {
      if (allowed.has(k) && typeof v === 'boolean') sanitized[k] = v;
    }

    if (Object.keys(sanitized).length === 0) {
      return reply.code(400).send({ error: 'invalid_body', message: 'no valid pref keys provided' });
    }

    // Fetch current prefs and merge so omitted keys stay unchanged.
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('notification_prefs')
      .eq('id', userId)
      .single();

    const merged = { ...(existing?.notification_prefs as Record<string, boolean> ?? {}), ...sanitized };

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update({ notification_prefs: merged })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      app.log.error({ error }, 'account/notification-prefs: update failed');
      return reply.code(500).send({ error: error.message });
    }
    return reply.send({ profile });
  });

  /**
   * PATCH /api/account/hedging
   * Toggle hedging mode on an account.  In netting mode (hedging_enabled=false,
   * the default) opening a trade in the opposite direction of an existing
   * position nets them out.  In hedging mode both legs coexist.
   * Body: { accountId: string, enabled: boolean }
   */
  app.patch('/hedging', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as { accountId?: unknown; enabled?: unknown };
    if (typeof body?.accountId !== 'string' || typeof body?.enabled !== 'boolean') {
      return reply.code(400).send({ error: 'invalid_body', message: 'accountId (string) and enabled (boolean) required' });
    }

    // Verify ownership.
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id')
      .eq('id', body.accountId)
      .single();

    if (!account || account.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('accounts')
      .update({ hedging_enabled: body.enabled })
      .eq('id', body.accountId)
      .select()
      .single();

    if (error) {
      app.log.error({ error }, 'account/hedging: update failed');
      return reply.code(500).send({ error: error.message });
    }

    return reply.send({ account: updated });
  });

  /**
   * GET /api/account/all
   * Returns all accounts belonging to the caller, sorted oldest-first.
   * T.10 — used by the account switcher in AccountHeader.
   */
  app.get('/all', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      app.log.error({ error }, 'account/all: query failed');
      return reply.code(500).send({ error: error.message });
    }
    return reply.send({ accounts: data ?? [] });
  });

  /**
   * POST /api/account/open
   * Open an additional trading account for the caller (demo or live).
   * Capped at 5 accounts per user.
   * Body: { type?: 'demo' | 'live' }  — defaults to 'demo'.
   * T.10
   */
  app.post('/open', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as { type?: unknown };
    const type: 'demo' | 'live' = body?.type === 'live' ? 'live' : 'demo';

    // Cap at 5 accounts.
    const { count, error: countErr } = await supabaseAdmin
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) {
      app.log.error({ countErr }, 'account/open: count failed');
      return reply.code(500).send({ error: countErr.message });
    }
    if ((count ?? 0) >= 5) {
      return reply.code(400).send({ error: 'account_limit', message: 'Maximum 5 accounts per user' });
    }

    const { data: newAccount, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        user_id: userId,
        type,
        status: 'active',
        balance: 10_000,
        equity: 10_000,
        free_margin: 10_000,
        currency: 'USD',
        is_primary: false,
      })
      .select()
      .single();

    if (error) {
      app.log.error({ error }, 'account/open: insert failed');
      return reply.code(500).send({ error: error.message });
    }

    return reply.code(201).send({ account: newAccount });
  });

  /**
   * PATCH /api/account/set-primary
   * Marks one account as the user's primary/active account (for cross-device sync).
   * Clears is_primary on all other accounts belonging to the user.
   * Body: { accountId: string }
   * T.10
   */
  app.patch('/set-primary', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as { accountId?: unknown };
    if (typeof body?.accountId !== 'string') {
      return reply.code(400).send({ error: 'invalid_body', message: 'accountId (string) required' });
    }

    // Verify ownership.
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id')
      .eq('id', body.accountId)
      .eq('user_id', userId)
      .single();

    if (!account) return reply.code(403).send({ error: 'forbidden' });

    // Clear all primary flags for this user, then promote the target.
    await supabaseAdmin
      .from('accounts')
      .update({ is_primary: false })
      .eq('user_id', userId);

    const { data: updated, error } = await supabaseAdmin
      .from('accounts')
      .update({ is_primary: true })
      .eq('id', body.accountId)
      .select()
      .single();

    if (error) {
      app.log.error({ error }, 'account/set-primary: update failed');
      return reply.code(500).send({ error: error.message });
    }

    return reply.send({ account: updated });
  });
}
