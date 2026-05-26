import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { getQuote } from '../lib/quoteCache.js';
import { calculatePnL } from '../lib/contracts.js';
import { requiredMargin, reserveMargin, releaseMargin } from '../lib/margin.js';
import { sendPushChecked } from '../lib/push.js';
import { checkFirstTrade, checkFiveWins, checkRiskMaster, checkBalance1000 } from '../lib/achievements.js';

const OpenOrderSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string().min(1),
  side: z.enum(['buy', 'sell']),
  volume: z.number().positive(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  reason: z.enum(['mobile', 'web', 'desktop', 'robot']).default('mobile'),
  // R.5 — idempotency: client sets this to a fresh UUID before each tap;
  // a duplicate request with the same id returns the existing trade.
  clientRequestId: z.string().uuid().optional(),
  // T.1 — pending orders. Default 'market' = current behavior. Migration 016
  // accepts all 4 values upfront so T.2 / T.3 don't need new migrations.
  orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']).default('market'),
  triggerPrice: z.number().positive().optional(),
  // T.3 — stop_limit orders need a second price: the limit fill price after the stop fires.
  limitPrice: z.number().positive().optional(),
  // T.4 -- trailing stop: distance (in price units) the SL trails behind
  // the best price seen since open. Only used for market orders.
  trailDistance: z.number().positive().optional(),
  // T.8 -- OCO group: two pending orders sharing this uuid are linked.
  // When one fills, the orders-trigger worker cancels the others in the
  // same group. Only allowed on pending order types (limit/stop/stop_limit).
  ocoGroupId: z.string().uuid().optional(),
});

const CloseOrderSchema = z.object({
  tradeId: z.number().int().positive(),
  // T.6 — partial close: provide a volume < trade.volume to close only that portion.
  // If omitted or >= trade.volume, the full position is closed.
  closeVolume: z.number().positive().optional(),
});

const CancelPendingParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
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
      .select('id, user_id, balance, free_margin, margin_used, leverage, hedging_enabled')
      .eq('id', body.accountId)
      .single();

    if (accErr || !account || account.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    // R.5 — idempotency: if caller supplied a client_request_id and we already
    // have a trade for (account_id, client_request_id), return it immediately.
    if (body.clientRequestId) {
      const { data: existing } = await supabaseAdmin
        .from('trades')
        .select()
        .eq('account_id', body.accountId)
        .eq('client_request_id', body.clientRequestId)
        .maybeSingle();
      if (existing) return { trade: existing };
    }

    const quote = getQuote(body.symbol);
    if (!quote) return reply.code(400).send({ error: 'no_quote', symbol: body.symbol });

    // T.1 — branch: market vs limit. For limit orders we validate the trigger
    // makes directional sense against the current quote, reserve margin, and
    // insert a status='pending' row. The orders-trigger worker flips it to
    // 'open' once the price crosses the trigger.
    const isPending = body.orderType !== 'market';

    // T.8 — OCO is only meaningful for pending orders (the sibling cancel
    // happens when one leg fills). Reject the combo so the client surfaces
    // it instead of silently dropping the linkage.
    if (!isPending && body.ocoGroupId) {
      return reply.code(400).send({
        error: 'invalid_input',
        message: 'ocoGroupId is only allowed on pending orders (limit / stop / stop_limit)',
      });
    }

    if (isPending) {
      if (body.triggerPrice == null) {
        return reply.code(400).send({
          error: 'invalid_trigger_price',
          message: 'triggerPrice is required for non-market orders',
        });
      }

      // Directional validation for limits and stops.
      if (body.orderType === 'limit') {
        if (body.side === 'buy' && body.triggerPrice >= quote.ask) {
          return reply.code(400).send({
            error: 'invalid_trigger_price',
            message: 'buy-limit trigger must be below current ask',
            triggerPrice: body.triggerPrice,
            ask: quote.ask,
          });
        }
        if (body.side === 'sell' && body.triggerPrice <= quote.bid) {
          return reply.code(400).send({
            error: 'invalid_trigger_price',
            message: 'sell-limit trigger must be above current bid',
            triggerPrice: body.triggerPrice,
            bid: quote.bid,
          });
        }
      }

      // T.2 — stop orders: breakout/breakdown entries. Trigger is placed
      // ABOVE current price for buy-stop (enter on upside break) and BELOW
      // for sell-stop (enter on downside break). The opposite of limit.
      if (body.orderType === 'stop') {
        if (body.side === 'buy' && body.triggerPrice <= quote.ask) {
          return reply.code(400).send({
            error: 'invalid_trigger_price',
            message: 'buy-stop trigger must be above current ask (breakout entry)',
            triggerPrice: body.triggerPrice,
            ask: quote.ask,
          });
        }
        if (body.side === 'sell' && body.triggerPrice >= quote.bid) {
          return reply.code(400).send({
            error: 'invalid_trigger_price',
            message: 'sell-stop trigger must be below current bid (breakdown entry)',
            triggerPrice: body.triggerPrice,
            bid: quote.bid,
          });
        }
      }

      // T.3 — stop_limit orders: two-stage (stop fires -> limit order active).
      // Stop side uses the same breakout/breakdown direction as plain stop.
      // Limit side must be at or beyond the trigger in the direction of travel
      // (for a buy stop_limit: limit >= trigger so you accept fills up to limit_price;
      //  for a sell stop_limit: limit <= trigger so you accept fills down to limit_price).
      if (body.orderType === 'stop_limit') {
        if (body.limitPrice == null) {
          return reply.code(400).send({
            error: 'invalid_limit_price',
            message: 'limitPrice is required for stop_limit orders',
          });
        }
        // Stop trigger direction (same as plain stop).
        if (body.side === 'buy' && body.triggerPrice <= quote.ask) {
          return reply.code(400).send({
            error: 'invalid_trigger_price',
            message: 'buy stop_limit trigger must be above current ask',
            triggerPrice: body.triggerPrice,
            ask: quote.ask,
          });
        }
        if (body.side === 'sell' && body.triggerPrice >= quote.bid) {
          return reply.code(400).send({
            error: 'invalid_trigger_price',
            message: 'sell stop_limit trigger must be below current bid',
            triggerPrice: body.triggerPrice,
            bid: quote.bid,
          });
        }
        // Limit vs trigger relationship.
        if (body.side === 'buy' && body.limitPrice < body.triggerPrice) {
          return reply.code(400).send({
            error: 'invalid_limit_price',
            message: 'buy stop_limit: limitPrice must be >= triggerPrice',
            limitPrice: body.limitPrice,
            triggerPrice: body.triggerPrice,
          });
        }
        if (body.side === 'sell' && body.limitPrice > body.triggerPrice) {
          return reply.code(400).send({
            error: 'invalid_limit_price',
            message: 'sell stop_limit: limitPrice must be <= triggerPrice',
            limitPrice: body.limitPrice,
            triggerPrice: body.triggerPrice,
          });
        }
      }
    }

    // T.7 — bracket order: validate SL/TP direction for market orders.
    // Pending orders don't know their fill price yet, so we skip validation there
    // (the risk worker will honour whatever values are stored).
    if (!isPending && (body.stopLoss != null || body.takeProfit != null)) {
      const entryPrice = body.side === 'buy' ? quote.ask : quote.bid;
      if (body.stopLoss != null) {
        if (body.side === 'buy' && body.stopLoss >= entryPrice) {
          return reply.code(400).send({
            error: 'invalid_sl',
            message: 'buy stop-loss must be below the entry price',
            entryPrice,
          });
        }
        if (body.side === 'sell' && body.stopLoss <= entryPrice) {
          return reply.code(400).send({
            error: 'invalid_sl',
            message: 'sell stop-loss must be above the entry price',
            entryPrice,
          });
        }
      }
      if (body.takeProfit != null) {
        if (body.side === 'buy' && body.takeProfit <= entryPrice) {
          return reply.code(400).send({
            error: 'invalid_tp',
            message: 'buy take-profit must be above the entry price',
            entryPrice,
          });
        }
        if (body.side === 'sell' && body.takeProfit >= entryPrice) {
          return reply.code(400).send({
            error: 'invalid_tp',
            message: 'sell take-profit must be below the entry price',
            entryPrice,
          });
        }
      }
    }

    // Margin requirement: for pending orders we estimate at the trigger price
    // (a stricter reservation than market would be — fine, the position will
    // open exactly at that price). For market we use the live quote side.
    const referencePrice = isPending
      ? (body.triggerPrice as number)
      : (body.side === 'buy' ? quote.ask : quote.bid);

    const required = +requiredMargin(
      body.volume,
      referencePrice,
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

    // T.9 — Netting mode: when hedging is disabled and this is a market order,
    // check for an open opposing position on the same symbol.  If found, net
    // them out (close the opposing position for min(existing, new) volume and
    // reduce or skip the incoming trade accordingly).
    if (!isPending && !(account as any).hedging_enabled) {
      const opposingSide = body.side === 'buy' ? 'sell' : 'buy';
      const { data: opposing } = await supabaseAdmin
        .from('trades')
        .select('id, volume, open_price, account_id')
        .eq('account_id', body.accountId)
        .eq('symbol', body.symbol)
        .eq('side', opposingSide)
        .eq('status', 'open')
        .order('open_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (opposing) {
        const existingVol = Number(opposing.volume);
        const incomingVol = body.volume;
        const closePrice = body.side === 'buy' ? quote.bid : quote.ask; // price at which the sell is closed
        const closeVol = Math.min(existingVol, incomingVol);
        const profit = +calculatePnL(
          opposingSide, closeVol, Number(opposing.open_price), closePrice, body.symbol,
        ).toFixed(2);
        const accLeverage = Number(account.leverage) || 1;
        const netMarginRelease = +requiredMargin(closeVol, Number(opposing.open_price), body.symbol, accLeverage).toFixed(2);

        if (existingVol <= incomingVol) {
          // Full close of opposing position.
          await supabaseAdmin
            .from('trades')
            .update({
              status: 'closed',
              close_price: closePrice,
              close_time: new Date().toISOString(),
              profit,
              reason: 'netting',
            })
            .eq('id', opposing.id);
        } else {
          // Partial close: opposing volume > incoming, reduce opposing.
          const remainingVol = +(existingVol - incomingVol).toFixed(8);
          await supabaseAdmin.from('trades').update({ volume: remainingVol }).eq('id', opposing.id).eq('status', 'open');
        }

        // Realise the P&L and release the reserved margin for the closed slice.
        try { await supabaseAdmin.rpc('apply_trade_pnl', { p_account_id: body.accountId, p_amount: profit }); } catch {}
        try { await releaseMargin(body.accountId, netMarginRelease, app.log); } catch {}

        if (existingVol >= incomingVol) {
          // The incoming trade is fully absorbed by the opposing position —
          // nothing new to open. Also roll back the just-reserved margin for
          // the incoming trade since we won't open it.
          try { await releaseMargin(body.accountId, required, app.log); } catch {}
          return {
            netted: true,
            closedTradeId: opposing.id,
            closedVolume: closeVol,
            profit,
            closePrice,
          };
        }
        // Reduce the incoming volume by the amount netted and continue to open
        // the remainder.  Also release the over-reserved margin portion.
        const remainder = +(incomingVol - existingVol).toFixed(8);
        const overReserved = +(required - +requiredMargin(remainder, referencePrice, body.symbol, accLeverage).toFixed(2)).toFixed(2);
        if (overReserved > 0) {
          try { await releaseMargin(body.accountId, overReserved, app.log); } catch {}
        }
        body.volume = remainder;
      }
    }

    const insertRow: Record<string, any> = {
      account_id: body.accountId,
      symbol: body.symbol,
      side: body.side,
      volume: body.volume,
      stop_loss: body.stopLoss,
      take_profit: body.takeProfit,
      reason: body.reason,
      client_request_id: body.clientRequestId ?? null,
      order_type: body.orderType,
      trigger_price: isPending ? body.triggerPrice : null,
      limit_price: body.orderType === 'stop_limit' ? (body.limitPrice ?? null) : null,
      // T.4 -- trailing stop (market orders only; null for pending order types)
      trail_distance: (!isPending && body.trailDistance != null) ? body.trailDistance : null,
      // T.8 -- OCO group id (pending orders only; null for market).
      oco_group_id: (isPending && body.ocoGroupId) ? body.ocoGroupId : null,
    };
    if (isPending) {
      insertRow.status = 'pending';
      // open_price stays null until the trigger worker fills it.
      insertRow.open_price = null;
      insertRow.current_price = null;
    } else {
      const openPrice = body.side === 'buy' ? quote.ask : quote.bid;
      insertRow.open_price = openPrice;
      insertRow.current_price = openPrice;
    }

    const { data: trade, error: tradeErr } = await supabaseAdmin
      .from('trades')
      .insert(insertRow)
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

    // Phase 11.3 — achievement check: first_trade (fire-and-forget). Only for
    // immediate-fill market orders; pending orders count once they fill.
    if (!isPending) {
      void checkFirstTrade(userId).catch(() => {});
    }

    return { trade };
  });

  app.post('/close', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CloseOrderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const { tradeId, closeVolume } = parsed.data;

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
    const accLeverage = Number((trade as any).accounts?.leverage) || 1;

    // T.6 — partial close: if closeVolume is supplied and is less than the
    // current position volume, close only that slice.  The parent row stays
    // open with the reduced volume; a child row records the realised P&L.
    const fullVolume = Number(trade.volume);
    const isPartial = closeVolume !== undefined && closeVolume < fullVolume;

    if (isPartial) {
      const closedVol = +closeVolume.toFixed(8);
      const remainingVol = +(fullVolume - closedVol).toFixed(8);

      const partialProfit = +calculatePnL(
        trade.side, closedVol, trade.open_price, closePrice, trade.symbol,
      ).toFixed(2);

      // Insert the child "closed slice" row — inherits symbol/side/open_price
      // from the parent so the history is readable.
      const childRow = {
        account_id: trade.account_id,
        symbol: trade.symbol,
        side: trade.side,
        volume: closedVol,
        open_price: trade.open_price,
        open_time: trade.open_time,
        close_price: closePrice,
        close_time: new Date().toISOString(),
        status: 'closed',
        profit: partialProfit,
        reason: 'partial_close',
        order_type: (trade as any).order_type ?? 'market',
      };
      const { data: childTrade, error: insertErr } = await supabaseAdmin
        .from('trades')
        .insert(childRow)
        .select()
        .single();

      if (insertErr) return reply.code(500).send({ error: 'partial_close_insert_failed' });

      // Reduce the parent volume.
      const { error: updErr } = await supabaseAdmin
        .from('trades')
        .update({ volume: remainingVol })
        .eq('id', tradeId)
        .eq('status', 'open'); // CAS guard

      if (updErr) return reply.code(500).send({ error: 'partial_close_update_failed' });

      // Release proportional margin (ratio = closedVol / fullVolume).
      const fullMargin = +requiredMargin(fullVolume, Number(trade.open_price), trade.symbol, accLeverage).toFixed(2);
      const releaseAmt = +(fullMargin * (closedVol / fullVolume)).toFixed(2);
      try {
        await releaseMargin(trade.account_id, releaseAmt, app.log);
      } catch (e) {
        app.log.error({ err: e, tradeId, releaseAmt }, 'failed to release margin on partial close');
      }

      // Apply the partial P&L to account balance.
      try {
        await supabaseAdmin.rpc('apply_trade_pnl', { p_account_id: trade.account_id, p_amount: partialProfit });
      } catch {}

      // Push notification for partial close.
      const sign = partialProfit >= 0 ? '+' : '';
      sendPushChecked(userId, 'trade_results', {
        title: `${trade.symbol} partial close`,
        body: `${closedVol} lots  ${sign}$${Math.abs(partialProfit).toFixed(2)}`,
        data: { tradeId, symbol: trade.symbol, profit: partialProfit, kind: 'partial_close' },
      }).catch(() => {});

      return {
        tradeId,
        childTradeId: (childTrade as any)?.id ?? null,
        profit: partialProfit,
        closePrice,
        closedVolume: closedVol,
        remainingVolume: remainingVol,
      };
    }

    // Full close (original path).
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
    sendPushChecked(userId, 'trade_results', {
      title: `${trade.symbol} closed`,
      body: `${sign}$${Math.abs(profit).toFixed(2)}`,
      data: { tradeId, symbol: trade.symbol, profit, kind: 'trade_closed' },
    }).catch(() => {/* fire-and-forget; push errors already logged inside sendPush */});

    // Phase 11.3 — achievement checks after close (fire-and-forget)
    void Promise.all([
      profit > 0 ? checkFiveWins(userId) : Promise.resolve(),
      checkRiskMaster(userId),
      checkBalance1000(userId),
    ]).catch(() => {});

    return { tradeId, profit, closePrice };
  });

  // T.1 — cancel a pending order. Releases the margin reservation and marks
  // the row 'cancelled' (note: existing enum uses British spelling; we keep
  // that label and reserve 'closed' for filled-then-closed lifecycle.)
  app.delete('/pending/:id', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CancelPendingParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });
    const { id } = parsed.data;

    const { data: trade, error } = await supabaseAdmin
      .from('trades')
      .select('*, accounts!inner(user_id, leverage)')
      .eq('id', id)
      .single();

    if (error || !trade || (trade as any).accounts.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    if (trade.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', status: trade.status });
    }

    // Compute the margin to release. trigger_price is the price we reserved
    // against on submit; fall back to open_price if for some reason a market
    // row leaked into this endpoint (defensive — shouldn't happen).
    const refPrice = Number((trade as any).trigger_price ?? trade.open_price ?? 0);
    const accLeverage = Number((trade as any).accounts?.leverage) || 1;
    const release = +requiredMargin(
      Number(trade.volume),
      refPrice,
      trade.symbol,
      accLeverage,
    ).toFixed(2);

    const { error: updErr } = await supabaseAdmin
      .from('trades')
      .update({
        status: 'cancelled',
        close_time: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending'); // CAS guard against trigger worker race

    if (updErr) {
      return reply.code(500).send({ error: 'cancel_failed' });
    }

    try {
      await releaseMargin(trade.account_id, release, app.log);
    } catch (e) {
      app.log.error({ err: e, tradeId: id, release }, 'failed to release margin on pending cancel');
    }

    return { tradeId: id, released: release };
  });

  // T.5 — Modify SL / TP on an open position.
  // PATCH /api/orders/modify/:id  { stopLoss?, takeProfit? }
  // Both fields are optional; pass null to clear. At least one must be present.
  // Server validates direction against the live quote (same rules as 1.6 client-side).
  const ModifyOrderParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
  });

  const ModifyOrderBodySchema = z.object({
    stopLoss: z.number().nullable().optional(),
    takeProfit: z.number().nullable().optional(),
  });

  app.patch('/modify/:id', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsedParams = ModifyOrderParamsSchema.safeParse(req.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'invalid_input' });
    const { id } = parsedParams.data;

    const parsedBody = ModifyOrderBodySchema.safeParse(req.body);
    if (!parsedBody.success) return reply.code(400).send({ error: 'invalid_input', issues: parsedBody.error.issues });
    const body = parsedBody.data;

    if (body.stopLoss === undefined && body.takeProfit === undefined) {
      return reply.code(400).send({ error: 'invalid_input', message: 'provide stopLoss or takeProfit' });
    }

    // Verify ownership and open status in one query. The accounts!inner embed gives
    // us user_id to cross-check without a second round-trip.
    const { data: trade, error } = await supabaseAdmin
      .from('trades')
      .select('*, accounts!inner(user_id, leverage)')
      .eq('id', id)
      .eq('status', 'open')
      .single();

    if (error || !trade || (trade as any).accounts.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    // Directional validation — only when a non-null level is provided and a
    // live quote is available. If no quote (symbol temporarily unlisted), skip.
    const quote = getQuote(trade.symbol);
    if (quote) {
      if (body.stopLoss != null) {
        if (trade.side === 'buy' && body.stopLoss >= quote.ask) {
          return reply.code(400).send({
            error: 'invalid_sl',
            message: 'stop loss for a buy must be below current price',
            stopLoss: body.stopLoss,
            ask: quote.ask,
          });
        }
        if (trade.side === 'sell' && body.stopLoss <= quote.bid) {
          return reply.code(400).send({
            error: 'invalid_sl',
            message: 'stop loss for a sell must be above current price',
            stopLoss: body.stopLoss,
            bid: quote.bid,
          });
        }
      }
      if (body.takeProfit != null) {
        if (trade.side === 'buy' && body.takeProfit <= quote.ask) {
          return reply.code(400).send({
            error: 'invalid_tp',
            message: 'take profit for a buy must be above current price',
            takeProfit: body.takeProfit,
            ask: quote.ask,
          });
        }
        if (trade.side === 'sell' && body.takeProfit >= quote.bid) {
          return reply.code(400).send({
            error: 'invalid_tp',
            message: 'take profit for a sell must be below current price',
            takeProfit: body.takeProfit,
            bid: quote.bid,
          });
        }
      }
    }

    const updateFields: Record<string, any> = {};
    if (body.stopLoss !== undefined) updateFields.stop_loss = body.stopLoss;
    if (body.takeProfit !== undefined) updateFields.take_profit = body.takeProfit;

    const { error: updErr } = await supabaseAdmin
      .from('trades')
      .update(updateFields)
      .eq('id', id)
      .eq('status', 'open'); // CAS guard: don't update if race-closed during request

    if (updErr) return reply.code(500).send({ error: 'update_failed' });

    return {
      tradeId: id,
      stopLoss: 'stopLoss' in updateFields ? updateFields.stop_loss : trade.stop_loss,
      takeProfit: 'takeProfit' in updateFields ? updateFields.take_profit : trade.take_profit,
    };
  });

  // PATCH /api/orders/note/:id  { notes: string }
  // Saves a free-text journal note on any trade the user owns, regardless of status.
  const NoteParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
  });

  const NoteBodySchema = z.object({
    notes: z.string().max(4000),
  });

  app.patch('/note/:id', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsedParams = NoteParamsSchema.safeParse(req.params);
    if (!parsedParams.success) return reply.code(400).send({ error: 'invalid_input' });
    const { id } = parsedParams.data;

    const parsedBody = NoteBodySchema.safeParse(req.body);
    if (!parsedBody.success) return reply.code(400).send({ error: 'invalid_input', issues: parsedBody.error.issues });
    const { notes } = parsedBody.data;

    // Verify ownership via accounts join — works for any trade status.
    const { data: trade, error } = await supabaseAdmin
      .from('trades')
      .select('id, accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (error || !trade || (trade as any).accounts.user_id !== userId) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const { error: updErr } = await supabaseAdmin
      .from('trades')
      .update({ notes })
      .eq('id', id);

    if (updErr) return reply.code(500).send({ error: 'update_failed' });

    return { tradeId: id, notes };
  });

}
