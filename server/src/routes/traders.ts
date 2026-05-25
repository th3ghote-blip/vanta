import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';

const FollowSchema = z.object({
  leaderId:   z.string().uuid(),
  accountId:  z.string().uuid(),
  allocationPct: z.number().positive().max(100),
});

const OptInSchema = z.object({ enabled: z.boolean() });

export async function tradersRoutes(app: FastifyInstance) {

  // ── GET /api/traders/leaderboard?period=7d|30d|all ────────────────────────
  // Returns opt-in leaders sorted by realised P&L in the requested window.
  // P&L is summed from the `trades` table (closed trades only).
  // Anonymised: display names are "Trader #<last-4-of-uuid>".
  app.get('/leaderboard', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const period = (req.query as any).period ?? '30d';
    const since =
      period === '7d'  ? new Date(Date.now() - 7  * 86_400_000).toISOString() :
      period === '30d' ? new Date(Date.now() - 30 * 86_400_000).toISOString() :
      null; // 'all'

    // Pull leaders who have opted in.
    const { data: leaders, error: lErr } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('copy_leader_enabled', true);

    if (lErr) return reply.code(500).send({ error: 'db_error' });
    if (!leaders || leaders.length === 0) return { leaderboard: [], period };

    const leaderIds = leaders.map((l) => l.id);

    // Aggregate closed-trade P&L for each leader in the window.
    let q = supabaseAdmin
      .from('trades')
      .select('user_id, profit')
      .in('user_id', leaderIds)
      .eq('status', 'closed')
      .not('profit', 'is', null);
    if (since) q = q.gte('closed_at', since);
    const { data: trades, error: tErr } = await q;
    if (tErr) return reply.code(500).send({ error: 'db_error' });

    // Who does the current user already follow?
    const { data: following } = await supabaseAdmin
      .from('copy_relationships')
      .select('leader_id, allocation_pct')
      .eq('follower_id', userId);
    const followMap = new Map<string, number>(
      (following ?? []).map((r) => [r.leader_id, r.allocation_pct])
    );

    // Roll up per-leader stats.
    const statsMap = new Map<string, { pnl: number; wins: number; total: number }>();
    for (const t of trades ?? []) {
      const uid = t.user_id as string;
      if (!statsMap.has(uid)) statsMap.set(uid, { pnl: 0, wins: 0, total: 0 });
      const s = statsMap.get(uid)!;
      s.pnl   += Number(t.profit ?? 0);
      s.total += 1;
      if (Number(t.profit ?? 0) > 0) s.wins += 1;
    }

    const rows = leaderIds
      .map((id) => {
        const s = statsMap.get(id) ?? { pnl: 0, wins: 0, total: 0 };
        return {
          leaderId:    id,
          displayName: `Trader #${id.slice(-4).toUpperCase()}`,
          pnl30d:      +s.pnl.toFixed(2),
          winRate:     s.total > 0 ? +(s.wins / s.total * 100).toFixed(1) : 0,
          tradeCount:  s.total,
          isFollowing: followMap.has(id),
          allocationPct: followMap.get(id) ?? null,
        };
      })
      .sort((a, b) => b.pnl30d - a.pnl30d)
      .slice(0, 20);

    return { leaderboard: rows, period };
  });

  // ── PATCH /api/traders/opt-in ─────────────────────────────────────────────
  // Toggle whether the calling user appears on the copy-trading leaderboard.
  app.patch('/opt-in', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = OptInSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input' });

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ copy_leader_enabled: parsed.data.enabled })
      .eq('id', userId);
    if (error) return reply.code(500).send({ error: 'db_error' });

    return { ok: true, enabled: parsed.data.enabled };
  });

  // ── POST /api/traders/follow ──────────────────────────────────────────────
  // Start copying a leader. Upserts the relationship (idempotent on same leader).
  app.post('/follow', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = FollowSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
    const { leaderId, accountId, allocationPct } = parsed.data;

    // Can't follow yourself.
    if (leaderId === userId) return reply.code(400).send({ error: 'cannot_follow_self' });

    // Verify the leader has opted in.
    const { data: leader } = await supabaseAdmin
      .from('profiles')
      .select('copy_leader_enabled')
      .eq('id', leaderId)
      .single();
    if (!leader?.copy_leader_enabled) return reply.code(404).send({ error: 'leader_not_found' });

    // Verify the follower owns the account.
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();
    if (!account) return reply.code(403).send({ error: 'account_not_owned' });

    const { error } = await supabaseAdmin
      .from('copy_relationships')
      .upsert(
        { follower_id: userId, leader_id: leaderId, follower_account_id: accountId, allocation_pct: allocationPct },
        { onConflict: 'follower_id,leader_id' }
      );
    if (error) return reply.code(500).send({ error: 'db_error' });

    return { ok: true };
  });

  // ── DELETE /api/traders/follow/:leaderId ──────────────────────────────────
  // Stop copying a leader.
  app.delete('/follow/:leaderId', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { leaderId } = req.params as { leaderId: string };

    const { error } = await supabaseAdmin
      .from('copy_relationships')
      .delete()
      .eq('follower_id', userId)
      .eq('leader_id', leaderId);
    if (error) return reply.code(500).send({ error: 'db_error' });

    return { ok: true };
  });

  // ── GET /api/traders/following ─────────────────────────────────────────────
  // List leaders the current user is copying.
  app.get('/following', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data, error } = await supabaseAdmin
      .from('copy_relationships')
      .select('leader_id, follower_account_id, allocation_pct, started_at')
      .eq('follower_id', userId);
    if (error) return reply.code(500).send({ error: 'db_error' });

    const rows = (data ?? []).map((r) => ({
      leaderId:          r.leader_id,
      displayName:       `Trader #${(r.leader_id as string).slice(-4).toUpperCase()}`,
      followerAccountId: r.follower_account_id,
      allocationPct:     r.allocation_pct,
      startedAt:         r.started_at,
    }));

    return { following: rows };
  });

  // ── GET /api/traders/me ───────────────────────────────────────────────────
  // Returns the caller's own copy-leader opt-in status.
  app.get('/me', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { data } = await supabaseAdmin
      .from('profiles')
      .select('copy_leader_enabled')
      .eq('id', userId)
      .single();

    return { copyLeaderEnabled: data?.copy_leader_enabled ?? false };
  });
}
