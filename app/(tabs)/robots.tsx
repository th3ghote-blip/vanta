import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Sparkles, Plus, Trophy, Users } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { RobotsSkeleton } from '@/components/shared/SkeletonShimmer';
import { RobotCard } from '@/components/robots/RobotCard';
import { RobotPromptBuilder } from '@/components/robots/RobotPromptBuilder';
import { RobotLeaderboard } from '@/components/robots/RobotLeaderboard';
import { RobotTemplates } from '@/components/robots/RobotTemplates';
import { CopyTrading } from '@/components/robots/CopyTrading';
import { useAccountStore } from '@/stores/account';
import { useRobotsStore } from '@/stores/robots';

type Tab = 'my_robots' | 'leaderboard' | 'copy';

export default function Robots() {
  const { account } = useAccountStore();
  const { robots, loading, fetch: fetchRobots } = useRobotsStore();
  const [activeTab, setActiveTab] = useState<Tab>('my_robots');
  const [showTemplates, setShowTemplates] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (account?.id) {
      fetchRobots(account.id);
    }
  }, [account?.id]);

  const handleTemplateSelect = (prompt: string) => {
    setSuggestedPrompt(prompt);
    setActiveTab('my_robots');
    // Scroll back to top so the prompt builder is visible.
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />

      <RobotTemplates
        visible={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplateSelect}
      />

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
        <TabPill
          label="Copy"
          icon={<Users size={13} color={activeTab === 'copy' ? '#fff' : colors.textSecondary} />}
          active={activeTab === 'copy'}
          onPress={() => setActiveTab('copy')}
        />
      </View>

      {/* Content */}
      {activeTab === 'my_robots' ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        >
          <RobotPromptBuilder suggestedPrompt={suggestedPrompt} />

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
            <RobotsSkeleton />
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
            onPress={() => setShowTemplates(true)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.bgSurface : colors.bgElevated,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.primary + '55',
              borderStyle: 'dashed',
              padding: spacing.lg,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: spacing.sm,
            })}
          >
            <Plus color={colors.primary} size={18} />
            <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 14 }}>
              Browse robot templates
            </Text>
          </Pressable>
        </ScrollView>
      ) : activeTab === 'leaderboard' ? (
        <View style={{ flex: 1, padding: spacing.md }}>
          <RobotLeaderboard />
        </View>
      ) : (
        <View style={{ flex: 1, padding: spacing.md }}>
          <CopyTrading />
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
