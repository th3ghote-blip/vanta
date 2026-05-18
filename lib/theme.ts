/**
 * Vanta theme tokens.
 *
 * Usage:
 *   import { useThemeColors } from '@/lib/theme';
 *   const colors = useThemeColors();
 *
 * For one-off dark-only static use (legacy, avoid in new code):
 *   import { colors } from '@/lib/theme';
 */

import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/stores/theme';

// ── Structural color type ──────────────────────────────────────────────────────

export interface ColorTokens {
  primary: string;
  primaryGlow: string;
  profit: string;
  loss: string;
  bgDeep: string;
  bgElevated: string;
  bgSurface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  warning: string;
  info: string;
}

// ── Color palettes ────────────────────────────────────────────────────────────

const darkColors: ColorTokens = {
  primary: '#3B82F6',
  primaryGlow: '#60A5FA',

  profit: '#10D984',
  loss: '#FF3B5C',

  bgDeep: '#0A0E1A',
  bgElevated: '#131829',
  bgSurface: '#1C2236',
  border: '#2A3148',

  textPrimary: '#FFFFFF',
  textSecondary: '#8B92A6',
  textMuted: '#5A6178',

  warning: '#FFB020',
  info: '#60A5FA',
};

const lightColors: ColorTokens = {
  primary: '#2563EB',
  primaryGlow: '#3B82F6',

  profit: '#059669',
  loss: '#DC2626',

  bgDeep: '#EEF1F8',
  bgElevated: '#FFFFFF',
  bgSurface: '#F5F7FC',
  border: '#D8DDE8',

  textPrimary: '#0A0E1A',
  textSecondary: '#4A5166',
  textMuted: '#8B92A6',

  warning: '#D97706',
  info: '#2563EB',
};

/** Static dark-mode colors — kept for backward compatibility with existing screens. */
export const colors: ColorTokens = darkColors;

// ── Reactive theme hook ───────────────────────────────────────────────────────

/**
 * Returns the correct color palette for the current theme preference.
 * Resolves 'auto' using the device system appearance.
 *
 * Use this in all new screens and components instead of the static `colors`.
 */
export function useThemeColors(): ColorTokens {
  const preference = useThemeStore((s) => s.theme);
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  const resolved =
    preference === 'auto'
      ? (systemScheme === 'light' ? 'light' : 'dark')
      : preference;

  return resolved === 'light' ? lightColors : darkColors;
}

/** Resolves a ThemePreference string to a scheme without a hook (for non-React contexts). */
export function resolveScheme(
  preference: 'auto' | 'dark' | 'light',
  systemScheme: 'light' | 'dark' | null,
): 'light' | 'dark' {
  if (preference === 'auto') return systemScheme === 'light' ? 'light' : 'dark';
  return preference;
}

// ── Other tokens (theme-independent) ─────────────────────────────────────────

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const typography = {
  display: { fontFamily: 'Inter', fontWeight: '700' as const },
  heading: { fontFamily: 'Inter', fontWeight: '600' as const },
  body: { fontFamily: 'Inter', fontWeight: '400' as const },
  bodyBold: { fontFamily: 'Inter', fontWeight: '500' as const },
  mono: { fontFamily: 'JetBrainsMono', fontWeight: '400' as const },
  monoBold: { fontFamily: 'JetBrainsMono', fontWeight: '600' as const },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const theme = { colors, radius, spacing, typography, shadows } as const;
export type Theme = typeof theme;
