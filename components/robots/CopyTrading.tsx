import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, ScrollView,
  RefreshControl, Modal, TextInput, Switch, Alert,
} from 'react-native';
import { Users, TrendingUp, TrendingDown, UserPlus, UserMinus, Share2 } from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAccountStore } from '@/stores/account';

interface CopyLeader {
  leaderId: string;
  displayName: string;
  pnl30d: number;
  winRate: number;
  tradeCount: number;
  isFollowing: boolean;
  allocationPct: number | null;
}

type Period = '7d' | '30d' | 'all';

const PERIOD_LABELS: Record<Period, string> = { '7d': '7d', '30d': '30d', all: 'All' };
const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;

export function CopyTrading() {
  const { account } = useAccountStore();

  const [period, setPeriod]         = useState<Period>('30d');
  const [leaders, setLeaders]       = useState<CopyLeader[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [isLeader, setIsLeader]     = useState(false);
  const [toggling, setToggling]     = useState(false);

  const [followTarget, setFollowTarget] = useState<CopyLeader | null>(null);
  const [allocation, setAllocation]     = useState('10');
  const [submitting, setSubmitting]     = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.request<{ copyLeaderEnabled: boolean }>('/api/traders/me');
      setIsLeader(res.copyLeaderEnabled);
    } catch {}
  }, []);

  const loadLeaderboard = useCallback(async (p: Period, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.request<{ leaderboard: CopyLeader[] }>(
        `/api/traders/leaderboard?period=${p}`,
      );
      setLeaders(res.leaderboard);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { loadLeaderboard(period); }, [period, loadLeaderboard]);

  const toggleLeader = async (val: boolean) => {
    setToggling(true);
    try {
      await api.request('/api/traders/opt-in', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: val }),
      });
      setIsLeader(val);
    } catch {
      Alert.alert('Error', 'Could not update leader status.');
    } finally {
      setToggling(false);
    }
  };

  const submitFollow = async () => {
    if (!followTarget || !account?.id) return;
    const pct = parseFloat(allocation);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      Alert.alert('Invalid', 'Enter a number between 1 and 100.');
      return;
    }
    setSubmitting(true);
    try {
      await api.request('/api/traders/follow', {
        method: 'POST',
        body: JSON.stringify({
          leaderId: followTarget.leaderId,
          accountId: account.id,
          allocationPct: pct,
        }),
      });
      setFollowTarget(null);
      loadLeaderboard(period, true);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not follow trader.');
    } finally {
      setSubmitting(false);
    }
  };

  const unfollowLeader = async (leader: CopyLeader) => {
    try {
      await api.request(`/api/traders/follow/${encodeURIComponent(leader.leaderId)}`, {
        method: 'DELETE',
      });
      loadLeaderboard(period, true);
    } catch {
      Alert.alert('Error', 'Could not unfollow. Try again.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Share my trades toggle */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: colors.bgSurface, borderRadius: radius.md,
          paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Share2 color={colors.primary} size={16} />
          <View>
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
              Share my trades
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
              Let others copy your positions
            </Text>
          </View>
        </View>
        <Switch
          value={isLeader}
          onValueChange={toggleLeader}
          disabled={toggling}
          trackColor={{ false: colors.bgDeep, true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {/* Period pills */}
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center',
              backgroundColor: period === p ? colors.primary : colors.bgSurface,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: period === p ? '600' : '400',
              color: period === p ? '#fff' : colors.textSecondary,
            }}>
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Leaderboard */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={{ ...typography.body, color: colors.loss, textAlign: 'center', marginTop: spacing.lg }}>
          {error}
        </Text>
      ) : leaders.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm, paddingHorizontal: spacing.xl }}>
          <Users color={colors.textSecondary} size={36} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', fontSize: 14 }}>
            No traders have opted in yet.{'\n'}Toggle "Share my trades" above to be first.
          </Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLeaderboard(period, true)}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {leaders.map((leader, i) => (
            <View
              key={leader.leaderId}
              style={{
                backgroundColor: colors.bgSurface, borderRadius: radius.md,
                padding: spacing.md, marginBottom: spacing.sm,
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              }}
            >
              {/* Rank badge */}
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: i < 3 ? `${MEDAL[i]}22` : colors.bgDeep,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700',
                  color: i < 3 ? MEDAL[i] : colors.textSecondary }}>
                  {i + 1}
                </Text>
              </View>

              {/* Stats */}
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
                  {leader.displayName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    {leader.pnl30d >= 0
                      ? <TrendingUp color={colors.profit} size={11} />
                      : <TrendingDown color={colors.loss} size={11} />}
                    <Text style={{ fontSize: 12, fontWeight: '600',
                      color: leader.pnl30d >= 0 ? colors.profit : colors.loss }}>
                      {leader.pnl30d >= 0 ? '+' : '-'}${Math.abs(leader.pnl30d).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {leader.winRate}% WR · {leader.tradeCount}t
                  </Text>
                </View>
                {leader.isFollowing && leader.allocationPct !== null && (
                  <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }}>
                    Copying at {leader.allocationPct}%
                  </Text>
                )}
              </View>

              {/* Button */}
              {leader.isFollowing ? (
                <Pressable
                  onPress={() => unfollowLeader(leader)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: spacing.sm, paddingVertical: 5,
                    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.loss,
                  }}
                >
                  <UserMinus color={colors.loss} size={13} />
                  <Text style={{ fontSize: 12, color: colors.loss, fontWeight: '600' }}>Unfollow</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => { setFollowTarget(leader); setAllocation('10'); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: spacing.sm, paddingVertical: 5,
                    borderRadius: radius.sm, backgroundColor: colors.primary,
                  }}
                >
                  <UserPlus color="#fff" size={13} />
                  <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>Copy</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Follow modal */}
      <Modal
        visible={followTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFollowTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: spacing.xl }}>
          <View style={{
            backgroundColor: colors.bgSurface, borderRadius: radius.lg,
            padding: spacing.lg, gap: spacing.md,
          }}>
            <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18 }}>
              Copy {followTarget?.displayName}
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
              What % of this trader's lot size should be mirrored on your account? (1–100)
            </Text>
            <TextInput
              value={allocation}
              onChangeText={setAllocation}
              keyboardType="numeric"
              maxLength={5}
              style={{
                backgroundColor: colors.bgDeep, color: colors.textPrimary,
                borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                fontSize: 16,
              }}
              placeholder="10"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setFollowTarget(null)}
                style={{
                  flex: 1, padding: spacing.sm, borderRadius: radius.sm,
                  backgroundColor: colors.bgDeep, alignItems: 'center',
                }}
              >
                <Text style={{ ...typography.body, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitFollow}
                disabled={submitting}
                style={{
                  flex: 1, padding: spacing.sm, borderRadius: radius.sm,
                  backgroundColor: colors.primary, alignItems: 'center',
                }}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ ...typography.bodyBold, color: '#fff' }}>Start copying</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
