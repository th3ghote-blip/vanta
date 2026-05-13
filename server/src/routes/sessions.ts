import type { FastifyInstance } from 'fastify';
import { authUser, supabaseAdmin } from '../lib/supabase.js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Raw session shape returned by Supabase Auth REST API. */
export interface AuthSession {
  id: string;
  created_at: string;
  updated_at: string;
  user_agent: string | null;
  ip: string | null;
  not_after: string | null;
  aal: string | null;
  is_anonymous: boolean;
}

async function listSupabaseSessions(userId: string): Promise<AuthSession[]> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions`,
    { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
  );
  if (!res.ok) throw new Error(`Supabase sessions list failed: ${res.status}`);
  const body = await res.json() as { sessions?: AuthSession[] };
  return body.sessions ?? [];
}

async function deleteSupabaseSession(userId: string, sessionId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}/sessions/${sessionId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Delete session failed: ${res.status}`);
  }
}

export async function sessionsRoutes(app: FastifyInstance) {
  /** GET /api/auth/sessions — list all sessions for the calling user */
  app.get('/sessions', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    try {
      const sessions = await listSupabaseSessions(userId);
      return { sessions };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'sessions: list failed');
      return reply.code(500).send({ error: msg });
    }
  });

  /** DELETE /api/auth/sessions/:sessionId — revoke one session */
  app.delete('/sessions/:sessionId', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { sessionId } = req.params as { sessionId: string };

    // Verify the session actually belongs to this user before deleting
    try {
      const sessions = await listSupabaseSessions(userId);
      if (!sessions.some((s) => s.id === sessionId)) {
        return reply.code(404).send({ error: 'session_not_found' });
      }
      await deleteSupabaseSession(userId, sessionId);
      return { revoked: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err, sessionId }, 'sessions: revoke failed');
      return reply.code(500).send({ error: msg });
    }
  });

  /** DELETE /api/auth/sessions — revoke ALL sessions except the current one */
  app.delete('/sessions', async (req, reply) => {
    const userId = await authUser(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });

    const { currentSessionId } = req.query as { currentSessionId?: string };

    try {
      const sessions = await listSupabaseSessions(userId);
      const others = currentSessionId
        ? sessions.filter((s) => s.id !== currentSessionId)
        : sessions;
      await Promise.allSettled(
        others.map((s) => deleteSupabaseSession(userId, s.id))
      );
      return { revoked: others.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, 'sessions: revoke-all failed');
      return reply.code(500).send({ error: msg });
    }
  });
}
