import React, { useCallback, useEffect, useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart2,
  RefreshCw,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000)     return sign + '$' + (abs / 1_000).toFixed(1)     + 'K';
  return sign + '$' + abs.toFixed(decimals);
}

function fmtVol(n: number): string {
  if (Math.abs(n) < 0.001) return n.toFixed(4);
  if (Math.abs(n) < 1)     return n.toFixed(3);
  return n.toFixed(2);
}

function pnlColor(v: number) {
  return v >= 0 ? colors.profit : colors.loss;
}

function marginLevelColor(pct: number): string {
  if (pct < 100) return colors.loss;
  if (pct < 120) return colors.warning;
  return colors.warning;
}

// ── types ─────────────────────────────────────────────────────────────────────

type RiskData = Awaited<ReturnType<typeof api.adminGetRisk>>;

// ── sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      marginBottom: spacing.sm,
    }}>
      {icon}
      <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 15 }}>
        {title}
      </Text>
    </View>
  );
}

function ExposureRow({
  symbol, buyVol, sellVol, netVolume, midPrice, grossExposure, netExposure,
}: RiskData['symbol_exposure'][0]) {
  const isLong = netVolume >= 0;
  return (
    <View style={{
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.xs,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
          {symbol}
        </Text>
        <View style={{
          paddingHorizontal: spacing.sm, paddingVertical: 3,
          borderRadius: radius.pill,
          backgroundColor: isLong ? colors.profit + '22' : colors.loss + '22',
        }}>
          <Text style={{ ...typography.bodyBold, color: isLong ? colors.profit : colors.loss, fontSize: 12 }}>
            {isLong ? 'NET LONG' : 'NET SHORT'} {fmtVol(Math.abs(netVolume))}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs }}>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Buy lots</Text>
          <Text style={{ ...typography.mono, color: colors.profit, fontSize: 13 }}>{fmtVol(buyVol)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Sell lots</Text>
          <Text style={{ ...typography.mono, color: colors.loss, fontSize: 13 }}>{fmtVol(sellVol)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Mid</Text>
          <Text style={{ ...typography.mono, color: colors.textPrimary, fontSize: 13 }}>{fmt$(midPrice, 4)}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Gross exposure</Text>
          <Text style={{ ...typography.mono, color: colors.info, fontSize: 13 }}>{fmt$(grossExposure, 0)}</Text>
        </View>
      </View>
    </View>
  );
}

function PositionRow({ pos }: { pos: RiskData['top_winning'][0] }) {
  const isWin = pos.pnl >= 0;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
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
          #{pos.id} · {fmtVol(pos.volume)} lots @ {fmt$(pos.open_price, 4)}
        </Text>
      </View>
      <Text style={{ ...typography.monoBold, color: pnlColor(pos.pnl), fontSize: 14 }}>
        {pos.pnl >= 0 ? '+' : ''}{fmt$(pos.pnl)}
      </Text>
    </View>
  );
}

function MarginCallRow({ row }: { row: RiskData['near_margin_call'][0] }) {
  const lvlColor = marginLevelColor(row.margin_level_pct);
  return (
    <View style={{
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: lvlColor + '55',
      padding: spacing.md,
      marginBottom: spacing.xs,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
          Acct {row.account_id.slice(0, 8)}…
        </Text>
        <View style={{
          paddingHorizontal: spacing.sm, paddingVertical: 3,
          borderRadius: radius.pill,
          backgroundColor: lvlColor + '22',
        }}>
          <Text style={{ ...typography.monoBold, color: lvlColor, fontSize: 12 }}>
            {row.margin_level_pct}%
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xs }}>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Equity</Text>
          <Text style={{ ...typography.mono, color: colors.textPrimary, fontSize: 13 }}>{fmt$(row.equity)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Margin used</Text>
          <Text style={{ ...typography.mono, color: colors.warning, fontSize: 13 }}>{fmt$(row.margin_used)}</Text>
        </View>
        <View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>Unrealized</Text>
          <Text style={{ ...typography.mono, color: pnlColor(row.unrealized_pnl), fontSize: 13 }}>
            {row.unrealized_pnl >= 0 ? '+' : ''}{fmt$(row.unrealized_pnl)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

type PositionTab = 'winning' | 'losing';

export default function RiskScreen() {
  const [data, setData]         = useState<RiskData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [posTab, setPosTab]     = useState<PositionTab>('losing');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const result = await api.adminGetRisk();
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load risk data');
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
        <BarChart2 size={18} color={colors.warning} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Risk Dashboard
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
          {/* Generated at */}
          {data?.generated_at && (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginBottom: spacing.md, textAlign: 'right' }}>
              Snapshot: {new Date(data.generated_at).toLocaleTimeString()}
            </Text>
          )}

          {/* ── Section 1: Symbol Exposure ── */}
          <SectionHeader
            title="Symbol Exposure"
            icon={<BarChart2 size={16} color={colors.info} />}
          />
          {data?.symbol_exposure.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.textMuted, marginBottom: spacing.xl }}>
              No open positions.
            </Text>
          ) : (
            data?.symbol_exposure.map((row) => (
              <ExposureRow key={row.symbol} {...row} />
            ))
          )}

          {/* ── Section 2: Top Positions ── */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader
              title="Open Positions"
              icon={<TrendingUp size={16} color={colors.profit} />}
            />
            {/* Tab switcher */}
            <View style={{
              flexDirection: 'row', gap: spacing.xs,
              backgroundColor: colors.bgSurface,
              borderRadius: radius.md,
              padding: 4,
              marginBottom: spacing.md,
            }}>
              {(['losing', 'winning'] as PositionTab[]).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setPosTab(tab)}
                  style={{
                    flex: 1, paddingVertical: spacing.xs,
                    alignItems: 'center',
                    borderRadius: radius.sm,
                    backgroundColor: posTab === tab ? colors.bgElevated : 'transparent',
                  }}
                >
                  <Text style={{
                    ...typography.bodyBold,
                    fontSize: 13,
                    color: posTab === tab
                      ? (tab === 'winning' ? colors.profit : colors.loss)
                      : colors.textSecondary,
                  }}>
                    {tab === 'winning' ? '▲ Top Winners' : '▼ Top Losers'}
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
              {(posTab === 'winning' ? data?.top_winning : data?.top_losing)?.length === 0 ? (
                <Text style={{ ...typography.body, color: colors.textMuted, padding: spacing.md, textAlign: 'center' }}>
                  No positions yet.
                </Text>
              ) : (
                (posTab === 'winning' ? data?.top_winning : data?.top_losing)?.map((pos) => (
                  <PositionRow key={pos.id} pos={pos} />
                ))
              )}
            </View>
          </View>

          {/* ── Section 3: Near Margin Call ── */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader
              title="Near Margin Call"
              icon={<AlertTriangle size={16} color={colors.warning} />}
            />
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm }}>
              Accounts with margin level below 150% (sorted by risk)
            </Text>
            {data?.near_margin_call.length === 0 ? (
              <View style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.profit + '44',
                padding: spacing.lg,
                alignItems: 'center',
              }}>
                <TrendingDown size={24} color={colors.profit} />
                <Text style={{ ...typography.bodyBold, color: colors.profit, marginTop: spacing.sm }}>
                  All clear — no accounts at risk
                </Text>
              </View>
            ) : (
              data?.near_margin_call.map((row) => (
                <MarginCallRow key={row.account_id} row={row} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
