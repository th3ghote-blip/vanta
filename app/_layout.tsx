import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';

import { colors } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { useModeStore } from '@/stores/mode';
import { useAccountStore } from '@/stores/account';
import { connectLiveQuotes, disconnectLiveQuotes } from '@/lib/liveQuotes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const initAuth = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const hydrateMode = useModeStore((s) => s.hydrate);
  const fetchAccount = useAccountStore((s) => s.fetch);
  const clearAccount = useAccountStore((s) => s.clear);

  useEffect(() => {
    const unsubscribe = initAuth();
    hydrateMode();
    connectLiveQuotes();
    return () => {
      unsubscribe();
      disconnectLiveQuotes();
    };
  }, [initAuth, hydrateMode]);

  // Refetch account whenever auth state changes
  useEffect(() => {
    if (session) fetchAccount();
    else clearAccount();
  }, [session, fetchAccount, clearAccount]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bgDeep },
                headerTintColor: colors.textPrimary,
                contentStyle: { backgroundColor: colors.bgDeep },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="help" options={{ title: 'Help' }} />
              <Stack.Screen name="kyc" options={{ title: 'Identity Verification' }} />
            </Stack>
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
