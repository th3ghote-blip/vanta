/**
 * ActiveRounds — Phase 2.4
 *
 * Displays all pending binary rounds for the current account.
 * Subscribes to Supabase realtime so rows appear instantly after openRound()
 * and disappear (with a win/loss flash) when the settler resolves them.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { CountdownRing } from './CountdownRing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RoundOutcome = 'pending' | 'win' | 'loss' | 'tie';

export interface BinaryRound {
  id: string;
  account_id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  stake: number;
  payout_multiplier: number;
  entry_price: number;
  duration_seconds: number;
  closes_at: string; // ISO timestamp
  outcome: RoundOutcome;
  exit_price: number | null;
  payout: number | null;
}

// ---------------------------------------------------------------------------
// RoundRow — one card, fades out after settling
// ---------------------------------------------------------------------------

interface RowProps {
  round: BinaryRound;
  onFaded: (id: string) => void;
}

function RoundRow({ round, onFaded }: RowProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const settled = round.outcome !== 'pending';

  useEffect(() => {
    if (!settled) return;
    // Hold briefly so the user sees the outcome, then fade out.
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => onFaded(round.id));
  }, [settled, opacity, onFaded, round.id]);

  const isWin = round.outcome === 'win';
  const isLoss = round.outcome === 'loss';

  const bg = settled
    ? isWin ? '#0d2e1e' : isLoss ? '#2e0d12' : colors.bgElevated
    : colors.bgElevated;
  const borderColor = settled
    ? isWin ? colors.profit : isLoss ? colors.loss : colors.border
    : colors.border;
  const ringColor = settled
    ? isWin ? colors.profit : isLoss ? colors.loss : colors.textMuted
    : colors.primary;

  const entryFmt = round.entry_price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  });
  const exitFmt =
    round.exit_price != null
      ? round.exit_price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 5,
        })
      : null;

  return (
    <Animated.View
      style={{
        opacity,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: bg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor,
        padding: spacing.sm,
      }}
    >
      {/* Countdown ring or outcome badge */}
      {settled ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: isWin ? '#0d2e1e' : isLoss ? '#2e0d12' : colors.bgSurface,
            borderWidth: 2,
            borderColor: ringColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              ...typography.monoBold,
              color: ringColor,
              fontSize: 11,
              textAlign: 'center',
            }}
          >
            {round.outcome.toUpperCase()}
          </Text>
        </View>
      ) : (
        <CountdownRing
          seconds={round.duration_seconds}
          closesAt={round.closes_at}
          label=""
          size={56}
        />
      )}

      {/* Middle: symbol + direction + prices */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {round.direction === 'buy' ? (
            <TrendingUp color={colors.profit} size={13} />
          ) : (
            <TrendingDown color={colors.loss} size={13} />
          )}
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
            {round.symbol}
          </Text>
          <Text
            style={{
              ...typography.body,
              color: round.direction === 'buy' ? colors.profit : colors.loss,
              fontSize: 11,
            }}
          >
            {round.direction === 'buy' ? '▲ UP' : '▼ DOWN'}
          </Text>
        </View>

        <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 11 }}>
          {exitFmt != null
            ? `${entryFmt} → ${exitFmt}`
            : `Entry ${entryFmt}`}
        </Text>
      </View>

      {/* Right: stake + payout */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 13 }}>
          ${round.stake.toFixed(2)}
        </Text>
        {settled ? (
          round.payout != null && round.payout > 0 ? (
            <Text style={{ ...typography.mono, color: colors.profit, fontSize: 11 }}>
              +${round.payout.toFixed(2)}
            </Text>
          ) : (
            <Text style={{ ...typography.mono, color: colors.loss, fontSize: 11 }}>
              −${round.stake.toFixed(2)}
            </Text>
          )
        ) : (
          <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 11 }}>
            ×{round.payout_multiplier}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// ActiveRounds — container
// ---------------------------------------------------------------------------

interface Props {
  accountId: string;
  /**
   * Called when a pending round transitions to win/loss/tie.
   * Fires exactly once per round (realtime UPDATE and the poll fallback are deduped).
   */
  onRoundSettled?: (round: BinaryRound) => void;
  /**
   * A freshly-opened round (from POST /api/rounds/open). Shown immediately so
   * short rounds (e.g. 5s) don't depend on the realtime INSERT arriving in time.
   */
  injectedRound?: BinaryRound | null;
}

export function ActiveRounds({ accountId, onRoundSettled, injectedRound }: Props) {
  const [rounds, setRounds] = useState<BinaryRound[]>([]);
  // Ids we've already reported as settled, so onRoundSettled fires exactly once
  // whether the realtime UPDATE or the poll fallback wins the race.
  const settledIdsRef = useRef<Set<string>>(new Set());

  // Mark a round settled: update its row in the list and fire onRoundSettled once.
  const reportSettled = useCallback(
    (round: BinaryRound) => {
      setRounds((prev) => prev.map((r) => (r.id === round.id ? round : r)));
      if (round.outcome === 'pending') return;
      if (settledIdsRef.current.has(round.id)) return;
      settledIdsRef.current.add(round.id);
      onRoundSettled?.(round);
    },
    [onRoundSettled],
  );

  // Fetch all currently-pending rounds on mount (and when accountId changes).
  const loadPending = useCallback(async () => {
    const { data, error } = await supabase
      .from('binary_rounds')
      .select('*')
      .eq('account_id', accountId)
      .eq('outcome', 'pending')
      .order('closes_at', { ascending: true });

    if (!error && data) {
      setRounds(data as BinaryRound[]);
    }
  }, [accountId]);

  // Optimistic insert: show a freshly-opened round immediately (don't wait for
  // the realtime INSERT, which can lose the race on short 5s rounds).
  useEffect(() => {
    if (!injectedRound) return;
    setRounds((prev) =>
      prev.some((r) => r.id === injectedRound.id)
        ? prev
        : [...prev, injectedRound].sort(
            (a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime(),
          ),
    );
  }, [injectedRound]);

  // Settlement fallback + primary path: Supabase realtime is unreliable here
  // (postgres_changes RLS authorization), so we poll fast. Every 600ms, re-fetch
  // any local round whose close time has passed and is still pending; settle it
  // from the DB. Guarantees the result modal fires within ~0.6s of the server
  // settling, regardless of realtime.
  useEffect(() => {
    const iv = setInterval(async () => {
      const now = Date.now();
      const due = rounds.filter(
        (r) =>
          r.outcome === 'pending' &&
          !settledIdsRef.current.has(r.id) &&
          new Date(r.closes_at).getTime() <= now,
      );
      if (due.length === 0) return;
      const { data } = await supabase
        .from('binary_rounds')
        .select('*')
        .in('id', due.map((r) => r.id));
      for (const row of (data ?? []) as BinaryRound[]) {
        if (row.outcome !== 'pending') reportSettled(row);
      }
    }, 600);
    return () => clearInterval(iv);
  }, [rounds, reportSettled]);

  useEffect(() => {
    loadPending();

    const channel = supabase
      .channel(`active_rounds_${accountId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'binary_rounds',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          const newRound = payload.new as BinaryRound;
          setRounds((prev) => {
            if (prev.some((r) => r.id === newRound.id)) return prev; // dedup
            return [...prev, newRound].sort(
              (a, b) =>
                new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime(),
            );
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'binary_rounds',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          const updated = payload.new as BinaryRound;
          if (updated.outcome !== 'pending') {
            reportSettled(updated);
          } else {
            setRounds((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, loadPending, reportSettled]);

  const removeRound = useCallback((id: string) => {
    setRounds((prev) => prev.filter((r) => r.id !== id));
  }, []);

  if (rounds.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
        ACTIVE ROUNDS ({rounds.length})
      </Text>
      {rounds.map((round) => (
        <RoundRow key={round.id} round={round} onFaded={removeRound} />
      ))}
    </View>
  );
}
