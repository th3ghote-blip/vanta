/**
 * Robot detail screen — Phase 3.2
 *
 * Dynamic route: /robot/[id]
 * Sections: header controls, prompt, compiled config, recent runs, stats.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bot,
  Play,
  Pause,
  Trash2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, ApiError } from '@/lib/api';
import { useRobotsStore, Robot } from '@/stores/robots';

// ─── helpers ────────────────────────────────────────────────────────────────

function rowToRobot(row: any): Robot {
  return {
    id: row.id,
    name: row.name ?? 'Unnamed Robot',
    description: row.description ?? '',
    status: row.status ?? 'draft',
    totalTrades: row.total_trades ?? 0,
    winningTrades: row.winning_trades ?? 0,
    totalProfit: row.total_profit ?? 0,
    prompt: row.prompt,
    config: row.config,
  };
}

const STATUS_META: Record<Robot['status'], { bg: string; fg: string; label: string }> = {
  draft:   { bg: colors.bgSurface,      fg: colors.textMuted,      label: 'DRAFT' },
  active:  { bg: colors.profit + '22',  fg: colors.profit,         label: 'ACTIVE' },
  paused:  { bg: colors.warning + '22', fg: colors.warning,        label: 'PAUSED' },
  stopped: { bg: colors.bgSurface,      fg: colors.textSecondary,  label: 'STOPPED' },
  error:   { bg: colors.loss + '22',    fg: colors.loss,           label: 'ERROR' },
};

const ACTION_LABELS: Record<string, string> = {
  open_trade:  'Opened trade',
  close_trade: 'Closed trade',
  tip:         'Sent tip',
  noop:        'No action',
};

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        ...typography.bodyBold,
        color: colors.textSecondary,
        fontSize: 11,
        letterSpacing: 1,
        marginBottom: spacing.sm,
      }}
    >
      {title.toUpperCase()}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ ...typography.mono, color: color ?? colors.textPrimary, fontSize: 18, fontWeight: '600' }}>
        {value}
      </Text>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function RunRow({ run }: { run: any }) {
  const label = ACTION_LABELS[run.action] ?? run.action;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: run.action === 'open_trade' ? colors.profit : run.action === 'tip' ? colors.primary : colors.textMuted,
        }}
      />
      <Text style={{ ...typography.body, color: colors.textPrimary, fontSize: 13, flex: 1 }}>
        {label}
      </Text>
      {run.notes ? (
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
          {run.notes}
        </Text>
      ) : null}
      <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 11 }}>
        {formatTs(run.triggered_at)}
      </Text>
    </View>
  );
}

// ─── main screen ────────────────────────────────────────────────────────────

export default function RobotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const storeUpdate = useRobotsStore((s) => s.update);
  const storeRemove = useRobotsStore((s) => s.remove);
  const storeRobots = useRobotsStore((s) => s.robots);

  const [robot, setRobot] = useState<Robot | null>(
    storeRobots.find((r) => r.id === id) ?? null,
  );
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(!robot);
  const [runsLoading, setRunsLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch robot detail from server
  const loadRobot = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { robot: row } = await api.getRobot(id);
      const r = rowToRobot(row);
      setRobot(r);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'Failed to load robot');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch recent runs
  const loadRuns = useCallback(async () => {
    if (!id) return;
    try {
      setRunsLoading(true);
      const { runs: rows } = await api.getRobotRuns(id);
      setRuns(rows);
    } catch {
      // runs are non-critical — fail silently
    } finally {
      setRunsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!robot) loadRobot();
    loadRuns();
  }, [id]);

  // Pause / resume toggle
  const handleToggleStatus = async () => {
    if (!robot || actionBusy) return;
    const nextStatus = robot.status === 'active' ? 'paused' : 'active';
    try {
      setActionBusy(true);
      const { robot: row } = await api.updateRobotStatus(id, nextStatus);
      const updated = rowToRobot(row);
      setRobot(updated);
      storeUpdate(id, { status: updated.status });
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.code : 'Could not update status');
    } finally {
      setActionBusy(false);
    }
  };

  // Delete with confirmation
  const handleDelete = () => {
    Alert.alert(
      'Delete Robot',
      `Delete "${robot?.name ?? 'this robot'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionBusy(true);
              await api.deleteRobot(id);
              storeRemove(id);
              router.back();
            } catch (err) {
              setActionBusy(false);
              Alert.alert('Error', err instanceof ApiError ? err.code : 'Could not delete robot');
            }
          },
        },
      ],
    );
  };

  // ── render loading / error ──
  if (loading && !robot) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error && !robot) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Text style={{ ...typography.body, color: colors.loss, textAlign: 'center', marginBottom: spacing.md }}>
          {error}
        </Text>
        <Pressable onPress={loadRobot} style={{ padding: spacing.sm }}>
          <Text style={{ ...typography.bodyBold, color: colors.primary }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const sm = robot ? STATUS_META[robot.status] : STATUS_META.draft;
  const winRate = robot && robot.totalTrades > 0
    ? Math.round((robot.winningTrades / robot.totalTrades) * 100)
    : 0;
  const positive = (robot?.totalProfit ?? 0) >= 0;
  const canToggle = robot && ['active', 'paused', 'draft'].includes(robot.status);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* ── header bar ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: spacing.sm,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <ChevronLeft color={colors.textSecondary} size={22} />
        </Pressable>

        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            backgroundColor: robot?.status === 'active' ? colors.primary : colors.bgSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot color={robot?.status === 'active' ? '#fff' : colors.textSecondary} size={18} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 16 }} numberOfLines={1}>
            {robot?.name ?? 'Robot'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: sm.bg }}>
              <Text style={{ ...typography.bodyBold, color: sm.fg, fontSize: 9, letterSpacing: 1 }}>
                {sm.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        {canToggle && (
          <Pressable
            onPress={handleToggleStatus}
            disabled={actionBusy}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.sm,
              backgroundColor: colors.bgSurface,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: actionBusy ? 0.5 : 1,
            }}
          >
            {actionBusy
              ? <ActivityIndicator color={colors.textSecondary} size="small" />
              : robot?.status === 'active'
                ? <Pause color={colors.warning} size={16} />
                : <Play color={colors.profit} size={16} />}
          </Pressable>
        )}

        <Pressable
          onPress={handleDelete}
          disabled={actionBusy}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: colors.bgSurface,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: actionBusy ? 0.5 : 1,
          }}
        >
          <Trash2 color={colors.loss} size={16} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>

        {/* ── stats ── */}
        <SectionHeader title="Stats" />
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <StatPill label="Trades" value={String(robot?.totalTrades ?? 0)} />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <StatPill
              label="Win Rate"
              value={robot && robot.totalTrades > 0 ? `${winRate}%` : '—'}
              color={robot && robot.totalTrades > 0 ? (winRate >= 50 ? colors.profit : colors.loss) : undefined}
            />
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <StatPill
              label="Total P&L"
              value={robot ? `${positive ? '+' : ''}$${robot.totalProfit.toFixed(2)}` : '—'}
              color={positive ? colors.profit : colors.loss}
            />
          </View>
        </Card>

        {/* ── prompt ── */}
        <SectionHeader title="Strategy Prompt" />
        <Card>
          <Text
            style={{
              ...typography.body,
              color: colors.textPrimary,
              fontSize: 14,
              lineHeight: 22,
            }}
          >
            {robot?.prompt ?? '—'}
          </Text>
        </Card>

        {/* ── compiled config ── */}
        <SectionHeader title="Compiled Config" />
        <Card>
          <Pressable
            onPress={() => setConfigExpanded((x) => !x)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 13 }}>
              {configExpanded ? 'Hide JSON' : 'Show JSON'}
            </Text>
            {configExpanded
              ? <ChevronUp color={colors.textMuted} size={16} />
              : <ChevronDown color={colors.textMuted} size={16} />}
          </Pressable>

          {/* always show quick summary */}
          {robot?.config ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {robot.config.kind ? (
                <ConfigRow k="Kind" v={robot.config.kind.toUpperCase()} color={robot.config.kind === 'trade' ? colors.profit : colors.primary} />
              ) : null}
              {robot.config.schedule ? (
                <ConfigRow k="Schedule" v={`${robot.config.schedule.type}: ${robot.config.schedule.value}`} />
              ) : null}
              {robot.config.symbols?.length ? (
                <ConfigRow k="Symbols" v={(robot.config.symbols as string[]).join(', ')} />
              ) : null}
              {robot.config.side ? (
                <ConfigRow k="Side" v={robot.config.side.toUpperCase()} />
              ) : null}
            </View>
          ) : null}

          {configExpanded && robot?.config ? (
            <View
              style={{
                marginTop: spacing.sm,
                backgroundColor: colors.bgDeep,
                borderRadius: radius.sm,
                padding: spacing.sm,
              }}
            >
              <Text
                style={{
                  ...typography.mono,
                  color: colors.textSecondary,
                  fontSize: 11,
                  lineHeight: 18,
                }}
                selectable
              >
                {JSON.stringify(robot.config, null, 2)}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* ── recent runs ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <SectionHeader title="Recent Runs" />
          <Pressable onPress={loadRuns} hitSlop={8}>
            <RefreshCw color={colors.textMuted} size={14} />
          </Pressable>
        </View>
        <Card>
          {runsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.md }} />
          ) : runs.length === 0 ? (
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: spacing.sm }}>
              No runs yet — activate this robot to start.
            </Text>
          ) : (
            runs.map((r) => <RunRow key={r.id} run={r} />)
          )}
        </Card>

      </ScrollView>
    </View>
  );
}

function ConfigRow({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, width: 72 }}>{k}</Text>
      <Text style={{ ...typography.bodyBold, color: color ?? colors.textPrimary, fontSize: 12, flex: 1 }}>{v}</Text>
    </View>
  );
}
