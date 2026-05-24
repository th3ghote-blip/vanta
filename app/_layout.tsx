import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Platform, View, Appearance, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';

import { colors, resolveScheme } from '@/lib/theme';

// ── Sentry: capture client errors + performance traces.
// DSN is public-safe (just an identifier). Disabled in dev to avoid noise.
//
// `@sentry/react-native` only works on iOS/Android — it tries to access
// native modules at import time and crashes web bundles. We import it
// dynamically here so web stays bundle-safe; the wrap + setUser fall back
// to identity / no-ops on web. (TODO: wire up @sentry/browser separately
// for true web error tracking — for now web errors are uninstrumented.)
type SentryShape = {
  init: (opts: any) => void;
  setUser: (u: any) => void;
  wrap: <T>(component: T) => T;
};

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let Sentry: SentryShape = {
  init: () => {},
  setUser: () => {},
  wrap: (c) => c,
};

if (Platform.OS !== 'web' && SENTRY_DSN) {
  // Native-only require — never evaluated in the web bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/react-native');
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_ENV ?? 'production',
    enabled: !__DEV__,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    ignoreErrors: ['Network request failed', 'AbortError'],
  });
}
import { useAuthStore } from '@/stores/auth';
import { useModeStore } from '@/stores/mode';
import { useAccountStore } from '@/stores/account';
import { useThemeStore } from '@/stores/theme';
import { usePrefsStore } from '@/stores/prefs';
import { connectLiveQuotes, disconnectLiveQuotes } from '@/lib/liveQuotes';
import {
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from '@/lib/notifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

/**
 * Custom font map.
 * Fonts are fetched from Google Fonts CDN at runtime — no extra npm packages needed.
 * The theme (lib/theme.ts) already references these family names in typography tokens.
 *
 * To switch to bundled fonts (faster cold start, works fully offline):
 *   npm install @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono
 *   Then replace the URI strings below with the imported TTF assets, e.g.:
 *     import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
 *     'Inter_400Regular': Inter_400Regular,
 */
const FONT_MAP: Record<string, string> = {
  // Inter — UI text
  Inter_400Regular:
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
  Inter_500Medium:
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2',
  Inter_600SemiBold:
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2',
  Inter_700Bold:
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2',
  // JetBrains Mono — numbers, prices, trade IDs
  JetBrainsMono_400Regular:
    'https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOV.woff2',
  JetBrainsMono_600SemiBold:
    'https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-axTOlOV.woff2',
};

function RootLayout() {
  const initAuth = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const hydrateMode = useModeStore((s) => s.hydrate);
  const fetchAccount = useAccountStore((s) => s.fetch);
  const clearAccount = useAccountStore((s) => s.clear);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themePreference = useThemeStore((s) => s.theme);
  const hydratePrefs = usePrefsStore((s) => s.hydrate);
  const systemScheme = useColorScheme();

  // Load custom fonts. On web the fonts stream in from the CDN; on native they
  // are cached after the first load. The app renders immediately — fonts swap in
  // once ready (FontDisplay.SWAP behaviour) so there is no hard loading gate.
  const [fontsLoaded] = useFonts(FONT_MAP);

  // Track the previous user id so we know when a sign-out occurs.
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth();
    hydrateMode();
    hydrateTheme();
    hydratePrefs();
    connectLiveQuotes();
    return () => {
      unsubscribe();
      disconnectLiveQuotes();
    };
  }, [initAuth, hydrateMode, hydrateTheme, hydratePrefs]);

  // Apply Appearance override whenever the theme preference changes.
  // Appearance.setColorScheme only exists on native (iOS/Android) — on web
  // it's undefined and would crash the bundle (TypeError on every render).
  // Web theme switching is handled by re-rendering with the new color tokens.
  useEffect(() => {
    if (Platform.OS === 'web' || typeof Appearance.setColorScheme !== 'function') {
      return;
    }
    const scheme = resolveScheme(themePreference, systemScheme ?? 'dark');
    if (themePreference === 'auto') {
      Appearance.setColorScheme(null);
    } else {
      Appearance.setColorScheme(scheme);
    }
  }, [themePreference, systemScheme]);

  // Refetch account + manage push token whenever auth state changes.
  useEffect(() => {
    if (session) {
      fetchAccount();
      const userId = session.user?.id;
      if (userId && userId !== prevUserIdRef.current) {
        prevUserIdRef.current = userId;
        // Register (or re-register) push token for this user.
        // Fire-and-forget - failures are logged internally and must not crash the app.
        registerForPushNotificationsAsync(userId).catch(() => {});
        // Tag Sentry events with this user (no-op on web).
        Sentry.setUser({ id: userId });
      }
    } else {
      // User signed out - clear push token so this device stops receiving pushes.
      const prevId = prevUserIdRef.current;
      if (prevId) {
        unregisterPushToken(prevId).catch(() => {});
        prevUserIdRef.current = null;
      }
      Sentry.setUser(null);
      clearAccount();
    }
  }, [session, fetchAccount, clearAccount]);

  // Derive resolved scheme for StatusBar and background
  const resolvedScheme = resolveScheme(themePreference, systemScheme ?? 'dark');
  const bgColor = resolvedScheme === 'light' ? '#EEF1F8' : colors.bgDeep;
  const statusBarStyle = resolvedScheme === 'light' ? 'dark' : 'light';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bgColor }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View style={{ flex: 1, backgroundColor: bgColor }}>
            <StatusBar style={statusBarStyle} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: bgColor },
                headerTintColor: resolvedScheme === 'light' ? '#0A0E1A' : colors.textPrimary,
                contentStyle: { backgroundColor: bgColor },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="help" options={{ title: 'Help' }} />
              <Stack.Screen name="kyc" options={{ title: 'Identity Verification' }} />
            </Stack>
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// On native, Sentry.wrap installs an error boundary. On web it's identity.
export default Sentry.wrap(RootLayout);
