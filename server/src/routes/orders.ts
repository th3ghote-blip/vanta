import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getQuote } from '../lib/quoteCache.js';
import { calculatePnL } from '../lib/contracts.js';
import { requiredMargin, reserveMargin, releaseMargin } from '../lib/margin.js';
import { sendPush } from '../lib/push.js';

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

    // Verify account ownership and pull margin-relevant fields.
    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, balance, free_margin, margin_used, leverage')
      .eq('id', body.accountId)
      .single();

    if (accErr || !account || account.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const quote = getQuote(body.symbol);
    if (!quote) return reply.code(400).send({ error: 'no_quote', symbol: body.symbol });

    const openPrice = body.side === 'buy' ? quote.ask : quote.bid;

    // Phase 1.2 — margin requirement.
    const required = +requiredMargin(
      body.volume,
      openPrice,
      body.symbol,
      Number(account.leverage) || 1,
    ).toFixed(2);
    const available = Number(account.free_margin) || 0;

    if (available < required) {
      return reply.code(400).send({
        error: 'insufficient_margin',
        required,
        available: +available.toFixed(2),
      });
    }

    // Reserve first so a failed trade insert can roll it back.
    const reserve = await reserveMargin(
      {
        id: account.id,
        free_margin: available,
        margin_used: Number(account.margin_used) || 0,
      },
      required,
      app.log,
    );

    if (!reserve.ok) {
      if (reserve.reason === 'insufficient' || reserve.reason === 'race') {
        return reply.code(400).send({
          error: 'insufficient_margin',
          required,
          available: +available.toFixed(2),
        });
      }
      return reply.code(500).send({ error: 'margin_reserve_failed' });
    }

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
      // Roll back the margin reservation so the user isn't billed for a phantom trade.
      try {
        await releaseMargin(account.id, required, app.log);
      } catch (e) {
        app.log.error({ err: e, accountId: account.id, required }, 'failed to roll back margin after trade insert error');
      }
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
      .select('*, accounts!inner(user_id, leverage)')
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

    // Apply P&L to balance/equity/free_margin.
    try {
      await supabaseAdmin.rpc('apply_trade_pnl', { p_account_id: trade.account_id, p_amount: profit });
    } catch {}

    // Phase 1.2 — release the margin we reserved when the trade was opened.
    const accLeverage = Number((trade as any).accounts?.leverage) || 1;
    const release = +requiredMargin(
      Number(trade.volume),
      Number(trade.open_price),
      trade.symbol,
      accLeverage,
    ).toFixed(2);
    try {
      await releaseMargin(trade.account_id, release, app.log);
    } catch (e) {
      app.log.error({ err: e, tradeId, release }, 'failed to release margin on close');
    }

    // Phase 6.3 — push notification: trade closed.
    const sign = profit >= 0 ? '+' : '';
    sendPush(userId, {
      title: `${trade.symbol} closed`,
      body: `${sign}$${Math.abs(profit).toFixed(2)}`,
      data: { tradeId, symbol: trade.symbol, profit, kind: 'trade_closed' },
    }).catch(() => {/* fire-and-forget; push errors already logged inside sendPush */});

    return { tradeId, profit, closePrice };
  });
}
