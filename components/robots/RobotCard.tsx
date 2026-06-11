import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Bot, Pause, Play } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api } from '@/lib/api';
import { useRobotsStore } from '@/stores/robots';

interface Robot {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'stopped' | 'error';
  totalTrades: number;
  winningTrades: number;
  totalProfit: number;
}

export function RobotCard({ robot }: { robot: Robot }) {
  const router = useRouter();
  const updateRobot = useRobotsStore((s) => s.update);
  const [toggling, setToggling] = useState(false);
  const winRate = robot.totalTrades > 0 ? Math.round((robot.winningTrades / robot.totalTrades) * 100) : 0;
  const positive = robot.totalProfit >= 0;
  const isActive = robot.status === 'active';

  // Play activates (from draft/paused/stopped), Pause deactivates. The engine
  // only processes status='active' robots, so this is the on/off switch.
  const toggleStatus = async () => {
    if (toggling) return;
    const next = isActive ? 'paused' : 'active';
    setToggling(true);
    try {
      const res = await api.updateRobotStatus(robot.id, next);
      updateRobot(robot.id, { status: res.robot?.status ?? next });
    } catch {
      // server rejected (e.g. session expired) — leave status unchanged
    } finally {
      setToggling(false);
    }
  };

  return (
    <Pressable
      onPress={() => router.push(`/robot/${robot.id}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: isActive ? colors.primary : colors.bgSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bot color={isActive ? '#fff' : colors.textSecondary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 15 }}>{robot.name}</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {robot.description}
          </Text>
        </View>
        <Pressable
          onPress={toggleStatus}
          disabled={toggling}
          accessibilityLabel={isActive ? 'Pause robot' : 'Activate robot'}
          // @ts-expect-error web-only title tooltip
          title={isActive ? 'Pause robot' : 'Activate robot'}
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: isActive ? colors.warning + '22' : colors.profit + '22',
            borderWidth: 1,
            borderColor: isActive ? colors.warning + '66' : colors.profit + '66',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {toggling ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : isActive ? (
            <Pause color={colors.warning} size={16} />
          ) : (
            <Play color={colors.profit} size={16} />
          )}
        </Pressable>
      </View>

      {robot.totalTrades > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: spacing.lg,
          }}
        >
          <Stat label="Trades" value={robot.totalTrades.toString()} />
          <Stat label="Win Rate" value={`${winRate}%`} />
          <Stat
            label="P&L"
            value={`${positive ? '+' : ''}$${robot.totalProfit.toFixed(2)}`}
            color={positive ? colors.profit : colors.loss}
          />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <StatusBadge status={robot.status} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.md, alignItems: 'flex-end' }}>
          <StatusBadge status={robot.status} />
        </View>
      )}
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ ...typography.monoBold, color: color ?? colors.textPrimary, fontSize: 14, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status: Robot['status'] }) {
  const map: Record<Robot['status'], { bg: string; fg: string; label: string }> = {
    draft: { bg: colors.bgSurface, fg: colors.textMuted, label: 'DRAFT' },
    active: { bg: colors.profit + '22', fg: colors.profit, label: 'ACTIVE' },
    paused: { bg: colors.warning + '22', fg: colors.warning, label: 'PAUSED' },
    stopped: { bg: colors.bgSurface, fg: colors.textSecondary, label: 'STOPPED' },
    error: { bg: colors.loss + '22', fg: colors.loss, label: 'ERROR' },
  };
  const s = map[status];
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: s.bg,
      }}
    >
      <Text style={{ ...typography.bodyBold, color: s.fg, fontSize: 10, letterSpacing: 1 }}>{s.label}</Text>
    </View>
  );
}
