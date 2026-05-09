import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react-native';

import { api, LeaderboardEntry } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

type Period = '7d' | '30d' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 days',
  '30d': '30 days',
  all: 'All time',
};

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

export function RobotLeaderboard() {
  const [period, setPeriod] = useState<Period>('7d');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.getRobotLeaderboard(p);
      setEntries(res.leaderboard);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  const onRefresh = useCallback(() => load(period, true), [period, load]);

  return (
    <View style={{ flex: 1 }}>
      {/* Period selector */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: period === p ? colors.primary : colors.bgSurface,
              borderWidth: 1,
              borderColor: period === p ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                ...typography.bodyBold,
                fontSize: 12,
                color: period === p ? '#fff' : colors.textSecondary,
              }}
            >
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && entries.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>{error}</Text>
          <Pressable onPress={() => load(period)} style={{ marginTop: spacing.sm }}>
            <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 13 }}>Retry</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Trophy color={colors.textMuted} size={28} />
          <Text style={{ ...typography.bodyBold, color: colors.textMuted, fontSize: 14 }}>
            No public robots yet
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
            Make one of your robots public to see it ranked here.
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry) => (
            <LeaderboardRow key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const isProfit = entry.total_profit >= 0;
  const medalColor = entry.rank <= 3 ? MEDAL_COLORS[entry.rank - 1] : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        gap: spacing.md,
      }}
    >
      {/* Rank badge */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.pill,
          backgroundColor: medalColor ? `${medalColor}22` : colors.bgSurface,
          borderWidth: 1,
          borderColor: medalColor ?? colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {entry.rank <= 3 ? (
          <Trophy
            size={14}
            color={medalColor ?? colors.textMuted}
          />
        ) : (
          <Text
            style={{
              ...typography.monoBold,
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            {entry.rank}
          </Text>
        )}
      </View>

      {/* Name + description */}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ ...typography.bodyBold, fontSize: 14, color: colors.textPrimary }}
          numberOfLines={1}
        >
          {entry.name}
        </Text>
        {entry.description ? (
          <Text
            style={{ ...typography.body, fontSize: 12, color: colors.textSecondary }}
            numberOfLines={1}
          >
            {entry.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 2 }}>
          <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted }}>
            {entry.total_trades} trades
          </Text>
          {entry.win_rate !== null && (
            <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted }}>
              · {entry.win_rate}% win
            </Text>
          )}
        </View>
      </View>

      {/* P&L */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {isProfit ? (
            <TrendingUp size={13} color={colors.profit} />
          ) : (
            <TrendingDown size={13} color={colors.loss} />
          )}
          <Text
            style={{
              ...typography.monoBold,
              fontSize: 14,
              color: isProfit ? colors.profit : colors.loss,
            }}
          >
            {isProfit ? '+' : ''}${Math.abs(entry.total_profit).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}
