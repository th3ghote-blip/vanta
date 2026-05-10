/**
 * Transaction history detailed view — Phase 4.4
 *
 * Full paginated transaction table with:
 * - Filter tabs: All / Deposits / Withdrawals / Bonuses / Adjustments
 * - Status badges (pending / completed / rejected)
 * - CSV export via Share sheet
 * - Pull-to-refresh
 * Accessible from Portfolio "View all history" link.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Download, ArrowDownToLine, ArrowUpFromLine, Gift, SlidersHorizontal, History } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAccountStore } from '@/stores/account';
import { supabase } from '@/lib/supabase';

type TxType = 'deposit' | 'withdrawal' | 'bonus' | 'adjustment';
type TxStatus = 'pending' | 'completed' | 'rejected';
type FilterType = 'all' | TxType;

interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  method: string | null;
  destination: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'bonus', label: 'Bonuses' },
  { key: 'adjustment', label: 'Adjustments' },
];

const PAGE_SIZE = 50;

export default function TransactionHistory() {
  const router = useRouter();
  const account = useAccountStore((s) => s.account);

  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTxs = useCallback(
    async (pageIndex = 0, replace = true) => {
      if (!account) return;
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('transactions')
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filter !== 'all') {
        q = q.eq('type', filter);
      }

      const { data, error } = await q;
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      const rows = (data ?? []) as Transaction[];
      setHasMore(rows.length === PAGE_SIZE);
      if (replace) {
        setTxs(rows);
      } else {
        setTxs((prev) => [...prev, ...rows]);
      }
    },
    [account, filter]
  );

  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchTxs(0, true).finally(() => setLoading(false));
  }, [fetchTxs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    await fetchTxs(0, true);
    setRefreshing(false);
  }, [fetchTxs]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await fetchTxs(next, false);
    setLoadingMore(false);
  }, [fetchTxs, hasMore, loadingMore, page]);

  const exportCSV = useCallback(async () => {
    if (!account) return;
    // Fetch all (up to 1000) for export ignoring page
    let q = supabase
      .from('transactions')
      .select('*')
      .eq('account_id', account.id)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (filter !== 'all') q = q.eq('type', filter);
    const { data } = await q;
    if (!data || data.length === 0) {
      Alert.alert('Nothing to export', 'No transactions match the current filter.');
      return;
    }
    const header = 'id,type,amount,status,method,destination,notes,created_at,completed_at';
    const rows = (data as Transaction[]).map((t) =>
      [
        t.id,
        t.type,
        t.amount,
        t.status,
        t.method ?? '',
        (t.destination ?? '').replace(/,/g, ' '),
        (t.notes ?? '').replace(/,/g, ' '),
        t.created_at,
        t.completed_at ?? '',
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');

    try {
      await Share.share({
        title: 'Vanta Transaction History',
        message: csv,
      });
    } catch {
      // user cancelled or Share unavailable
    }
  }, [account, filter]);

  const filtered = txs; // already filtered server-side

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: Platform.OS === 'ios' ? 56 : 24,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.bgDeep,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <ChevronLeft color={colors.textPrimary} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 16 }}>
            Transaction History
          </Text>
          {account && (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
              Account #{account.login}
            </Text>
          )}
        </View>
        <Pressable
          onPress={exportCSV}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <Download color={colors.textSecondary} size={14} />
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>CSV</Text>
        </Pressable>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}
        style={{ flexGrow: 0 }}
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: active ? colors.primary : colors.bgSurface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Text
                style={{
                  ...typography.bodyBold,
                  fontSize: 12,
                  color: active ? '#fff' : colors.textSecondary,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Transaction list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md }}>
            Loading transactions…
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
          <History color={colors.textMuted} size={40} style={{ marginBottom: spacing.lg }} />
          <Text style={{ ...typography.bodyBold, color: colors.textSecondary, textAlign: 'center' }}>
            No transactions yet
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }}>
            {filter === 'all'
              ? 'Make a deposit to get started.'
              : `No ${filter}s found.`}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            if (nearBottom) loadMore();
          }}
          scrollEventThrottle={400}
        >
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {filtered.map((tx, i) => (
              <TxRow key={tx.id} tx={tx} separator={i > 0} />
            ))}
          </View>

          {loadingMore && (
            <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          )}

          {!hasMore && filtered.length >= PAGE_SIZE && (
            <Text
              style={{
                ...typography.body,
                color: colors.textMuted,
                textAlign: 'center',
                fontSize: 12,
                paddingTop: spacing.xl,
              }}
            >
              All transactions loaded
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function TxRow({ tx, separator }: { tx: Transaction; separator: boolean }) {
  const isCredit = tx.type === 'deposit' || tx.type === 'bonus' || tx.type === 'adjustment';
  const amountColor =
    tx.status === 'rejected'
      ? colors.textMuted
      : isCredit
      ? colors.profit
      : colors.loss;

  return (
    <View
      style={{
        padding: spacing.md,
        borderTopWidth: separator ? 1 : 0,
        borderTopColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.sm,
          backgroundColor: colors.bgSurface,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <TxIcon type={tx.type} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
            {txTypeLabel(tx.type)}
          </Text>
          <StatusBadge status={tx.status} />
        </View>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
          {tx.method ? `${tx.method} · ` : ''}
          {formatDate(tx.created_at)}
        </Text>
        {tx.notes ? (
          <Text
            style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, marginTop: 2 }}
            numberOfLines={1}
          >
            {tx.notes}
          </Text>
        ) : null}
      </View>

      {/* Amount */}
      <Text
        style={{
          ...typography.monoBold,
          color: amountColor,
          fontSize: 14,
          textDecorationLine: tx.status === 'rejected' ? 'line-through' : 'none',
        }}
      >
        {isCredit ? '+' : '-'}${Number(tx.amount).toFixed(2)}
      </Text>
    </View>
  );
}

function TxIcon({ type }: { type: TxType }) {
  const size = 16;
  switch (type) {
    case 'deposit':
      return <ArrowDownToLine color={colors.profit} size={size} />;
    case 'withdrawal':
      return <ArrowUpFromLine color={colors.loss} size={size} />;
    case 'bonus':
      return <Gift color={colors.primary} size={size} />;
    case 'adjustment':
      return <SlidersHorizontal color={colors.warning} size={size} />;
  }
}

function StatusBadge({ status }: { status: TxStatus }) {
  const cfg: Record<TxStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: '#FFB02022', text: colors.warning, label: 'Pending' },
    completed: { bg: '#10D98422', text: colors.profit, label: 'Completed' },
    rejected: { bg: '#FF3B5C22', text: colors.loss, label: 'Rejected' },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: radius.xs,
        paddingHorizontal: 5,
        paddingVertical: 1,
      }}
    >
      <Text style={{ ...typography.body, color: c.text, fontSize: 10 }}>{c.label}</Text>
    </View>
  );
}

function txTypeLabel(type: TxType): string {
  switch (type) {
    case 'deposit':
      return 'Deposit';
    case 'withdrawal':
      return 'Withdrawal';
    case 'bonus':
      return 'Bonus';
    case 'adjustment':
      return 'Adjustment';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
