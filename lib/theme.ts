/**
 * Vanta theme tokens. Default is dark; light mode is a future addition.
 */

export const colors = {
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
} as const;

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
