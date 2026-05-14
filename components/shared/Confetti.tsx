import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

export interface ConfettiRef {
  fire: () => void;
}

/**
 * Full-screen confetti overlay. Mount it once at the screen level and call
 * ref.fire() to trigger a 3-second burst. Pointer events are disabled so it
 * never blocks taps on the underlying UI.
 */
export const Confetti = forwardRef<ConfettiRef>((_, ref) => {
  const { width } = useWindowDimensions();
  const cannonRef = useRef<any>(null);
  const [visible, setVisible] = useState(false);

  useImperativeHandle(ref, () => ({
    fire() {
      setVisible(true);
      // The cannon auto-starts; hide the overlay once animation ends.
    },
  }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ConfettiCannon
        ref={cannonRef}
        count={180}
        origin={{ x: width / 2, y: -20 }}
        explosionSpeed={350}
        fallSpeed={3000}
        fadeOut
        autoStart
        colors={['#3b82f6', '#60a5fa', '#93c5fd', '#ffffff', '#fbbf24', '#34d399']}
        onAnimationEnd={() => setVisible(false)}
      />
    </View>
  );
});

Confetti.displayName = 'Confetti';
