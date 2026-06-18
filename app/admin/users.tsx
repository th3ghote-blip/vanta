import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Search, Users, ShieldCheck, ChevronRight } from 'lucide-react-native';

import { api, AdminUser } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

function fmt$(n: number | string) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '$0.00';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'K';
  return '$' + v.toFixed(2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

// 21.9 — margin level %: null (no open margin) → em dash.
function fmtMarginLevel(pct: number | null | undefined) {
  if (pct == null) return '—';
  return pct.toFixed(0) + '%';
}

// Colour the margin level: red below 100% (margin call), amber below 200%.
function marginLevelColor(pct: number | null | undefined) {
  if (pct == null) return colors.textSecondary;
  if (pct < 100) return colors.loss;
  if (pct < 200) return colors.warning ?? colors.textPrimary;
  return colors.profit ?? colors.textPrimary;
}

interface UserCardProps {
  user: AdminUser;
  onPress: () => void;
}

function UserCard({ user, onPress }: UserCardProps) {
  const primaryAccount = user.accounts?.[0];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.bgSurface : colors.bgElevated,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      })}
    >
      {/* Avatar circle */}
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 15 }}>
          {(user.display_name ?? user.email ?? '?')[0].toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>
            {user.display_name ?? 'Unknown'}
          </Text>
          {user.is_admin && (
            <View style={{
              backgroundColor: colors.primary + '22', borderRadius: 4,
              paddingHorizontal: 5, paddingVertical: 1,
            }}>
              <Text style={{ ...typography.body, color: colors.primary, fontSize: 10 }}>ADMIN</Text>
            </View>
          )}
        </View>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
          {user.email ?? 'No email'} · Joined {fmtDate(user.created_at)}
        </Text>
        {primaryAccount && (
          <>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
              #{primaryAccount.login} · {primaryAccount.type.toUpperCase()} · {fmt$(primaryAccount.balance)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                Equity {primaryAccount.equity != null ? fmt$(primaryAccount.equity) : fmt$(primaryAccount.balance)} · ML{' '}
              </Text>
              <Text style={{ ...typography.body, color: marginLevelColor(primaryAccount.margin_level_pct), fontSize: 12 }}>
                {fmtMarginLevel(primaryAccount.margin_level_pct)}
              </Text>
            </View>
          </>
        )}
      </View>

      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null);
  const [query, setQuery]         = useState('');
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── admin gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── initial load ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (q?: string) => {
    setError(null);
    try {
      const { users: result } = await api.adminSearchUsers(q);
      setUsers(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin === true) fetchUsers();
    else if (isAdmin === false) setLoading(false);
  }, [isAdmin, fetchUsers]);

  // ── search ────────────────────────────────────────────────────────────────
  const onSearch = useCallback(() => {
    setSearching(true);
    fetchUsers(query.trim() || undefined);
  }, [query, fetchUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers(query.trim() || undefined);
  }, [query, fetchUsers]);

  // ── guard screens ─────────────────────────────────────────────────────────
  if (isAdmin === null || (isAdmin === true && loading && users.length === 0)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isAdmin === false) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <ShieldCheck size={48} color={colors.loss} />
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, marginTop: spacing.md }}>
          Admin access required
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingTop: 56, paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.bgDeep,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Users size={18} color={colors.primary} />
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18 }}>
            User Search
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.bgDeep,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <View style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          backgroundColor: colors.bgElevated, borderRadius: radius.md,
          borderWidth: 1, borderColor: colors.border,
          paddingHorizontal: spacing.sm, paddingVertical: 8,
        }}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={{ flex: 1, ...typography.body, color: colors.textPrimary, fontSize: 14 }}
            placeholder="Login number or email..."
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={onSearch}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primary + 'cc' : colors.primary,
            borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9,
          })}
        >
          {searching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 14 }}>Search</Text>
          }
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error && (
          <View style={{
            backgroundColor: colors.loss + '22', borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.loss, padding: spacing.sm,
          }}>
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {users.length === 0 && !loading && !searching && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Users size={36} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
              {query ? 'No users found for that search.' : 'No users yet.'}
            </Text>
          </View>
        )}

        {users.map(u => (
          <UserCard
            key={u.id}
            user={u}
            onPress={() => router.push(`/admin/user/${u.id}` as any)}
          />
        ))}

        {users.length > 0 && (
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: spacing.sm }}>
            {users.length} result{users.length !== 1 ? 's' : ''}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
