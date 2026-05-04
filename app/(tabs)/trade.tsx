import { View, ScrollView } from 'react-native';
import { useModeStore } from '@/stores/mode';
import { colors, spacing } from '@/lib/theme';
import { ModeSwitcher } from '@/components/shared/ModeSwitcher';
import { EnvBanner } from '@/components/shared/EnvBanner';
import { ProTradeScreen } from '@/components/pro/ProTradeScreen';
import { QuickTradeScreen } from '@/components/fun/QuickTradeScreen';

export default function Trade() {
  const mode = useModeStore((s) => s.mode);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />
      <View style={{ padding: spacing.md, paddingBottom: 0 }}>
        <ModeSwitcher />
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: spacing.md }}>
        {mode === 'pro' ? <ProTradeScreen /> : <QuickTradeScreen />}
      </ScrollView>
    </View>
  );
}
