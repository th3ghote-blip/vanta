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
  Radio,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(2);
}

function fmtAgo(secs: number | null): string {
  if (secs == null || !isFinite(secs) || secs < 0) return '—';
  if (secs < 10) return 'just now';
  if (secs < 60) return secs + 's ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  return hrs + 'h ' + (mins % 60) + 'm ago';
}

// Green if very recent, amber as it ages toward the edge of the window.
function dotColor(secs: number | null): string {
  if (secs == null) return colors.textMuted;
  if (secs < 60) return colors.profit;
  if (secs < 180) return colors.warning ?? colors.primary;
  return colors.textSecondary;
}

// ── types ─────────────────────────────────────────────────────────────────────

type OnlineData = Awaited<ReturnType<typeof api.adminGetOnline>>;
type OnlineRow = OnlineData['online'][0];

const WINDOWS = [1, 5, 15, 60] as const;

// ── sub-components ────────────────────────────────────────────────────────────

function Row({ r }: { r: OnlineRow }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    }}>
      <View style={{
        width: 9, height: 9, borderRadius: 5,
        backgroundColor: dotColor(r.seconds_ago),
      }} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
          {r.login != null ? '#' + r.login : 'acct ' + r.account_id.slice(0, 6)}
          {r.is_admin && (
            <Text style={{ color: colors.primary, fontSize: 11 }}>  · admin</Text>
          )}
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
          {r.display_name ?? '—'}{r.type ? ' · ' + r.type : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 12 }}>
          {fmtAgo(r.seconds_ago)}
        </Text>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
          {fmt$(r.balance)}
        </Text>
      </View>
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function OnlineScreen() {
  const [data, setData] = useState<OnlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowMin, setWindowMin] = useState<number>(5);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const result = await api.adminGetOnline(windowMin);
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load online users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [windowMin]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
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
        <Radio size={18} color={colors.profit} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Online Now
        </Text>
        <Pressable onPress={onRefresh} hitSlop={12}>
          <RefreshCw size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

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
          {/* Window selector */}
          <View style={{
            flexDirection: 'row', gap: spacing.xs,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            padding: 4,
            marginBottom: spacing.md,
          }}>
            {WINDOWS.map((w) => (
              <Pressable
                key={w}
                onPress={() => setWindowMin(w)}
                style={{
                  flex: 1, paddingVertical: spacing.xs,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  backgroundColor: windowMin === w ? colors.bgElevated : 'transparent',
                }}
              >
                <Text style={{
                  ...typography.bodyBold,
                  fontSize: 12,
                  color: windowMin === w ? colors.primary : colors.textSecondary,
                }}>
                  {w < 60 ? w + 'm' : '1h'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Count card */}
          <View style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginBottom: spacing.md,
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          }}>
            <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.profit }} />
            <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 22 }}>
              {data?.count ?? 0}
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
              online in the last {data?.window_minutes ?? windowMin} min
            </Text>
          </View>

          <View style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
          }}>
            {(data?.online.length ?? 0) === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing.lg }}>
                <ShieldCheck size={28} color={colors.textMuted} />
                <Text style={{ ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                  No accounts seen in the last {data?.window_minutes ?? windowMin} minutes.
                </Text>
              </View>
            ) : (
              data!.online.map((r) => <Row key={r.account_id} r={r} />)
            )}
          </View>

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
