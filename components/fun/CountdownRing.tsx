import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, typography } from '@/lib/theme';

interface Props {
  seconds: number;
  label: string;
  size?: number;
}

/**
 * Animated countdown ring. Loops the duration to create a "next round opens in..."
 * vibe before a real round is opened. Replace with real timer logic when wired
 * to backend rounds.
 */
export function CountdownRing({ seconds, label, size = 100 }: Props) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const id = setInterval(() => {
      setRemaining((r) => (r <= 1 ? seconds : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / seconds;
  const strokeDashoffset = circumference * (1 - progress);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={4} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ ...typography.monoBold, color: colors.textPrimary, fontSize: 18 }}>{display}</Text>
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
