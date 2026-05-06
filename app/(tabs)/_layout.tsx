import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { TrendingUp, Bot, Wallet, User } from 'lucide-react-native';

import { colors, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { AccountHeader } from '@/components/shared/AccountHeader';

export default function TabsLayout() {
  const { session, loading } = useAuthStore();

  // Bounce out if no session (after sign-out, token expiry, etc.)
  if (!loading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Live account strip — visible on every tab */}
      <AccountHeader />

      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: colors.bgElevated,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { ...typography.bodyBold, fontSize: 11 },
          headerStyle: { backgroundColor: colors.bgDeep },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen
          name="trade"
          options={{
            title: 'Trade',
            tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="robots"
          options={{
            title: 'Robots',
            tabBarIcon: ({ color, size }) => <Bot color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="portfolio"
          options={{
            title: 'Portfolio',
            tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}
