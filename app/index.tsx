import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';

import { colors, spacing, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { VantaLogo } from '@/components/shared/VantaLogo';

export default function Landing() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgDeep }}>
        <VantaLogo height={52} />
        <Text style={{ ...typography.body, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, letterSpacing: 1 }}>
          Trade smarter. Trade faster.
        </Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </View>
    );
  }

  return session ? <Redirect href="/(tabs)/trade" /> : <Redirect href="/(auth)/login" />;
}
