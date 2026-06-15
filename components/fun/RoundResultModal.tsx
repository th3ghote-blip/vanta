/**
 * RoundResultModal — Phase 2.5
 *
 * Pops when a binary round settles. Win → confetti + green check + "+$X.XX".
 * Loss → red shake + "-$X.XX". Auto-dismisses after 3 s.
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { CheckCircle, XCircle } from 'lucide-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

import { colors, radius, spacing, typography } from '@/lib/theme';
import type { BinaryRound } from './ActiveRounds';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  round: BinaryRound | null;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoundResultModal({ round, onDismiss }: Props) {
  const { width } = useWindowDimensions();
  const shakeX = useRef(new Animated.Value(0)).current;
  const scaleIn = useRef(new Animated.Value(0.7)).current;
  const opacityIn = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiRef = useRef<ConfettiCannon>(null);

  const visible = round !== null && round.outcome !== 'pending';
  const isWin = round?.outcome === 'win';
  const isTie = round?.outcome === 'tie';

  // Keep the latest onDismiss in a ref so the entrance effect doesn't depend on
  // it. The parent (Quick screen) re-renders ~5x/s on live quote ticks and
  // passes a fresh onDismiss arrow each time; without this the entrance effect
  // re-ran every render and the modal flashed.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Payout displayed:
  //  - win: +payout amount
  //  - loss: -stake
  //  - tie: +stake (refund)
  const amountDisplay = (() => {
    if (!round) return '';
    if (isWin) {
      const net = (round.payout ?? round.stake * round.payout_multiplier) - round.stake;
      return `+$${net.toFixed(2)}`;
    }
    if (isTie) return `±$0.00`;
    return `-$${round.stake.toFixed(2)}`;
  })();

  const accentColor = isWin || isTie ? colors.profit : colors.loss;
  const bgColor = isWin || isTie ? '#0a2318' : '#2a0a12';

  // Clear any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const runEntrance = useCallback(() => {
    scaleIn.setValue(0.7);
    opacityIn.setValue(0);
    Animated.parallel([
      Animated.spring(scaleIn, {
        toValue: 1,
        tension: 180,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacityIn, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleIn, opacityIn]);

  const runShake = useCallback(() => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  14, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  // Run the entrance/shake/auto-dismiss ONCE per settled round. Keyed only on
  // the round id + outcome so frequent parent re-renders (live quote ticks)
  // don't restart the animation and flash the modal.
  const settledKey = round && round.outcome !== 'pending' ? `${round.id}:${round.outcome}` : null;
  useEffect(() => {
    if (!settledKey) return;
    const win = round?.outcome === 'win';
    const tie = round?.outcome === 'tie';

    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }

    runEntrance();

    if (win) {
      const c = setTimeout(() => confettiRef.current?.start(), 80);
      dismissTimer.current = setTimeout(() => onDismissRef.current(), 3000);
      return () => clearTimeout(c);
    }
    if (tie) {
      dismissTimer.current = setTimeout(() => onDismissRef.current(), 3000);
      return;
    }
    // loss: shake, no auto-dismiss (tap to close)
    const t = setTimeout(runShake, 200);
    return () => clearTimeout(t);
  }, [settledKey, runEntrance, runShake]);

  if (!round) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      {/* Overlay */}
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Confetti fires from center-top — rendered outside the card so it
            isn't clipped by the card's overflow. */}
        {isWin && (
          <ConfettiCannon
            ref={confettiRef}
            count={120}
            origin={{ x: width / 2, y: -20 }}
            autoStart={false}
            fadeOut
            explosionSpeed={400}
            fallSpeed={2800}
            colors={['#10D984', '#00C6FF', '#FFD700', '#FF6BCA', '#FFFFFF']}
          />
        )}

        {/* Card — stop propagation so tapping the card doesn't dismiss */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={{
              transform: [
                { scale: scaleIn },
                { translateX: shakeX },
              ],
              opacity: opacityIn,
              backgroundColor: bgColor,
              borderRadius: radius.xl ?? 20,
              borderWidth: 1,
              borderColor: accentColor,
              padding: spacing.xl ?? 32,
              alignItems: 'center',
              width: 280,
              gap: spacing.md ?? 16,
              // Shadow
              ...(Platform.OS !== 'web'
                ? {
                    shadowColor: accentColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.35,
                    shadowRadius: 20,
                    elevation: 12,
                  }
                : {
                    boxShadow: `0 4px 32px ${accentColor}55`,
                  }),
            }}
          >
            {/* Icon */}
            {isWin || isTie ? (
              <CheckCircle color={accentColor} size={56} strokeWidth={1.5} />
            ) : (
              <XCircle color={accentColor} size={56} strokeWidth={1.5} />
            )}

            {/* Result label */}
            <Text
              style={{
                ...typography.heading,
                color: accentColor,
                fontSize: 28,
                letterSpacing: 1,
              }}
            >
              {isWin ? 'YOU WON' : isTie ? 'TIE' : 'YOU LOST'}
            </Text>

            {/* Amount */}
            <Text
              style={{
                ...typography.monoBold,
                color: accentColor,
                fontSize: 40,
                lineHeight: 48,
              }}
            >
              {amountDisplay}
            </Text>

            {/* Symbol + direction subtitle */}
            <Text
              style={{
                ...typography.body,
                color: colors.textMuted,
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              {round.symbol} · {round.direction === 'buy' ? '▲ Up' : '▼ Down'} · ${round.stake.toFixed(2)} stake
            </Text>

            {/* Dismiss hint */}
            <Text
              style={{
                ...typography.body,
                color: colors.textMuted,
                fontSize: 11,
                marginTop: spacing.xs ?? 4,
              }}
            >
              Tap anywhere to close
            </Text>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
