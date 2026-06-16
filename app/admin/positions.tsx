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
  Activity,
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

function pnlColor(v: number) {
  return v >= 0 ? colors.profit : colors.loss;
}

function ageOf(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return Math.floor(hrs / 24) + 'd';
}

// ── types ─────────────────────────────────────────────────────────────────────

type PositionsData = Awaited<ReturnType<typeof api.adminGetPositions>>;
type Position = PositionsData['positions'][0];
type SortKey = 'pnl' | 'symbol' | 'age';

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: PositionsData['summary'] }) {
  const net = summary.net_notional;
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
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Open trades</Text>
          <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 16 }}>{summary.total_open}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Total notional</Text>
          <Text style={{ ...typography.monoBold, color: colors.info, fontSize: 16 }}>{fmt$(summary.total_notional, 0)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Buy / Sell</Text>
          <Text style={{ ...typography.mono, color: colors.textPrimary, fontSize: 13 }}>
            <Text style={{ color: colors.profit }}>{fmt$(summary.buy_notional, 0)}</Text>
            {'  '}
            <Text style={{ color: colors.loss }}>{fmt$(summary.sell_notional, 0)}</Text>
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 90 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Net exposure</Text>
          <Text style={{ ...typography.monoBold, color: net >= 0 ? colors.profit : colors.loss, fontSize: 16 }}>
            {net >= 0 ? 'LONG ' : 'SHORT '}{fmt$(Math.abs(net), 0)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PositionRow({ pos }: { pos: Position }) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
          {pos.symbol}{' '}
          <Text style={{ color: pos.side === 'buy' ? colors.profit : colors.loss }}>
            {pos.side.toUpperCase()}
          </Text>
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
          {pos.login != null ? '#' + pos.login : 'acct ' + pos.account_id.slice(0, 6)} · {fmtVol(pos.volume)} lots
        </Text>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
          {fmt$(pos.open_price, 4)} → {fmt$(pos.current_price, 4)} · margin {fmt$(pos.margin)} · {ageOf(pos.open_time)}
        </Text>
      </View>
      <Text style={{ ...typography.monoBold, color: pnlColor(pos.pnl), fontSize: 15 }}>
        {pos.pnl >= 0 ? '+' : ''}{fmt$(pos.pnl)}
      </Text>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function PositionsScreen() {
  const [data, setData] = useState<PositionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('pnl');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const result = await api.adminGetPositions();
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load positions');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefresh(true);
    load(true);
  }, [load]);

  const sorted = useMemo(() => {
    const rows = [...(data?.positions ?? [])];
    if (sortKey === 'symbol') {
      rows.sort((a, b) => a.symbol.localeCompare(b.symbol) || Math.abs(b.pnl) - Math.abs(a.pnl));
    } else if (sortKey === 'age') {
      rows.sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());
    } else {
      rows.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
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
        <Activity size={18} color={colors.primary} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Live Positions
        </Text>
        <Pressable onPress={onRefresh} hitSlop={12}>
          <RefreshCw size={16} color={colors.textSecondary} />
        </Pressable>
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
          {data?.generated_at && (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: spacing.md, textAlign: 'right' }}>
              Snapshot: {new Date(data.generated_at).toLocaleTimeString()}
            </Text>
          )}

          {data && <SummaryCard summary={data.summary} />}

          {/* Sort switcher */}
          <View style={{
            flexDirection: 'row', gap: spacing.xs,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            padding: 4,
            marginBottom: spacing.md,
          }}>
            {(['pnl', 'symbol', 'age'] as SortKey[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setSortKey(key)}
                style={{
                  flex: 1, paddingVertical: spacing.xs,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: sortKey === key ? colors.bgElevated : 'transparent',
                }}
              >
                <Text style={{
                  ...typography.bodyBold,
                  fontSize: 13,
                  color: sortKey === key ? colors.primary : colors.textSecondary,
                }}>
                  {key === 'pnl' ? 'P&L' : key === 'symbol' ? 'Symbol' : 'Age'}
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
                No open positions across any account.
              </Text>
            ) : (
              sorted.map((pos) => <PositionRow key={pos.id} pos={pos} />)
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
