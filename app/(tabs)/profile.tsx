import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Shield, Bell, MessageSquare, Phone, HelpCircle, LogOut, ChevronRight, BadgeCheck, ShieldCheck } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { useAccountStore } from '@/stores/account';
import { api } from '@/lib/api';
import { listVerifiedFactors } from '@/lib/2fa';
import { ModeSwitcher } from '@/components/shared/ModeSwitcher';
import { EnvBanner } from '@/components/shared/EnvBanner';

export default function Profile() {
  const { user, signOut } = useAuthStore();
  const account = useAccountStore((s) => s.account);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [has2FA, setHas2FA] = useState(false);

  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => {});
    listVerifiedFactors()
      .then(({ factors }) => setHas2FA(factors.length > 0))
      .catch(() => {});
  }, []);

  function handleCopyLogin() {
    if (!account?.login) return;
    Clipboard.setStringAsync(String(account.login));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <EnvBanner />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ ...typography.display, color: '#fff', fontSize: 24 }}>
              {(user?.email ?? 'V').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Pressable onPress={handleCopyLogin} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 16 }}>
                Account #{account?.login ?? '---'}
              </Text>
            </Pressable>
            <Text style={{ ...typography.body, color: copied ? colors.profit : colors.textMuted, fontSize: 11, marginTop: 1 }}>
              {copied ? 'Copied!' : 'Tap to copy'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.profit }} />
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>Online</Text>
            </View>
          </View>
        </View>

        {/* Mode toggle */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, marginBottom: spacing.sm }}>
            Trading Mode
          </Text>
          <ModeSwitcher />
        </View>

        {/* Settings list */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <Row
            icon={<BadgeCheck color={colors.warning} size={20} />}
            label="Identity Verification"
            sublabel="Required to withdraw"
            onPress={() => router.push('/kyc')}
          />
          <Row icon={<Bell color={colors.textSecondary} size={20} />} label="Notifications" onPress={() => router.push('/notifications-settings')} />
          <Row icon={<MessageSquare color={colors.textSecondary} size={20} />} label="Support Chat" />
          <Row icon={<Phone color={colors.textSecondary} size={20} />} label="Voice Support" sublabel="Available 9am-9pm" />
          <Row
            icon={<Shield color={colors.textSecondary} size={20} />}
            label="Security & Password"
            onPress={() => router.push('/change-password')}
          />
          <Row
            icon={<ShieldCheck color={has2FA ? colors.profit : colors.textSecondary} size={20} />}
            label="Two-Factor Authentication"
            sublabel={has2FA ? 'Enabled' : 'Add extra sign-in security'}
            onPress={() => router.push('/2fa-setup')}
          />
          <Row icon={<HelpCircle color={colors.textSecondary} size={20} />} label="Help Center" onPress={() => router.push('/help')} last={!isAdmin} />
          {isAdmin && (
            <Row
              icon={<ShieldCheck color={colors.primary} size={20} />}
              label="Admin -- Transactions"
              sublabel="Approve / reject pending requests"
              onPress={() => router.push('/admin/transactions')}
              last
            />
          )}
        </View>

        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <LogOut color={colors.loss} size={18} />
          <Text style={{ ...typography.bodyBold, color: colors.loss, fontSize: 14 }}>Sign Out</Text>
        </Pressable>

        <View style={{ alignItems: 'center', marginTop: spacing.md }}>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>VANTA v0.1.0</Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
            Powered by AI App Genius - Analytics by Nifield
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  sublabel,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.body, color: colors.textPrimary, fontSize: 15 }}>{label}</Text>
        {sublabel && (
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{sublabel}</Text>
        )}
      </View>
      <ChevronRight color={colors.textMuted} size={18} />
    </Pressable>
  );
}
