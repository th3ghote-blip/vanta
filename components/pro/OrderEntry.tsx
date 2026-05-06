import { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import { useAccountStore } from '@/stores/account';
import { api, ApiError } from '@/lib/api';

interface Props {
  symbol: string;
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
 * Map a thrown error from `api.openOrder` to a sentence the user can act on.
 * Server error codes (see `server/src/routes/orders.ts`):
 *   insufficient_margin → details.required, details.available
 *   no_quote            → details.symbol
 *   forbidden           → either the account isn't theirs, or auth lapsed
 *   invalid_input       → details.issues (zod), but we keep the surface short
 *   margin_reserve_failed / insert_failed / close_failed → server bug, generic copy
 *   http_<status>       → fallback when the body wasn't JSON
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
      default:
        // Unknown code or http_<status> fallback — show the code so support can repro.
        return `Order failed (${err.code}).`;
    }
  }
  // Network errors (TypeError: Failed to fetch) or anything else.
  const msg = err instanceof Error ? err.message : String(err);
  return msg ? `Order failed: ${msg}` : 'Order failed.';
}

export function OrderEntry({ symbol }: Props) {
  const [volume, setVolume] = useState('0.10');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

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
      });
      // Refresh account so balance/margin reflects new position
      fetchAccount();
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

      <Field label="Volume (lots)" value={volume} onChangeText={setVolume} />
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
          label={`Sell ${quote ? quote.bid : ''}`}
          color={colors.loss}
          busy={busy === 'sell'}
          onPress={() => submit('sell')}
        />
        <ActionButton
          label={`Buy ${quote ? quote.ask : ''}`}
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
