import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';

import { colors, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';

export default function Landing() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgDeep }}>
        <Text style={{ ...typography.display, fontSize: 48, color: colors.primary, letterSpacing: 4 }}>VANTA</Text>
        <Text style={{ ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>
          Trade smarter. Trade faster.
        </Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return session ? <Redirect href="/(tabs)/trade" /> : <Redirect href="/(auth)/login" />;
}
