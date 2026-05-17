/**
 * EmptyState — shared component for blank-list / zero-data screens.
 * Renders a centered icon, title, optional subtitle, and optional CTA button.
 */
import { View, Text, Pressable } from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void };
  padded?: boolean;
}

export function EmptyState({ icon, title, subtitle, cta, padded = true }: EmptyStateProps) {
  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: padded ? spacing.xxl : spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      {icon}
      <Text
        style={{
          ...typography.bodyBold,
          color: colors.textSecondary,
          fontSize: 15,
          textAlign: 'center',
          marginTop: spacing.xs,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            ...typography.body,
            color: colors.textMuted,
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 19,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          style={({ pressed }) => ({
            marginTop: spacing.xs,
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
          })}
        >
          <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 14 }}>
            {cta.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
