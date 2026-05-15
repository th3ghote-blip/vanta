import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { colors, radius, typography } from '@/lib/theme';

export interface WinFlashRef {
  flash: (amount: number) => void;
}

/**
 * Full-screen overlay that briefly shows a green "+$X.XX" celebration when
 * a trade closes in profit. Render once at the root of the trade screen so
 * it is not clipped by any inner ScrollView.
 *
 * Usage:
 *   const ref = useRef<WinFlashRef>(null);
 *   <WinFlash ref={ref} />
 *   ref.current?.flash(48.20);
 */
export const WinFlash = forwardRef<WinFlashRef>((_props, ref) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  const [amount, setAmount] = useState(0);

  useImperativeHandle(ref, () => ({
    flash(amt: number) {
      setAmount(amt);
      opacity.setValue(0);
      scale.setValue(0.7);
      Animated.sequence([
        // pop in
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 10 }),
        ]),
        Animated.delay(750),
        // fade out
        Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start();
    },
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        opacity,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          backgroundColor: colors.profit + 'DD',
          paddingHorizontal: 36,
          paddingVertical: 20,
          borderRadius: radius.xl ?? 20,
          alignItems: 'center',
          shadowColor: colors.profit,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <Text style={{ ...typography.heading, fontSize: 36, color: '#fff', letterSpacing: 1 }}>
          {'+$' + amount.toFixed(2)}
        </Text>
        <Text style={{ ...typography.body, fontSize: 13, color: '#ffffffaa', marginTop: 4 }}>
          {'WIN'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

WinFlash.displayName = 'WinFlash';
