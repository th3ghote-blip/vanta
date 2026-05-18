import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface VantaLogoProps {
  /** Height of the V mark in dp; wordmark scales proportionally. Default 32. */
  height?: number;
  /** Show the "VANTA" wordmark beside the mark. Default true. */
  showWordmark?: boolean;
  /** Override the tint colour. Defaults to brand blue. */
  tint?: string;
}

/**
 * VANTA brand logo.
 *
 * Renders the geometric V mark (react-native-svg) and the optional VANTA
 * wordmark as a native Text element so it inherits the loaded font stack.
 *
 * Usage:
 *   <VantaLogo />                   // full logo, default size
 *   <VantaLogo height={56} />       // larger
 *   <VantaLogo showWordmark={false} height={28} />   // mark only
 */
export function VantaLogo({
  height = 32,
  showWordmark = true,
  tint,
}: VantaLogoProps) {
  const primary = tint ?? colors.primary;
  const glow = tint ?? colors.primaryGlow;

  // Mark is drawn on a 28 × 23 canvas (23 to accommodate tip circle).
  const markWidth = (height / 23) * 28;

  return (
    <View style={styles.row}>
      {/* ── V mark ── */}
      <Svg width={markWidth} height={height} viewBox="0 0 28 23">
        <Defs>
          {/*
           * Gradient: lighter blue at the top, full primary at the bottom.
           * This gives a subtle top-lit "chrome" effect on the arms.
           */}
          <LinearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={glow} stopOpacity="1" />
            <Stop offset="1" stopColor={primary} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Left arm: top-left → bottom-centre */}
        <Path d="M0 0 L6 0 L14 20 L8 20 Z" fill="url(#vg)" />

        {/* Right arm: top-right → bottom-centre */}
        <Path d="M22 0 L28 0 L20 20 L14 20 Z" fill="url(#vg)" />

        {/* Apex dot — a faint data-point circle at the V tip */}
        <Circle cx="14" cy="20" r="2.2" fill={glow} opacity="0.7" />
      </Svg>

      {/* ── Wordmark ── */}
      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            {
              fontSize: height * 0.72,
              lineHeight: height * 0.9,
              color: primary,
              marginLeft: height * 0.3,
            },
          ]}
          allowFontScaling={false}
        >
          VANTA
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    fontWeight: '700',
    letterSpacing: 3.5,
  },
});
