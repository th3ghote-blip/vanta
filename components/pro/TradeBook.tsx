import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';
import { api } from '@/lib/api';
import { calculatePnL } from '@/lib/contracts';

interface Trade {
  id: number;
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
  current_price: number | null;
  close_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  status: 'open' | 'closed' | 'cancelled';
  reason: string;
  open_time: string;
  close_time: string | null;
}

type Tab = 'open' | 'closed' | 'all';

export function TradeBook() {
  const account = useAccountStore((s) => s.account);
  const fetchAccount = useAccountStore((s) => s.fetch);
  const quotes = usePriceStore((s) => s.quotes);
  const [tab, setTab] = useState<Tab>('open');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }
    let q = supabase
      .from('trades')
      .select('*')
      .eq('account_id', account.id)
      .order('open_time', { ascending: false })
      .limit(200);

    if (tab === 'open') q = q.eq('status', 'open');
    else if (tab === 'closed') q = q.eq('status', 'closed');

    const { data, error } = await q;
    if (!error && data) setTrades(data as Trade[]);
    setLoading(false);
  }, [account, tab]);

  useEffect(() => {
    setLoading(true);
    refresh();
    if (!account) return;

    const channel = supabase
      .channel(`trades:${account.id}:${tab}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trades', filter: `account_id=eq.${account.id}` },
        () => refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account, tab, refresh]);

  const close = async (tradeId: number) => {
    setClosing(tradeId);
    try {
      await api.closeOrder(tradeId);
      fetchAccount();
    } catch {}
    finally { setClosing(null); }
  };

  const stats = useMemo(() => {
    const wins = trades.filter((t) => t.status === 'closed' && t.profit > 0).length;
    const closed = trades.filter((t) => t.status === 'closed').length;
    const totalPnL = trades.reduce((sum, t) => {
      if (t.status === 'closed') return sum + Number(t.profit);
      const q = quotes[t.symbol];
      const live = q ? (t.side === 'buy' ? q.bid : q.ask) : t.open_price;
      return sum + calculatePnL(t.side, t.volume, t.open_price, live, t.symbol);
    }, 0);
    return {
      total: trades.length,
      winRate: closed > 0 ? Math.round((wins / closed) * 100) : 0,
      totalPnL,
    };
  }, [trades, quotes]);

  if (!account) {
    return (
      <View style={emptyContainerStyle}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {/* Tabs + Stats */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.bgSurface,
            borderRadius: radius.pill,
            padding: 3,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <TabButton label="Open" active={tab === 'open'} onPress={() => setTab('open')} />
          <TabButton label="Closed" active={tab === 'closed'} onPress={() => setTab('closed')} />
          <TabButton label="All" active={tab === 'all'} onPress={() => setTab('all')} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Stat label="Trades" value={String(stats.total)} />
          {tab !== 'open' && <Stat label="Win" value={`${stats.winRate}%`} />}
          <Stat
            label={tab === 'open' ? 'Live P&L' : 'P&L'}
            value={`${stats.totalPnL >= 0 ? '+' : ''}$${stats.totalPnL.toFixed(2)}`}
            color={stats.totalPnL >= 0 ? colors.profit : colors.loss}
          />
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={emptyContainerStyle}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : trades.length === 0 ? (
        <View style={emptyContainerStyle}>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
            {tab === 'open'
              ? 'No open positions. Use Buy or Sell above to open one.'
              : tab === 'closed'
                ? "You haven't closed any trades yet."
                : 'No trades yet. Place your first trade above.'}
          </Text>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              padding: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.bgSurface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <HeaderCell flex={1.4}>Symbol / Side</HeaderCell>
            <HeaderCell flex={1} align="right">Open → Now</HeaderCell>
            <HeaderCell flex={0.9} align="right">P&L</HeaderCell>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView style={{ maxHeight: 480 }}>
            {trades.map((t) => (
              <TradeRow
                key={t.id}
                trade={t}
                quote={quotes[t.symbol]}
                onClose={t.status === 'open' ? close : undefined}
                closing={closing === t.id}
              />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function TradeRow({
  trade,
  quote,
  onClose,
  closing,
}: {
  trade: Trade;
  quote?: { bid: number; ask: number };
  onClose?: (id: number) => void;
  closing: boolean;
}) {
  const isOpen = trade.status === 'open';
  const livePrice = isOpen
    ? quote
      ? trade.side === 'buy' ? quote.bid : quote.ask
      : trade.open_price
    : trade.close_price ?? trade.open_price;

  const profit = isOpen
    ? calculatePnL(trade.side, trade.volume, trade.open_price, livePrice, trade.symbol)
    : Number(trade.profit);
  const positive = profit >= 0;
  const SideIcon = trade.side === 'buy' ? ArrowUpRight : ArrowDownRight;

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.sm,
            backgroundColor: trade.side === 'buy' ? colors.profit + '22' : colors.loss + '22',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SideIcon color={trade.side === 'buy' ? colors.profit : colors.loss} size={14} />
        </View>
        <View>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
            {trade.symbol}
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
            {trade.side.toUpperCase()} · {trade.volume} · {timeAgo(trade.open_time)}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ ...typography.mono, color: colors.textPrimary, fontSize: 12 }}>
          {trade.open_price}
        </Text>
        <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 11 }}>
          → {livePrice}
        </Text>
      </View>

      <View style={{ flex: 0.9, alignItems: 'flex-end' }}>
        <Text
          style={{
            ...typography.monoBold,
            color: positive ? colors.profit : colors.loss,
            fontSize: 14,
          }}
        >
          {positive ? '+' : ''}{profit.toFixed(2)}
        </Text>
        {!isOpen && (
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10 }}>
            CLOSED
          </Text>
        )}
      </View>

      <View style={{ width: 32, alignItems: 'center' }}>
        {onClose ? (
          <Pressable
            onPress={() => onClose(trade.id)}
            disabled={closing}
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.sm,
              backgroundColor: colors.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {closing ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <X color={colors.textSecondary} size={14} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 9, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 13, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function HeaderCell({
  children,
  flex,
  align = 'left',
}: {
  children: React.ReactNode;
  flex: number;
  align?: 'left' | 'right';
}) {
  return (
    <View style={{ flex }}>
      <Text
        style={{
          ...typography.body,
          fontSize: 9,
          color: colors.textMuted,
          letterSpacing: 0.5,
          textAlign: align,
        }}
      >
        {String(children).toUpperCase()}
      </Text>
    </View>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const emptyContainerStyle = {
  padding: spacing.xl,
  backgroundColor: colors.bgElevated,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  alignItems: 'center' as const,
};
