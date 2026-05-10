/**
 * Deposit screen — Phase 4.1
 *
 * Three tabs: Crypto (BTC / ETH / USDT), Bank Wire, Card.
 * - Crypto: shows a demo deposit address + "I've sent $X" button
 * - Wire: shows wiring instructions + "I've sent $X" button
 * - Card: "coming soon" placeholder
 * "I've sent $X" creates a pending transactions row via POST /api/transactions/deposit.
 */
import { useState } from 'react';
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
import {
  Bitcoin,
  Building2,
  CreditCard,
  Copy,
  ChevronLeft,
  CheckCircle,
} from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAccountStore } from '@/stores/account';

// ── Demo deposit addresses (per coin — same for all demo accounts) ──────────
const CRYPTO_OPTIONS = [
  {
    key: 'crypto_btc' as const,
    coin: 'BTC',
    label: 'Bitcoin',
    network: 'Bitcoin (BTC)',
    address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    color: '#F7931A',
  },
  {
    key: 'crypto_eth' as const,
    coin: 'ETH',
    label: 'Ethereum',
    network: 'ERC-20',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    color: '#627EEA',
  },
  {
    key: 'crypto_usdt' as const,
    coin: 'USDT',
    label: 'Tether USD',
    network: 'TRC-20 (TRON)',
    address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
    color: '#26A17B',
  },
];

type Tab = 'crypto' | 'wire' | 'card';
type CryptoKey = 'crypto_btc' | 'crypto_eth' | 'crypto_usdt';

export default function DepositScreen() {
  const router = useRouter();
  const { account } = useAccountStore();

  const [tab, setTab] = useState<Tab>('crypto');
  const [selectedCoin, setSelectedCoin] = useState<CryptoKey>('crypto_btc');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedOption = CRYPTO_OPTIONS.find((o) => o.key === selectedCoin)!;

  async function submitDeposit(method: 'crypto_btc' | 'crypto_eth' | 'crypto_usdt' | 'wire') {
    if (!account) return;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert('Enter amount', 'Please enter a valid deposit amount.');
      return;
    }
    setBusy(true);
    try {
      await api.createDeposit({ accountId: account.id, amount: parsed, method });
      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 2200);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit deposit. Try again.');
    } finally {
      setBusy(false);
    }
  }

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
          Deposit Submitted
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
          Your deposit is pending review. Funds will appear in your account once confirmed.
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
          Deposit Funds
        </Text>
      </View>

      {/* Tab strip */}
      <View
        style={{
          flexDirection: 'row',
          margin: spacing.md,
          backgroundColor: colors.bgSurface,
          borderRadius: radius.md,
          padding: 3,
        }}
      >
        {(
          [
            { key: 'crypto', icon: <Bitcoin size={14} color={tab === 'crypto' ? '#fff' : colors.textSecondary} />, label: 'Crypto' },
            { key: 'wire', icon: <Building2 size={14} color={tab === 'wire' ? '#fff' : colors.textSecondary} />, label: 'Bank Wire' },
            { key: 'card', icon: <CreditCard size={14} color={tab === 'card' ? '#fff' : colors.textSecondary} />, label: 'Card' },
          ] as { key: Tab; icon: React.ReactNode; label: string }[]
        ).map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: tab === t.key ? colors.primary : 'transparent',
            }}
          >
            {t.icon}
            <Text
              style={{
                ...typography.bodyBold,
                color: tab === t.key ? '#fff' : colors.textSecondary,
                fontSize: 13,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {/* ── CRYPTO TAB ── */}
        {tab === 'crypto' && (
          <>
            {/* Coin selector */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {CRYPTO_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelectedCoin(opt.key)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: selectedCoin === opt.key ? opt.color : colors.border,
                    backgroundColor:
                      selectedCoin === opt.key ? `${opt.color}18` : colors.bgSurface,
                  }}
                >
                  <Text style={{ ...typography.bodyBold, color: opt.color, fontSize: 16 }}>
                    {opt.coin}
                  </Text>
                  <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Network badge */}
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>
                Network
              </Text>
              <Text style={{ ...typography.bodyBold, color: colors.warning, fontSize: 13 }}>
                ⚠️  {selectedOption.network} only — sending on a different network will result in permanent loss.
              </Text>
            </View>

            {/* Address box */}
            <View
              style={{
                backgroundColor: colors.bgSurface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12 }}>
                Deposit address ({selectedOption.coin})
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text
                  style={{
                    ...typography.mono,
                    color: colors.textPrimary,
                    fontSize: 13,
                    flex: 1,
                    flexWrap: 'wrap',
                  }}
                  selectable
                >
                  {selectedOption.address}
                </Text>
                <Pressable hitSlop={8}>
                  <Copy color={colors.textSecondary} size={18} />
                </Pressable>
              </View>
            </View>

            {/* Minimum deposit note */}
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
              Minimum deposit $10 · Credited after 1 network confirmation
            </Text>

            {/* Amount input */}
            <AmountInput value={amount} onChange={setAmount} />

            <Pressable
              onPress={() => submitDeposit(selectedCoin)}
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
                  I've sent ${amount || '0.00'}
                </Text>
              )}
            </Pressable>
          </>
        )}

        {/* ── WIRE TAB ── */}
        {tab === 'wire' && (
          <>
            <WireInstructions />
            <AmountInput value={amount} onChange={setAmount} />
            <Pressable
              onPress={() => submitDeposit('wire')}
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
                  I've sent ${amount || '0.00'}
                </Text>
              )}
            </Pressable>
          </>
        )}

        {/* ── CARD TAB ── */}
        {tab === 'card' && (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.xxxl,
              gap: spacing.lg,
            }}
          >
            <CreditCard color={colors.textMuted} size={48} />
            <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 18 }}>
              Coming Soon
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              Card deposits will be available shortly. Use crypto or bank wire in the meantime.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
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
          value={value}
          onChangeText={onChange}
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
  );
}

function WireRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 13 }} selectable>
        {value}
      </Text>
    </View>
  );
}

function WireInstructions() {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 2,
      }}
    >
      <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, marginBottom: spacing.sm }}>
        Wire Transfer Details
      </Text>
      <WireRow label="Bank name" value="Silvergate Bank" />
      <WireRow label="Account name" value="Vanta Markets Ltd" />
      <WireRow label="Account number" value="4400 8812 7731" />
      <WireRow label="Routing number (ABA)" value="322286803" />
      <WireRow label="SWIFT / BIC" value="SGBKUS6L" />
      <WireRow label="Reference" value="VANTA-DEPOSIT" />
      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginTop: spacing.sm }}>
        Transfers typically arrive within 1–3 business days. Include your login number in the reference field.
      </Text>
    </View>
  );
}
