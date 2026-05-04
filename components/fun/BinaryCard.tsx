import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { CountdownRing } from './CountdownRing';

interface Props {
  asset: { symbol: string; name: string; price: number; change: number };
  duration: { label: string; seconds: number; multiplier: number };
}

export function BinaryCard({ asset, duration }: Props) {
  const positive = asset.change >= 0;

  return (
    <LinearGradient
      colors={[colors.bgElevated, colors.bgSurface]}
      style={{
        borderRadius: radius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>{asset.name}</Text>
          <Text style={{ ...typography.display, color: colors.textPrimary, fontSize: 28, marginTop: 4 }}>
            {asset.symbol}
          </Text>
          <Text
            style={{
              ...typography.monoBold,
              color: positive ? colors.profit : colors.loss,
              fontSize: 24,
              marginTop: spacing.sm,
            }}
          >
            {asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </Text>
          <Text
            style={{
              ...typography.mono,
              color: positive ? colors.profit : colors.loss,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            {positive ? '+' : ''}
            {asset.change.toFixed(2)}% today
          </Text>
        </View>

        <CountdownRing seconds={duration.seconds} label={duration.label} />
      </View>
    </LinearGradient>
  );
}
