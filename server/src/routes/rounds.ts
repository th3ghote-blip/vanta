import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getMid } from '../lib/quoteCache.js';
import { isRealtimeSymbol } from '../feed/pricefeed.js';

/** 5s/30s rounds require a real-time (Coinbase) feed; Yahoo assets are too slow. */
const REALTIME_MIN_SECONDS = 60;

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

    // Gate ultra-short rounds to real-time assets (see REALTIME_MIN_SECONDS).
    if (body.durationSeconds < REALTIME_MIN_SECONDS && !isRealtimeSymbol(body.symbol)) {
      return reply.code(400).send({ error: 'duration_requires_realtime', minSeconds: REALTIME_MIN_SECONDS });
    }

    // 1. Fetch account and verify ownership
    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, balance')
      .eq('id', body.accountId)
      .single();

    if (accErr || !account) return reply.code(400).send({ error: 'account_not_found' });
    if (account.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    // 2. Balance check
    const balance = Number(account.balance);
    if (balance < body.stake) {
      return reply.code(400).send({
        error: 'insufficient_balance',
        required: body.stake,
        available: balance,
      });
    }

    // 3. Deduct stake atomically before inserting the round
    const { error: deductErr } = await supabaseAdmin.rpc('apply_trade_pnl', {
      p_account_id: body.accountId,
      p_amount: -body.stake,
    });
    if (deductErr) {
      app.log.error({ err: deductErr, accountId: body.accountId }, 'rounds: stake deduct failed');
      return reply.code(500).send({ error: 'deduct_failed' });
    }

    // 4. Insert the round (account_id already stored)
    const entry = getMid(body.symbol);
    if (entry == null) {
      // Refund the stake — no quote available
      await supabaseAdmin.rpc('apply_trade_pnl', {
        p_account_id: body.accountId,
        p_amount: body.stake,
      });
      return reply.code(400).send({ error: 'no_quote' });
    }

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

    if (error) {
      // Compensating transaction — refund stake on insert failure
      app.log.error({ err: error, accountId: body.accountId }, 'rounds: insert failed, refunding stake');
      await supabaseAdmin.rpc('apply_trade_pnl', {
        p_account_id: body.accountId,
        p_amount: body.stake,
      });
      return reply.code(500).send({ error: 'insert_failed' });
    }

    return { round };
  });
}

// Payout multiplier per duration. MUST match the DURATIONS table the client
// shows on the Quick screen (components/fun/QuickTradeScreen.tsx) — otherwise
// the odds on the button differ from what we actually credit on a win.
// Source of truth: the displayed value is the promise; honour it exactly.
const PAYOUT_BY_SECONDS: Record<number, number> = {
  5: 2.0,
  30: 1.92,
  60: 1.85,
  300: 1.78,
  900: 1.72,
  1800: 1.65,
  14400: 1.55,
  86400: 1.45,
};

function payoutFor(seconds: number): number {
  // Exact match for a known duration; otherwise interpolate down a sane curve
  // (shorter = higher) so an unlisted duration never over- or under-pays wildly.
  if (PAYOUT_BY_SECONDS[seconds] != null) return PAYOUT_BY_SECONDS[seconds];
  if (seconds <= 60) return 1.85;
  if (seconds <= 300) return 1.78;
  if (seconds <= 900) return 1.72;
  if (seconds <= 1800) return 1.65;
  if (seconds <= 14400) return 1.55;
  return 1.45;
}
