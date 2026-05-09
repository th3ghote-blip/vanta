import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Sparkles, Plus } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { RobotCard } from '@/components/robots/RobotCard';
import { RobotPromptBuilder } from '@/components/robots/RobotPromptBuilder';
import { useAccountStore } from '@/stores/account';
import { useRobotsStore } from '@/stores/robots';

export default function Robots() {
  const { account } = useAccountStore();
  const { robots, loading, fetch: fetchRobots } = useRobotsStore();

  useEffect(() => {
    if (account?.id) {
      fetchRobots(account.id);
    }
  }, [account?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Sparkles color={colors.primary} size={22} />
          <Text style={{ ...typography.heading, fontSize: 22, color: colors.textPrimary }}>AI Robots</Text>
        </View>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>
          Describe what you want in plain English. Vanta's AI builds the strategy.
        </Text>

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
              Build your first robot above — describe a strategy and save it.
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
    </View>
  );
}
