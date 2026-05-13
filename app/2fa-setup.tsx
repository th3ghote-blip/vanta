import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Shield, ShieldCheck, ShieldOff, Copy, CheckCircle2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { SvgXml } from 'react-native-svg';

import { colors, radius, spacing, typography } from '@/lib/theme';
import {
  enroll2FA,
  verifyEnrollment,
  unenroll2FA,
  listVerifiedFactors,
  type MFAFactor,
} from '@/lib/2fa';

type Screen = 'loading' | 'disabled' | 'enrolling' | 'verifying' | 'enabled';

function decodeSvg(qrCode: string): string {
  try {
    if (qrCode.startsWith('data:image/svg+xml;base64,')) {
      const b64 = qrCode.slice('data:image/svg+xml;base64,'.length);
      return atob(b64);
    }
    if (qrCode.startsWith('data:image/svg+xml,')) {
      return decodeURIComponent(qrCode.slice('data:image/svg+xml,'.length));
    }
    return qrCode;
  } catch {
    return qrCode;
  }
}

export default function TwoFASetup() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [factor, setFactor] = useState<MFAFactor | null>(null);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
    uri: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const codeRef = useRef<TextInput>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setScreen('loading');
    const { factors, error: err } = await listVerifiedFactors();
    if (err) {
      setError(err);
      setScreen('disabled');
      return;
    }
    if (factors.length > 0) {
      setFactor(factors[0]);
      setScreen('enabled');
    } else {
      setScreen('disabled');
    }
  }

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await enroll2FA();
    setBusy(false);
    if (err || !data) {
      setError(err ?? 'Enrollment failed');
      return;
    }
    setEnrollData(data);
    setCode('');
    setScreen('enrolling');
  }

  async function confirmEnroll() {
    if (!enrollData) return;
    if (code.replace(/\s/g, '').length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await verifyEnrollment(enrollData.factorId, code.replace(/\s/g, ''));
    setBusy(false);
    if (err) {
      setError('Invalid code. Please try again.');
      return;
    }
    setDone(true);
    setTimeout(() => {
      setDone(false);
      loadStatus();
    }, 1800);
  }

  async function handleDisable() {
    if (!factor) return;
    Alert.alert(
      'Disable 2FA',
      'This will remove two-factor authentication from your account. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            const { error: err } = await unenroll2FA(factor.id);
            setBusy(false);
            if (err) {
              setError(err);
              return;
            }
            setFactor(null);
            setScreen('disabled');
          },
        },
      ]
    );
  }

  async function copySecret() {
    if (!enrollData) return;
    await Clipboard.setStringAsync(enrollData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const svgXml = enrollData ? decodeSvg(enrollData.qrCode) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: spacing.xs }}>
          <Text style={{ ...typography.body, color: colors.primary }}>Back</Text>
        </Pressable>
        <Text style={{ ...typography.heading, color: colors.textPrimary, flex: 1 }}>
          Two-Factor Authentication
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
        {screen === 'loading' && (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {screen === 'disabled' && (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Shield color={colors.textMuted} size={48} />
              <Text style={{ ...typography.heading, color: colors.textPrimary, textAlign: 'center' }}>
                2FA is not enabled
              </Text>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                Add an extra layer of security. Each sign-in will require a 6-digit code from your
                authenticator app (Google Authenticator, Authy, 1Password, etc.).
              </Text>
            </View>

            {error ? (
              <Text style={{ ...typography.body, color: colors.loss }}>{error}</Text>
            ) : null}

            <Pressable
              onPress={startEnroll}
              disabled={busy}
              style={{
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
                <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>
                  Enable 2FA
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {screen === 'enrolling' && enrollData && (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.md,
              }}
            >
              <Text style={{ ...typography.heading, color: colors.textPrimary }}>
                Step 1 — Scan the QR code
              </Text>
              <Text style={{ ...typography.body, color: colors.textSecondary, lineHeight: 22 }}>
                Open your authenticator app and scan the code below. If you cannot scan, copy the
                secret key and add it manually.
              </Text>

              {svgXml ? (
                <View
                  style={{
                    alignSelf: 'center',
                    backgroundColor: '#fff',
                    borderRadius: radius.md,
                    padding: 12,
                  }}
                >
                  <SvgXml xml={svgXml} width={180} height={180} />
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textPrimary,
                    flex: 1,
                    fontFamily: 'JetBrainsMono',
                    fontSize: 13,
                    letterSpacing: 1,
                  }}
                  selectable
                >
                  {enrollData.secret}
                </Text>
                <Pressable onPress={copySecret} style={{ padding: 4 }}>
                  {copied ? (
                    <CheckCircle2 color={colors.profit} size={18} />
                  ) : (
                    <Copy color={colors.textMuted} size={18} />
                  )}
                </Pressable>
              </View>
            </View>

            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.md,
              }}
            >
              <Text style={{ ...typography.heading, color: colors.textPrimary }}>
                Step 2 — Verify the code
              </Text>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>
                Enter the 6-digit code shown in your authenticator app.
              </Text>
              <TextInput
                ref={codeRef}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^\d\s]/g, '').slice(0, 7))}
                keyboardType="number-pad"
                placeholder="000 000"
                placeholderTextColor={colors.textMuted}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlign: 'center',
                  fontFamily: 'JetBrainsMono',
                  letterSpacing: 6,
                }}
              />
            </View>

            {error ? (
              <Text style={{ ...typography.body, color: colors.loss }}>{error}</Text>
            ) : null}

            {done ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' }}
              >
                <CheckCircle2 color={colors.profit} size={20} />
                <Text style={{ ...typography.bodyBold, color: colors.profit }}>
                  2FA enabled successfully!
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={confirmEnroll}
                disabled={busy}
                style={{
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
                  <Text style={{ ...typography.heading, color: '#fff', fontSize: 16 }}>
                    Verify & Enable
                  </Text>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={() => setScreen('disabled')}
              disabled={busy}
              style={{ alignItems: 'center', paddingVertical: spacing.sm }}
            >
              <Text style={{ ...typography.body, color: colors.textMuted }}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {screen === 'enabled' && (
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.lg,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <ShieldCheck color={colors.profit} size={48} />
              <Text style={{ ...typography.heading, color: colors.textPrimary, textAlign: 'center' }}>
                2FA is active
              </Text>
              <Text
                style={{
                  ...typography.body,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                Your account is protected. Each sign-in requires a code from your authenticator app.
              </Text>
            </View>

            {error ? (
              <Text style={{ ...typography.body, color: colors.loss }}>{error}</Text>
            ) : null}

            <Pressable
              onPress={handleDisable}
              disabled={busy}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: colors.bgElevated,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.loss,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color={colors.loss} />
              ) : (
                <>
                  <ShieldOff color={colors.loss} size={18} />
                  <Text style={{ ...typography.bodyBold, color: colors.loss }}>Disable 2FA</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
