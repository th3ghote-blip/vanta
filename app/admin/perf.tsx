import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, RefreshCw, Zap } from 'lucide-react-native';

import { useAuthStore } from '@/stores/auth';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteStats {
  route:  string;
  count:  number;
  p50:    number;
  p95:    number;
  p99:    number;
  min:    number;
  max:    number;
}

interface PerfData {
  window_minutes: number;
  generated_at:   string;
  routes:         RouteStats[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const caption = { ...typography.body, fontSize: 11 } as const;
const h3      = { ...typography.heading, fontSize: 17 } as const;

function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
  return ms + 'ms';
}

function latencyColor(ms: number): string {
  if (ms < 100)  return colors.profit;
  if (ms < 500)  return colors.warning;
  return colors.loss;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeaderCell({ label, flex = 1 }: { label: string; flex?: number }) {
  return (
    <Text
      style={{
        flex,
        ...caption,
        color: colors.textSecondary,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        textAlign: 'right',
      }}
    >
      {label}
    </Text>
  );
}

function Cell({
  value,
  color,
  flex = 1,
}: {
  value: string;
  color?: string;
  flex?: number;
}) {
  return (
    <Text
      style={{
        flex,
        ...typography.mono,
        fontSize: 13,
        color: color ?? colors.textPrimary,
        textAlign: 'right',
      }}
    >
      {value}
    </Text>
  );
}

function RouteRow({ stat }: { stat: RouteStats }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.xs,
      }}
    >
      <Text
        style={{ flex: 3, ...typography.mono, fontSize: 12, color: colors.textPrimary }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {stat.route}
      </Text>
      <Cell value={String(stat.count)} color={colors.textSecondary} />
      <Cell value={fmtMs(stat.p50)} color={latencyColor(stat.p50)} />
      <Cell value={fmtMs(stat.p95)} color={latencyColor(stat.p95)} />
      <Cell value={fmtMs(stat.p99)} color={latencyColor(stat.p99)} />
      <Cell value={fmtMs(stat.max)} color={colors.textSecondary} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PerfScreen() {
  const { session } = useAuthStore();
  const [data, setData]             = useState<PerfData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

  const fetchPerf = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`${API}/api/admin/perf`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json() as PerfData);
      setError(null);
    } catch (e: any) {
      setError((e as Error).message ?? 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, API]);

  useEffect(() => {
    void fetchPerf();
    intervalRef.current = setInterval(() => { void fetchPerf(); }, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPerf]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Zap size={18} color={colors.warning} />
        <Text style={{ ...h3, color: colors.textPrimary, flex: 1 }}>
          Performance
        </Text>
        <Pressable onPress={() => { void fetchPerf(true); }}>
          <RefreshCw size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.loss, textAlign: 'center' }}>
            {error}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { void fetchPerf(true); }}
              tintColor={colors.primary}
            />
          }
        >
          {/* Meta */}
          <Text style={{ ...caption, color: colors.textSecondary, marginBottom: spacing.md }}>
            {`Rolling ${data?.window_minutes ?? 5}-min window · auto-refreshes every 10s`}
            {data?.generated_at
              ? '  ·  ' + new Date(data.generated_at).toLocaleTimeString()
              : ''}
          </Text>

          {!data?.routes?.length ? (
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.md,
                padding: spacing.lg,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                No requests recorded yet in this window.
              </Text>
              <Text style={{ ...caption, color: colors.textMuted, marginTop: spacing.xs }}>
                Data appears once API traffic arrives.
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.md,
                padding: spacing.md,
              }}
            >
              {/* Column headers */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingBottom: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  gap: spacing.xs,
                }}
              >
                <Text
                  style={{
                    flex: 3,
                    ...caption,
                    color: colors.textSecondary,
                    fontSize: 10,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                  }}
                >
                  Route
                </Text>
                <HeaderCell label="Reqs" />
                <HeaderCell label="p50" />
                <HeaderCell label="p95" />
                <HeaderCell label="p99" />
                <HeaderCell label="Max" />
              </View>

              {/* Rows */}
              {data.routes.map((stat) => (
                <RouteRow key={stat.route} stat={stat} />
              ))}
            </View>
          )}

          {/* Legend */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.lg,
              marginTop: spacing.md,
              justifyContent: 'center',
            }}
          >
            {([
              { label: '< 100ms',   color: colors.profit  },
              { label: '100–500ms', color: colors.warning },
              { label: '> 500ms',   color: colors.loss    },
            ] as const).map(({ label, color }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ ...caption, color: colors.textSecondary }}>{label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
