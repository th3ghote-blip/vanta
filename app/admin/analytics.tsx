import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  PieChart,
  AlertTriangle,
  RefreshCw,
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

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 60) return Math.round(seconds) + 's';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ' + (mins % 60) + 'm';
  return Math.floor(hrs / 24) + 'd ' + (hrs % 24) + 'h';
}

function pnlColor(v: number) {
  return v >= 0 ? colors.profit : colors.loss;
}

// ── types ─────────────────────────────────────────────────────────────────────

type AnalyticsData = Awaited<ReturnType<typeof api.adminAnalyticsBySymbol>>;
type SymbolRow = AnalyticsData['symbols'][0];
type WindowKey = '24h' | '7d' | '30d' | 'all';
type SortKey = 'volume' | 'exposure' | 'pnl' | 'winrate';

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'pnl', label: 'House P&L' },
  { key: 'winrate', label: 'Win %' },
];

// ── sub-components ────────────────────────────────────────────────────────────

function TotalsCard({ totals }: { totals: AnalyticsData['totals'] }) {
  const house = totals.realized_house_pnl;
  return (
    <View style={{
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Symbols</Text>
          <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 16 }}>{totals.symbols}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Trades</Text>
          <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 16 }}>{totals.trade_count}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Volume</Text>
          <Text style={{ ...typography.monoBold, color: colors.info, fontSize: 16 }}>{fmt$(totals.volume_notional, 0)}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 90 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>House P&L</Text>
          <Text style={{ ...typography.monoBold, color: pnlColor(house), fontSize: 16 }}>
            {house >= 0 ? '+' : ''}{fmt$(house)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SymbolCard({ row }: { row: SymbolRow }) {
  const net = row.net_open_notional;
  return (
    <View style={{
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, flex: 1 }}>
          {row.symbol}
          {row.over_exposure && (
            <Text style={{ color: colors.loss, fontSize: 12 }}>  ⚠ exposure</Text>
          )}
        </Text>
        <Text style={{ ...typography.monoBold, color: pnlColor(row.realized_house_pnl), fontSize: 15 }}>
          {row.realized_house_pnl >= 0 ? '+' : ''}{fmt$(row.realized_house_pnl)}
        </Text>
      </View>

      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
        {row.trade_count} trades ({row.open_count} open · {row.closed_count} closed) · {fmtVol(row.volume_lots)} lots · {fmt$(row.volume_notional, 0)}
      </Text>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
        Net OI:{' '}
        <Text style={{ color: net >= 0 ? colors.profit : colors.loss }}>
          {net >= 0 ? 'LONG ' : 'SHORT '}{fmt$(Math.abs(net), 0)}
        </Text>
        {' '}({fmtVol(row.net_open_lots)} lots) · Win {Math.round(row.win_rate * 100)}% · Hold {fmtDuration(row.avg_hold_seconds)}
      </Text>
      {row.top_accounts.length > 0 && (
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
          Top: {row.top_accounts.map((a) => (a.login != null ? '#' + a.login : 'acct') + ' (' + a.trade_count + ')').join(', ')}
        </Text>
      )}
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>('7d');
  const [sortKey, setSortKey] = useState<SortKey>('volume');

  const load = useCallback(async (win: WindowKey, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const result = await api.adminAnalyticsBySymbol(win);
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(windowKey); }, [load, windowKey]);

  const onRefresh = useCallback(() => {
    setRefresh(true);
    load(windowKey, true);
  }, [load, windowKey]);

  const sorted = useMemo(() => {
    const rows = [...(data?.symbols ?? [])];
    if (sortKey === 'exposure') {
      rows.sort((a, b) => Math.abs(b.net_open_notional) - Math.abs(a.net_open_notional));
    } else if (sortKey === 'pnl') {
      rows.sort((a, b) => b.realized_house_pnl - a.realized_house_pnl);
    } else if (sortKey === 'winrate') {
      rows.sort((a, b) => b.win_rate - a.win_rate);
    } else {
      rows.sort((a, b) => b.volume_notional - a.volume_notional);
    }
    return rows;
  }, [data, sortKey]);

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
        <PieChart size={18} color={colors.primary} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Asset Analytics
        </Text>
        <Pressable onPress={onRefresh} hitSlop={12}>
          <RefreshCw size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Window selector */}
      <View style={{
        flexDirection: 'row', gap: spacing.xs,
        backgroundColor: colors.bgSurface,
        borderRadius: radius.md,
        padding: 4,
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
      }}>
        {WINDOWS.map((w) => (
          <Pressable
            key={w.key}
            onPress={() => setWindowKey(w.key)}
            style={{
              flex: 1, paddingVertical: spacing.xs,
              alignItems: 'center',
              borderRadius: radius.sm,
              backgroundColor: windowKey === w.key ? colors.bgElevated : 'transparent',
            }}
          >
            <Text style={{
              ...typography.bodyBold,
              fontSize: 13,
              color: windowKey === w.key ? colors.primary : colors.textSecondary,
            }}>
              {w.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Body */}
      {loading ? (
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
            onPress={() => load(windowKey)}
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
          {data?.generated_at && (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: spacing.md, textAlign: 'right' }}>
              Snapshot: {new Date(data.generated_at).toLocaleTimeString()}
            </Text>
          )}

          {data && <TotalsCard totals={data.totals} />}

          {/* Sort switcher */}
          <View style={{
            flexDirection: 'row', gap: spacing.xs,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            padding: 4,
            marginBottom: spacing.md,
          }}>
            {SORTS.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setSortKey(s.key)}
                style={{
                  flex: 1, paddingVertical: spacing.xs,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: sortKey === s.key ? colors.bgElevated : 'transparent',
                }}
              >
                <Text style={{
                  ...typography.bodyBold,
                  fontSize: 12,
                  color: sortKey === s.key ? colors.primary : colors.textSecondary,
                }}>
                  {s.label}
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
            {sorted.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textMuted, padding: spacing.md, textAlign: 'center' }}>
                No trades in this window.
              </Text>
            ) : (
              sorted.map((row) => <SymbolCard key={row.symbol} row={row} />)
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
