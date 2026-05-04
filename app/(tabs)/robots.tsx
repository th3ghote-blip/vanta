import { View, Text, ScrollView, Pressable } from 'react-native';
import { Sparkles, Plus } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { RobotCard } from '@/components/robots/RobotCard';
import { RobotPromptBuilder } from '@/components/robots/RobotPromptBuilder';

const DEMO_ROBOTS = [
  {
    id: '1',
    name: 'NYSE Open Buyer',
    description: 'Buys Amazon at NYSE open every weekday',
    status: 'active' as const,
    totalTrades: 23,
    winningTrades: 15,
    totalProfit: 482.5,
  },
  {
    id: '2',
    name: 'Daily Tip Bot',
    description: 'Sends 3 trade ideas every morning at 9am',
    status: 'active' as const,
    totalTrades: 0,
    winningTrades: 0,
    totalProfit: 0,
  },
  {
    id: '3',
    name: 'EUR/USD Reversal',
    description: 'Buys when RSI < 30, sells when RSI > 70',
    status: 'paused' as const,
    totalTrades: 47,
    winningTrades: 28,
    totalProfit: -123.2,
  },
];

export default function Robots() {
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

        {DEMO_ROBOTS.map((r) => (
          <RobotCard key={r.id} robot={r} />
        ))}

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
