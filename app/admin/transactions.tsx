import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ArrowDownCircle,
  ArrowUpCircle,
  Gift,
  SlidersHorizontal,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

type TxStatus = 'pending' | 'completed' | 'rejected' | 'all';

interface TxRow {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bonus' | 'adjustment';
  amount: string;
  currency: string;
  status: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  accounts: {
    id: string;
    user_id: string;
    balance: string;
    type: string;
    currency: string;
  };
}

const STATUS_TABS: { label: string; value: TxStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

function typeIcon(type: string) {
  const sz = 16;
  switch (type) {
    case 'deposit':    return <ArrowDownCircle size={sz} color={colors.profit} />;
    case 'withdrawal': return <ArrowUpCircle size={sz} color={colors.loss} />;
    case 'bonus':      return <Gift size={sz} color={colors.primary} />;
    default:           return <SlidersHorizontal size={sz} color={colors.textSecondary} />;
  }
}

function statusColor(s: string) {
  if (s === 'completed') return colors.profit;
  if (s === 'rejected')  return colors.loss;
  return colors.textSecondary;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function shortId(id: string) {
  return id.slice(0, 8) + '…';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminTransactions() {
  const [loading, setLoading]     = useState(true);
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null);
  const [filter, setFilter]       = useState<TxStatus>('pending');
  const [txs, setTxs]             = useState<TxRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reject-reason modal
  const [rejectModal, setRejectModal]   = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── data load ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { transactions } = await api.adminGetTransactions(filter);
      setTxs(transactions as TxRow[]);
    } catch {
      setTxs([]);
    }
  }, [filter]);

  useEffect(() => {
    if (isAdmin !== true) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    setActionLoading(id + ':approve');
    try {
      const { balance_delta } = await api.adminApproveTransaction(id);
      const sign = balance_delta >= 0 ? '+' : '';
      Alert.alert('Approved', `Balance updated ${sign}$${Math.abs(balance_delta).toFixed(2)}`);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id + ':reject');
    setRejectModal(null);
    try {
      await api.adminRejectTransaction(rejectModal.id, rejectReason || undefined);
      setRejectReason('');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isAdmin === false) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <ShieldAlert size={48} color={colors.loss} />
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, marginTop: spacing.md, textAlign: 'center' }}>
          Access Denied
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
          You need admin privileges to view this page.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
            backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ ...typography.body, color: colors.textPrimary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: spacing.md,
        paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.bgElevated, gap: spacing.sm,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 18, flex: 1 }}>
          Transaction Approvals
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
          {txs.length} rows
        </Text>
      </View>

      {/* Status filter tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        gap: spacing.xs, backgroundColor: colors.bgElevated, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {STATUS_TABS.map(tab => (
          <Pressable
            key={tab.value}
            onPress={() => setFilter(tab.value)}
            style={{
              flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center',
              backgroundColor: filter === tab.value ? colors.primary : colors.bg,
              borderWidth: 1, borderColor: filter === tab.value ? colors.primary : colors.border,
            }}
          >
            <Text style={{ ...typography.body, fontSize: 12,
              color: filter === tab.value ? '#fff' : colors.textSecondary }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {txs.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <CheckCircle2 size={40} color={colors.border} />
              <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
                No {filter === 'all' ? '' : filter} transactions
              </Text>
            </View>
          )}

          {txs.map(tx => {
            const isPending = tx.status === 'pending';
            const approving = actionLoading === tx.id + ':approve';
            const rejecting = actionLoading === tx.id + ':reject';
            const busy = approving || rejecting;

            return (
              <View
                key={tx.id}
                style={{
                  backgroundColor: colors.bgElevated, borderRadius: radius.lg,
                  borderWidth: 1, borderColor: isPending ? colors.primary + '44' : colors.border,
                  padding: spacing.md, gap: spacing.sm,
                }}
              >
                {/* Row 1: type + amount + status */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {typeIcon(tx.type)}
                  <Text style={{ ...typography.bodyBold, color: colors.textPrimary, flex: 1, textTransform: 'capitalize' }}>
                    {tx.type}
                  </Text>
                  <Text style={{ ...typography.bodyBold, color: tx.type === 'withdrawal' ? colors.loss : colors.profit, fontSize: 16 }}>
                    {tx.type === 'withdrawal' ? '-' : '+'}${Number(tx.amount).toFixed(2)}
                  </Text>
                </View>

                {/* Row 2: metadata */}
                <View style={{ gap: 3 }}>
                  <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                    TX <Text style={{ color: colors.textPrimary }}>{shortId(tx.id)}</Text>
                    {'  ·  '}Account <Text style={{ color: colors.textPrimary }}>{shortId(tx.accounts.id)}</Text>
                  </Text>
                  {tx.method && (
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                      Method: <Text style={{ color: colors.textPrimary }}>{tx.method}</Text>
                    </Text>
                  )}
                  {tx.reference && (
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }} numberOfLines={2}>
                      Dest: <Text style={{ color: colors.textPrimary }}>{tx.reference}</Text>
                    </Text>
                  )}
                  <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                    Balance: <Text style={{ color: colors.textPrimary }}>${Number(tx.accounts.balance).toFixed(2)}</Text>
                    {'  ·  '}
                    <Text style={{ color: statusColor(tx.status), textTransform: 'capitalize' }}>{tx.status}</Text>
                    {'  ·  '}{fmtDate(tx.created_at)}
                  </Text>
                  {tx.notes && (
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, fontStyle: 'italic' }} numberOfLines={2}>
                      {tx.notes}
                    </Text>
                  )}
                </View>

                {/* Actions (pending only) */}
                {isPending && (
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <Pressable
                      onPress={() => handleApprove(tx.id)}
                      disabled={busy}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        paddingVertical: 10, borderRadius: radius.md, gap: 6,
                        backgroundColor: busy ? colors.border : colors.profit + '22',
                        borderWidth: 1, borderColor: busy ? colors.border : colors.profit,
                      }}
                    >
                      {approving
                        ? <ActivityIndicator size="small" color={colors.profit} />
                        : <CheckCircle2 size={15} color={colors.profit} />}
                      <Text style={{ ...typography.bodyBold, color: colors.profit, fontSize: 13 }}>Approve</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => { setRejectReason(''); setRejectModal({ id: tx.id }); }}
                      disabled={busy}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        paddingVertical: 10, borderRadius: radius.md, gap: 6,
                        backgroundColor: busy ? colors.border : colors.loss + '22',
                        borderWidth: 1, borderColor: busy ? colors.border : colors.loss,
                      }}
                    >
                      {rejecting
                        ? <ActivityIndicator size="small" color={colors.loss} />
                        : <XCircle size={15} color={colors.loss} />}
                      <Text style={{ ...typography.bodyBold, color: colors.loss, fontSize: 13 }}>Reject</Text>
                    </Pressable>
                  </View>
                )}

                {/* Settled indicator */}
                {!isPending && tx.completed_at && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} color={colors.textSecondary} />
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                      Settled {fmtDate(tx.completed_at)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Reject reason modal */}
      <Modal
        visible={!!rejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModal(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
          onPress={() => setRejectModal(null)}
        >
          <Pressable
            style={{ backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: spacing.lg,
              width: '100%', gap: spacing.md, borderWidth: 1, borderColor: colors.border }}
            onPress={() => {}}
          >
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 16 }}>
              Reject Transaction
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
              Optional: add a reason (visible in transaction notes).
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Incomplete bank details"
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm,
                color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
                ...typography.body,
              }}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setRejectModal(null)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
                  backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ ...typography.body, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRejectConfirm}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
                  backgroundColor: colors.loss + '22', borderWidth: 1, borderColor: colors.loss }}
              >
                <Text style={{ ...typography.bodyBold, color: colors.loss }}>Confirm Reject</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
