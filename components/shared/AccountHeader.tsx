/**
 * AccountHeader — Phase 1.5 + T.10
 *
 * Persistent strip shown above all tabs: account login number plus
 * live Balance / Equity / Free Margin.  Equity updates on every quote
 * tick by computing unrealised P&L from the open-trades list locally.
 *
 * T.10: When the user has multiple accounts, the login number becomes a
 * tappable dropdown that lets them switch the active account.  A small
 * account-type badge (DEMO / LIVE) is shown next to the login number.
 */

import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, CheckCircle2 } from 'lucide-react-native';

import { calculatePnL } from '@/lib/contracts';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { useAccountStore } from '@/stores/account';
import { usePriceStore } from '@/stores/prices';
import type { Account } from '@/stores/account';

// --- types -------------------------------------------------------------------

interface OpenTrade {
  id: number;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
}

// --- helpers -----------------------------------------------------------------

function fmt(n: number): string {
  return (
    '$' +
    Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function TypeBadge({ type }: { type: Account['type'] }) {
  const isLive = type === 'live';
  return (
    <View
      style={{
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        backgroundColor: isLive ? colors.profit + '33' : colors.primary + '33',
        borderWidth: 1,
        borderColor: isLive ? colors.profit + '66' : colors.primary + '66',
      }}
    >
      <Text
        style={{
          ...typography.mono,
          fontSize: 9,
          color: isLive ? colors.profit : colors.primary,
          letterSpacing: 0.5,
        }}
      >
        {isLive ? 'LIVE' : 'DEMO'}
      </Text>
    </View>
  );
}

// --- account switcher modal --------------------------------------------------

function AccountSwitcherModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const account = useAccountStore((s) => s.account);
  const allAccounts = useAccountStore((s) => s.allAccounts);
  const switchAccount = useAccountStore((s) => s.switchAccount);
  const [switching, setSwitching] = useState<string | null>(null);

  async function handleSwitch(id: string) {
    if (id === account?.id) { onClose(); return; }
    setSwitching(id);
    await switchAccount(id);
    setSwitching(null);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-start' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            marginTop: 42,
            marginHorizontal: spacing.md,
            backgroundColor: colors.bgElevated,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
          onPress={() => {}}
        >
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 8 }}>
            <Text style={{ ...typography.bodyBold, fontSize: 12, color: colors.textMuted, letterSpacing: 1 }}>
              SWITCH ACCOUNT
            </Text>
          </View>

          <ScrollView bounces={false}>
            {allAccounts.map((a) => {
              const isActive = a.id === account?.id;
              const isLoading = switching === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => handleSwitch(a.id)}
                  disabled={!!switching}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.md,
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    backgroundColor: isActive ? colors.primary + '11' : 'transparent',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ ...typography.mono, fontSize: 13, color: isActive ? colors.primary : colors.textPrimary }}>
                        #{a.login ?? a.id.slice(0, 8)}
                      </Text>
                      <TypeBadge type={a.type} />
                    </View>
                    <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      {fmt(Number(a.balance))} balance
                    </Text>
                  </View>
                  {isActive && !isLoading && (
                    <CheckCircle2 size={16} color={colors.primary} />
                  )}
                  {isLoading && (
                    <Text style={{ ...typography.body, fontSize: 11, color: colors.textMuted }}>
                      switching...
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              padding: spacing.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ ...typography.body, fontSize: 13, color: colors.textMuted }}>
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- component ---------------------------------------------------------------

export function AccountHeader() {
  const insets = useSafeAreaInsets();
  const account = useAccountStore((s) => s.account);
  const allAccounts = useAccountStore((s) => s.allAccounts);
  const quotes = usePriceStore((s) => s.quotes);
  const [openTrades, setOpenTrades] = useState<OpenTrade[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);

  const hasMultiple = allAccounts.length > 1;

  useEffect(() => {
    if (!account) return;

    let cancelled = false;

    async function fetchOpen() {
      if (!account) return;
      const { data } = await supabase
        .from('trades')
        .select('id, symbol, side, volume, open_price')
        .eq('account_id', account.id)
        .eq('status', 'open');
      if (!cancelled && data) setOpenTrades(data as OpenTrade[]);
    }

    fetchOpen();

    const channel = supabase
      .channel(`acct_hdr_${account.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `account_id=eq.${account.id}`,
        },
        () => { fetchOpen(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [account?.id]);

  const { liveEquity, liveFreeMargin } = useMemo(() => {
    if (!account) return { liveEquity: 0, liveFreeMargin: 0 };

    const unrealized = openTrades.reduce((sum, t) => {
      const q = quotes[t.symbol];
      const exitPrice = q ? (t.side === 'buy' ? q.bid : q.ask) : t.open_price;
      return sum + calculatePnL(t.side, t.volume, t.open_price, exitPrice, t.symbol);
    }, 0);

    const eq = Number(account.balance) + unrealized;
    const free = eq - Number(account.margin_used ?? 0);
    return { liveEquity: eq, liveFreeMargin: free };
  }, [account, openTrades, quotes]);

  if (!account) return null;

  const equityColor =
    liveEquity > Number(account.balance)
      ? colors.profit
      : liveEquity < Number(account.balance)
        ? colors.loss
        : colors.textSecondary;

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bgElevated,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: spacing.md,
          // Top inset so the balance row isn't clipped under the status bar /
          // browser chrome (was rendering half off-screen on web).
          paddingTop: insets.top + 6,
          paddingBottom: 6,
          gap: 6,
        }}
      >
        <Pressable
          onPress={hasMultiple ? () => setShowSwitcher(true) : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text
            style={{
              ...typography.mono,
              fontSize: 11,
              color: colors.primary,
              letterSpacing: 0.5,
            }}
          >
            #{account.login ?? account.id.slice(0, 8)}
          </Text>
          <TypeBadge type={account.type} />
          {hasMultiple && <ChevronDown size={11} color={colors.primary} />}
        </Pressable>

        <Text style={{ color: colors.border, fontSize: 14 }}>|</Text>

        <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary }}>
          Bal{' '}
          <Text style={{ ...typography.monoBold, fontSize: 11, color: colors.textPrimary }}>
            {fmt(Number(account.balance))}
          </Text>
        </Text>

        <Text style={{ color: colors.textMuted, fontSize: 11 }}>·</Text>

        <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary }}>
          Eq{' '}
          <Text style={{ ...typography.monoBold, fontSize: 11, color: equityColor }}>
            {fmt(liveEquity)}
          </Text>
        </Text>

        <Text style={{ color: colors.textMuted, fontSize: 11 }}>·</Text>

        <Text style={{ ...typography.body, fontSize: 11, color: colors.textSecondary }}>
          Free{' '}
          <Text style={{ ...typography.monoBold, fontSize: 11, color: colors.textPrimary }}>
            {fmt(liveFreeMargin)}
          </Text>
        </Text>
      </View>

      {hasMultiple && (
        <AccountSwitcherModal
          visible={showSwitcher}
          onClose={() => setShowSwitcher(false)}
        />
      )}
    </>
  );
}
