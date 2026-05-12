/**
 * Server-side Expo push notification helper — Phase 6.2
 *
 * sendPush(userId, payload)    — look up token for one user, fire push
 * sendPushBatch(entries)       — send up to 100 notifications in one HTTP call
 *
 * Uses the Expo Push HTTP API v2 directly (no extra SDK needed — Node 18+ fetch).
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 *
 * Tokens are stored in profiles.push_token (set by lib/notifications.ts on login).
 * If a user has no token or the push fails, we log and continue — never throw.
 */

import { supabaseAdmin } from './supabase.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Send a push notification to a single user by userId.
 * Looks up their push_token in the profiles table.
 * Returns true if the push was accepted by Expo, false otherwise.
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  const token = await getToken(userId);
  if (!token) return false;
  const tickets = await sendToExpo([buildMessage(token, payload)]);
  return tickets.length > 0 && tickets[0].status === 'ok';
}

/**
 * Send pushes to multiple users in a single Expo batch request (max 100).
 * Looks up all tokens at once. Silently skips users without tokens.
 */
export async function sendPushBatch(
  entries: Array<{ userId: string; payload: PushPayload }>,
): Promise<void> {
  if (entries.length === 0) return;

  const userIds = entries.map((e) => e.userId);
  const tokenMap = await getTokens(userIds);

  const messages: ExpoPushMessage[] = [];
  for (const { userId, payload } of entries) {
    const token = tokenMap.get(userId);
    if (token) messages.push(buildMessage(token, payload));
  }

  if (messages.length === 0) return;

  // Expo accepts up to 100 messages per request — chunk if needed.
  for (let i = 0; i < messages.length; i += 100) {
    await sendToExpo(messages.slice(i, i + 100));
  }
}

// ─── internals ───────────────────────────────────────────────────────────────

function buildMessage(token: string, payload: PushPayload): ExpoPushMessage {
  return {
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound !== undefined ? payload.sound : 'default',
    badge: payload.badge,
  };
}

/** Fetch push_token for one user. Returns null if missing or not found. */
async function getToken(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();

  if (error || !data?.push_token) return null;
  return data.push_token as string;
}

/**
 * Fetch push_tokens for multiple users in one Supabase query.
 * Returns a Map<userId, token> containing only rows that have a token.
 */
async function getTokens(userIds: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, push_token')
    .in('id', userIds)
    .not('push_token', 'is', null);

  if (error || !data) return new Map();

  const map = new Map<string, string>();
  for (const row of data) {
    if (row.push_token) map.set(row.id, row.push_token as string);
  }
  return map;
}

/**
 * POST to Expo Push API. Logs any per-message errors but never throws.
 * Returns the ticket array (may be empty on network error).
 */
async function sendToExpo(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.warn(`[push] Expo API returned ${res.status}: ${await res.text()}`);
      return [];
    }

    const json = (await res.json()) as { data: ExpoPushTicket[] };
    const tickets: ExpoPushTicket[] = json.data ?? [];

    // Log any Expo-level rejections (e.g. DeviceNotRegistered).
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        const to = messages[i]?.to ?? 'unknown';
        console.warn(`[push] ticket error for token ${to}:`, ticket.message, ticket.details);
      }
    });

    return tickets;
  } catch (err) {
    console.warn('[push] fetch to Expo failed:', err);
    return [];
  }
}

// ─── pref-gated push helper ──────────────────────────────────────────────────

export type NotificationPrefKey =
  | 'price_alerts'
  | 'robot_signals'
  | 'trade_results'
  | 'promotional';

/**
 * Like sendPush, but first checks the user's notification_prefs column.
 * If the preference for `prefKey` is explicitly set to false, the push is
 * suppressed. Defaults to sending when no prefs are set (graceful fallback
 * for users that pre-date the 010 migration).
 */
export async function sendPushChecked(
  userId: string,
  prefKey: NotificationPrefKey,
  payload: PushPayload,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('notification_prefs')
    .eq('id', userId)
    .single();

  const prefs = (data?.notification_prefs as Record<string, boolean> | null) ?? {};
  // undefined means pref not set => default allow
  if (prefs[prefKey] === false) return false;

  return sendPush(userId, payload);
}
