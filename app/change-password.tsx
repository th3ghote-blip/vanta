import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle, Lock } from 'lucide-react-native';
import { useAuthStore } from '@/stores/auth';
import { useAccountStore } from '@/stores/account';
import { colors, radius, spacing } from '@/lib/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { signIn, changePassword, signOut } = useAuthStore();
  const account = useAccountStore((s) => s.account);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validate = (): string | null => {
    if (!currentPassword) return 'Enter your current password.';
    if (!newPassword) return 'Enter a new password.';
    if (newPassword.length < 8) return 'New password must be at least 8 characters.';
    if (newPassword !== confirmPassword) return 'New passwords do not match.';
    if (newPassword === currentPassword) return 'New password must differ from the current one.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!account?.login) {
      setError('Account not loaded. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);

    // Step 1: re-verify identity by signing in with current credentials.
    const signInResult = await signIn(account.login, currentPassword);
    if (signInResult.error) {
      setLoading(false);
      setError('Current password is incorrect.');
      return;
    }

    // Step 2: change the password.
    const changeResult = await changePassword(newPassword);
    setLoading(false);

    if (changeResult.error) {
      setError(changeResult.error);
      return;
    }

    // Step 3: show success, sign out, redirect to login.
    setSuccess(true);
    setTimeout(async () => {
      await signOut();
      router.replace('/(auth)/login');
    }, 2200);
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Stack.Screen options={{ title: 'Change Password', headerBackVisible: false }} />
        <CheckCircle color={colors.profit} size={56} />
        <Text style={styles.successTitle}>Password Updated</Text>
        <Text style={styles.successSubtitle}>
          You have been signed out. Please sign in with your new password.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Change Password' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Lock color={colors.primary} size={36} />
        </View>
        <Text style={styles.heading}>Update your password</Text>
        <Text style={styles.subheading}>
          Enter your current password to confirm, then choose a new one.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            value={currentPassword}
            onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
            editable={!loading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            value={newPassword}
            onChangeText={(t) => { setNewPassword(t); setError(null); }}
            editable={!loading}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat new password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCorrect={false}
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
            editable={!loading}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Update Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={loading}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgDeep },
  scroll: { flex: 1 },
  container: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.loss,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
