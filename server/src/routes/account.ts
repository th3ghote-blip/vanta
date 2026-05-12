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
}
