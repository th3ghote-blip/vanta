import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { supabaseAdmin, signInWithPassword } from '../lib/supabase.js';
import { awardAchievement } from '../lib/achievements.js';

/**
 * Email-based auth.
 *
 * Users sign up and log in with their real email + a password they choose.
 * Behind the scenes the signup trigger (migration 003) still mints a numeric
 * account LOGIN (e.g. 80000001) on `accounts.login` — kept for support and the
 * admin dashboard only; it is never used to authenticate. (Older accounts
 * created before this change use a synthetic `${login}@vanta.account` email;
 * those keep working but are not the path new users take.)
 *
 * Endpoints:
 * - POST /api/auth/register         → { email, password } → returns { login, email, session }
 * - POST /api/auth/login            → { email, password } → returns { session }
 * - POST /api/auth/change-password  → authed; takes new password
 */

// Normalize the email (trim + lowercase) BEFORE validating, so leading/trailing
// whitespace or mixed case from the client doesn't fail .email() or split identities.
const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.string().email(),
);

const RegisterSchema = z.object({
  email: emailField,
  password: z.string().min(8).max(200),
});

const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(200),
});

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

      const { email, password } = parsed.data;

      // 1. Create the auth user with their real email. The trigger from
      //    migration 003 auto-creates the profile + accounts row (with a fresh
      //    login from the sequence). email_confirm:true keeps signup instant
      //    (no confirmation email — gated on a verified Resend domain, PARKED).
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        const msg = (createErr?.message ?? '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return reply.code(409).send({ error: 'email_taken' });
        }
        app.log.error({ createErr }, 'auth/register: createUser failed');
        return reply.code(500).send({ error: 'create_user_failed', message: createErr?.message });
      }
      const userId = created.user.id;

      // 2. Look up the auto-assigned login number (for display / admin only).
      const { data: account, error: acctErr } = await supabaseAdmin
        .from('accounts')
        .select('login')
        .eq('user_id', userId)
        .single();
      if (acctErr || !account) {
        app.log.error({ acctErr }, 'auth/register: account lookup failed');
        return reply.code(500).send({ error: 'account_lookup_failed' });
      }

      // 3. Sign in to issue a session for the client.
      // Use raw fetch (not supabaseAdmin.auth.signInWithPassword) to avoid
      // mutating the shared singleton's in-memory session, which would
      // downgrade subsequent service_role queries to authenticated+RLS.
      const { session: signedInSession, error: signInErr } = await signInWithPassword(email, password);
      if (!signedInSession) {
        return reply.code(500).send({ error: 'sign_in_failed', message: signInErr ?? undefined });
      }

      return { login: account.login, email, session: signedInSession };
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
      const { email, password } = parsed.data;
      const ip = req.ip;
      const ua = req.headers['user-agent'] ?? null;

      const { session: loginSession, error: loginErr } = await signInWithPassword(email, password);

      if (!loginSession) {
        await logAttempt({
          email,
          ip,
          ua,
          outcome: 'invalid_password',
          details: loginErr ?? undefined,
        });
        return reply.code(401).send({ error: 'invalid_credentials' });
      }

      await logAttempt({ email, ip, ua, outcome: 'success' });

      // Update daily login streak (best-effort -- never blocks login)
      const userId = loginSession.user_id;
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
      // Phase 11.3 — award 7-day streak achievement (fire-and-forget)
      if (login_streak >= 7) {
        void awardAchievement(userId, 'seven_day_streak').catch(() => {});
      }

      return { session: loginSession, login_streak };
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


async function logAttempt(input: {
  email: string;
  ip?: string;
  ua?: string | null;
  outcome: 'success' | 'invalid_password' | 'unknown_login' | 'rate_limited' | 'error';
  details?: string;
}) {
  try {
    await supabaseAdmin.from('login_attempts').insert({
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
