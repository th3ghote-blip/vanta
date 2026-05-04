import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getQuote } from '../lib/quoteCache.js';
import { calculatePnL } from '../lib/contracts.js';

const OpenOrderSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  volume: z.number().positive(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  reason: z.enum(['mobile', 'web', 'desktop', 'robot']).default('mobile'),
});

const CloseOrderSchema = z.object({
  tradeId: z.number().int().positive(),
});

export async function ordersRoutes(app: FastifyInstance) {
  app.post('/open', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = OpenOrderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
    const body = parsed.data;

    // Verify account ownership
    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, balance, free_margin')
      .eq('id', body.accountId)
      .single();

    if (accErr || !account || account.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const quote = getQuote(body.symbol);
    if (!quote) return reply.code(400).send({ error: 'no_quote', symbol: body.symbol });

    const openPrice = body.side === 'buy' ? quote.ask : quote.bid;

    const { data: trade, error: tradeErr } = await supabaseAdmin
      .from('trades')
      .insert({
        account_id: body.accountId,
        symbol: body.symbol,
        side: body.side,
        volume: body.volume,
        open_price: openPrice,
        current_price: openPrice,
        stop_loss: body.stopLoss,
        take_profit: body.takeProfit,
        reason: body.reason,
      })
      .select()
      .single();

    if (tradeErr) {
      app.log.error({ tradeErr }, 'failed to insert trade');
      return reply.code(500).send({ error: 'insert_failed' });
    }

    return { trade };
  });

  app.post('/close', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CloseOrderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const { tradeId } = parsed.data;

    const { data: trade, error } = await supabaseAdmin
      .from('trades')
      .select('*, accounts!inner(user_id)')
      .eq('id', tradeId)
      .eq('status', 'open')
      .single();

    if (error || !trade || (trade as any).accounts.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const quote = getQuote(trade.symbol);
    if (!quote) return reply.code(400).send({ error: 'no_quote' });

    const closePrice = trade.side === 'buy' ? quote.bid : quote.ask;
    const profit = +calculatePnL(trade.side, trade.volume, trade.open_price, closePrice, trade.symbol).toFixed(2);

    const { error: closeErr } = await supabaseAdmin
      .from('trades')
      .update({
        status: 'closed',
        close_price: closePrice,
        close_time: new Date().toISOString(),
        profit,
      })
      .eq('id', tradeId);

    if (closeErr) return reply.code(500).send({ error: 'close_failed' });

    // Update account balance
    try {
      await supabaseAdmin.rpc('apply_trade_pnl', { p_account_id: trade.account_id, p_amount: profit });
    } catch {}

    return { tradeId, profit, closePrice };
  });
}

