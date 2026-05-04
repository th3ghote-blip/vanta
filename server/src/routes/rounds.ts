import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getMid } from '../lib/quoteCache.js';

const OpenRoundSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string(),
  direction: z.enum(['buy', 'sell']),
  stake: z.number().positive(),
  durationSeconds: z.number().int().positive(),
});

export async function roundsRoutes(app: FastifyInstance) {
  app.post('/open', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = OpenRoundSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const body = parsed.data;

    const entry = getMid(body.symbol);
    if (entry == null) return reply.code(400).send({ error: 'no_quote' });

    const multiplier = payoutFor(body.durationSeconds);
    const closesAt = new Date(Date.now() + body.durationSeconds * 1000).toISOString();

    const { data: round, error } = await supabaseAdmin
      .from('binary_rounds')
      .insert({
        account_id: body.accountId,
        symbol: body.symbol,
        direction: body.direction,
        stake: body.stake,
        payout_multiplier: multiplier,
        entry_price: entry,
        duration_seconds: body.durationSeconds,
        closes_at: closesAt,
      })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: 'insert_failed' });
    return { round };
  });
}

function payoutFor(seconds: number): number {
  if (seconds <= 60) return 1.85;
  if (seconds <= 300) return 1.78;
  if (seconds <= 900) return 1.72;
  return 1.65;
}
