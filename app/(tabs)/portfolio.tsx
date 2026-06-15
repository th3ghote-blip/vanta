import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { PortfolioSkeleton } from '@/components/shared/SkeletonShimmer';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';
import { supabase } from '@/lib/supabase';
import { calculatePnL } from '@/lib/contracts';

interface Trade {
  id: number;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
  close_price: number | null;
  profit: number;
  status: 'open' | 'closed' | 'cancelled';
  open_time: string;
  reason: string;
}

interface Tx {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bonus' | 'adjustment';
  amount: number;
  status: string;
  method: string | null;
  created_at: string;
}

export default function Portfolio() {
  const router = useRouter();
  const account = useAccountStore((s) => s.account);
  const fetchAccount = useAccountStore((s) => s.fetch);
  const accountLoading = useAccountStore((s) => s.loading);
  const quotes = usePriceStore((s) => s.quotes);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);

  // Load trades + Quick rounds + transactions for stats / activity
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    Promise.all([
      supabase.from('trades').select('*').eq('account_id', account.id).order('open_time', { ascending: false }).limit(100),
      supabase.from('transactions').select('*').eq('account_id', account.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('binary_rounds').select('id, symbol, direction, stake, payout, outcome, closes_at').eq('account_id', account.id).neq('outcome', 'pending').order('closes_at', { ascending: false }).limit(20),
    ]).then(([t, x, r]) => {
      if (cancelled) return;
      if (t.data) setTrades(t.data as Trade[]);
      if (x.data) setTxs(x.data as Tx[]);
      if (r.data) setRounds(r.data);
    });
    return () => { cancelled = true; };
  }, [account]);

  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === 'closed');
    const wins = closed.filter((t) => t.profit > 0).length;
    const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
    const bestTrade = closed.reduce((max, t) => (t.profit > max ? t.profit : max), 0);
    const totalRealized = closed.reduce((sum, t) => sum + t.profit, 0);
    const totalUnrealized = trades
      .filter((t) => t.status === 'open')
      .reduce((sum, t) => {
        const q = quotes[t.symbol];
        const live = q ? (t.side === 'buy' ? q.bid : q.ask) : t.open_price;
        return sum + calculatePnL(t.side, t.volume, t.open_price, live, t.symbol);
      }, 0);
    return {
      total: trades.length,
      winRate,
      bestTrade,
      totalRealized,
      totalUnrealized,
    };
  }, [trades, quotes]);

  if (accountLoading || !account) {
    return <PortfolioSkeleton />;
  }

  const equity = Number(account.equity ?? account.balance) + stats.totalUnrealized;
  const totalChange = equity - 10000;
  const pctChange = (totalChange / 10000) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Balance card */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, letterSpacing: 1 }}>
              EQUITY · {account.type.toUpperCase()}
            </Text>
            <Pressable onPress={fetchAccount} style={{ padding: 4 }}>
              <RefreshCw color={colors.textSecondary} size={14} />
            </Pressable>
          </View>
          <Text style={{ ...typography.display, color: colors.textPrimary, fontSize: 36, marginTop: spacing.xs }}>
            ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text
            style={{
              ...typography.mono,
              color: totalChange >= 0 ? colors.profit : colors.loss,
              fontSize: 14,
              marginTop: 2,
            }}
          >
            {totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)} ({pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%)
          </Text>

          <View
            style={{
              marginTop: spacing.lg,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <BalanceLine label="Balance" value={`$${Number(account.balance).toFixed(2)}`} />
            <BalanceLine
              label="Unrealized P&L"
              value={`${stats.totalUnrealized >= 0 ? '+' : ''}$${stats.totalUnrealized.toFixed(2)}`}
              color={stats.totalUnrealized >= 0 ? colors.profit : colors.loss}
            />
            <BalanceLine label="Margin Used" value={`$${Number(account.margin_used ?? 0).toFixed(2)}`} />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <ActionPill icon={<ArrowDownToLine color="#fff" size={16} />} label="Deposit" primary onPress={() => router.push('/deposit')} />
            <ActionPill icon={<ArrowUpFromLine color={colors.textPrimary} size={16} />} label="Withdraw" onPress={() => router.push('/withdraw')} />
          </View>
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatTile label="Total Trades" value={String(stats.total)} />
          <StatTile label="Win Rate" value={`${stats.winRate}%`} />
          <StatTile
            label="Realized P&L"
            value={`${stats.totalRealized >= 0 ? '+' : ''}$${stats.totalRealized.toFixed(2)}`}
            color={stats.totalRealized >= 0 ? colors.profit : colors.loss}
          />
        </View>

        {/* Recent activity — combined trades + transactions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <Text
            style={{
              ...typography.bodyBold,
              color: colors.textSecondary,
              fontSize: 12,
              letterSpacing: 1,
              flex: 1,
            }}
          >
            RECENT ACTIVITY
          </Text>
          <Pressable onPress={() => router.push('/activity')}>
            <Text style={{ ...typography.body, color: colors.primary, fontSize: 12 }}>
              View all →
            </Text>
          </Pressable>
        </View>

        {(trades.length === 0 && txs.length === 0) ? (
          <View
            style={{
              padding: spacing.xl,
              backgroundColor: colors.bgElevated,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
              No activity yet. Place your first trade or make a deposit.
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
            {[
              ...trades.slice(0, 8).map((t) => ({
                key: `t${t.id}`,
                title: `${t.side.toUpperCase()} ${t.volume} ${t.symbol}`,
                subtitle: `${t.status === 'open' ? 'OPEN' : 'Closed'} · ${timeAgo(t.open_time)}`,
                amount: t.status === 'closed' ? t.profit : 0,
                show: t.status === 'closed',
                ts: new Date(t.open_time).getTime(),
              })),
              ...txs.map((x) => ({
                key: `x${x.id}`,
                title: x.type[0].toUpperCase() + x.type.slice(1) + (x.method ? ` · ${x.method}` : ''),
                subtitle: `${x.status} · ${timeAgo(x.created_at)}`,
                amount: x.type === 'withdrawal' ? -Math.abs(x.amount) : x.amount,
                show: true,
                ts: new Date(x.created_at).getTime(),
              })),
              ...rounds.map((r) => ({
                key: `r${r.id}`,
                title: `${r.direction === 'buy' ? '▲ Up' : '▼ Down'} ${r.symbol}`,
                subtitle: `Round · ${r.outcome} · ${timeAgo(r.closes_at)}`,
                amount: r.outcome === 'win' ? (Number(r.payout) || 0) - Number(r.stake) : r.outcome === 'tie' ? 0 : -Number(r.stake),
                show: true,
                ts: new Date(r.closes_at).getTime(),
              })),
            ]
              .filter((r) => r.show)
              .sort((a, b) => b.ts - a.ts)
              .slice(0, 12)
              .map((r, i) => (
                <View
                  key={r.key}
                  style={{
                    flexDirection: 'row',
                    padding: spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
                      {r.title}
                    </Text>
                    <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
                      {r.subtitle}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...typography.monoBold,
                      color: r.amount > 0 ? colors.profit : r.amount < 0 ? colors.loss : colors.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    {r.amount > 0 ? '+' : r.amount < 0 ? '-' : ''}${Math.abs(r.amount).toFixed(2)}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function BalanceLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 9, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 12, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function ActionPill({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        backgroundColor: primary ? colors.primary : colors.bgSurface,
        borderWidth: 1,
        borderColor: primary ? colors.primary : colors.border,
      }}
    >
      {icon}
      <Text style={{ ...typography.bodyBold, color: primary ? '#fff' : colors.textPrimary, fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 16, marginTop: 4 }}>
        {value}
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
