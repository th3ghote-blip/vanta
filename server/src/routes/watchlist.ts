/**
 * Watchlist endpoints — T.12
 *
 * GET    /api/watchlist          — list the caller's starred symbols (string[])
 * POST   /api/watchlist          — star a symbol   { symbol: string }
 * DELETE /api/watchlist/:symbol  — unstar a symbol
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

const AddSchema = z.object({
  symbol: z.string().min(1).max(30).toUpperCase(),
});

export async function watchlistRoutes(app: FastifyInstance) {
  // ── GET /api/watchlist ───────────────────────────────────────────────────
  app.get('/', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('user_watchlist')
      .select('symbol, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      app.log.error({ err: error }, 'watchlist: list failed');
      return reply.code(500).send({ error: 'internal' });
    }

    return reply.send({ symbols: (data ?? []).map((r: { symbol: string }) => r.symbol) });
  });

  // ── POST /api/watchlist ──────────────────────────────────────────────────
  app.post('/', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = AddSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
    }
    const { symbol } = parsed.data;

    // ON CONFLICT DO NOTHING — starring an already-starred symbol is a no-op.
    const { error } = await supabaseAdmin
      .from('user_watchlist')
      .upsert({ user_id: userId, symbol }, { onConflict: 'user_id,symbol', ignoreDuplicates: true });

    if (error) {
      app.log.error({ err: error }, 'watchlist: add failed');
      return reply.code(500).send({ error: 'internal' });
    }

    return reply.code(201).send({ ok: true, symbol });
  });

  // ── DELETE /api/watchlist/:symbol ────────────────────────────────────────
  app.delete('/:symbol', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const symbol = ((req.params as Record<string, string>).symbol ?? '').toUpperCase();
    if (!symbol) return reply.code(400).send({ error: 'invalid_input' });

    const { error } = await supabaseAdmin
      .from('user_watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol);

    if (error) {
      app.log.error({ err: error }, 'watchlist: remove failed');
      return reply.code(500).send({ error: 'internal' });
    }

    return reply.send({ ok: true, symbol });
  });
}
