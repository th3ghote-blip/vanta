import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!url || !serviceKey) {
  console.warn('Server: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Verify a user JWT and return their user id. */
export async function authUser(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const cleaned = token.replace(/^Bearer /, '');
  const { data, error } = await supabaseAdmin.auth.getUser(cleaned);
  if (error || !data.user) return null;
  return data.user.id;
}
