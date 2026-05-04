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
}
