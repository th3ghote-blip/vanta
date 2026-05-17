import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Copy, Check, AlertTriangle } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';

export default function Signup() {
  const register = useAuthStore((s) => s.register);
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<{ login: number; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'login' | 'password' | null>(null);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const res = await register(contactEmail.trim() || undefined);
    setBusy(false);
    if ('error' in res && res.error) {
      setError(res.error);
    } else if ('login' in res) {
      setCredentials({ login: res.login, password: res.password });
    }
  };

  const copy = async (text: string, field: 'login' | 'password') => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  if (credentials) {
    return (
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgDeep }}
      >
        <Text
          style={{
            ...typography.display,
            fontSize: 32,
            color: colors.primary,
            letterSpacing: 4,
            marginBottom: spacing.sm,
          }}
        >
          VANTA
        </Text>
        <Text style={{ ...typography.heading, fontSize: 22, color: colors.textPrimary, marginBottom: spacing.lg }}>
          Account created
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            backgroundColor: colors.warning + '22',
            borderColor: colors.warning,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <AlertTriangle color={colors.warning} size={20} />
          <Text style={{ ...typography.body, color: colors.warning, flex: 1, fontSize: 13, lineHeight: 19 }}>
            Save these credentials now. The password will not be shown again. Store them in a password manager.
          </Text>
        </View>

        <CredField
          label="Account number (login)"
          value={String(credentials.login)}
          copied={copiedField === 'login'}
          onCopy={() => copy(String(credentials.login), 'login')}
          mono
        />
        <CredField
          label="Password"
          value={credentials.password}
          copied={copiedField === 'password'}
          onCopy={() => copy(credentials.password, 'password')}
          mono
        />

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
            I've saved them — continue to Vanta
          </Text>
        </Pressable>

        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: spacing.md, textAlign: 'center' }}>
          Demo balance: $10,000.00 · Account #{credentials.login}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.bgDeep }}
    >
      <Text style={{ ...typography.display, fontSize: 40, color: colors.primary, letterSpacing: 4, marginBottom: spacing.sm }}>
        VANTA
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xxl }}>
        Create a new account. We'll generate a login number and password — like MT4. Demo balance starts at $10,000.
      </Text>

      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginBottom: spacing.xs }}>
        Contact email (optional)
      </Text>
      <TextInput
        value={contactEmail}
        onChangeText={setContactEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com — for support recovery"
        placeholderTextColor={colors.textMuted}
        style={inputStyle}
      />
      <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs }}>
        Used only for support contact and password recovery. Not required.
      </Text>

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
