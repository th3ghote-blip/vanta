/**
 * Alerts & Tips feed (in-app notifications).
 *
 * Reads /api/notifications, renders newest-first, and marks everything read on
 * open. This is where robot tips land — works on web and mobile (mobile push is
 * a bonus delivered on top, but the feed is the source of truth).
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Bell, TrendingUp } from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  symbol: string | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getNotifications();
      setItems(res.notifications ?? []);
      // Mark everything read once we've shown it.
      if ((res.notifications ?? []).some((n: Notification) => !n.read_at)) {
        api.markNotificationsRead().catch(() => {});
      }
    } catch {
      setError('Could not load alerts. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.md,
          borderBottomWidth: 1, borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Alerts & Tips
        </Text>
        <Bell size={18} color={colors.textSecondary} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.primary}
            />
          }
        >
          {error && (
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>{error}</Text>
          )}

          {!error && items.length === 0 && (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
              <Bell size={36} color={colors.textMuted} />
              <Text style={{ ...typography.bodyBold, color: colors.textMuted, fontSize: 15 }}>
                No alerts yet
              </Text>
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>
                Create a tip robot (e.g. "alert me when Bitcoin moves 3%") and its
                alerts will appear here.
              </Text>
            </View>
          )}

          {items.map((n) => (
            <View
              key={n.id}
              style={{
                backgroundColor: colors.bgElevated,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: n.read_at ? colors.border : colors.primary + '55',
                padding: spacing.md,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TrendingUp size={15} color={colors.primary} />
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, flex: 1 }}>
                  {n.title}
                </Text>
                {!!n.symbol && (
                  <View style={{ backgroundColor: colors.bgSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                    <Text style={{ ...typography.mono, color: colors.textSecondary, fontSize: 10 }}>{n.symbol}</Text>
                  </View>
                )}
              </View>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
                {n.body}
              </Text>
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
                {timeAgo(n.created_at)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
