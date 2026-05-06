/**
 * AccountHeader — Phase 1.5
 *
 * Persistent strip shown above all tabs: account login number plus
 * live Balance / Equity / Free Margin.  Equity updates on every quote
 * tick by computing unrealised P&L from the open-trades list locally.
 *
 * Open trades are fetched on mount and kept fresh via a Supabase
 * realtime channel that refetches on any INSERT/UPDATE/DELETE on the
 * `trades` table for this account.
 */

import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';

import { calculatePnL } from '@/lib/contracts';
import { supabase } from '@/lib/supabase';
import { colors, spacing, typography } from '@/lib/theme';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';

// ─── types ────────────────────────────────────────────────────────────────────

interface OpenTrade {
  id: number;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return (
    '$' +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// ─── component ────────────────────────────────────────────────────────────────

export function AccountHeader() {
  const account = useAccountStore((s) => s.account);
  const quotes = usePriceStore((s) => s.quotes);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);

  // Fetch open trades; re-subscribe whenever account changes.
  useEffect(() => {
    if (!account) return;

    let cancelled = false;

    async function fetchOpen() {
      if (!account) return;
      const { data } = await supabase
        .from('trades')
        .select('id, symbol, side, volume, open_price')
        .eq('account_id', account.id)
        .eq('status', 'open');
      if (!cancelled && data) setOpenTrades(data as OpenTrade[]);
    }

    fetchOpen();

    const channel = supabase
      .channel(`acct_hdr_${account.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `account_id=eq.${account.id}`,
        },
        () => {
          fetchOpen();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [account?.id]);

  // Recompute on every quote tick.
  const { liveEquity, liveFreeMargin } = useMemo(() => {
    if (!account) return { liveEquity: 0, liveFreeMargin: 0 };

    const unrealized = openTrades.reduce((sum, t) => {
      const q = quotes[t.symbol];
      const exitPrice = q ? (t.side === 'buy' ? q.bid : q.ask) : t.open_price;
      return sum + calculatePnL(t.side, t.volume, t.open_price, exitPrice, t.symbol);
    }, 0);

    const eq = Number(account.balance) + unrealized;
    const free = eq - Number(account.margin_used ?? 0);
    return { liveEquity: eq, liveFreeMargin: free };
  }, [account, openTrades, quotes]);

  if (!account) return null;

  const equityColor =
    liveEquity > Number(account.balance)
      ? colors.profit
      : liveEquity < Number(account.balance)
        ? colors.loss
        : colors.textSecondary;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgElevated,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        gap: 6,
      }}
    >
      {/* Account number */}
      <Text
        style={{
          ...typography.mono,
          fontSize: 11,
          color: colors.primary,
          letterSpacing: 0.5,
        }}
      >
        #{account.login ?? account.id.slice(0, 8)}
      </Text>

      <Text style={{ color: colors.border, fontSize: 14 }}>|</Text>

      {/* Balance */}
      <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary }}>
        Bal{' '}
        <Text style={{ ...typography.monoBold, fontSize: 11, color: colors.textPrimary }}>
          {fmt(Number(account.balance))}
        </Text>
      </Text>

      <Text style={{ color: colors.textMuted, fontSize: 11 }}>·</Text>

      {/* Live equity */}
      <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary }}>
        Eq{' '}
        <Text style={{ ...typography.monoBold, fontSize: 11, color: equityColor }}>
          {fmt(liveEquity)}
        </Text>
      </Text>

      <Text style={{ color: colors.textMuted, fontSize: 11 }}>·</Text>

      {/* Free margin */}
      <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary }}>
        Free{' '}
        <Text style={{ ...typography.monoBold, fontSize: 11, color: colors.textPrimary }}>
          {fmt(liveFreeMargin)}
        </Text>
      </Text>
    </View>
  );
}
