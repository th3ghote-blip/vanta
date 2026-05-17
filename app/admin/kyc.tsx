/**
 * app/admin/kyc.tsx — Phase 5.2
 *
 * Admin screen for reviewing KYC submissions.
 * Shows queue of pending submissions with document thumbnails.
 * Approve or reject with optional reason.
 */
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
  Image,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  FileText,
  User,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react-native';

import { api } from '@/lib/api';
import { colors, radius, spacing, typography } from '@/lib/theme';

type KycStatus = 'pending' | 'approved' | 'rejected' | 'all';

interface KycDoc {
  id: string;
  doc_type: 'id_front' | 'id_back' | 'selfie' | 'proof_of_address';
  storage_path: string;
  uploaded_at: string;
  signed_url: string | null;
}

interface KycSubmission {
  id: string;
  user_id: string;
  status: string;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  kyc_documents: KycDoc[];
}

const STATUS_TABS: { label: string; value: KycStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

const DOC_LABELS: Record<string, string> = {
  id_front: 'ID Front',
  id_back: 'ID Back',
  selfie: 'Selfie',
  proof_of_address: 'Proof of Address',
};

function statusColor(s: string) {
  if (s === 'approved') return colors.profit;
  if (s === 'rejected') return colors.loss;
  if (s === 'pending') return colors.warning;
  return colors.textSecondary;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function shortId(id: string) {
  return id.slice(0, 8) + '…';
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminKyc() {
  const [loading, setLoading]     = useState(true);
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null);
  const [filter, setFilter]       = useState<KycStatus>('pending');
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [refreshing, setRefreshing]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());

  // Reject reason modal
  const [rejectModal, setRejectModal]   = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── admin check ───────────────────────────────────────────────────────────
  useEffect(() => {
    api.getProfile()
      .then(({ profile }) => setIsAdmin(Boolean(profile.is_admin)))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── data load ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { submissions: data } = await api.adminGetKycSubmissions(filter);
      setSubmissions(data as KycSubmission[]);
    } catch {
      setSubmissions([]);
    }
  }, [filter]);

  useEffect(() => {
    if (isAdmin !== true) return;
    setLoading(true);
    setExpanded(new Set()); // collapse on filter change
    load().finally(() => setLoading(false));
  }, [isAdmin, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── expand/collapse ───────────────────────────────────────────────────────
  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── actions ───────────────────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    setActionLoading(id + ':approve');
    try {
      await api.adminApproveKyc(id);
      Alert.alert('Approved', 'KYC submission has been approved. User can now withdraw.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    const { id } = rejectModal;
    setActionLoading(id + ':reject');
    setRejectModal(null);
    try {
      await api.adminRejectKyc(id, rejectReason || undefined);
      setRejectReason('');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  // ── guards ────────────────────────────────────────────────────────────────
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

  // ── render ────────────────────────────────────────────────────────────────
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
          KYC Review
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
          {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Status filter tabs */}
      <View style={{
        flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        gap: spacing.xs, backgroundColor: colors.bgElevated,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        {STATUS_TABS.map(tab => (
          <Pressable
            key={tab.value}
            onPress={() => setFilter(tab.value)}
            style={{
              flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center',
              backgroundColor: filter === tab.value ? colors.primary : colors.bgSurface,
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
          {submissions.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
              <FileText size={40} color={colors.border} />
              <Text style={{ ...typography.bodyBold, color: colors.textSecondary, marginTop: spacing.sm }}>
                No {filter === 'all' ? '' : filter + ' '}submissions
              </Text>
              <Text style={{ ...typography.body, color: colors.textMuted, textAlign: 'center', fontSize: 13 }}>
                {filter === 'pending'
                  ? 'KYC submissions appear here when users complete verification.'
                  : filter === 'approved'
                  ? 'No approved submissions yet.'
                  : filter === 'rejected'
                  ? 'No rejected submissions on record.'
                  : 'No KYC submissions have been created yet.'}
              </Text>
            </View>
          )}

          {submissions.map(sub => {
            const isPending = sub.status === 'pending';
            const isExp = expanded.has(sub.id);
            const approving = actionLoading === sub.id + ':approve';
            const rejecting = actionLoading === sub.id + ':reject';
            const busy = approving || rejecting;
            const docCount = sub.kyc_documents.length;

            return (
              <View
                key={sub.id}
                style={{
                  backgroundColor: colors.bgElevated, borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: isPending ? colors.warning + '55' : sub.status === 'approved' ? colors.profit + '44' : colors.border,
                  overflow: 'hidden',
                }}
              >
                {/* Summary row — tap to expand */}
                <Pressable
                  onPress={() => toggleExpanded(sub.id)}
                  style={{ padding: spacing.md, gap: spacing.sm }}
                >
                  {/* Row 1: user icon + user_id + status badge */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <User size={16} color={colors.textSecondary} />
                    <Text style={{ ...typography.bodyBold, color: colors.textPrimary, flex: 1 }}>
                      {shortId(sub.user_id)}
                    </Text>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
                      backgroundColor: statusColor(sub.status) + '22',
                      borderWidth: 1, borderColor: statusColor(sub.status) + '88',
                    }}>
                      <Text style={{ ...typography.body, fontSize: 11, color: statusColor(sub.status), textTransform: 'capitalize' }}>
                        {sub.status}
                      </Text>
                    </View>
                    {isExp
                      ? <ChevronUp size={16} color={colors.textSecondary} />
                      : <ChevronDown size={16} color={colors.textSecondary} />}
                  </View>

                  {/* Row 2: dates + doc count */}
                  <View style={{ gap: 3 }}>
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                      Submitted: <Text style={{ color: colors.textPrimary }}>{fmtDate(sub.submitted_at)}</Text>
                    </Text>
                    {sub.reviewed_at && (
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                        Reviewed: <Text style={{ color: colors.textPrimary }}>{fmtDate(sub.reviewed_at)}</Text>
                      </Text>
                    )}
                    {sub.rejection_reason && (
                      <Text style={{ ...typography.body, color: colors.loss, fontSize: 12 }} numberOfLines={2}>
                        Reason: {sub.rejection_reason}
                      </Text>
                    )}
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                      Documents: <Text style={{ color: docCount === 4 ? colors.profit : colors.warning }}>
                        {docCount}/4
                      </Text>
                      {'  ·  '}ID: <Text style={{ color: colors.textMuted }}>{shortId(sub.id)}</Text>
                    </Text>
                  </View>
                </Pressable>

                {/* Expanded: document thumbnails + actions */}
                {isExp && (
                  <View style={{
                    borderTopWidth: 1, borderTopColor: colors.border,
                    padding: spacing.md, gap: spacing.md,
                  }}>
                    {/* Documents grid */}
                    <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
                      Documents
                    </Text>

                    {docCount === 0 ? (
                      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                        No documents uploaded.
                      </Text>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        {(['id_front', 'id_back', 'selfie', 'proof_of_address'] as const).map(docType => {
                          const doc = sub.kyc_documents.find(d => d.doc_type === docType);
                          return (
                            <View
                              key={docType}
                              style={{
                                width: '47%', borderRadius: radius.md,
                                backgroundColor: colors.bgSurface,
                                borderWidth: 1, borderColor: doc ? colors.border : colors.border + '44',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Image or placeholder */}
                              {doc?.signed_url ? (
                                <Pressable onPress={() => doc.signed_url && Linking.openURL(doc.signed_url)}>
                                  <Image
                                    source={{ uri: doc.signed_url }}
                                    style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.bgDeep }}
                                    resizeMode="cover"
                                  />
                                  <View style={{
                                    position: 'absolute', bottom: 28, right: 6,
                                    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.sm,
                                    padding: 4,
                                  }}>
                                    <Eye size={12} color="#fff" />
                                  </View>
                                </Pressable>
                              ) : (
                                <View style={{
                                  width: '100%', aspectRatio: 4 / 3,
                                  alignItems: 'center', justifyContent: 'center',
                                  backgroundColor: colors.bgDeep,
                                }}>
                                  <FileText size={24} color={colors.textMuted} />
                                </View>
                              )}
                              {/* Label */}
                              <View style={{ padding: 6 }}>
                                <Text style={{ ...typography.body, color: doc ? colors.textPrimary : colors.textMuted, fontSize: 11 }}>
                                  {DOC_LABELS[docType]}
                                </Text>
                                {doc && (
                                  <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 10 }}>
                                    {fmtDate(doc.uploaded_at)}
                                  </Text>
                                )}
                                {!doc && (
                                  <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10 }}>
                                    Not uploaded
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Approve / Reject actions (pending only) */}
                    {isPending && (
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                        <Pressable
                          onPress={() => handleApprove(sub.id)}
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
                          <Text style={{ ...typography.bodyBold, color: colors.profit, fontSize: 13 }}>
                            Approve
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => { setRejectReason(''); setRejectModal({ id: sub.id }); }}
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
                          <Text style={{ ...typography.bodyBold, color: colors.loss, fontSize: 13 }}>
                            Reject
                          </Text>
                        </Pressable>
                      </View>
                    )}

                    {/* Settled indicator for non-pending */}
                    {!isPending && sub.reviewed_at && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} color={colors.textSecondary} />
                        <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                          {sub.status === 'approved' ? 'Approved' : 'Rejected'} {fmtDate(sub.reviewed_at)}
                        </Text>
                      </View>
                    )}
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
            style={{
              backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: spacing.lg,
              width: '100%', gap: spacing.md, borderWidth: 1, borderColor: colors.border,
            }}
            onPress={() => {}}
          >
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 16 }}>
              Reject KYC Submission
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
              Provide a reason so the user knows what to fix. This will be shown to them in the app.
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. ID photo is blurry, please retake"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.bgSurface, borderRadius: radius.md, padding: spacing.sm,
                color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
                ...typography.body, textAlignVertical: 'top', minHeight: 72,
              }}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setRejectModal(null)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
                  backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.border,
                }}
              >
                <Text style={{ ...typography.body, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRejectConfirm}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md,
                  backgroundColor: colors.loss + '22', borderWidth: 1, borderColor: colors.loss,
                }}
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
