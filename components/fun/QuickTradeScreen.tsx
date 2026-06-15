import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { TrendingUp, TrendingDown, Flame } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, ApiError } from '@/lib/api';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';
import { useProfileStore } from '@/stores/profile';
import { allSymbols, CATEGORIES, type SymbolCategory } from '@/lib/symbolMeta';
import { BinaryCard } from './BinaryCard';
import { ActiveRounds } from './ActiveRounds';
import type { BinaryRound } from './ActiveRounds';
import { RoundResultModal } from './RoundResultModal';
import { QuickStats } from './QuickStats';

const DURATIONS = [
  { label: '5s',    seconds: 5,     multiplier: 2.00 },
  { label: '30s',   seconds: 30,    multiplier: 1.92 },
  { label: '60s',   seconds: 60,    multiplier: 1.85 },
  { label: '5min',  seconds: 300,   multiplier: 1.78 },
  { label: '15min', seconds: 900,   multiplier: 1.72 },
  { label: '30min', seconds: 1800,  multiplier: 1.65 },
  { label: '4h',    seconds: 14400, multiplier: 1.55 },
  { label: '24h',   seconds: 86400, multiplier: 1.45 },
];

type CategoryTab = 'All' | SymbolCategory;
const TABS: CategoryTab[] = ['All', ...CATEGORIES];

function describeRoundError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'insufficient_balance':
        return `Not enough balance (need $${(err.details.required as number)?.toFixed(2) ?? '-'}, have $${(err.details.available as number)?.toFixed(2) ?? '-'})`;
      case 'no_quote':
        return 'No live price available for this asset - try again.';
      case 'account_not_found':
        return 'Account not found. Please reload.';
      case 'forbidden':
        return 'Account access denied.';
      case 'unauthorized':
        return 'Session expired - please sign in again.';
      case 'deduct_failed':
      case 'insert_failed':
        return 'Server error - your balance was not changed. Try again.';
      default:
        return `Error: ${err.code}`;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

export function QuickTradeScreen() {
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('All');
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
  const [duration, setDuration] = useState(DURATIONS[0]);
  const [stake, setStake] = useState(10);
  const [busy, setBusy] = useState<'buy' | 'sell' | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [settledRound, setSettledRound] = useState<BinaryRound | null>(null);
  // Freshly-opened round, handed to ActiveRounds for an optimistic insert so
  // short (5s) rounds show immediately instead of waiting on the realtime INSERT.
  const [openedRound, setOpenedRound] = useState<BinaryRound | null>(null);

  const { account, fetch: refetchAccount } = useAccountStore();
  const quotes = usePriceStore((s) => s.quotes);
  const { profile, fetch: fetchProfile, subscribe: subscribeProfile } = useProfileStore();

  useEffect(() => {
    fetchProfile();
    let cleanup: (() => void) | undefined;
    subscribeProfile().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [fetchProfile, subscribeProfile]);

  const streak = profile?.current_streak ?? 0;

  // All symbols that have a live quote right now
  const liveSymbols = useMemo(() => {
    return allSymbols().filter((s) => quotes[s.ticker] !== undefined);
  }, [quotes]);

  // Symbols visible in the chip strip based on active category tab
  const visibleSymbols = useMemo(() => {
    if (categoryTab === 'All') return liveSymbols;
    return liveSymbols.filter((s) => s.category === categoryTab);
  }, [liveSymbols, categoryTab]);

  // Reset selected symbol when switching category if current isn't in new list
  useEffect(() => {
    const inView = visibleSymbols.some((s) => s.ticker === selectedSymbol);
    if (!inView && visibleSymbols.length > 0) {
      setSelectedSymbol(visibleSymbols[0].ticker);
    }
  }, [visibleSymbols, selectedSymbol]);

  const selectedMeta = liveSymbols.find((s) => s.ticker === selectedSymbol) ?? liveSymbols[0];
  const quote = quotes[selectedSymbol];
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
        const { round } = await api.openRound({
          accountId: account.id,
          symbol: selectedSymbol,
          direction,
          stake,
          durationSeconds: duration.seconds,
        });

        // Show it immediately (don't wait for the realtime INSERT — it loses the
        // race on 5s rounds). New object identity each time so the effect re-runs
        // even if the same id somehow recurs.
        if (round) setOpenedRound({ ...round });

        refetchAccount();

        setFeedback({
          msg: `Round opened! ${direction === 'buy' ? 'Up' : 'Down'} ${selectedSymbol} $${stake} - closes in ${duration.label}`,
          ok: true,
        });
      } catch (err) {
        setFeedback({ msg: describeRoundError(err), ok: false });
      } finally {
        setBusy(null);
      }
    },
    [busy, account, selectedSymbol, stake, duration, refetchAccount],
  );

  const selectedAsset = {
    symbol: selectedSymbol,
    name: selectedMeta?.name ?? selectedSymbol,
    price: livePrice,
    change: 0,
  };

  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      {/* Streak badge */}
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
            {streak} win streak
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginLeft: 'auto' }}>
            Best: {profile?.best_streak ?? streak}
          </Text>
        </View>
      )}

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.xs }}
      >
        {TABS.map((tab) => {
          const active = tab === categoryTab;
          const count =
            tab === 'All'
              ? liveSymbols.length
              : liveSymbols.filter((s) => s.category === tab).length;
          if (count === 0 && tab !== 'All') return null;
          return (
            <Pressable
              key={tab}
              onPress={() => { setCategoryTab(tab); setFeedback(null); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: spacing.md,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: active ? colors.primary : 'transparent',
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textSecondary, fontSize: 12 }}>
                {tab}
              </Text>
              <Text style={{ ...typography.mono, color: active ? '#fff' : colors.textMuted, fontSize: 11 }}>
                {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Asset chips filtered by category */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {visibleSymbols.map((s) => {
          const active = s.ticker === selectedSymbol;
          const q = quotes[s.ticker];
          const mid = q ? (q.bid + q.ask) / 2 : null;
          return (
            <Pressable
              key={s.ticker}
              onPress={() => { setSelectedSymbol(s.ticker); setFeedback(null); }}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: active ? colors.primary : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                minWidth: 110,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textPrimary, fontSize: 13 }}>
                {s.ticker}
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
                  ? mid >= 100
                    ? mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : mid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })
                  : '...'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Featured card with live price */}
      <BinaryCard asset={selectedAsset} duration={duration} />

      {/* Duration picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {DURATIONS.map((d) => {
          const active = d.label === duration.label;
          return (
            <Pressable
              key={d.label}
              testID={`duration-${d.label}`}
              onPress={() => setDuration(d)}
              style={{
                width: 68,
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
                x{d.multiplier}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
                testID={`stake-${amt}`}
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
          testID={feedback.ok ? 'quick-feedback-ok' : 'quick-feedback-error'}
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
        <Pressable
          testID="quick-down-button"
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

        <Pressable
          testID="quick-up-button"
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
        Win pays x{duration.multiplier} - Loss costs ${stake.toFixed(2)}
      </Text>

      {/* Active rounds */}
      {account && (
        <ActiveRounds
          accountId={account.id}
          onRoundSettled={setSettledRound}
          injectedRound={openedRound}
        />
      )}

      {/* 18.16 — balance + session stats + recent results so the player can
          see how they're doing (the empty space below the buttons). Refreshes
          when a round settles (settledRound) or a new one opens (openedRound). */}
      {account && (
        <QuickStats
          accountId={account.id}
          balance={Number(account.balance)}
          streak={streak}
          refreshSignal={`${settledRound?.id ?? ''}:${openedRound?.id ?? ''}`}
        />
      )}

      {/* Win / loss result modal */}
      <RoundResultModal
        round={settledRound}
        onDismiss={() => setSettledRound(null)}
      />
    </View>
  );
}
