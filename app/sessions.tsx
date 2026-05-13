import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Monitor, Smartphone, Tablet, Globe, Shield, LogOut, ChevronLeft, RefreshCw } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { getSessions, revokeSession, revokeOtherSessions, type DeviceSession } from '@/lib/api';

/** Parse user-agent into a friendly device label. */
function parseDevice(ua: string | null): { label: string; type: 'mobile' | 'tablet' | 'desktop' | 'web' } {
  if (!ua) return { label: 'Unknown device', type: 'web' };
  const u = ua.toLowerCase();
  if (u.includes('iphone') || u.includes('android') && !u.includes('tablet')) {
    const os = u.includes('iphone') ? 'iOS' : 'Android';
    const browser = u.includes('chrome') ? 'Chrome' : u.includes('safari') ? 'Safari' : 'Browser';
    return { label: `${browser} on ${os}`, type: 'mobile' };
  }
  if (u.includes('ipad') || u.includes('tablet')) {
    return { label: 'Tablet browser', type: 'tablet' };
  }
  if (u.includes('expo') || u.includes('okhttp') || u.includes('darwinapp')) {
    return { label: 'Vanta App', type: 'mobile' };
  }
  if (u.includes('windows')) return { label: 'Windows browser', type: 'desktop' };
  if (u.includes('mac os') || u.includes('macintosh')) return { label: 'Mac browser', type: 'desktop' };
  if (u.includes('linux')) return { label: 'Linux browser', type: 'desktop' };
  return { label: 'Web browser', type: 'web' };
}

function DeviceIcon({ type, color }: { type: 'mobile' | 'tablet' | 'desktop' | 'web'; color: string }) {
  const size = 22;
  if (type === 'mobile') return <Smartphone color={color} size={size} />;
  if (type === 'tablet') return <Tablet color={color} size={size} />;
  if (type === 'desktop') return <Monitor color={color} size={size} />;
  return <Globe color={color} size={size} />;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2) return 'Active now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, { data: sessionData }] = await Promise.all([
        getSessions(),
        supabase.auth.getSession(),
      ]);
      setSessions(list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      setCurrentSessionId(sessionData.session?.access_token
        ? null  // we don't have the session id from the token directly
        : null);
      // Try to match current session by recency -- most recently updated is current
      if (list.length > 0) {
        const sorted = [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setCurrentSessionId(sorted[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(sessionId: string) {
    if (sessionId === currentSessionId) {
      Alert.alert(
        'Sign out?',
        'This will sign you out of this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out',
            style: 'destructive',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            },
          },
        ]
      );
      return;
    }
    setRevoking((prev) => new Set(prev).add(sessionId));
    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevoking((prev) => { const next = new Set(prev); next.delete(sessionId); return next; });
    }
  }

  async function handleRevokeAll() {
    const otherCount = sessions.filter((s) => s.id !== currentSessionId).length;
    if (otherCount === 0) {
      Alert.alert('No other sessions', 'You are only signed in on this device.');
      return;
    }
    Alert.alert(
      'Sign out all other devices?',
      `This will revoke ${otherCount} other session${otherCount === 1 ? '' : 's'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others',
          style: 'destructive',
          onPress: async () => {
            setRevokingAll(true);
            try {
              await revokeOtherSessions(currentSessionId ?? '');
              setSessions((prev) => prev.filter((s) => s.id === currentSessionId));
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed');
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ]
    );
  }

  const otherCount = sessions.filter((s) => s.id !== currentSessionId).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xl,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft color={colors.textSecondary} size={22} />
        </Pressable>
        <Shield color={colors.primary} size={20} />
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 17, flex: 1 }}>
          Active Sessions
        </Text>
        <Pressable onPress={load} style={{ padding: 4 }}>
          <RefreshCw color={colors.textSecondary} size={18} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ ...typography.body, color: colors.textMuted, marginTop: spacing.sm }}>
            Loading sessions...
          </Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.loss, textAlign: 'center', marginBottom: spacing.md }}>
            {error}
          </Text>
          <Pressable
            onPress={load}
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {/* Info banner */}
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
              {sessions.length === 0
                ? 'No active sessions found.'
                : `${sessions.length} active session${sessions.length === 1 ? '' : 's'}. Revoking a session signs that device out immediately.`}
            </Text>
          </View>

          {/* Session cards */}
          {sessions.map((session) => {
            const isCurrent = session.id === currentSessionId;
            const { label, type } = parseDevice(session.user_agent);
            const isRevoking = revoking.has(session.id);
            return (
              <View
                key={session.id}
                style={{
                  backgroundColor: colors.bgElevated,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: isCurrent ? colors.primary : colors.border,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: isCurrent ? colors.primary + '22' : colors.bgSurface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <DeviceIcon type={type} color={isCurrent ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 15 }}>
                        {label}
                      </Text>
                      {isCurrent && (
                        <View
                          style={{
                            backgroundColor: colors.primary + '33',
                            borderRadius: radius.sm,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ ...typography.body, color: colors.primary, fontSize: 10 }}>
                            THIS DEVICE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      Last active: {formatDate(session.updated_at)}
                    </Text>
                    {session.ip && (
                      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }}>
                        IP: {session.ip}
                      </Text>
                    )}
                    {session.aal && session.aal === 'aal2' && (
                      <Text style={{ ...typography.body, color: colors.profit, fontSize: 12 }}>
                        2FA verified
                      </Text>
                    )}
                  </View>
                </View>

                <Pressable
                  onPress={() => handleRevoke(session.id)}
                  disabled={isRevoking}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: isCurrent ? colors.warning : colors.loss,
                    opacity: isRevoking ? 0.5 : 1,
                  }}
                >
                  {isRevoking ? (
                    <ActivityIndicator color={colors.loss} size="small" />
                  ) : (
                    <>
                      <LogOut color={isCurrent ? colors.warning : colors.loss} size={15} />
                      <Text
                        style={{
                          ...typography.bodyBold,
                          color: isCurrent ? colors.warning : colors.loss,
                          fontSize: 13,
                        }}
                      >
                        {isCurrent ? 'Sign out this device' : 'Revoke'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          })}

          {/* Revoke all others */}
          {otherCount > 0 && (
            <Pressable
              onPress={handleRevokeAll}
              disabled={revokingAll}
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
                opacity: revokingAll ? 0.5 : 1,
              }}
            >
              {revokingAll ? (
                <ActivityIndicator color={colors.loss} size="small" />
              ) : (
                <>
                  <Shield color={colors.textSecondary} size={16} />
                  <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 14 }}>
                    Sign out all other devices ({otherCount})
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
