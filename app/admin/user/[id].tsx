import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Clipboard,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft,
  ShieldCheck,
  ArrowDownCircle,
  ArrowUpCircle,
  LogIn,
  SlidersHorizontal,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

function fmt$(n: number | string) {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '$0.00';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'K';
  return '$' + v.toFixed(2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── mini components ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={{
      ...typography.bodyBold, color: colors.textSecondary,
      fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
      marginTop: spacing.md, marginBottom: spacing.xs,
    }}>
      {label}
    </Text>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border,
    }}>
      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{
        ...(mono ? { fontFamily: 'monospace' } : typography.bodyBold),
        color: colors.textPrimary, fontSize: 13, maxWidth: '60%', textAlign: 'right',
      }}>
        {value}
      </Text>
    </View>
  );
}

function KycBadge({ status }: { status: string }) {
  const color = status === 'approved' ? colors.profit : status === 'rejected' ? colors.loss : (colors as any).warning ?? colors.primary;
  return (
    <View style={{
      backgroundColor: color + '22', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2,
      borderWidth: 1, borderColor: color, alignSelf: 'flex-start',
    }}>
      <Text style={{ ...typography.bodyBold, color, fontSize: 11 }}>{status.toUpperCase()}</Text>
    </View>
  );
}

// ── AdjustBalanceModal ────────────────────────────────────────────────────────

interface AdjustModalProps {
  visible: boolean;
  account: any | null;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

function AdjustBalanceModal({ visible, account, onClose, onSuccess }: AdjustModalProps) {
  const [amount, setAmount]   = useState('');
  const [reason, setReason]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const reasonRef             = useRef<TextInput>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAmount('');
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsed) || parsed === 0) {
      setError('Enter a non-zero amount (negative to debit).');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for audit purposes.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.adminAdjustBalance(account.id, parsed, reason.trim());
      onSuccess(res.new_balance);
      onClose();
    } catch (e: any) {
      const code = e?.code ?? '';
      if (code === 'insufficient_balance') {
        setError(`Insufficient balance. Current: ${fmt$(e?.current ?? 0)}`);
      } else if (code === 'invalid_amount') {
        setError('Invalid amount.');
      } else if (code === 'reason_required') {
        setError('Reason is required.');
      } else {
        setError(e?.message ?? 'Adjustment failed. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [amount, reason, account, onClose, onSuccess]);

  const currentBalance = account ? parseFloat(account.balance ?? '0') : 0;
  const parsedAmount   = parseFloat(amount.replace(/,/g, ''));
  const preview        = isNaN(parsedAmount) ? null : currentBalance + parsedAmount;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <View style={{
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          padding: spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : spacing.lg,
          borderTopWidth: 1, borderColor: colors.border,
        }}>
          {/* Title */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 17 }}>
              Adjust Balance
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>Cancel</Text>
            </Pressable>
          </View>

          {account && (
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md }}>
              Account #{account.login} · Current balance: {fmt$(account.balance)}
            </Text>
          )}

          {/* Amount input */}
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
            AMOUNT (use − for debit, e.g. −500)
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 250 or -100"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
            onSubmitEditing={() => reasonRef.current?.focus()}
            style={{
              ...typography.body,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: 15,
              marginBottom: spacing.sm,
            }}
          />

          {/* Preview */}
          {preview !== null && (
            <Text style={{
              ...typography.body, fontSize: 12, marginBottom: spacing.sm,
              color: preview < 0 ? colors.loss : colors.textSecondary,
            }}>
              New balance: {fmt$(preview)}{preview < 0 ? ' — will be rejected' : ''}
            </Text>
          )}

          {/* Reason input */}
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
            REASON (required for audit log)
          </Text>
          <TextInput
            ref={reasonRef}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Bonus credit, correction, promotional"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            style={{
              ...typography.body,
              color: colors.textPrimary,
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: 14,
              marginBottom: spacing.sm,
            }}
          />

          {/* Error */}
          {error && (
            <Text style={{ ...typography.body, color: colors.loss, fontSize: 13, marginBottom: spacing.sm }}>
              {error}
            </Text>
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={busy}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
              opacity: busy || pressed ? 0.6 : 1,
              marginTop: spacing.xs,
            })}
          >
            {busy
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 15 }}>Apply Adjustment</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isAdmin, setIsAdmin]         = useState<boolean | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [data, setData]               = useState<any | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);

  // Adjust modal state
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);

  // ── admin gate ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── load user ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const result = await api.adminGetUser(id);
      setData(result);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load user');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin === true) load();
    else if (isAdmin === false) setLoading(false);
  }, [isAdmin, load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // ── impersonation ─────────────────────────────────────────────────────────
  const handleImpersonate = useCallback(async () => {
    if (!id) return;
    Alert.alert(
      'Generate impersonation link?',
      'A one-time magic link will be generated for this user. Only use this for support purposes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'destructive',
          onPress: async () => {
            setImpersonating(true);
            try {
              const { magic_link, email } = await api.adminImpersonate(id);
              const link = magic_link ?? 'Link unavailable';
              Clipboard.setString(link);
              Alert.alert(
                'Magic link generated',
                `Copied to clipboard.\n\nEmail: ${email}\n\nLink:\n${link.substring(0, 80)}...`,
                [{ text: 'OK' }],
              );
            } catch (e: any) {
              const msg = e?.code === 'cannot_impersonate_admin'
                ? 'Cannot impersonate an admin account.'
                : e?.message ?? 'Failed to generate link';
              Alert.alert('Error', msg);
            } finally {
              setImpersonating(false);
            }
          },
        },
      ],
    );
  }, [id]);

  // ── balance adjustment success ────────────────────────────────────────────
  const handleAdjustSuccess = useCallback((accountId: string, newBalance: number) => {
    setData((prev: any) => {
      if (!prev) return prev;
      const accounts = (prev.accounts ?? []).map((a: any) =>
        a.id === accountId ? { ...a, balance: String(newBalance) } : a
      );
      return { ...prev, accounts };
    });
    Alert.alert('Balance adjusted', `New balance: ${fmt$(newBalance)}`);
  }, []);

  // ── guards ────────────────────────────────────────────────────────────────
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
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, marginTop: spacing.md }}>Admin access required</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const profile = data?.profile ?? {};
  const accounts: any[] = data?.accounts ?? [];
  const trades: any[] = data?.trades ?? [];
  const transactions: any[] = data?.transactions ?? [];
  const kyc: any[] = data?.kyc ?? [];

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.primary + '22', alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 14 }}>
              {(profile.display_name ?? profile.email ?? '?')[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 17, flex: 1 }} numberOfLines={1}>
            {profile.display_name ?? profile.email ?? 'User'}
          </Text>
        </View>
        {/* Impersonate button */}
        <Pressable
          onPress={handleImpersonate}
          disabled={impersonating}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: pressed ? colors.bgSurface : colors.bgElevated,
            borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6,
            borderWidth: 1, borderColor: colors.border,
            opacity: impersonating ? 0.5 : 1,
          })}
        >
          {impersonating
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <LogIn size={14} color={colors.primary} />
          }
          <Text style={{ ...typography.body, color: colors.primary, fontSize: 12 }}>View as user</Text>
        </Pressable>
      </View>

      {error && (
        <View style={{ margin: spacing.md, backgroundColor: colors.loss + '22', borderRadius: radius.md, borderWidth: 1, borderColor: colors.loss, padding: spacing.sm }}>
          <Text style={{ ...typography.body, color: colors.loss, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Profile */}
        <SectionHeader label="Profile" />
        <View style={{ backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md }}>
          <InfoRow label="Display name" value={profile.display_name ?? '—'} />
          <InfoRow label="Email" value={profile.email ?? '—'} />
          <InfoRow label="User ID" value={profile.id ?? '—'} mono />
          <InfoRow label="Joined" value={profile.created_at ? fmtDate(profile.created_at) : '—'} />
          <InfoRow label="Admin" value={profile.is_admin ? 'Yes' : 'No'} />
        </View>

        {/* Accounts */}
        <SectionHeader label={`Accounts (${accounts.length})`} />
        {accounts.length === 0
          ? <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>No trading accounts found for this user.</Text>
          : accounts.map((acc: any) => (
            <View key={acc.id} style={{ backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
              <InfoRow label="Login #" value={String(acc.login ?? '—')} mono />
              <InfoRow label="Type" value={acc.type?.toUpperCase() ?? '—'} />
              <InfoRow label="Status" value={acc.status ?? '—'} />
              <InfoRow label="Balance" value={fmt$(acc.balance)} />
              <InfoRow label="Free margin" value={fmt$(acc.free_margin)} />
              <InfoRow label="Leverage" value={`1:${acc.leverage ?? 100}`} />
              {/* Adjust balance button */}
              <Pressable
                onPress={() => setAdjustTarget(acc)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: spacing.sm, marginBottom: spacing.sm,
                  backgroundColor: pressed ? colors.bgSurface : colors.bgDeep,
                  borderRadius: radius.sm, paddingVertical: 8,
                  borderWidth: 1, borderColor: colors.border,
                })}
              >
                <SlidersHorizontal size={14} color={colors.primary} />
                <Text style={{ ...typography.body, color: colors.primary, fontSize: 13 }}>Adjust Balance</Text>
              </Pressable>
            </View>
          ))
        }

        {/* KYC */}
        <SectionHeader label="KYC" />
        {kyc.length === 0
          ? <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>User has not submitted KYC documents yet.</Text>
          : kyc.map((k: any) => (
            <View key={k.id} style={{ backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
                  {k.submitted_at ? fmtDate(k.submitted_at) : fmtDate(k.created_at ?? '')}
                </Text>
                <KycBadge status={k.status} />
              </View>
              {k.rejection_reason && (
                <Text style={{ ...typography.body, color: colors.loss, fontSize: 12 }}>Reason: {k.rejection_reason}</Text>
              )}
            </View>
          ))
        }

        {/* Recent trades */}
        <SectionHeader label={`Recent Trades (${Math.min(trades.length, 50)})`} />
        {trades.length === 0
          ? <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>No trades placed on this account yet.</Text>
          : (
            <View style={{ backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {trades.slice(0, 20).map((t: any, i: number) => {
                const profit = parseFloat(t.profit ?? '0');
                const isOpen = t.status === 'open';
                return (
                  <View key={t.id} style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8,
                    borderBottomWidth: i < Math.min(trades.length, 20) - 1 ? 1 : 0, borderBottomColor: colors.border,
                  }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
                        {t.symbol} <Text style={{ color: t.side === 'buy' ? colors.profit : colors.loss }}>{t.side.toUpperCase()}</Text>
                        {' '}<Text style={{ color: colors.textSecondary }}>×{t.volume}</Text>
                      </Text>
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                        {fmtDateTime(t.open_time)} · {isOpen ? 'OPEN' : 'closed'}
                      </Text>
                    </View>
                    <Text style={{ ...typography.bodyBold, color: isOpen ? colors.textSecondary : profit >= 0 ? colors.profit : colors.loss, fontSize: 13 }}>
                      {isOpen ? '—' : (profit >= 0 ? '+' : '') + fmt$(profit)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )
        }

        {/* Recent transactions */}
        <SectionHeader label={`Transactions (${Math.min(transactions.length, 50)})`} />
        {transactions.length === 0
          ? <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>No deposits or withdrawals on this account yet.</Text>
          : (
            <View style={{ backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 20 }}>
              {transactions.slice(0, 20).map((tx: any, i: number) => {
                const isDeposit = tx.type === 'deposit' || tx.type === 'bonus' || tx.type === 'adjustment';
                const Icon = isDeposit ? ArrowDownCircle : ArrowUpCircle;
                const iconColor = isDeposit ? colors.profit : colors.loss;
                return (
                  <View key={tx.id} style={{
                    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 8,
                    borderBottomWidth: i < Math.min(transactions.length, 20) - 1 ? 1 : 0, borderBottomColor: colors.border,
                    gap: spacing.sm,
                  }}>
                    <Icon size={18} color={iconColor} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
                        {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                        {' '}<Text style={{ color: colors.textSecondary, fontWeight: 'normal' }}>{tx.method ?? ''}</Text>
                      </Text>
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                        {fmtDateTime(tx.created_at)} · {tx.status}
                      </Text>
                    </View>
                    <Text style={{ ...typography.bodyBold, color: isDeposit ? colors.profit : colors.loss, fontSize: 13 }}>
                      {isDeposit ? '+' : '-'}{fmt$(tx.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )
        }
      </ScrollView>

      {/* Balance adjustment modal */}
      <AdjustBalanceModal
        visible={adjustTarget !== null}
        account={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSuccess={(newBalance) => {
          if (adjustTarget) handleAdjustSuccess(adjustTarget.id, newBalance);
          setAdjustTarget(null);
        }}
      />
    </View>
  );
}
