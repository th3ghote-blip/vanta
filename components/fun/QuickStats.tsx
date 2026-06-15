/**
 * QuickStats — at-a-glance Quick-mode dashboard (18.16).
 *
 * Shows the player how they're doing: balance, today's Quick P&L, win/loss
 * record + win-rate, current streak, and a scrollable list of recent settled
 * rounds (which otherwise vanish after the result modal closes).
 *
 * Data comes straight from `binary_rounds` for the account — no new backend.
 * Re-fetches whenever `refreshSignal` changes (pass the just-settled round id).
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

interface Round {
  id: string;
  symbol: string;
  direction: 'buy' | 'sell';
  stake: number;
  payout: number | null;
  outcome: 'pending' | 'win' | 'loss' | 'tie';
  closes_at: string;
}

/** Net P&L for one settled round (stake was deducted on open). */
function net(r: Round): number {
  if (r.outcome === 'win') return (r.payout ?? 0) - r.stake;
  if (r.outcome === 'tie') return 0;
  return -r.stake; // loss
}

function money(n: number): string {
  const s = n < 0 ? '-' : n > 0 ? '+' : '';
  return `${s}$${Math.abs(n).toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function QuickStats({
  accountId,
  balance,
  streak,
  refreshSignal,
}: {
  accountId: string;
  balance: number;
  streak: number;
  refreshSignal?: unknown;
}) {
  const router = useRouter();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('binary_rounds')
      .select('id, symbol, direction, stake, payout, outcome, closes_at')
      .eq('account_id', accountId)
      .neq('outcome', 'pending')
      .order('closes_at', { ascending: false })
      .limit(50);
    if (data) setRounds(data as Round[]);
  }, [accountId]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  // Aggregate.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const today = rounds.filter((r) => new Date(r.closes_at).getTime() >= todayStart.getTime());
  const todayPnl = today.reduce((s, r) => s + net(r), 0);
  const wins = rounds.filter((r) => r.outcome === 'win').length;
  const losses = rounds.filter((r) => r.outcome === 'loss').length;
  const ties = rounds.filter((r) => r.outcome === 'tie').length;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null;

  // Inline filtering of the recent-results list (in the trading area).
  const displayed = rounds
    .filter((r) => (outcomeFilter === 'all' ? true : r.outcome === outcomeFilter))
    .sort((a, b) =>
      sortBy === 'amount'
        ? Math.abs(net(b)) - Math.abs(net(a))
        : new Date(b.closes_at).getTime() - new Date(a.closes_at).getTime(),
    )
    .slice(0, 20);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
      {/* Top stat row */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat label="Balance" value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <Stat
          label="Today P&L"
          value={money(todayPnl)}
          color={todayPnl > 0 ? colors.profit : todayPnl < 0 ? colors.loss : colors.textPrimary}
        />
        <Stat
          label="Win rate"
          value={winRate == null ? '—' : `${winRate}%`}
          sub={`${wins}W · ${losses}L${ties ? ` · ${ties}T` : ''}`}
        />
        <Stat
          label="Streak"
          value={streak > 0 ? String(streak) : '0'}
          icon={streak > 0 ? <Flame size={13} color={colors.warning} /> : undefined}
        />
      </View>

      {/* Recent results */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, letterSpacing: 1, flex: 1 }}>
            RECENT RESULTS
          </Text>
          <Pressable onPress={() => router.push('/activity')} hitSlop={8}>
            <Text style={{ ...typography.body, color: colors.primary, fontSize: 12 }}>
              View all →
            </Text>
          </Pressable>
        </View>

        {/* Inline filters */}
        {rounds.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm }}>
            <FilterPill label="All" active={outcomeFilter === 'all'} onPress={() => setOutcomeFilter('all')} />
            <FilterPill label="Wins" active={outcomeFilter === 'win'} onPress={() => setOutcomeFilter('win')} color={colors.profit} />
            <FilterPill label="Losses" active={outcomeFilter === 'loss'} onPress={() => setOutcomeFilter('loss')} color={colors.loss} />
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => setSortBy((s) => (s === 'date' ? 'amount' : 'date'))}
              hitSlop={6}
              style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                Sort: {sortBy === 'date' ? 'Recent' : 'Amount'}
              </Text>
            </Pressable>
          </View>
        )}
        {rounds.length === 0 ? (
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' }}>
            No rounds yet — place an Up or Down bet above.
          </Text>
        ) : (
          displayed.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' }}>
              No {outcomeFilter === 'win' ? 'wins' : 'losses'} yet.
            </Text>
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
            {displayed.map((r, i) => {
              const n = net(r);
              const c = r.outcome === 'win' ? colors.profit : r.outcome === 'tie' ? colors.textSecondary : colors.loss;
              return (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                    gap: spacing.sm,
                  }}
                >
                  <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13, width: 78 }}>
                    {r.symbol}
                  </Text>
                  <Text style={{ ...typography.body, color: r.direction === 'buy' ? colors.profit : colors.loss, fontSize: 11, width: 44 }}>
                    {r.direction === 'buy' ? '▲ Up' : '▼ Down'}
                  </Text>
                  <Text style={{ ...typography.mono, color: colors.textMuted, fontSize: 11, flex: 1 }}>
                    ${r.stake.toFixed(0)} · {timeAgo(r.closes_at)}
                  </Text>
                  <Text style={{ ...typography.bodyBold, color: c, fontSize: 11, width: 44, textTransform: 'uppercase' }}>
                    {r.outcome}
                  </Text>
                  <Text style={{ ...typography.monoBold, color: c, fontSize: 13, width: 64, textAlign: 'right' }}>
                    {money(n)}
                  </Text>
                </View>
              );
            })}
          </View>
          )
        )}
      </View>
    </View>
  );
}

function FilterPill({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const accent = color ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: active ? accent + '22' : 'transparent',
        borderWidth: 1,
        borderColor: active ? accent : colors.border,
      }}
    >
      <Text style={{ ...typography.bodyBold, color: active ? accent : colors.textSecondary, fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bgElevated,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        gap: 2,
      }}
    >
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        {icon}
        <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 14 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {!!sub && <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 9 }}>{sub}</Text>}
    </View>
  );
}
