/**
 * In-app notifications feed (robot tips, system alerts).
 *
 * GET   /api/notifications            — caller's notifications, newest first
 * GET   /api/notifications/unread     — unread count
 * POST  /api/notifications/read       — mark all (or {ids}) as read
 *
 * Rows are written server-side (service role) by the robot engine; users only
 * read/mark-read their own (also enforced by RLS for direct client reads).
 */
import type { FastifyInstance } from 'fastify';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id, kind, title, body, symbol, data, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return reply.code(500).send({ error: 'query_failed' });
    return { notifications: data ?? [] };
  });

  app.get('/unread', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) return reply.code(500).send({ error: 'query_failed' });
    return { unread: count ?? 0 };
  });

  app.post('/read', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = (req.body ?? {}) as { ids?: number[] };
    let q = supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (Array.isArray(body.ids) && body.ids.length) {
      q = q.in('id', body.ids);
    }
    const { error } = await q;
    if (error) return reply.code(500).send({ error: 'update_failed' });
    return { ok: true };
  });
}
