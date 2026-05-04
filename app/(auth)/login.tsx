import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';

export default function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const num = Number(login.trim());
    if (!Number.isInteger(num) || num <= 0) {
      setError('Account number must be a number.');
      setBusy(false);
      return;
    }
    const res = await signIn(num, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else router.replace('/(tabs)/trade');
  };

  return (
    <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.bgDeep }}>
      <Text style={{ ...typography.display, fontSize: 40, color: colors.primary, letterSpacing: 4, marginBottom: spacing.sm }}>
        VANTA
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl }}>
        Welcome back. Sign in with your account number.
      </Text>

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginBottom: spacing.xs }}>
        Account number
      </Text>
      <TextInput
        value={login}
        onChangeText={(t) => setLogin(t.replace(/[^\d]/g, ''))}
        autoCapitalize="none"
        keyboardType="number-pad"
        placeholder="80000001"
        placeholderTextColor={colors.textMuted}
        style={[inputStyle, { fontFamily: 'JetBrainsMono', letterSpacing: 1.5 }]}
      />

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs }}>
        Password
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        placeholder="••••••••••••••"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
      />

      {error ? (
        <Text style={{ ...typography.body, color: colors.loss, marginTop: spacing.md }}>{error}</Text>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={busy}
        style={{
          marginTop: spacing.xl,
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          alignItems: 'center',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Sign In</Text>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>New to Vanta? </Text>
        <Link href="/(auth)/signup" style={{ ...typography.bodyBold, color: colors.primary }}>
          Create an account
        </Link>
      </View>
    </View>
  );
}

const inputStyle = {
  backgroundColor: colors.bgSurface,
  borderRadius: radius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.textPrimary,
  fontSize: 16,
  borderWidth: 1,
  borderColor: colors.border,
} as const;
