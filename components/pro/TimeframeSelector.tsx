import { Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSurface,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 2,
        alignSelf: 'flex-start',
      }}
    >
      {TIMEFRAMES.map((tf) => {
        const active = tf === value;
        return (
          <Pressable
            key={tf}
            onPress={() => onChange(tf)}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              backgroundColor: active ? colors.bgElevated : 'transparent',
              borderRadius: radius.xs,
              minWidth: 36,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                ...typography.bodyBold,
                color: active ? colors.primary : colors.textSecondary,
                fontSize: 11,
                letterSpacing: 0.5,
              }}
            >
              {tf}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
