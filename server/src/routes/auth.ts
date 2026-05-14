import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

import { supabaseAdmin } from '../lib/supabase.js';

/**
 * MT4-style auth.
 *
 * Users don't have email/password — they get a numeric LOGIN (e.g. 80000001)
 * and a server-generated password. Behind the scenes we store these in
 * Supabase Auth using a synthetic email `${login}@vanta.account`, so all the
 * Supabase Auth machinery (sessions, JWTs, RLS) works unchanged.
 *
 * Endpoints:
 * - POST /api/auth/register         → returns { login, password, session }
 * - POST /api/auth/login            → returns { session }
 * - POST /api/auth/change-password  → authed; takes new password
 */

const SYNTH_DOMAIN = 'vanta.account';
const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
const PASSWORD_LEN = 14;

function generatePassword(): string {
  const bytes = randomBytes(PASSWORD_LEN);
  let out = '';
  for (let i = 0; i < PASSWORD_LEN; i++) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }
  return out;
}

const RegisterSchema = z.object({
  contactEmail: z.string().email().optional(),
});

const LoginSchema = z.object({
  login: z.coerce.number().int().positive(),
  password: z.string().min(1).max(200),
});

interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user_id: string;
}

export async function authRoutes(app: FastifyInstance) {
  // Rate limit: 10 register/min per IP, 5 login/min per IP
  app.post(
    '/register',
    {
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const parsed = RegisterSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }

      const password = generatePassword();
      // Use a temporary throwaway email; we'll rewrite it after the account row exists.
      const tempEmail = `temp-${randomBytes(6).toString('hex')}@${SYNTH_DOMAIN}`;

      // 1. Create the auth user. The trigger from migration 003 auto-creates
      //    the profile + accounts row (with a fresh login from the sequence).
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: tempEmail,
        password,
        email_confirm: true,
        user_metadata: parsed.data.contactEmail ? { contact_email: parsed.data.contactEmail } : {},
      });
      if (createErr || !created.user) {
        app.log.error({ createErr }, 'auth/register: createUser failed');
        return reply.code(500).send({ error: 'create_user_failed', message: createErr?.message });
      }
      const userId = created.user.id;

      // 2. Look up the auto-assigned login number.
      const { data: account, error: acctErr } = await supabaseAdmin
        .from('accounts')
        .select('login')
        .eq('user_id', userId)
        .single();
      if (acctErr || !account) {
        app.log.error({ acctErr }, 'auth/register: account lookup failed');
        return reply.code(500).send({ error: 'account_lookup_failed' });
      }

      // 3. Rewrite the auth user's email to use the login number.
      const finalEmail = `${account.login}@${SYNTH_DOMAIN}`;
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: finalEmail,
        email_confirm: true,
      });
      if (updateErr) {
        app.log.warn({ updateErr }, 'auth/register: email rewrite failed (non-fatal)');
      }

      // 4. Sign in to issue a session for the client.
      const { data: signedIn, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
        email: finalEmail,
        password,
      });

      if (signInErr || !signedIn.session) {
        // Fall back to temp email if rewrite hadn't propagated yet.
        const fb = await supabaseAdmin.auth.signInWithPassword({ email: tempEmail, password });
        if (fb.error || !fb.data.session) {
          return reply
            .code(500)
            .send({ error: 'sign_in_failed', message: signInErr?.message ?? fb.error?.message });
        }
        return {
          login: account.login,
          password,
          session: toSessionPayload(fb.data.session, userId),
        };
      }

      return {
        login: account.login,
        password,
        session: toSessionPayload(signedIn.session, userId),
      };
    },
  );

  app.post(
    '/login',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const parsed = LoginSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input' });
      }
      const { login, password } = parsed.data;
      const ip = req.ip;
      const ua = req.headers['user-agent'] ?? null;
      const email = `${login}@${SYNTH_DOMAIN}`;

      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        const isUnknown = (error?.message ?? '').toLowerCase().includes('invalid login');
        await logAttempt({
          login,
          email,
          ip,
          ua,
          outcome: isUnknown ? 'invalid_password' : 'error',
          details: error?.message,
        });
        return reply.code(401).send({ error: 'invalid_credentials' });
      }

      await logAttempt({ login, email, ip, ua, outcome: 'success' });

      // Update daily login streak (best-effort -- never blocks login)
      const userId = data.user?.id ?? '';
      let login_streak = 0;
      if (userId) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('last_login_date, login_streak')
            .eq('id', userId)
            .single();
          if (prof) {
            if (prof.last_login_date === today) {
              // Already logged in today -- keep existing streak
              login_streak = prof.login_streak ?? 0;
            } else if (prof.last_login_date === yesterday) {
              // Consecutive day -- extend streak
              login_streak = (prof.login_streak ?? 0) + 1;
              await supabaseAdmin
                .from('profiles')
                .update({ last_login_date: today, login_streak })
                .eq('id', userId);
            } else {
              // Gap of more than 1 day (or never set) -- reset to 1
              login_streak = 1;
              await supabaseAdmin
                .from('profiles')
                .update({ last_login_date: today, login_streak: 1 })
                .eq('id', userId);
            }
          }
        } catch {
          // best-effort; never block login on streak failure
        }
      }

      return { session: toSessionPayload(data.session, userId), login_streak };
    },
  );

  app.post('/change-password', async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'unauthorized' });
    const token = auth.replace(/^Bearer /, '');

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as { newPassword?: string };
    if (!body.newPassword || body.newPassword.length < 8) {
      return reply.code(400).send({ error: 'invalid_password', message: 'min 8 chars' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userData.user.id, {
      password: body.newPassword,
    });
    if (error) return reply.code(500).send({ error: error.message });
    return { ok: true };
  });
}

function toSessionPayload(session: any, userId: string): SessionPayload {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user_id: userId,
  };
}

async function logAttempt(input: {
  login: number;
  email?: string;
  ip?: string;
  ua?: string | null;
  outcome: 'success' | 'invalid_password' | 'unknown_login' | 'rate_limited' | 'error';
  details?: string;
}) {
  try {
    await supabaseAdmin.from('login_attempts').insert({
      login: input.login,
      email: input.email,
      ip_address: input.ip,
      user_agent: input.ua,
      outcome: input.outcome,
      details: input.details,
    });
  } catch {
    // best-effort; never block login on audit failure
  }
}
