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
