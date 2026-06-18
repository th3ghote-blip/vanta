import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  History,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(decimals);
}

function fmtVol(n: number): string {
  if (Math.abs(n) < 0.001) return n.toFixed(4);
  if (Math.abs(n) < 1) return n.toFixed(3);
  return n.toFixed(2);
}

function pnlColor(v: number) {
  return v >= 0 ? colors.profit : colors.loss;
}

function fmtDuration(secs: number | null): string {
  if (secs == null || !isFinite(secs) || secs < 0) return '—';
  if (secs < 60) return Math.round(secs) + 's';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ' + (mins % 60) + 'm';
  return Math.floor(hrs / 24) + 'd ' + (hrs % 24) + 'h';
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── types ─────────────────────────────────────────────────────────────────────

type TradesData = Awaited<ReturnType<typeof api.adminGetTrades>>;
type Trade = TradesData['trades'][0];
type SortKey = 'close_time' | 'open_time' | 'profit' | 'volume' | 'symbol';

const PAGE_SIZE = 50;

// ── sub-components ────────────────────────────────────────────────────────────

function TotalsCard({ totals }: { totals: TradesData['totals'] }) {
  return (
    <View style={{
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Closed trades</Text>
          <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 16 }}>{totals.count}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Volume</Text>
          <Text style={{ ...typography.monoBold, color: colors.info, fontSize: 16 }}>{fmtVol(totals.volume_lots)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Client P&L</Text>
          <Text style={{ ...typography.monoBold, color: pnlColor(totals.realized_client_pnl), fontSize: 16 }}>
            {totals.realized_client_pnl >= 0 ? '+' : ''}{fmt$(totals.realized_client_pnl)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 80 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>House P&L</Text>
          <Text style={{ ...typography.monoBold, color: pnlColor(totals.realized_house_pnl), fontSize: 16 }}>
            {totals.realized_house_pnl >= 0 ? '+' : ''}{fmt$(totals.realized_house_pnl)}
          </Text>
        </View>
      </View>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: spacing.xs }}>
        Win rate {(totals.win_rate * 100).toFixed(1)}% · {totals.wins} winners ·
        {' '}gross {fmt$(totals.gross_profit)} / {fmt$(totals.gross_loss)}
      </Text>
    </View>
  );
}

function FilterInput({
  label, value, onChange, placeholder, flex = 1, keyboard,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  flex?: number;
  keyboard?: 'numeric' | 'default';
}) {
  return (
    <View style={{ flex, minWidth: 120 }}>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, marginBottom: 2 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        keyboardType={keyboard ?? 'default'}
        style={{
          ...typography.mono,
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs + 2,
          fontSize: 13,
        }}
      />
    </View>
  );
}

function TradeRow({ t }: { t: Trade }) {
  return (
    <View style={{
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
            {t.symbol}{' '}
            <Text style={{ color: t.side === 'buy' ? colors.profit : colors.loss }}>
              {t.side.toUpperCase()}
            </Text>
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
            {t.login != null ? '#' + t.login : 'acct ' + t.account_id.slice(0, 6)} · {fmtVol(t.volume)} lots
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
            {fmt$(t.open_price, 4)} → {t.close_price != null ? fmt$(t.close_price, 4) : '—'} · {fmtDuration(t.duration_seconds)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...typography.monoBold, color: pnlColor(t.profit), fontSize: 15 }}>
            {t.profit >= 0 ? '+' : ''}{fmt$(t.profit)}
          </Text>
          {!!t.reason && (
            <View style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.sm,
              paddingHorizontal: 6, paddingVertical: 1,
              marginTop: 2,
            }}>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 10 }}>{t.reason}</Text>
            </View>
          )}
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
            {fmtWhen(t.close_time)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function TradesScreen() {
  const [data, setData] = useState<TradesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // committed filters (used in the request) + draft inputs
  const [symbol, setSymbol] = useState('');
  const [account, setAccount] = useState('');
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [sortKey, setSortKey] = useState<SortKey>('close_time');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const result = await api.adminGetTrades({
        symbol: symbol.trim() || undefined,
        account: account.trim() || undefined,
        reason: reason.trim() || undefined,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        sort: sortKey,
        dir,
        limit: PAGE_SIZE,
        offset,
      });
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load trades');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [symbol, account, reason, from, to, sortKey, dir, offset]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefresh(true);
    load(true);
  }, [load]);

  // Applying a filter / changing sort resets to the first page.
  const applyFilters = useCallback(() => setOffset(0), []);
  const onSort = useCallback((key: SortKey) => {
    setOffset(0);
    if (key === sortKey) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setDir('desc'); }
  }, [sortKey]);

  const totalCount = data?.count ?? 0;
  const pageStart = totalCount === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, totalCount);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalCount;

  const sortLabel = useMemo(() => ({
    close_time: 'Closed', open_time: 'Opened', profit: 'P&L', volume: 'Volume', symbol: 'Symbol',
  } as Record<SortKey, string>), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: 56,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <History size={18} color={colors.primary} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Trade History
        </Text>
        <Pressable onPress={onRefresh} hitSlop={12}>
          <RefreshCw size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Body */}
      {loading && !data ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <AlertTriangle size={32} color={colors.loss} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
            {error}
          </Text>
          <Pressable
            onPress={() => load()}
            style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.bgElevated, borderRadius: radius.md }}
          >
            <Text style={{ ...typography.bodyBold, color: colors.primary }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Filters */}
          <View style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.md,
            gap: spacing.sm,
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <FilterInput label="SYMBOL" value={symbol} onChange={setSymbol} placeholder="e.g. BTCUSD" />
              <FilterInput label="ACCOUNT (login)" value={account} onChange={setAccount} placeholder="e.g. 80000035" keyboard="numeric" />
              <FilterInput label="REASON" value={reason} onChange={setReason} placeholder="e.g. admin_close" />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <FilterInput label="FROM (close ≥)" value={from} onChange={setFrom} placeholder="2026-06-01" />
              <FilterInput label="TO (close ≤)" value={to} onChange={setTo} placeholder="2026-06-30" />
              <Pressable
                onPress={applyFilters}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  alignSelf: 'flex-end',
                  backgroundColor: colors.primary,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  minWidth: 110,
                }}
              >
                <Search size={14} color={colors.bgDeep} />
                <Text style={{ ...typography.bodyBold, color: colors.bgDeep, fontSize: 13 }}>Apply</Text>
              </Pressable>
            </View>
          </View>

          {data && <TotalsCard totals={data.totals} />}

          {/* Sort switcher */}
          <View style={{
            flexDirection: 'row', gap: spacing.xs,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            padding: 4,
            marginBottom: spacing.md,
          }}>
            {(['close_time', 'profit', 'volume', 'symbol'] as SortKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => onSort(key)}
                style={{
                  flex: 1, paddingVertical: spacing.xs,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: sortKey === key ? colors.bgElevated : 'transparent',
                }}
              >
                <Text style={{
                  ...typography.bodyBold,
                  fontSize: 12,
                  color: sortKey === key ? colors.primary : colors.textSecondary,
                }}>
                  {sortLabel[key]}{sortKey === key ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
          }}>
            {(data?.trades.length ?? 0) === 0 ? (
              <Text style={{ ...typography.body, color: colors.textMuted, padding: spacing.md, textAlign: 'center' }}>
                No closed trades match these filters.
              </Text>
            ) : (
              data!.trades.map((t) => <TradeRow key={t.id} t={t} />)
            )}
          </View>

          {/* Pagination */}
          {totalCount > 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              marginTop: spacing.md,
            }}>
              <Pressable
                onPress={() => hasPrev && setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={!hasPrev}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
                  borderRadius: radius.sm, borderWidth: 1,
                  borderColor: hasPrev ? colors.border : 'transparent',
                  opacity: hasPrev ? 1 : 0.3,
                }}
              >
                <ChevronLeft size={14} color={colors.textSecondary} />
                <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 12 }}>Prev</Text>
              </Pressable>

              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }}>
                {pageStart}–{pageEnd} of {totalCount}
              </Text>

              <Pressable
                onPress={() => hasNext && setOffset(offset + PAGE_SIZE)}
                disabled={!hasNext}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
                  borderRadius: radius.sm, borderWidth: 1,
                  borderColor: hasNext ? colors.border : 'transparent',
                  opacity: hasNext ? 1 : 0.3,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 12 }}>Next</Text>
                <ChevronRight size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {data?.generated_at && (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: spacing.md, textAlign: 'right' }}>
              Snapshot: {new Date(data.generated_at).toLocaleTimeString()}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}
