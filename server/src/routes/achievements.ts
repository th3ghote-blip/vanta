/**
 * GET /api/achievements — return the authenticated user's unlocked badges + metadata.
 *
 * Response: { achievements: { code, unlocked_at }[], meta: Record<code, { label, emoji, description }> }
 */
import type { FastifyInstance } from 'fastify';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { ACHIEVEMENT_META } from '../lib/achievements.js';

export async function achievementsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('achievements')
      .select('code, unlocked_at')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: true });

    if (error) {
      app.log.error({ error }, 'achievements: fetch failed');
      return reply.code(500).send({ error: 'fetch_failed' });
    }

    return { achievements: data ?? [], meta: ACHIEVEMENT_META };
  });
}
