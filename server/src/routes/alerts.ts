/**
 * Price alert endpoints — Phase 6.4
 *
 * GET  /api/alerts           — list caller's alerts (optionally ?active=true)
 * POST /api/alerts           — create an alert {symbol, threshold, direction}
 * DELETE /api/alerts/:id     — cancel an alert (own only)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

const CreateAlertSchema = z.object({
  symbol:    z.string().min(1).max(20),
  threshold: z.number().positive(),
  direction: z.enum(['above', 'below']),
});

export async function alertsRoutes(app: FastifyInstance) {
  // ─── GET /api/alerts ─────────────────────────────────────────────────────
  app.get('/', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const qs = req.query as Record<string, string>;
    let query = supabaseAdmin
      .from('price_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (qs.active === 'true') {
      query = query.is('triggered_at', null);
    }

    const { data, error } = await query;
    if (error) {
      app.log.error({ err: error }, 'alerts: list failed');
      return reply.code(500).send({ error: 'internal' });
    }
    return reply.send({ alerts: data ?? [] });
  });

  // ─── POST /api/alerts ────────────────────────────────────────────────────
  app.post('/', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CreateAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
    }
    const { symbol, threshold, direction } = parsed.data;

    // Upsert: if an active alert for same (user, symbol, direction) already exists,
    // replace it with the new threshold (the partial unique index enforces uniqueness).
    // We do this as delete + insert to work around ON CONFLICT with partial indexes.
    await supabaseAdmin
      .from('price_alerts')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .eq('direction', direction)
      .is('triggered_at', null);

    const { data, error } = await supabaseAdmin
      .from('price_alerts')
      .insert({ user_id: userId, symbol, threshold, direction })
      .select()
      .single();

    if (error) {
      app.log.error({ err: error }, 'alerts: insert failed');
      return reply.code(500).send({ error: 'internal' });
    }
    return reply.code(201).send({ alert: data });
  });

  // ─── DELETE /api/alerts/:id ──────────────────────────────────────────────
  app.delete('/:id', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params as { id: string };

    const { error } = await supabaseAdmin
      .from('price_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // ownership guard

    if (error) {
      app.log.error({ err: error }, 'alerts: delete failed');
      return reply.code(500).send({ error: 'internal' });
    }
    return reply.send({ ok: true });
  });
}
