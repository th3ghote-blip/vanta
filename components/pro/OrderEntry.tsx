import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import { useAccountStore } from '@/stores/account';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { defaultVolumeFor } from '@/lib/contracts';

interface Props {
  symbol: string;
  onFirstTrade?: () => void;
}

/**
 * Format a USD figure for in-line error copy. Falls back to the raw value if the
 * server sent something non-numeric.
 */
function fmtUsd(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? '?');
  return `$${n.toFixed(2)}`;
}

/**
 * R.5 — Generate a UUID v4-compatible request ID.
 * Works on web (crypto.randomUUID) and React Native (Math.random fallback).
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Map a thrown error from `api.openOrder` to a sentence the user can act on.
 * Server error codes (see `server/src/routes/orders.ts`):
 *   insufficient_margin => details.required, details.available
 *   no_quote            => details.symbol
 *   forbidden           => either the account isn't theirs, or auth lapsed
 *   invalid_input       => details.issues (zod), but we keep the surface short
 *   margin_reserve_failed / insert_failed / close_failed => server bug, generic copy
 *   http_<status>       => fallback when the body wasn't JSON
 * Anything else (including a non-ApiError, e.g. network failure) gets a friendly fallback.
 */
function describeOrderError(err: unknown, symbol: string): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'insufficient_margin': {
        const required = fmtUsd(err.details.required);
        const available = fmtUsd(err.details.available);
        return `Not enough margin (required: ${required}, available: ${available}).`;
      }
      case 'no_quote': {
        const sym = err.details.symbol ?? symbol;
        return `No live price for ${sym} right now. Wait a moment and try again.`;
      }
      case 'forbidden':
        return `You can't trade on this account. Try signing out and back in.`;
      case 'invalid_input':
        return `Order details look off. Check the volume, stop loss, and take profit.`;
      case 'unauthorized':
        return `Session expired. Please sign in again.`;
      case 'margin_reserve_failed':
      case 'insert_failed':
        return `Server couldn't open the trade. Try again in a moment.`;
      case 'invalid_trigger_price':
        return err.details?.message
          ? `Trigger price: ${err.details.message}.`
          : `Trigger price is invalid.`;
      case 'not_implemented':
        return `That order type isn't available yet.`;
      default:
        // Unknown code or http_<status> fallback — show the code so support can repro.
        return `Order failed (${err.code}).`;
    }
  }
  // Network errors (TypeError: Failed to fetch) or anything else.
  const msg = err instanceof Error ? err.message : String(err);
  return msg ? `Order failed: ${msg}` : 'Order failed.';
}

type OrderKind = 'market' | 'limit';

export function OrderEntry({ symbol, onFirstTrade }: Props) {
  const [volume, setVolume] = useState(() => defaultVolumeFor(symbol));
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [orderKind, setOrderKind] = useState<OrderKind>('market');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Track whether the user has manually typed a volume. If they haven't, we
  // auto-update the volume field whenever the symbol changes so the default
  // always matches the asset class (forex=0.10, crypto=0.01, stocks=1, gold=0.10).
  const userEditedVolume = useRef(false);

  useEffect(() => {
    if (!userEditedVolume.current) {
      setVolume(defaultVolumeFor(symbol));
    }
  }, [symbol]);

  const handleVolumeChange = (s: string) => {
    userEditedVolume.current = true;
    setVolume(s);
  };

  const quote = usePriceStore((s) => s.quotes[symbol]);
  const account = useAccountStore((s) => s.account);
  const fetchAccount = useAccountStore((s) => s.fetch);

  const submit = async (side: 'buy' | 'sell') => {
    setLastError(null);
    if (!account) {
      setLastError('No account found. Try refreshing or signing out and back in.');
      return;
    }
    const vol = Number(volume);
    if (!Number.isFinite(vol) || vol <= 0) {
      setLastError('Volume must be a positive number.');
      return;
    }

    // T.1 — limit-order client-side validation. Server re-validates so this is
    // just an early friendly message.
    let triggerNum: number | undefined;
    if (orderKind === 'limit') {
      triggerNum = Number(triggerPrice);
      if (!Number.isFinite(triggerNum) || triggerNum <= 0) {
        setLastError('Trigger price must be a positive number.');
        return;
      }
      if (quote) {
        if (side === 'buy' && triggerNum >= quote.ask) {
          setLastError(`Buy-limit must be below current ask (${quote.ask}).`);
          return;
        }
        if (side === 'sell' && triggerNum <= quote.bid) {
          setLastError(`Sell-limit must be above current bid (${quote.bid}).`);
          return;
        }
      }
    }

    // R.5 — generate a fresh idempotency key for this tap so double-taps
    // (e.g. lag-induced second press) don't open two positions.
    const clientRequestId = generateRequestId();

    setBusy(side);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      await api.openOrder({
        accountId: account.id,
        symbol,
        side,
        volume: vol,
        stopLoss: stopLoss ? Number(stopLoss) : undefined,
        takeProfit: takeProfit ? Number(takeProfit) : undefined,
        reason: Platform.OS === 'web' ? 'web' : 'mobile',
        clientRequestId,
        orderType: orderKind,
        triggerPrice: triggerNum,
      });
      // Refresh account so balance/margin reflects new position
      fetchAccount();
      // First-trade confetti: count all trades for this account.
      // Fire the callback only when the count is exactly 1 (this was the very
      // first trade). Do it async/non-blocking so it never delays the UI.
      if (onFirstTrade && account) {
        void (async () => {
          try {
            const { count } = await supabase
              .from('trades')
              .select('*', { count: 'exact', head: true })
              .eq('account_id', account.id);
            if (count === 1) onFirstTrade();
          } catch {
            // confetti is best-effort; ignore failures silently
          }
        })();
      }
    } catch (err: any) {
      setLastError(describeOrderError(err, symbol));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.heading, fontSize: 14, color: colors.textSecondary, letterSpacing: 1 }}>
          NEW ORDER · {symbol}
        </Text>
        {quote && (
          <Text style={{ ...typography.mono, fontSize: 11, color: colors.textMuted }}>
            bid {quote.bid} / ask {quote.ask}
          </Text>
        )}
      </View>

      {/* T.1 — Market / Limit selector */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.bgSurface,
          borderRadius: radius.pill,
          padding: 3,
          borderWidth: 1,
          borderColor: colors.border,
          alignSelf: 'flex-start',
        }}
      >
        <KindButton label="Market" active={orderKind === 'market'} onPress={() => setOrderKind('market')} />
        <KindButton label="Limit" active={orderKind === 'limit'} onPress={() => setOrderKind('limit')} />
      </View>

      <Field label="Volume (lots)" value={volume} onChangeText={handleVolumeChange} />

      {orderKind === 'limit' && (
        <Field
          label="Trigger price"
          value={triggerPrice}
          onChangeText={setTriggerPrice}
          placeholder={quote ? String(quote.bid) : '—'}
        />
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field label="Stop Loss" value={stopLoss} onChangeText={setStopLoss} placeholder="—" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Take Profit" value={takeProfit} onChangeText={setTakeProfit} placeholder="—" />
        </View>
      </View>

      {lastError && (
        <Text style={{ ...typography.body, color: colors.loss, fontSize: 12 }}>{lastError}</Text>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <ActionButton
          label={
            orderKind === 'limit'
              ? `Sell-limit ${triggerPrice || '@'}`
              : `Sell ${quote ? quote.bid : ''}`
          }
          color={colors.loss}
          busy={busy === 'sell'}
          onPress={() => submit('sell')}
        />
        <ActionButton
          label={
            orderKind === 'limit'
              ? `Buy-limit ${triggerPrice || '@'}`
              : `Buy ${quote ? quote.ask : ''}`
          }
          color={colors.profit}
          busy={busy === 'buy'}
          onPress={() => submit('buy')}
        />
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <View>
      <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        style={{
          backgroundColor: colors.bgSurface,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
          fontSize: 16,
          borderWidth: 1,
          borderColor: colors.border,
          fontFamily: 'JetBrainsMono',
        }}
      />
    </View>
  );
}

function KindButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      <Text
        style={{
          ...typography.bodyBold,
          color: active ? '#fff' : colors.textSecondary,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  color,
  busy,
  onPress,
}: {
  label: string;
  color: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={{
        flex: 1,
        backgroundColor: color,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        alignItems: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ ...typography.heading, color: '#fff', fontSize: 14 }}>{label}</Text>
      )}
    </Pressable>
  );
}
