import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

import { authUser, supabaseAdmin } from '../lib/supabase.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

const CompileSchema = z.object({
  prompt: z.string().min(5).max(2000),
});

const COMPILE_SYSTEM = `You are a trading-strategy compiler for the Vanta platform.

Translate the user's natural-language strategy into a strict JSON config:

{
  "kind": "trade" | "tip",                  // does it execute trades, or just send tips?
  "name": "<short name, max 40 chars>",
  "description": "<one-line plain English summary>",
  "schedule": {
    "type": "cron" | "interval" | "event",
    "value": "<cron expr, ms interval, or event name like 'nyse_open'>"
  },
  "symbols": ["EURUSD", ...],                // symbols this robot trades or watches
  "side": "buy" | "sell" | "either",
  "volume": 0.01,                            // lot size if kind=trade
  "conditions": [                            // optional indicator/price conditions
    { "type": "rsi" | "ma_cross" | "price_drop" | "always", ... }
  ],
  "risk": { "stop_loss_pct": 1.0, "take_profit_pct": 2.0, "max_concurrent": 1 }
}

Reply with ONLY the JSON object. No prose, no code fences. If the user's request is ambiguous, make sensible defaults.

Supported symbols: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, XAUUSD, BTCUSD, AAPL, TSLA, AMZN.
Supported events: nyse_open, nyse_close, london_open, asia_open, daily_9am.`;

export async function robotsRoutes(app: FastifyInstance) {
  app.post('/compile', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CompileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: COMPILE_SYSTEM,
        messages: [{ role: 'user', content: parsed.data.prompt }],
      });

      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('');

      let config: unknown;
      try {
        config = JSON.parse(text);
      } catch {
        return reply.code(422).send({ error: 'compile_failed', raw: text });
      }

      return { config, raw: text };
    } catch (err) {
      app.log.error({ err }, 'claude compile failed');
      return reply.code(500).send({ error: 'ai_error' });
    }
  });

  app.post('/save', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as { accountId: string; prompt: string; config: any };
    const { data, error } = await supabaseAdmin
      .from('robots')
      .insert({
        account_id: body.accountId,
        name: body.config.name,
        description: body.config.description,
        prompt: body.prompt,
        config: body.config,
        status: 'draft',
      })
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { robot: data };
  });


  // GET /api/robots/:id — fetch a single robot (must belong to authed user)
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('robots')
      .select('*, accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (error || !data) return reply.code(404).send({ error: 'not_found' });
    if ((data as any).accounts.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    const { accounts: _acc, ...robot } = data as any;
    return { robot };
  });

  // GET /api/robots/:id/runs — last 20 run records
  app.get<{ Params: { id: string } }>('/:id/runs', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
    // Verify ownership
    const { data: robot } = await supabaseAdmin
      .from('robots')
      .select('id, accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (!robot) return reply.code(404).send({ error: 'not_found' });
    if ((robot as any).accounts.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    const { data: runs, error } = await supabaseAdmin
      .from('robot_runs')
      .select('*')
      .eq('robot_id', id)
      .order('triggered_at', { ascending: false })
      .limit(20);

    if (error) return reply.code(500).send({ error: error.message });
    return { runs: runs ?? [] };
  });

  // PATCH /api/robots/:id/status — pause or resume
  app.patch<{ Params: { id: string } }>('/:id/status', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
    const body = req.body as { status: string };
    const allowed = ['active', 'paused', 'stopped'];
    if (!allowed.includes(body.status)) return reply.code(400).send({ error: 'invalid_status' });

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('robots')
      .select('id, accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if ((existing as any).accounts.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    const { data, error } = await supabaseAdmin
      .from('robots')
      .update({ status: body.status })
      .eq('id', id)
      .select()
      .single();

    if (error) return reply.code(500).send({ error: error.message });
    return { robot: data };
  });

  // DELETE /api/robots/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
    const { data: existing } = await supabaseAdmin
      .from('robots')
      .select('id, accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if ((existing as any).accounts.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    const { error } = await supabaseAdmin.from('robots').delete().eq('id', id);
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true };
  });
}
