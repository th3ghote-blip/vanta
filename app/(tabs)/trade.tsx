import { useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useModeStore } from '@/stores/mode';
import { useAuthStore } from '@/stores/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { ModeSwitcher } from '@/components/shared/ModeSwitcher';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { ProTradeScreen } from '@/components/pro/ProTradeScreen';
import { QuickTradeScreen } from '@/components/fun/QuickTradeScreen';
import { Confetti, type ConfettiRef } from '@/components/shared/Confetti';

export default function Trade() {
  const mode = useModeStore((s) => s.mode);
  const loginStreak = useAuthStore((s) => s.loginStreak);
  const confettiRef = useRef<ConfettiRef>(null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />
      {loginStreak >= 2 && (
        <View style={{
          marginHorizontal: spacing.md,
          marginTop: spacing.sm,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.warning,
          paddingVertical: 6,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <Text style={{ fontSize: 16 }}>{'🔥'}</Text>
          <Text style={{ ...typography.body, color: colors.warning, fontSize: 13 }}>
            {loginStreak}-day streak{' '}
            <Text style={{ color: colors.textSecondary }}>
              — log in tomorrow to keep it going!
            </Text>
          </Text>
        </View>
      )}
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <ModeSwitcher />
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md }}>
        {mode === 'pro'
          ? <ProTradeScreen onFirstTrade={() => confettiRef.current?.fire()} />
          : <QuickTradeScreen />}
      </ScrollView>
      <Confetti ref={confettiRef} />
    </View>
  );
}
