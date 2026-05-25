/**
 * CookieConsentBanner — web-only cookie notice.
 *
 * Shows a bottom banner on first web visit asking the user to accept or decline
 * analytics cookies. Preference is persisted to AsyncStorage (maps to
 * localStorage on web) under the key 'cookie_consent'. Once a choice is made
 * the banner disappears permanently.
 *
 * On native (iOS / Android) this renders nothing — cookies are a browser concept.
 */

import { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors, spacing, typography, radius } from '@/lib/theme';

const STORAGE_KEY = 'cookie_consent';

type ConsentValue = 'accepted' | 'declined';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const colors = useThemeColors();

  useEffect(() => {
    // Only relevant on web. On native, bail immediately.
    if (Platform.OS !== 'web') return;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) {
          // No previous choice — show the banner.
          setVisible(true);
        }
      })
      .catch(() => {
        // If storage is unavailable just show the banner; worst case they see it
        // again next session.
        setVisible(true);
      });
  }, []);

  const handleChoice = async (value: ConsentValue) => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage failure is non-critical — the choice is lost but UX continues.
    }
  };

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            We use cookies
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Vanta uses essential cookies to keep you signed in and analytics
            cookies to understand how the platform is used. You can decline
            analytics cookies without affecting core functionality.{'  '}
            <Text
              style={{ color: colors.primary }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => (window as any).open('/legal/privacy', '_blank', 'noopener,noreferrer')}
              accessibilityRole="link"
            >
              Privacy Policy
            </Text>
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnSecondary,
              { borderColor: colors.border, backgroundColor: colors.bgSurface },
            ]}
            onPress={() => handleChoice('declined')}
            accessibilityLabel="Decline analytics cookies"
          >
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>
              Necessary only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={() => handleChoice('accepted')}
            accessibilityLabel="Accept all cookies"
          >
            <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Accept all</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    zIndex: 9999,
  },
  content: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textBlock: {
    flex: 1,
    minWidth: 200,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  body: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexShrink: 0,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {},
  btnSecondary: {
    borderWidth: 1,
  },
  btnText: {
    ...typography.bodyBold,
    fontSize: 13,
  },
});
