import { View, Text } from 'react-native';
import { ENV } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';

export function EnvBanner() {
  if (ENV === 'live') return null;

  const label = ENV === 'demo' ? 'DEMO — virtual money, no real risk' : 'STAGING — internal testing';
  const bg = ENV === 'demo' ? colors.warning : colors.info;

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ ...typography.bodyBold, color: colors.bgDeep, fontSize: 11, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}
