import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, ApiError } from '@/lib/api';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';
import { useProfileStore } from '@/stores/profile';
import { BinaryCard } from './BinaryCard';
import { CountdownRing } from './CountdownRing';
import { ActiveRounds } from './ActiveRounds';
import type { BinaryRound } from './ActiveRounds';
import { RoundResultModal } from './RoundResultModal';

const ASSETS = [
  { symbol: 'EURUSD', name: 'Euro / Dollar' },
  { symbol: 'BTCUSD', name: 'Bitcoin' },
  { symbol: 'XAUUSD', name: 'Gold' },
  { symbol: 'AAPL',   name: 'Apple' },
  { symbol: 'TSLA',   name: 'Tesla' },
  { symbol: 'AMZN',   name: 'Amazon' },
];

const DURATIONS = [
  { label: '60s',   seconds: 60,  multiplier: 1.85 },
  { label: '5min',  seconds: 300, multiplier: 1.78 },
  { label: '15min', seconds: 900, multiplier: 1.72 },
];

function describeRoundError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'insufficient_balance':
        return `Not enough balance (need $${(err.details.required as number)?.toFixed(2) ?? '—'}, have $${(err.details.available as number)?.toFixed(2) ?? '—'})`;
      case 'no_quote':
        return 'No live price available for this asset — try again.';
      case 'account_not_found':
        return 'Account not found. Please reload.';
      case 'forbidden':
        return 'Account access denied.';
      case 'unauthorized':
        return 'Session expired — please sign in again.';
      case 'deduct_failed':
      case 'insert_failed':
        return 'Server error — your balance was not changed. Try again.';
      default:
        return `Error: ${err.code}`;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

export function QuickTradeScreen() {
  const [selectedSymbol, setSelectedSymbol] = useState(ASSETS[0].symbol);
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [stake, setStake] = useState(10);
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [settledRound, setSettledRound] = useState<BinaryRound | null>(null);

  const { account, fetch: refetchAccount } = useAccountStore();
  const quotes = usePriceStore((s) => s.quotes);
  const { profile, fetch: fetchProfile, subscribe: subscribeProfile } = useProfileStore();

  // Fetch streak on mount; subscribe to realtime updates so badge refreshes
  // immediately after each round settles (server writes profiles.current_streak).
  useEffect(() => {
    fetchProfile();
    let cleanup: (() => void) | undefined;
    subscribeProfile().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [fetchProfile, subscribeProfile]);

  const streak = profile?.current_streak ?? 0;

  const selected = ASSETS.find((a) => a.symbol === selectedSymbol) ?? ASSETS[0];
  const quote = quotes[selected.symbol];
  const livePrice = quote ? (quote.bid + quote.ask) / 2 : 0;

  const openRound = useCallback(
    async (direction: 'buy' | 'sell') => {
      if (busy) return;
      if (!account) {
        setFeedback({ msg: 'No account loaded.', ok: false });
        return;
      }

      setBusy(direction);
      setFeedback(null);

      try {
        await api.openRound({
          accountId: account.id,
          symbol: selected.symbol,
          direction,
          stake,
          durationSeconds: duration.seconds,
        });

        refetchAccount();

        setFeedback({
          msg: `Round opened! ${direction === 'buy' ? '▲ Up' : '▼ Down'} ${selected.symbol} $${stake} · closes in ${duration.label}`,
          ok: true,
        });
      } catch (err) {
        setFeedback({ msg: describeRoundError(err), ok: false });
      } finally {
        setBusy(null);
      }
    },
    [busy, account, selected.symbol, stake, duration, refetchAccount],
  );

  const selectedAsset = {
    symbol: selected.symbol,
    name: selected.name,
    price: livePrice,
    change: 0,
  };

  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      {/* Streak badge — only rendered when the user has an active streak */}
      {streak > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.bgElevated,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.warning,
          }}
        >
          <Flame color={colors.warning} size={20} />
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
            🔥 {streak} win streak
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginLeft: 'auto' }}>
            Best: {profile?.best_streak ?? streak}
          </Text>
        </View>
      )}

      {/* Asset chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {ASSETS.map((a) => {
          const active = a.symbol === selectedSymbol;
          const q = quotes[a.symbol];
          const mid = q ? (q.bid + q.ask) / 2 : null;
          return (
            <Pressable
              key={a.symbol}
              onPress={() => { setSelectedSymbol(a.symbol); setFeedback(null); }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: active ? colors.primary : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                minWidth: 120,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textPrimary, fontSize: 13 }}>
                {a.symbol}
              </Text>
              <Text
                style={{
                  ...typography.mono,
                  fontSize: 11,
                  color: active ? '#fff' : colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {mid != null
                  ? mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                  : '…'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Featured card with live price */}
      <BinaryCard asset={selectedAsset} duration={duration} />

      {/* Duration picker */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {DURATIONS.map((d) => {
          const active = d.label === duration.label;
          return (
            <Pressable
              key={d.label}
              onPress={() => setDuration(d)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                alignItems: 'center',
                borderRadius: radius.md,
                backgroundColor: active ? colors.bgElevated : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>{d.label}</Text>
              <Text style={{ ...typography.mono, color: colors.profit, fontSize: 11, marginTop: 2 }}>
                ×{d.multiplier}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Stake selector */}
      <View>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs }}>
          Stake
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[5, 10, 25, 50, 100].map((amt) => {
            const active = amt === stake;
            return (
              <Pressable
                key={amt}
                onPress={() => setStake(amt)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                  borderRadius: radius.md,
                  backgroundColor: active ? colors.primary : colors.bgSurface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    ...typography.monoBold,
                    color: active ? '#fff' : colors.textPrimary,
                    fontSize: 14,
                  }}
                >
                  ${amt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Feedback banner */}
      {feedback && (
        <View
          style={{
            backgroundColor: feedback.ok ? '#0d2e1e' : '#2e0d12',
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: feedback.ok ? colors.profit : colors.loss,
            padding: spacing.md,
          }}
        >
          <Text
            style={{
              ...typography.body,
              color: feedback.ok ? colors.profit : colors.loss,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {feedback.msg}
          </Text>
        </View>
      )}

      {/* Up / Down buttons */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        {/* Down */}
        <Pressable
          disabled={!!busy}
          onPress={() => openRound('sell')}
          style={{
            flex: 1,
            backgroundColor: busy ? colors.bgElevated : colors.loss,
            paddingVertical: spacing.lg,
            borderRadius: radius.lg,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.sm,
            opacity: busy && busy !== 'sell' ? 0.4 : 1,
          }}
        >
          {busy === 'sell' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <TrendingDown color="#fff" size={20} />
              <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Down</Text>
            </>
          )}
        </Pressable>

        {/* Up */}
        <Pressable
          disabled={!!busy}
          onPress={() => openRound('buy')}
          style={{
            flex: 1,
            backgroundColor: busy ? colors.bgElevated : colors.profit,
            paddingVertical: spacing.lg,
            borderRadius: radius.lg,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.sm,
            opacity: busy && busy !== 'buy' ? 0.4 : 1,
          }}
        >
          {busy === 'buy' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <TrendingUp color="#fff" size={20} />
              <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Up</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>
        Win pays ×{duration.multiplier} · Loss costs ${stake.toFixed(2)}
      </Text>

      {/* Active rounds — appears once at least one round is open (Phase 2.4) */}
      {account && (
        <ActiveRounds
          accountId={account.id}
          onRoundSettled={setSettledRound}
        />
      )}

      {/* Win / loss result modal (Phase 2.5) */}
      <RoundResultModal
        round={settledRound}
        onDismiss={() => setSettledRound(null)}
      />
    </View>
  );
}
           