import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { VantaLogo } from '@/components/shared/VantaLogo';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/lib/supabase';
import { challengeAndVerify } from '@/lib/2fa';

export default function Login() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 2FA step
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [totpCode, setTotpCode] = useState('');
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      setBusy(false);
      return;
    }
    const res = await signIn(cleanEmail, password);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }

    // Check if MFA is required
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === 'aal2') {
      // User has 2FA — find the factor
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factorId = factorsData?.totp?.[0]?.id ?? null;
      setTotpFactorId(factorId);
      setTotpCode('');
      setBusy(false);
      setStep('totp');
    } else {
      setBusy(false);
      router.replace('/(tabs)/trade');
    }
  };

  const onVerifyTotp = async () => {
    if (!totpFactorId) {
      setError('Could not find 2FA factor. Please sign in again.');
      return;
    }
    const clean = totpCode.replace(/\s/g, '');
    if (clean.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await challengeAndVerify(totpFactorId, clean);
    setBusy(false);
    if (err) {
      setError('Invalid code. Check your authenticator app and try again.');
      return;
    }
    router.replace('/(tabs)/trade');
  };

  if (step === 'totp') {
    return (
      <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.bgDeep }}>
        <VantaLogo height={44} />
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 20, marginBottom: spacing.xs }}>
          Two-Factor Authentication
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl }}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          value={totpCode}
          onChangeText={(t) => setTotpCode(t.replace(/[^\d\s]/g, '').slice(0, 7))}
          keyboardType="number-pad"
          placeholder="000 000"
          placeholderTextColor={colors.textMuted}
          autoFocus
          style={[
            inputStyle,
            {
              fontFamily: 'JetBrainsMono',
              fontSize: 28,
              letterSpacing: 8,
              textAlign: 'center',
            },
          ]}
        />

        {error ? (
          <Text style={{ ...typography.body, color: colors.loss, marginTop: spacing.md }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={onVerifyTotp}
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
            <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Verify</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => { setStep('password'); setError(null); setTotpCode(''); }}
          style={{ alignItems: 'center', marginTop: spacing.lg }}
        >
          <Text style={{ ...typography.body, color: colors.textMuted }}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.bgDeep }}>
      <VantaLogo height={44} />
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl }}>
        Welcome back. Sign in with your email.
      </Text>

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginBottom: spacing.xs }}>
        Email
      </Text>
      <TextInput
        testID="login-email-input"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
      />

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs }}>
        Password
      </Text>
      <TextInput
        testID="login-password-input"
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
        testID="login-submit"
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
