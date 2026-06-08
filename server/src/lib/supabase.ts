import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !serviceKey) {
  console.warn('Server: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.');
}

/**
 * Admin client used for every server-side data access. Configured to never
 * persist or refresh auth state — but supabase-js v2 will still mutate the
 * client's auth state if you call `supabaseAdmin.auth.getUser(jwt)` with a
 * non-service-role JWT, downgrading subsequent queries from `service_role`
 * to `authenticated`. That broke trade INSERTs (RLS-blocked) and account
 * UPDATEs (no policy match). Verifying tokens via direct `/auth/v1/user`
 * fetch in `authUser` below sidesteps that.
 */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user_id: string;
}

/**
 * Sign in via raw fetch to /auth/v1/token.
 *
 * MUST NOT use supabaseAdmin.auth.signInWithPassword — supabase-js v2 stores
 * the returned JWT on the shared singleton (even with persistSession:false),
 * which downgrades all subsequent .from() queries from service_role to
 * authenticated and breaks RLS-gated lookups for other users.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ session: SessionPayload | null; error: string | null }> {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: serviceKey },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !body.access_token) {
    return { session: null, error: (body.error_description as string) ?? 'sign_in_failed' };
  }
  return {
    session: {
      access_token: body.access_token as string,
      refresh_token: body.refresh_token as string,
      expires_at: body.expires_at as number | undefined,
      user_id: (body.user as Record<string, string>)?.id ?? '',
    },
    error: null,
  };
}

/**
 * Verify a user JWT and return their user id. Uses a raw fetch to the
 * Supabase Auth REST endpoint so it does NOT touch the shared
 * `supabaseAdmin` client's session — critical because any session mutation
 * downgrades subsequent queries off `service_role`.
 */
export async function authUser(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const cleaned = token.replace(/^Bearer /, '');
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${cleaned}`,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}
