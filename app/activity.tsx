/**
 * Activity — unified, filterable history of everything on the account:
 * closed trades, Quick-mode rounds, and money transactions.
 *
 * Filters: Type (All / Trades / Rounds / Deposits / Withdrawals), Date range
 * (Today / 7d / 30d / All), and sort by Date or Amount. Scrollable (FlatList)
 * with load-more. CSV export of the current filtered set.
 *
 * Data is merged client-side from three Supabase queries (no new backend).
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Download, TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine, Gift, Zap } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAccountStore } from '@/stores/account';
import { supabase } from '@/lib/supabase';
import { HScrollView } from '@/components/shared/HScrollView';

type Kind = 'trade' | 'round' | 'deposit' | 'withdrawal' | 'bonus' | 'adjustment';

interface Item {
  key: string;
  kind: Kind;
  title: string;
  subtitle: string;
  amount: number; // signed net for the account
  ts: number;
  symbol?: string;
}

type TypeFilter = 'all' | 'trade' | 'round' | 'deposit' | 'withdrawal';
type RangeFilter = 'today' | '7d' | '30d' | 'all';
type Sort = 'date' | 'amount';

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trade', label: 'Trades' },
  { key: 'round', label: 'Rounds' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'withdrawal', label: 'Withdrawals' },
];
const RANGES: { key: RangeFilter; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All' },
];

const PAGE = 50;

function timeStr(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function Activity() {
  const router = useRouter();
  const account = useAccountStore((s) => s.account);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [range, setRange] = useState<RangeFilter>('all');
  const [sort, setSort] = useState<Sort>('date');
  const [limit, setLimit] = useState(PAGE);

  const load = useCallback(async () => {
    if (!account) return;
    const [tradesRes, roundsRes, txRes] = await Promise.all([
      supabase
        .from('trades')
        .select('id, symbol, side, volume, profit, status, close_time, open_time')
        .eq('account_id', account.id)
        .eq('status', 'closed')
        .order('close_time', { ascending: false })
        .limit(500),
      supabase
        .from('binary_rounds')
        .select('id, symbol, direction, stake, payout, outcome, closes_at')
        .eq('account_id', account.id)
        .neq('outcome', 'pending')
        .order('closes_at', { ascending: false })
        .limit(500),
      supabase
        .from('transactions')
        .select('id, type, amount, status, method, created_at')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const merged: Item[] = [];

    for (const t of (tradesRes.data ?? []) as any[]) {
      merged.push({
        key: `t${t.id}`,
        kind: 'trade',
        title: `${t.side === 'buy' ? 'Buy' : 'Sell'} ${t.volume} ${t.symbol}`,
        subtitle: `Trade · closed`,
        amount: Number(t.profit) || 0,
        ts: new Date(t.close_time ?? t.open_time).getTime(),
        symbol: t.symbol,
      });
    }
    for (const r of (roundsRes.data ?? []) as any[]) {
      const net = r.outcome === 'win' ? (Number(r.payout) || 0) - Number(r.stake)
        : r.outcome === 'tie' ? 0 : -Number(r.stake);
      merged.push({
        key: `r${r.id}`,
        kind: 'round',
        title: `${r.direction === 'buy' ? '▲ Up' : '▼ Down'} ${r.symbol}`,
        subtitle: `Round · ${r.outcome}`,
        amount: net,
        ts: new Date(r.closes_at).getTime(),
        symbol: r.symbol,
      });
    }
    for (const x of (txRes.data ?? []) as any[]) {
      const signed = x.type === 'withdrawal' ? -Math.abs(Number(x.amount)) : Number(x.amount);
      merged.push({
        key: `x${x.id}`,
        kind: x.type as Kind,
        title: x.type[0].toUpperCase() + x.type.slice(1) + (x.method ? ` · ${x.method}` : ''),
        subtitle: `${x.status}`,
        amount: signed,
        ts: new Date(x.created_at).getTime(),
      });
    }

    setItems(merged);
  }, [account]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const visible = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === 'today' ? new Date().setHours(0, 0, 0, 0)
      : range === '7d' ? now - 7 * 864e5
      : range === '30d' ? now - 30 * 864e5
      : 0;

    let list = items.filter((it) => {
      if (it.ts < cutoff) return false;
      if (typeFilter === 'all') return true;
      if (typeFilter === 'trade') return it.kind === 'trade';
      if (typeFilter === 'round') return it.kind === 'round';
      if (typeFilter === 'deposit') return it.kind === 'deposit';
      if (typeFilter === 'withdrawal') return it.kind === 'withdrawal';
      return true;
    });

    list = list.sort((a, b) => (sort === 'amount' ? Math.abs(b.amount) - Math.abs(a.amount) : b.ts - a.ts));
    return list;
  }, [items, typeFilter, range, sort]);

  // Reset visible window when filters change.
  useEffect(() => { setLimit(PAGE); }, [typeFilter, range, sort]);

  const exportCSV = useCallback(async () => {
    if (visible.length === 0) return;
    const header = 'kind,title,amount,when';
    const rows = visible.map((it) =>
      [it.kind, it.title.replace(/,/g, ' '), it.amount.toFixed(2), new Date(it.ts).toISOString()].join(','),
    );
    try {
      await Share.share({ title: 'Vanta Activity', message: [header, ...rows].join('\n') });
    } catch {}
  }, [visible]);

  const iconFor = (k: Kind) => {
    if (k === 'trade') return <Zap size={15} color={colors.primary} />;
    if (k === 'round') return <TrendingUp size={15} color={colors.primary} />;
    if (k === 'deposit') return <ArrowDownToLine size={15} color={colors.profit} />;
    if (k === 'withdrawal') return <ArrowUpFromLine size={15} color={colors.loss} />;
    return <Gift size={15} color={colors.warning} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, flex: 1 }}>Activity</Text>
        <Pressable onPress={exportCSV} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Download size={16} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>CSV</Text>
        </Pressable>
      </View>

      {/* Type filter */}
      <View style={{ paddingTop: spacing.sm }}>
        <HScrollView contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.md }}>
          {TYPE_TABS.map((t) => {
            const active = t.key === typeFilter;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTypeFilter(t.key)}
                style={{
                  paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill,
                  backgroundColor: active ? colors.primary : 'transparent',
                  borderWidth: 1, borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textSecondary, fontSize: 12 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </HScrollView>
      </View>

      {/* Date range + sort */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs }}>
        {RANGES.map((r) => {
          const active = r.key === range;
          return (
            <Pressable
              key={r.key}
              onPress={() => setRange(r.key)}
              style={{
                paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm,
                backgroundColor: active ? colors.bgElevated : 'transparent',
                borderWidth: 1, borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text style={{ ...typography.body, color: active ? colors.primary : colors.textMuted, fontSize: 12 }}>{r.label}</Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setSort((s) => (s === 'date' ? 'amount' : 'date'))}
          style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
            Sort: {sort === 'date' ? 'Date' : 'Amount'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visible.slice(0, limit)}
          keyExtractor={(it) => it.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={() => setLimit((n) => (n < visible.length ? n + PAGE : n))}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: spacing.md, paddingTop: 0 }}
          ListEmptyComponent={
            <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl }}>
              No activity for this filter.
            </Text>
          }
          ListFooterComponent={
            limit < visible.length ? (
              <Pressable onPress={() => setLimit((n) => n + PAGE)} style={{ padding: spacing.md, alignItems: 'center' }}>
                <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 13 }}>
                  Load more ({visible.length - limit} more)
                </Text>
              </Pressable>
            ) : visible.length > 0 ? (
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, textAlign: 'center', padding: spacing.md }}>
                {visible.length} item{visible.length === 1 ? '' : 's'}
              </Text>
            ) : null
          }
          renderItem={({ item: it }) => (
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                backgroundColor: colors.bgElevated, borderRadius: radius.md,
                borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs,
              }}
            >
              {iconFor(it.kind)}
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }} numberOfLines={1}>{it.title}</Text>
                <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>{it.subtitle} · {timeStr(it.ts)}</Text>
              </View>
              <Text style={{ ...typography.monoBold, color: it.amount > 0 ? colors.profit : it.amount < 0 ? colors.loss : colors.textSecondary, fontSize: 13 }}>
                {it.amount > 0 ? '+' : it.amount < 0 ? '-' : ''}${Math.abs(it.amount).toFixed(2)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
