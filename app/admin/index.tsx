import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Wallet,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  FileText,
  ChevronRight,
  Activity,
  DollarSign,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

interface DashboardData {
  total_users: number;
  active_accounts: number;
  total_deposits: number;
  open_trades: number;
  total_exposure: number;
  health: { status: string; server_time: string };
}

function fmt$(n: number) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent }: StatCardProps) {
  const accentColor = accent ?? colors.primary;
  return (
    <View style={{
      flex: 1, minWidth: '47%',
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.xs,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
          {label}
        </Text>
      </View>
      <Text style={{ ...typography.bodyBold, color: accentColor, fontSize: 22 }}>
        {value}
      </Text>
      {!!sub && (
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
          {sub}
        </Text>
      )}
    </View>
  );
}

interface NavRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

function NavRow({ icon, label, onPress }: NavRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: pressed ? colors.bgSurface : colors.bgElevated,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
        gap: spacing.sm,
      })}
    >
      {icon}
      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, flex: 1 }}>
        {label}
      </Text>
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [loading, setLoading]       = useState(true);
  const [isAdmin, setIsAdmin]       = useState<boolean | null>(null);
  const [data, setData]             = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── load dashboard ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.adminGetDashboard();
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin === true) load();
    else if (isAdmin === false) setLoading(false);
  }, [isAdmin, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // ── render: guard ─────────────────────────────────────────────────────────
  if (isAdmin === null || (isAdmin === true && loading && !data)) {
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
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, marginTop: spacing.md, textAlign: 'center' }}>
          Admin access required
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
          Your account does not have administrator privileges.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isHealthy = data?.health?.status === 'ok';

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
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Admin Dashboard
        </Text>
        {/* Health indicator */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: (isHealthy ? colors.profit : colors.loss) + '22',
          borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3,
          borderWidth: 1, borderColor: isHealthy ? colors.profit : colors.loss,
        }}>
          <Activity size={11} color={isHealthy ? colors.profit : colors.loss} />
          <Text style={{ ...typography.body, color: isHealthy ? colors.profit : colors.loss, fontSize: 11 }}>
            {isHealthy ? 'Online' : 'Degraded'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {error && (
          <View style={{
            backgroundColor: colors.loss + '22', borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.loss,
            padding: spacing.sm,
          }}>
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Stats grid */}
        {data && (
          <>
            <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
              Platform overview
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <StatCard
                icon={<Users size={14} color={colors.primary} />}
                label="Total Users"
                value={fmtNum(data.total_users)}
                accent={colors.primary}
              />
              <StatCard
                icon={<Wallet size={14} color={colors.primary} />}
                label="Accounts"
                value={fmtNum(data.active_accounts)}
                accent={colors.primary}
              />
              <StatCard
                icon={<DollarSign size={14} color={colors.profit} />}
                label="Total Deposits"
                value={fmt$(data.total_deposits)}
                sub="Completed deposits"
                accent={colors.profit}
              />
              <StatCard
                icon={<TrendingUp size={14} color={colors.warning ?? colors.primary} />}
                label="Open Trades"
                value={fmtNum(data.open_trades)}
                accent={colors.warning ?? colors.primary}
              />
              <StatCard
                icon={<BarChart2 size={14} color={colors.loss} />}
                label="Total Exposure"
                value={fmt$(data.total_exposure)}
                sub="Sum of open notionals"
                accent={colors.loss}
              />
            </View>

            {/* Server time */}
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, textAlign: 'right' }}>
              Last updated: {fmtTime(data.health.server_time)}
            </Text>
          </>
        )}

        {/* Navigation */}
        <Text style={{ ...typography.bodyBold, color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.sm }}>
          Admin tools
        </Text>

        <View style={{ gap: spacing.sm }}>
          <NavRow
            icon={<FileText size={18} color={colors.primary} />}
            label="Transaction Approvals"
            onPress={() => router.push('/admin/transactions')}
          />
          <NavRow
            icon={<ShieldCheck size={18} color={colors.primary} />}
            label="KYC Review"
            onPress={() => router.push('/admin/kyc')}
          />
        </View>
      </ScrollView>
    </View>
  );
}
