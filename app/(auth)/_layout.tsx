import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgDeep },
        headerTintColor: colors.textPrimary,
        contentStyle: { backgroundColor: colors.bgDeep },
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
