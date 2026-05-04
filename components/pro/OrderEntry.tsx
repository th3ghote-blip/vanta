import { useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import { useAccountStore } from '@/stores/account';
import { api } from '@/lib/api';

interface Props {
  symbol: string;
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
      setLastError(err?.message ?? 'Order failed');
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
