import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Sparkles, Plus, Trophy } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { RobotCard } from '@/components/robots/RobotCard';
import { RobotPromptBuilder } from '@/components/robots/RobotPromptBuilder';
import { RobotLeaderboard } from '@/components/robots/RobotLeaderboard';
import { useAccountStore } from '@/stores/account';
import { useRobotsStore } from '@/stores/robots';

type Tab = 'my_robots' | 'leaderboard';

export default function Robots() {
  const { account } = useAccountStore();
  const { robots, loading, fetch: fetchRobots } = useRobotsStore();
  const [activeTab, setActiveTab] = useState<Tab>('my_robots');

  useEffect(() => {
    if (account?.id) {
      fetchRobots(account.id);
    }
  }, [account?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />

      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Sparkles color={colors.primary} size={22} />
          <Text style={{ ...typography.heading, fontSize: 22, color: colors.textPrimary }}>AI Robots</Text>
        </View>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>
          Describe what you want in plain English. Vanta's AI builds the strategy.
        </Text>
      </View>

      {/* Tab switcher */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: spacing.md,
          marginTop: spacing.md,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.sm,
          padding: 3,
        }}
      >
        <TabPill
          label="My Robots"
          active={activeTab === 'my_robots'}
          onPress={() => setActiveTab('my_robots')}
        />
        <TabPill
          label="Leaderboard"
          icon={<Trophy size={13} color={activeTab === 'leaderboard' ? '#fff' : colors.textSecondary} />}
          active={activeTab === 'leaderboard'}
          onPress={() => setActiveTab('leaderboard')}
        />
      </View>

      {/* Content */}
      {activeTab === 'my_robots' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          <RobotPromptBuilder />

          <Text
            style={{
              ...typography.bodyBold,
              color: colors.textSecondary,
              fontSize: 12,
              letterSpacing: 1,
              marginTop: spacing.lg,
            }}
          >
            YOUR ROBOTS
          </Text>

          {loading && robots.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : robots.length === 0 ? (
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
              <Text style={{ ...typography.bodyBold, color: colors.textMuted, fontSize: 14 }}>
                No robots yet
              </Text>
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                Build your first robot above -- describe a strategy and save it.
              </Text>
            </View>
          ) : (
            robots.map((r) => <RobotCard key={r.id} robot={r} />)
          )}

          <Pressable
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: 'dashed',
              padding: spacing.lg,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            <Plus color={colors.textSecondary} size={18} />
            <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 14 }}>
              Browse robot templates
            </Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: spacing.md }}>
          <RobotLeaderboard />
        </View>
      )}
    </View>
  );
}

function TabPill({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: radius.xs,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      {icon}
      <Text
        style={{
          ...typography.bodyBold,
          fontSize: 13,
          color: active ? '#fff' : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
