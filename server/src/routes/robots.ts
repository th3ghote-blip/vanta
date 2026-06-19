import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

import { authUser, supabaseAdmin } from '../lib/supabase.js';
import { checkRobotEngineer, checkRobotMaster } from '../lib/achievements.js';

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
  "conditions": [                            // optional gating conditions
    // Only these are enforced by the engine today — prefer them:
    //   { "type": "always" }                         fire every scheduled tick
    //   { "type": "price_move_pct", "pct": 3 }        fire only when the FIRST symbol
    //                                                 moves >= pct% from a rolling baseline
    // For "alert me when X moves N%" / "when X drops/rises N%" ALWAYS emit
    // price_move_pct with the right pct (do NOT use a bare interval + always).
    { "type": "price_move_pct", "pct": 3 }
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

    // Phase 11.3 — check robot_engineer achievement (fire-and-forget)
    void checkRobotEngineer(userId).catch(() => {});
    // Phase 22.1 — robot_master (10 robots built), fire-and-forget
    void checkRobotMaster(userId).catch(() => {});

    return { robot: data };
  });

  // GET /api/robots/leaderboard?period=7d|30d|all
  // Registered BEFORE /:id so the static segment wins over the parametric one.
  app.get('/leaderboard', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const query = req.query as { period?: string };
    const period = query.period ?? '7d';

    let cutoff: string | null = null;
    if (period === '7d') {
      cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === '30d') {
      cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    let q = supabaseAdmin
      .from('robots')
      .select('id, name, description, total_trades, winning_trades, total_profit, last_run_at, created_at')
      .eq('is_public', true)
      .order('total_profit', { ascending: false })
      .limit(20);

    if (cutoff) {
      q = q.gte('last_run_at', cutoff);
    }

    const { data, error } = await q;
    if (error) return reply.code(500).send({ error: error.message });

    const entries = (data ?? []).map((r: any, idx: number) => ({
      rank: idx + 1,
      id: r.id,
      name: r.name,
      description: r.description,
      total_trades: r.total_trades,
      winning_trades: r.winning_trades,
      win_rate: r.total_trades > 0 ? Math.round((r.winning_trades / r.total_trades) * 100) : null,
      total_profit: r.total_profit,
      last_run_at: r.last_run_at,
    }));

    return { leaderboard: entries, period };
  });

  // GET /api/robots/:id
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

  // GET /api/robots/:id/runs
  app.get<{ Params: { id: string } }>('/:id/runs', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
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

  // PATCH /api/robots/:id/status
  app.patch<{ Params: { id: string } }>('/:id/status', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
    const body = req.body as { status: string };
    const allowed = ['active', 'paused', 'stopped'];
    if (!allowed.includes(body.status)) return reply.code(400).send({ error: 'invalid_status' });

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

  // PATCH /api/robots/:id/visibility
  app.patch<{ Params: { id: string } }>('/:id/visibility', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { id } = req.params;
    const body = req.body as { is_public: boolean };
    if (typeof body.is_public !== 'boolean') {
      return reply.code(400).send({ error: 'is_public must be boolean' });
    }

    const { data: existing } = await supabaseAdmin
      .from('robots')
      .select('id, accounts!inner(user_id)')
      .eq('id', id)
      .single();

    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if ((existing as any).accounts.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    const { data, error } = await supabaseAdmin
      .from('robots')
      .update({ is_public: body.is_public })
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
