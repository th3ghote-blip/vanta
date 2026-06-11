import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { VantaLogo } from '@/components/shared/VantaLogo';
import { useAuthStore } from '@/stores/auth';

export default function Signup() {
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ login: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const res = await register(cleanEmail, password);
    setBusy(false);
    if ('error' in res && res.error) {
      setError(res.error);
    } else if ('login' in res) {
      setCreated({ login: res.login });
    }
  };

  const copyNumber = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (created) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgDeep }}
      >
        <VantaLogo height={38} />
        <Text style={{ ...typography.heading, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.sm }}>
          Account created
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14, marginBottom: spacing.lg }}>
          You're all set. Sign in any time with your email and password.
        </Text>

        <CredField
          label="Your account number (for support)"
          value={String(created.login)}
          copied={copied}
          onCopy={() => copyNumber(String(created.login))}
          mono
        />
        <Text style={{ ...typography.body, fontSize: 12, color: colors.textMuted, marginTop: spacing.xs }}>
          You log in with your email — the account number is just a reference for support.
        </Text>

        <Pressable
          onPress={() => router.replace('/onboarding')}
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>
            Continue to Vanta
          </Text>
        </Pressable>

        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: spacing.md, textAlign: 'center' }}>
          Demo balance: $10,000.00 · Account #{created.login}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgDeep }}
    >
      <VantaLogo height={44} />
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl }}>
        Create your account with an email and password. Demo balance starts at $10,000.
      </Text>

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginBottom: spacing.xs }}>
        Email
      </Text>
      <TextInput
        testID="signup-email-input"
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
        testID="signup-password-input"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
      />

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs }}>
        Confirm password
      </Text>
      <TextInput
        testID="signup-confirm-input"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
      />

      {error ? (
        <Text style={{ ...typography.body, color: colors.loss, marginTop: spacing.md }}>{error}</Text>
      ) : null}

      <Pressable
        testID="signup-submit"
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
          <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>Create Account</Text>
        )}
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl }}>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>Already have one? </Text>
        <Link href="/(auth)/login" style={{ ...typography.bodyBold, color: colors.primary }}>
          Sign in
        </Link>
      </View>
    </ScrollView>
  );
}

function CredField({
  label,
  value,
  copied,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted, marginBottom: spacing.xs }}>
        {label.toUpperCase()}
      </Text>
      <Pressable
        onPress={onCopy}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bgSurface,
          borderColor: copied ? colors.profit : colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        <Text
          selectable
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: 18,
            ...(mono ? typography.monoBold : typography.bodyBold),
            letterSpacing: mono ? 1.5 : 0,
          }}
        >
          {value}
        </Text>
        {copied ? (
          <Check color={colors.profit} size={20} />
        ) : (
          <Copy color={colors.textSecondary} size={20} />
        )}
      </Pressable>
      <Text style={{ ...typography.body, fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
        Tap to copy
      </Text>
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
