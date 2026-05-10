import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { authUser, supabaseAdmin } from '../lib/supabase.js';

const CreateDepositSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['crypto_btc', 'crypto_eth', 'crypto_usdt', 'wire', 'card']),
  reference: z.string().optional(),
});

const CreateWithdrawalSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['crypto', 'wire']),
  destination: z.string().min(1, 'Destination is required'),
});

export async function transactionsRoutes(app: FastifyInstance) {
  /** POST /api/transactions/deposit — create a pending deposit transaction */
  app.post('/deposit', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CreateDepositSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    const body = parsed.data;

    // Verify account belongs to this user
    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id')
      .eq('id', body.accountId)
      .single();

    if (accErr || !account) return reply.code(400).send({ error: 'account_not_found' });
    if (account.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    // Insert pending deposit
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        account_id: body.accountId,
        type: 'deposit',
        amount: body.amount,
        currency: 'USD',
        status: 'pending',
        method: body.method,
        reference: body.reference ?? null,
        notes: `User-initiated deposit via ${body.method}`,
      })
      .select()
      .single();

    if (txErr) {
      app.log.error({ err: txErr }, 'transactions: deposit insert failed');
      return reply.code(500).send({ error: 'insert_failed' });
    }

    return reply.code(201).send({ transaction: tx });
  });

  /** POST /api/transactions/withdraw — create a pending withdrawal transaction */
  app.post('/withdraw', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = CreateWithdrawalSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    const body = parsed.data;

    // Verify account belongs to this user
    const { data: account, error: accErr } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, balance')
      .eq('id', body.accountId)
      .single();

    if (accErr || !account) return reply.code(400).send({ error: 'account_not_found' });
    if (account.user_id !== userId) return reply.code(403).send({ error: 'forbidden' });

    // Block if insufficient balance
    if (body.amount > Number(account.balance)) {
      return reply.code(400).send({
        error: 'insufficient_balance',
        available: Number(account.balance),
        requested: body.amount,
      });
    }

    // Block if KYC not approved
    const { data: kyc } = await supabaseAdmin
      .from('kyc_submissions')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!kyc || kyc.status !== 'approved') {
      return reply.code(403).send({ error: 'kyc_required' });
    }

    // Insert pending withdrawal
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .insert({
        account_id: body.accountId,
        type: 'withdrawal',
        amount: body.amount,
        currency: 'USD',
        status: 'pending',
        method: body.method,
        reference: body.destination,
        notes: `User-initiated withdrawal via ${body.method} to ${body.destination}`,
      })
      .select()
      .single();

    if (txErr) {
      app.log.error({ err: txErr }, 'transactions: withdrawal insert failed');
      return reply.code(500).send({ error: 'insert_failed' });
    }

    return reply.code(201).send({ transaction: tx });
  });
}
