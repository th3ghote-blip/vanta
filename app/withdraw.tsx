/**
 * Withdraw screen — Phase 4.2
 *
 * Form: amount + method (crypto address / bank wire).
 * - Validates amount <= account.balance
 * - Blocks if kyc_submissions.status != 'approved'
 * - Inserts pending transactions row via POST /api/transactions/withdraw
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckCircle, ShieldAlert, Bitcoin, Building2 } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api, ApiError } from '@/lib/api';
import { useAccountStore } from '@/stores/account';
import { supabase } from '@/lib/supabase';

type Method = 'crypto' | 'wire';
type KycStatus = 'loading' | 'approved' | 'blocked';

export default function WithdrawScreen() {
  const router = useRouter();
  const { account } = useAccountStore();

  const [kycStatus, setKycStatus] = useState<KycStatus>('loading');
  const [method, setMethod] = useState<Method>('crypto');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [amountError, setAmountError] = useState('');
  const [destError, setDestError] = useState('');

  // Check KYC status on mount
  useEffect(() => {
    async function checkKyc() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setKycStatus('blocked'); return; }

      const { data } = await supabase
        .from('kyc_submissions')
        .select('status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setKycStatus(data?.status === 'approved' ? 'approved' : 'blocked');
    }
    checkKyc();
  }, []);

  function validate(): boolean {
    let ok = true;
    setAmountError('');
    setDestError('');

    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setAmountError('Enter a valid amount.');
      ok = false;
    } else if (account && parsed > Number(account.balance)) {
      setAmountError(`Exceeds available balance ($${Number(account.balance).toFixed(2)}).`);
      ok = false;
    } else if (parsed < 10) {
      setAmountError('Minimum withdrawal is $10.');
      ok = false;
    }

    if (!destination.trim()) {
      setDestError(method === 'crypto' ? 'Enter a wallet address.' : 'Enter bank account details.');
      ok = false;
    }

    return ok;
  }

  async function submit() {
    if (!account) return;
    if (!validate()) return;

    setBusy(true);
    try {
      await api.createWithdrawal({
        accountId: account.id,
        amount: parseFloat(amount),
        method,
        destination: destination.trim(),
      });
      setSuccess(true);
      setTimeout(() => router.back(), 2200);
    } catch (e: any) {
      if (e instanceof ApiError) {
        if (e.code === 'kyc_required') {
          Alert.alert('Identity verification required', 'Complete KYC before withdrawing.');
        } else if (e.code === 'insufficient_balance') {
          setAmountError(`Exceeds available balance ($${(e.details.available ?? 0).toFixed(2)}).`);
        } else {
          Alert.alert('Error', e.message ?? 'Could not submit withdrawal. Try again.');
        }
      } else {
        Alert.alert('Error', 'Could not submit withdrawal. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgDeep,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.lg,
          padding: spacing.xl,
        }}
      >
        <CheckCircle color={colors.profit} size={56} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 22, textAlign: 'center' }}>
          Withdrawal Submitted
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
          Your withdrawal request is pending review. Funds are typically processed within 1–3 business days.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          paddingTop: spacing.xl,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color={colors.textPrimary} size={24} />
        </Pressable>
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 20, flex: 1 }}>
          Withdraw Funds
        </Text>
      </View>

      {/* KYC loading */}
      {kycStatus === 'loading' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {/* KYC blocked */}
      {kycStatus === 'blocked' && (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
            gap: spacing.lg,
          }}
        >
          <ShieldAlert color={colors.warning} size={52} />
          <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 20, textAlign: 'center' }}>
            Verify Identity First
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            Withdrawals are only available after completing identity verification (KYC). This protects your account and keeps us compliant.
          </Text>
          <Pressable
            onPress={() => router.replace('/kyc' as any)}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 15 }}>
              Start Verification
            </Text>
          </Pressable>
        </View>
      )}

      {/* Main form — only shown when KYC approved */}
      {kycStatus === 'approved' && (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
          {/* Balance info */}
          {account && (
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>
                Available balance
              </Text>
              <Text style={{ ...typography.heading, color: colors.profit, fontSize: 18 }}>
                ${Number(account.balance).toFixed(2)}
              </Text>
            </View>
          )}

          {/* Amount input */}
          <View style={{ gap: spacing.xs }}>
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: amountError ? colors.loss : colors.border,
                padding: spacing.md,
                gap: 6,
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                Amount (USD)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ ...typography.heading, color: colors.textSecondary, fontSize: 22 }}>$</Text>
                <TextInput
                  value={amount}
                  onChangeText={(v) => { setAmount(v); setAmountError(''); }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={{
                    ...typography.heading,
                    color: colors.textPrimary,
                    fontSize: 28,
                    flex: 1,
                  }}
                />
              </View>
            </View>
            {amountError ? (
              <Text style={{ ...typography.body, color: colors.loss, fontSize: 12, paddingLeft: 2 }}>
                {amountError}
              </Text>
            ) : null}
          </View>

          {/* Quick-fill buttons */}
          {account && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {[25, 50, 100].map((pct) => {
                const val = ((Number(account.balance) * pct) / 100).toFixed(2);
                return (
                  <Pressable
                    key={pct}
                    onPress={() => { setAmount(val); setAmountError(''); }}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: spacing.sm,
                      borderRadius: radius.sm,
                      backgroundColor: colors.bgSurface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
                      {pct}%
                    </Text>
                    <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                      ${val}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => { setAmount(Number(account.balance).toFixed(2)); setAmountError(''); }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.bgSurface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>Max</Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>
                  ${Number(account.balance).toFixed(2)}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Method selector */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.bgSurface,
              borderRadius: radius.md,
              padding: 3,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {(
              [
                { key: 'crypto' as Method, icon: <Bitcoin size={14} color={method === 'crypto' ? '#fff' : colors.textSecondary} />, label: 'Crypto' },
                { key: 'wire' as Method, icon: <Building2 size={14} color={method === 'wire' ? '#fff' : colors.textSecondary} />, label: 'Bank Wire' },
              ]
            ).map((m) => (
              <Pressable
                key={m.key}
                onPress={() => { setMethod(m.key); setDestination(''); setDestError(''); }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: method === m.key ? colors.primary : 'transparent',
                }}
              >
                {m.icon}
                <Text
                  style={{
                    ...typography.bodyBold,
                    color: method === m.key ? '#fff' : colors.textSecondary,
                    fontSize: 13,
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Destination input */}
          <View style={{ gap: spacing.xs }}>
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: destError ? colors.loss : colors.border,
                padding: spacing.md,
                gap: 6,
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                {method === 'crypto' ? 'Wallet address' : 'Bank account details'}
              </Text>
              <TextInput
                value={destination}
                onChangeText={(v) => { setDestination(v); setDestError(''); }}
                placeholder={
                  method === 'crypto'
                    ? 'e.g. 0x742d35Cc...'
                    : 'Account number, routing, bank name'
                }
                placeholderTextColor={colors.textMuted}
                multiline={method === 'wire'}
                numberOfLines={method === 'wire' ? 3 : 1}
                style={{
                  ...typography.body,
                  color: colors.textPrimary,
                  fontSize: 14,
                  ...(method === 'wire' ? { minHeight: 60, textAlignVertical: 'top' } : {}),
                }}
              />
            </View>
            {destError ? (
              <Text style={{ ...typography.body, color: colors.loss, fontSize: 12, paddingLeft: 2 }}>
                {destError}
              </Text>
            ) : null}
          </View>

          {/* Fee / processing note */}
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.xs,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }}>
              Processing info
            </Text>
            {method === 'crypto' ? (
              <>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                  • Network fee deducted from amount
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                  • Typically processed within 24 hours
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                  • Double-check your address — crypto transfers are irreversible
                </Text>
              </>
            ) : (
              <>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                  • $0 wire fee for withdrawals over $500; $15 below
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                  • Arrives within 1–3 business days
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                  • Include your login number as reference when contacting support
                </Text>
              </>
            )}
          </View>

          {/* Submit */}
          <Pressable
            onPress={submit}
            disabled={busy}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md + 2,
              alignItems: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ ...typography.bodyBold, color: '#fff', fontSize: 15 }}>
                Request Withdrawal{amount ? ` — $${parseFloat(amount) > 0 ? parseFloat(amount).toFixed(2) : '0.00'}` : ''}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
