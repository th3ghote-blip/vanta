/**
 * 21.13 — Online-users presence tracking.
 *
 * Stamps `accounts.last_seen` for a user's accounts whenever they make an
 * authenticated request, so the admin "Online now" panel can list who is
 * active. The write is THROTTLED in-memory (one stamp per user per window)
 * so a busy client doesn't generate a write on every single request.
 *
 * Lives in its own module (not inside supabase.ts) so the integration tests —
 * which `vi.mock('../src/lib/supabase.js')` — exercise this logic against the
 * in-memory mock DB rather than the real Supabase client.
 */
import { supabaseAdmin } from './supabase.js';

/** Minimum gap between two DB writes for the same user. */
export const PRESENCE_THROTTLE_MS = 60_000;

const lastStampedAt = new Map<string, number>();

/**
 * Record that `userId` was just seen. Returns true if a DB write was issued,
 * false if it was throttled (or no userId). Best-effort: DB errors are
 * swallowed so presence tracking never breaks an authenticated request.
 */
export async function stampLastSeen(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const now = Date.now();
  const prev = lastStampedAt.get(userId);
  if (prev != null && now - prev < PRESENCE_THROTTLE_MS) return false;
  // Reserve the slot BEFORE awaiting so concurrent requests don't all write.
  lastStampedAt.set(userId, now);
  try {
    await supabaseAdmin
      .from('accounts')
      .update({ last_seen: new Date(now).toISOString() })
      .eq('user_id', userId);
    return true;
  } catch {
    return false;
  }
}

/** Test-only: clear the throttle map so each test starts fresh. */
export function _resetPresence(): void {
  lastStampedAt.clear();
}
