import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, typography } from '@/lib/theme';

interface Props {
  /** Total duration — used as the denominator for arc progress. */
  seconds: number;
  label: string;
  size?: number;
  /**
   * If provided, the ring counts down to this real ISO timestamp in real-time
   * instead of looping its internal countdown. `seconds` is still needed as
   * the arc denominator (i.e. what "full" looks like).
   */
  closesAt?: string;
}

function computeRemaining(closesAt: string): number {
  return Math.max(0, Math.round((new Date(closesAt).getTime() - Date.now()) / 1000));
}

/**
 * Animated countdown ring.
 * - Without `closesAt`: loops the given `seconds` countdown (preview/demo mode).
 * - With    `closesAt`: counts down to the real close time, stops at 0.
 */
export function CountdownRing({ seconds, label, size = 100, closesAt }: Props) {
  const [remaining, setRemaining] = useState<number>(() =>
    closesAt ? computeRemaining(closesAt) : seconds,
  );

  useEffect(() => {
    if (closesAt) {
      setRemaining(computeRemaining(closesAt));
      const id = setInterval(() => {
        setRemaining(computeRemaining(closesAt));
      }, 1000);
      return () => clearInterval(id);
    }

    // Loop mode (no real close time).
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? seconds : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, closesAt]);

  const ringRadius = (size - 8) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const progress = seconds > 0 ? remaining / seconds : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={ringRadius} stroke={colors.border} strokeWidth={4} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={ringRadius}
          stroke={colors.primary}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: size >= 80 ? 18 : 13 }}>
        {display}
      </Text>
      {label ? (
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{label}</Text>
      ) : null}
    </View>
  );
}
