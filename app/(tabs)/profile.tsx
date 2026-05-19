import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Shield, Bell, MessageSquare, Phone, HelpCircle, LogOut, ChevronRight, BadgeCheck, ShieldCheck, Trophy, Sun, Moon, Monitor, FileText, type LucideIcon } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth';
import { useAccountStore } from '@/stores/account';
import { useThemeStore } from '@/stores/theme';
import type { ThemePreference } from '@/stores/theme';
import { api, getAchievements } from '@/lib/api';
import type { Achievement, AchievementMeta } from '@/lib/api';
import { listVerifiedFactors } from '@/lib/2fa';
import { ModeSwitcher } from '@/components/shared/ModeSwitcher';
import { EnvBanner } from '@/components/shared/EnvBanner';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'auto',  label: 'Auto',  Icon: Monitor },
  { value: 'dark',  label: 'Dark',  Icon: Moon },
  { value: 'light', label: 'Light', Icon: Sun },
];

export default function Profile() {
  const { user, signOut } = useAuthStore();
  const account = useAccountStore((s) => s.account);
  const themePreference = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [achievementMeta, setAchievementMeta] = useState<Record<string, AchievementMeta>>({});

  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => {});
    listVerifiedFactors()
      .then(({ factors }) => setHas2FA(factors.length > 0))
      .catch(() => {});
    getAchievements()
      .then(({ achievements: a, meta: m }) => { setAchievements(a); setAchievementMeta(m); })
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

        {/* Display — theme toggle */}
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
            Display
          </Text>
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginBottom: spacing.md }}>
            Theme
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const active = themePreference === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTheme(value)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.bgSurface : colors.bgDeep,
                    gap: spacing.xs,
                  }}
                >
                  <Icon color={active ? colors.primary : colors.textMuted} size={20} />
                  <Text
                    style={{
                      ...typography.bodyBold,
                      color: active ? colors.primary : colors.textMuted,
                      fontSize: 12,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
          <Row icon={<HelpCircle color={colors.textSecondary} size={20} />} label="Help Center" onPress={() => router.push('/help')} />
          <Row icon={<FileText color={colors.textSecondary} size={20} />} label="Terms of Service" onPress={() => router.push('/legal/terms')} />
          <Row icon={<FileText color={colors.textSecondary} size={20} />} label="Privacy Policy" onPress={() => router.push('/legal/privacy')} last={!isAdmin} />
          {isAdmin && (
            <Row
              icon={<ShieldCheck color={colors.primary} size={20} />}
              label="Admin Dashboard"
              sublabel="Users, deposits, trades, KYC & more"
              onPress={() => router.push('/admin')}
              last
            />
          )}
        </View>

        {/* Achievements */}
        <View
          style={{
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Trophy color={colors.warning} size={18} />
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
              Achievements
            </Text>
            {achievements.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.warning,
                  borderRadius: 10,
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: '#000', fontSize: 11 }}>
                  {achievements.length}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {Object.entries(achievementMeta).map(([code, meta]) => {
              const unlocked = achievements.find((a) => a.code === code);
              return (
                <View
                  key={code}
                  style={{
                    width: '30%',
                    alignItems: 'center',
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: unlocked ? colors.warning : colors.border,
                    backgroundColor: unlocked ? colors.bgSurface : colors.bgDeep,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>{meta.emoji}</Text>
                  <Text
                    style={{
                      ...typography.bodyBold,
                      color: unlocked ? colors.textPrimary : colors.textMuted,
                      fontSize: 11,
                      textAlign: 'center',
                    }}
                    numberOfLines={2}
                  >
                    {meta.label}
                  </Text>
                  {!unlocked && (
                    <Text
                      style={{
                        ...typography.body,
                        color: colors.textMuted,
                        fontSize: 9,
                        textAlign: 'center',
                        marginTop: 2,
                      }}
                      numberOfLines={2}
                    >
                      {meta.description}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
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
