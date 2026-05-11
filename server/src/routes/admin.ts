import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

/** Verify auth + admin role. Returns userId or null. */
async function authAdmin(token: string | undefined): Promise<string | null> {
  const userId = await authUser(token);
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  if (!data?.is_admin) return null;
  return userId;
}

const RejectSchema = z.object({ reason: z.string().optional() }).optional();

export async function adminRoutes(app: FastifyInstance) {
  /**
   * GET /api/admin/transactions?status=pending|completed|rejected|all
   * Returns up to 100 transactions (most recent first) with nested account info.
   */
  app.get('/transactions', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { status } = req.query as { status?: string };

    let query = supabaseAdmin
      .from('transactions')
      .select('*, accounts!inner(id, user_id, balance, type, currency)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    }

    const { data, error } = await query;
    if (error) {
      app.log.error({ err: error }, 'admin/transactions: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    return reply.send({ transactions: data ?? [] });
  });

  /**
   * POST /api/admin/transactions/:id/approve
   * - deposit → credit balance
   * - withdrawal → debit balance (checks sufficient funds first)
   * - bonus / adjustment → credit balance
   * Sets status = 'completed'.
   */
  app.post('/transactions/:id/approve', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*, accounts!inner(id, user_id, balance, equity, margin_used, free_margin)')
      .eq('id', id)
      .single();

    if (txErr || !tx) return reply.code(404).send({ error: 'transaction_not_found' });
    if (tx.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: tx.status });
    }

    const account = (tx as any).accounts;
    const currentBalance = Number(account.balance);
    const amount = Number(tx.amount);

    let balanceDelta = 0;
    if (tx.type === 'deposit' || tx.type === 'bonus' || tx.type === 'adjustment') {
      balanceDelta = amount;
    } else if (tx.type === 'withdrawal') {
      if (currentBalance < amount) {
        return reply.code(400).send({
          error: 'insufficient_balance',
          available: currentBalance,
          requested: amount,
        });
      }
      balanceDelta = -amount;
    }

    if (balanceDelta !== 0) {
      const newBalance = currentBalance + balanceDelta;
      const marginUsed = Number(account.margin_used ?? 0);
      const { error: balErr } = await supabaseAdmin
        .from('accounts')
        .update({
          balance: newBalance,
          equity: newBalance,
          free_margin: Math.max(0, newBalance - marginUsed),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (balErr) {
        app.log.error({ err: balErr }, 'admin/approve: balance update failed');
        return reply.code(500).send({ error: 'balance_update_failed' });
      }
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/approve: status update failed');
      return reply.code(500).send({ error: 'status_update_failed' });
    }

    app.log.info({ adminId, txId: id, type: tx.type, amount, balanceDelta }, 'admin: transaction approved');
    return reply.send({ transaction: updated, balance_delta: balanceDelta });
  });

  /**
   * POST /api/admin/transactions/:id/reject
   * No balance changes. Sets status = 'rejected'.
   */
  app.post('/transactions/:id/reject', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };
    const parsed = RejectSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data?.reason : undefined;

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('id, status, notes')
      .eq('id', id)
      .single();

    if (txErr || !tx) return reply.code(404).send({ error: 'transaction_not_found' });
    if (tx.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: tx.status });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'rejected',
        notes: reason ? `Rejected: ${reason}` : 'Rejected by admin',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/reject: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, txId: id, reason }, 'admin: transaction rejected');
    return reply.send({ transaction: updated });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // KYC review endpoints
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/kyc?status=pending|approved|rejected|all
   * Returns up to 100 KYC submissions (most recent first) with their documents.
   * Each doc includes a 1-hour signed URL the admin can use to view the image.
   */
  app.get('/kyc', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { status } = req.query as { status?: string };

    let query = supabaseAdmin
      .from('kyc_submissions')
      .select('id, user_id, status, rejection_reason, submitted_at, reviewed_at, created_at, kyc_documents(id, doc_type, storage_path, uploaded_at)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    } else if (!status) {
      // Default to pending
      query = query.eq('status', 'pending' as any);
    }

    const { data, error } = await query;
    if (error) {
      app.log.error({ err: error }, 'admin/kyc: query failed');
      return reply.code(500).send({ error: 'query_failed' });
    }

    // Generate signed URLs for every document (1-hour expiry)
    const submissions = await Promise.all(
      (data ?? []).map(async (sub: any) => {
        const docs = await Promise.all(
          (sub.kyc_documents ?? []).map(async (doc: any) => {
            const { data: signedData } = await supabaseAdmin.storage
              .from('kyc')
              .createSignedUrl(doc.storage_path, 3600);
            return {
              ...doc,
              signed_url: signedData?.signedUrl ?? null,
            };
          }),
        );
        return { ...sub, kyc_documents: docs };
      }),
    );

    return reply.send({ submissions });
  });

  /**
   * POST /api/admin/kyc/:id/approve
   * Sets kyc_submissions.status = 'approved', reviewed_at = now().
   */
  app.post('/kyc/:id/approve', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('kyc_submissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (subErr || !sub) return reply.code(404).send({ error: 'submission_not_found' });
    if (sub.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: sub.status });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('kyc_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/kyc/approve: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, submissionId: id }, 'admin: KYC approved');
    return reply.send({ submission: updated });
  });

  /**
   * POST /api/admin/kyc/:id/reject
   * Sets status = 'rejected', rejection_reason, reviewed_at = now().
   */
  app.post('/kyc/:id/reject', async (req, reply) => {
    const adminId = await authAdmin(req.headers.authorization);
    if (!adminId) return reply.code(403).send({ error: 'forbidden' });

    const { id } = req.params as { id: string };
    const parsed = RejectSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data?.reason : undefined;

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('kyc_submissions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (subErr || !sub) return reply.code(404).send({ error: 'submission_not_found' });
    if (sub.status !== 'pending') {
      return reply.code(400).send({ error: 'not_pending', current: sub.status });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('kyc_submissions')
      .update({
        status: 'rejected',
        rejection_reason: reason ?? 'Rejected by admin',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) {
      app.log.error({ err: updErr }, 'admin/kyc/reject: update failed');
      return reply.code(500).send({ error: 'update_failed' });
    }

    app.log.info({ adminId, submissionId: id, reason }, 'admin: KYC rejected');
    return reply.send({ submission: updated });
  });
}
