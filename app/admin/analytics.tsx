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
  BarChart3,
  Users,
  AlertTriangle,
  RefreshCw,
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
type OverviewData = Awaited<ReturnType<typeof api.adminAnalyticsOverview>>;
type AccountsData = Awaited<ReturnType<typeof api.adminAnalyticsAccounts>>;
type AccountRow = AccountsData['accounts'][0];

type WindowKey = '24h' | '7d' | '30d' | 'all';
type SortKey = 'volume' | 'exposure' | 'pnl' | 'winrate';
type Mode = 'symbol' | 'platform' | 'accounts';
type AcctSort = 'pnl' | 'net' | 'equity' | 'trades' | 'deposits';

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

const ACCT_SORTS: { key: AcctSort; label: string }[] = [
  { key: 'pnl', label: 'P&L' },
  { key: 'net', label: 'Net Dep.' },
  { key: 'equity', label: 'Equity' },
  { key: 'trades', label: 'Trades' },
  { key: 'deposits', label: 'Deposits' },
];

const MODES: { key: Mode; label: string }[] = [
  { key: 'symbol', label: 'By Asset' },
  { key: 'platform', label: 'Platform' },
  { key: 'accounts', label: 'Accounts' },
];

// ── shared bits ────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ minWidth: 78 }}>
      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>{label}</Text>
      <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    }}>
      {children}
    </View>
  );
}

function SortBar<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={{
      flexDirection: 'row', gap: spacing.xs,
      backgroundColor: colors.bgSurface,
      borderRadius: radius.md,
      padding: 4,
      marginBottom: spacing.md,
    }}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={{
            flex: 1, paddingVertical: spacing.xs,
            alignItems: 'center',
            borderRadius: radius.sm,
            backgroundColor: value === o.key ? colors.bgElevated : 'transparent',
          }}
        >
          <Text style={{
            ...typography.bodyBold, fontSize: 12,
            color: value === o.key ? colors.primary : colors.textSecondary,
          }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── By-asset sub-components (21.5) ──────────────────────────────────────────────

function SymbolTotalsCard({ totals }: { totals: AnalyticsData['totals'] }) {
  const house = totals.realized_house_pnl;
  return (
    <Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <Stat label="Symbols" value={String(totals.symbols)} />
        <Stat label="Trades" value={String(totals.trade_count)} />
        <Stat label="Volume" value={fmt$(totals.volume_notional, 0)} color={colors.info} />
        <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 90 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>House P&L</Text>
          <Text style={{ ...typography.monoBold, color: pnlColor(house), fontSize: 16 }}>
            {house >= 0 ? '+' : ''}{fmt$(house)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function SymbolCard({ row }: { row: SymbolRow }) {
  const net = row.net_open_notional;
  return (
    <View style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, flex: 1 }}>
          {row.symbol}
          {row.over_exposure && <Text style={{ color: colors.loss, fontSize: 12 }}>  ⚠ exposure</Text>}
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

function SymbolView() {
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
      setData(await api.adminAnalyticsBySymbol(win));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(windowKey); }, [load, windowKey]);
  const onRefresh = useCallback(() => { setRefresh(true); load(windowKey, true); }, [load, windowKey]);

  const sorted = useMemo(() => {
    const rows = [...(data?.symbols ?? [])];
    if (sortKey === 'exposure') rows.sort((a, b) => Math.abs(b.net_open_notional) - Math.abs(a.net_open_notional));
    else if (sortKey === 'pnl') rows.sort((a, b) => b.realized_house_pnl - a.realized_house_pnl);
    else if (sortKey === 'winrate') rows.sort((a, b) => b.win_rate - a.win_rate);
    else rows.sort((a, b) => b.volume_notional - a.volume_notional);
    return rows;
  }, [data, sortKey]);

  return (
    <>
      <SortBar options={WINDOWS} value={windowKey} onChange={setWindowKey} />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => load(windowKey)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {data && <SymbolTotalsCard totals={data.totals} />}
          <SortBar options={SORTS} value={sortKey} onChange={setSortKey} />
          <View style={{
            backgroundColor: colors.bgElevated, borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
          }}>
            {sorted.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textMuted, padding: spacing.md, textAlign: 'center' }}>
                No trades in this window.
              </Text>
            ) : sorted.map((row) => <SymbolCard key={row.symbol} row={row} />)}
          </View>
        </ScrollView>
      )}
    </>
  );
}

// ── Platform view (21.6) ────────────────────────────────────────────────────────

function MiniBars({ rows, valueOf, color, signed }: {
  rows: OverviewData['series']; valueOf: (r: OverviewData['series'][0]) => number; color: string; signed?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(valueOf(r))));
  return (
    <View style={{ marginTop: spacing.sm }}>
      {rows.map((r) => {
        const v = valueOf(r);
        const pct = Math.min(100, (Math.abs(v) / max) * 100);
        const barColor = signed ? pnlColor(v) : color;
        return (
          <View key={r.date} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 9, width: 38 }}>{r.date.slice(5)}</Text>
            <View style={{ flex: 1, height: 10, backgroundColor: colors.bgSurface, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SeriesPanel({ title, rows, valueOf, color, signed, fmt }: {
  title: string; rows: OverviewData['series']; valueOf: (r: OverviewData['series'][0]) => number;
  color: string; signed?: boolean; fmt: (n: number) => string;
}) {
  const total = rows.reduce((s, r) => s + valueOf(r), 0);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13, flex: 1 }}>{title}</Text>
        <Text style={{ ...typography.monoBold, color: signed ? pnlColor(total) : color, fontSize: 14 }}>
          {signed && total >= 0 ? '+' : ''}{fmt(total)}
        </Text>
      </View>
      <MiniBars rows={rows} valueOf={valueOf} color={color} signed={signed} />
    </Card>
  );
}

function PlatformView() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      setData(await api.adminAnalyticsOverview(30));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load overview');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefresh(true); load(true); }, [load]);

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />;
  if (error) return <ErrorBlock message={error} onRetry={() => load()} />;
  if (!data) return null;

  const t = data.totals;
  const rows = data.series;
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 64 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Card>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm }}>
          Lifetime totals
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Stat label="Users" value={String(t.total_users)} />
          <Stat label="Deposits" value={fmt$(t.total_deposits, 0)} color={colors.profit} />
          <Stat label="Withdrawn" value={fmt$(t.total_withdrawals, 0)} color={colors.loss} />
          <Stat label="Net" value={fmt$(t.net_deposits, 0)} color={colors.info} />
          <Stat label="Open trades" value={String(t.open_trades)} />
          <Stat label="Exposure" value={fmt$(t.total_exposure, 0)} />
        </View>
      </Card>

      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm }}>
        Last {data.days} days (UTC)
      </Text>
      <SeriesPanel title="New users / day" rows={rows} valueOf={(r) => r.new_users} color={colors.primary} fmt={(n) => String(Math.round(n))} />
      <SeriesPanel title="Trade volume / day" rows={rows} valueOf={(r) => r.trade_volume} color={colors.info} fmt={(n) => fmt$(n, 0)} />
      <SeriesPanel title="Deposits / day" rows={rows} valueOf={(r) => r.deposits} color={colors.profit} fmt={(n) => fmt$(n, 0)} />
      <SeriesPanel title="Withdrawals / day" rows={rows} valueOf={(r) => r.withdrawals} color={colors.loss} fmt={(n) => fmt$(n, 0)} />
      <SeriesPanel title="House P&L / day" rows={rows} valueOf={(r) => r.house_pnl} color={colors.profit} signed fmt={(n) => fmt$(n)} />

      {data.generated_at && (
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, textAlign: 'right', marginTop: spacing.sm }}>
          Snapshot: {new Date(data.generated_at).toLocaleTimeString()}
        </Text>
      )}
    </ScrollView>
  );
}

// ── Accounts leaderboard view (21.6) ────────────────────────────────────────────

function AccountCard({ row }: { row: AccountRow }) {
  return (
    <Pressable
      onPress={() => { if (row.user_id) router.push(`/admin/user/${row.user_id}` as any); }}
      style={{ paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, flex: 1 }}>
          {row.login != null ? '#' + row.login : 'account'}
        </Text>
        <Text style={{ ...typography.monoBold, color: pnlColor(row.realized_pnl), fontSize: 15 }}>
          {row.realized_pnl >= 0 ? '+' : ''}{fmt$(row.realized_pnl)}
        </Text>
        <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
      </View>
      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
        Equity {fmt$(row.current_equity, 0)} · Bal {fmt$(row.balance, 0)} · Net dep {fmt$(row.net_deposits, 0)}
      </Text>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
        Dep {fmt$(row.deposits, 0)} · Wd {fmt$(row.withdrawals, 0)} · {row.trade_count} trades ({row.closed_count} closed) · Win {Math.round(row.win_rate * 100)}%
        {row.unrealized_pnl !== 0 && (
          <Text style={{ color: pnlColor(row.unrealized_pnl) }}>
            {'  '}uPnL {row.unrealized_pnl >= 0 ? '+' : ''}{fmt$(row.unrealized_pnl)}
          </Text>
        )}
      </Text>
    </Pressable>
  );
}

function AccountsView() {
  const [data, setData] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<AcctSort>('pnl');

  const load = useCallback(async (s: AcctSort, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      setData(await api.adminAnalyticsAccounts(s));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load accounts');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(sort); }, [load, sort]);
  const onRefresh = useCallback(() => { setRefresh(true); load(sort, true); }, [load, sort]);

  return (
    <>
      <SortBar options={ACCT_SORTS} value={sort} onChange={setSort} />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => load(sort)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {data && (
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
                <Stat label="Accounts" value={String(data.totals.accounts)} />
                <Stat label="Net dep." value={fmt$(data.totals.net_deposits, 0)} color={colors.info} />
                <Stat label="Equity" value={fmt$(data.totals.current_equity, 0)} />
                <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 90 }}>
                  <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>House P&L</Text>
                  <Text style={{ ...typography.monoBold, color: pnlColor(data.totals.realized_house_pnl), fontSize: 16 }}>
                    {data.totals.realized_house_pnl >= 0 ? '+' : ''}{fmt$(data.totals.realized_house_pnl)}
                  </Text>
                </View>
              </View>
            </Card>
          )}
          <View style={{
            backgroundColor: colors.bgElevated, borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
          }}>
            {(data?.accounts ?? []).length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textMuted, padding: spacing.md, textAlign: 'center' }}>
                No accounts.
              </Text>
            ) : data!.accounts.map((row) => <AccountCard key={row.account_id} row={row} />)}
          </View>
        </ScrollView>
      )}
    </>
  );
}

// ── shared error block ──────────────────────────────────────────────────────────

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <AlertTriangle size={32} color={colors.loss} />
      <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' }}>
        {message}
      </Text>
      <Pressable onPress={onRetry} style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.bgElevated, borderRadius: radius.md }}>
        <Text style={{ ...typography.bodyBold, color: colors.primary }}>Retry</Text>
      </Pressable>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [mode, setMode] = useState<Mode>('symbol');
  const Icon = mode === 'symbol' ? PieChart : mode === 'platform' ? BarChart3 : Users;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <Icon size={18} color={colors.primary} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Analytics
        </Text>
      </View>

      {/* Mode switcher */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <SortBar options={MODES} value={mode} onChange={setMode} />
      </View>

      {/* Body */}
      <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
        {mode === 'symbol' ? <SymbolView /> : mode === 'platform' ? <PlatformView /> : <AccountsView />}
      </View>
    </View>
  );
}
