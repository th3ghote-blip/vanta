import { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, typography } from '@/lib/theme';

// ─── Core shimmer box ────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.sm,
  style,
}: SkeletonProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
    return () => anim.stopAnimation();
  }, []);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 320],
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.bgElevated,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ─── Portfolio tab skeleton ──────────────────────────────────────────────────

export function PortfolioSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Account header strip */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
        }}
      >
        <Skeleton width={120} height={14} borderRadius={radius.sm} />
        <Skeleton width={60} height={14} borderRadius={radius.sm} />
      </View>

      {/* Balance card */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.lg,
          padding: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <Skeleton width={80} height={12} />
        <Skeleton width={180} height={36} borderRadius={radius.md} />
        <Skeleton width={120} height={12} />

        {/* Equity / Change row */}
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width={60} height={11} />
            <Skeleton width={100} height={18} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width={60} height={11} />
            <Skeleton width={80} height={18} />
          </View>
        </View>
      </View>

      {/* Action buttons row */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: spacing.lg,
          marginTop: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Skeleton width={undefined} height={44} borderRadius={radius.md} style={{ flex: 1 }} />
        <Skeleton width={undefined} height={44} borderRadius={radius.md} style={{ flex: 1 }} />
      </View>

      {/* Section header */}
      <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>
        <Skeleton width={140} height={14} />
      </View>

      {/* Activity rows */}
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: spacing.lg,
            marginBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width={140} height={13} />
            <Skeleton width={80} height={11} />
          </View>
          <Skeleton width={70} height={14} />
        </View>
      ))}
    </View>
  );
}

// ─── TradeBook skeleton ──────────────────────────────────────────────────────

export function TradeBookSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      {/* Tab bar */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Skeleton width={undefined} height={34} borderRadius={radius.md} style={{ flex: 1 }} />
        <Skeleton width={undefined} height={34} borderRadius={radius.md} style={{ flex: 1 }} />
        <Skeleton width={undefined} height={34} borderRadius={radius.md} style={{ flex: 1 }} />
      </View>

      {/* Stats row */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.bgElevated,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.md,
        }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width={50} height={11} />
            <Skeleton width={70} height={16} />
          </View>
        ))}
      </View>

      {/* Trade rows */}
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ gap: spacing.xs }}>
              <Skeleton width={80} height={14} />
              <Skeleton width={50} height={11} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
              <Skeleton width={60} height={14} />
              <Skeleton width={40} height={11} />
            </View>
          </View>
          <Skeleton width="60%" height={11} />
        </View>
      ))}
    </View>
  );
}

// ─── Robots tab skeleton ─────────────────────────────────────────────────────

export function RobotsSkeleton() {
  return (
    <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          {/* Header row: icon + name + status badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Skeleton width={40} height={40} borderRadius={radius.md} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Skeleton width={130} height={14} />
              <Skeleton width={90} height={11} />
            </View>
            <Skeleton width={56} height={22} borderRadius={radius.sm} />
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            {[0, 1, 2].map((j) => (
              <View key={j} style={{ gap: spacing.xs }}>
                <Skeleton width={44} height={11} />
                <Skeleton width={56} height={14} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
