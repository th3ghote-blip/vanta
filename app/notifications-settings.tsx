import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Bell, TrendingUp, Bot, Gift } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, NotificationPrefs } from '@/lib/api';

const DEFAULT_PREFS: NotificationPrefs = {
  price_alerts: true,
  robot_signals: true,
  trade_results: true,
  promotional: true,
};

interface PrefRow {
  key: keyof NotificationPrefs;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const ROWS: PrefRow[] = [
  {
    key: 'trade_results',
    label: 'Trade Results',
    sublabel: 'Notify when a trade closes (SL, TP, or manual close)',
    icon: <TrendingUp color={colors.profit} size={20} />,
  },
  {
    key: 'price_alerts',
    label: 'Price Alerts',
    sublabel: 'Notify when a price alert you set is triggered',
    icon: <Bell color={colors.warning} size={20} />,
  },
  {
    key: 'robot_signals',
    label: 'Robot Signals',
    sublabel: 'Notify when an AI robot fires a tip signal',
    icon: <Bot color={colors.primary} size={20} />,
  },
  {
    key: 'promotional',
    label: 'Promotions',
    sublabel: 'Bonuses, special events, and platform news',
    icon: <Gift color={colors.textSecondary} size={20} />,
  },
];

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);

  useEffect(() => {
    api.getNotificationPrefs()
      .then((p) => setPrefs(p))
      .catch(() => {/* silently use defaults */})
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    // Optimistic update
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaving(key);
    try {
      const { profile } = await api.updateNotificationPrefs({ [key]: value });
      const updated = { ...DEFAULT_PREFS, ...(profile.notification_prefs ?? {}) };
      setPrefs(updated);
    } catch {
      // Roll back on failure
      setPrefs((prev) => ({ ...prev, [key]: !value }));
    } finally {
      setSaving(null);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingTop: 56,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          backgroundColor: colors.bgDeep,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color={colors.textPrimary} size={24} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 17 }}>
          Notifications
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            Choose which push notifications you receive. Changes take effect immediately.
          </Text>

          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {ROWS.map((row, idx) => (
              <View
                key={row.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderBottomWidth: idx < ROWS.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                  opacity: saving === row.key ? 0.6 : 1,
                }}
              >
                {row.icon}
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 15 }}>
                    {row.label}
                  </Text>
                  <Text
                    style={{
                      ...typography.body,
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {row.sublabel}
                  </Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={(val) => toggle(row.key, val)}
                  disabled={saving !== null}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>

          <Text
            style={{
              ...typography.body,
              color: colors.textMuted,
              fontSize: 11,
              textAlign: 'center',
              marginTop: spacing.sm,
            }}
          >
            You must have notifications enabled in your device settings for these to work.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
