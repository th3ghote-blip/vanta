/**
 * Terms of Service — static page.
 * Accessible from Profile → Help → Terms of Service.
 * Review with a lawyer before launch. Generated from Marshall Islands
 * B-book broker template; jurisdiction clause intentional (not legal advice).
 */
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

const LAST_UPDATED = 'May 2026';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Acceptance of Terms',
    body:
      'By accessing or using Vanta ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). ' +
      'If you do not agree to all Terms, do not use the Platform. We may update these Terms at any time; ' +
      'continued use after changes are posted constitutes acceptance.',
  },
  {
    title: '2. Eligibility',
    body:
      'You must be at least 18 years old and legally permitted to trade financial instruments in your jurisdiction. ' +
      'By registering, you represent and warrant that you meet these requirements. The Platform is not available ' +
      'to residents of the United States or any jurisdiction where such services are prohibited.',
  },
  {
    title: '3. Demo & Live Accounts',
    body:
      'Demo accounts are funded with virtual money for practice only. No real funds are at risk on a demo account. ' +
      'Live accounts require identity verification (KYC) before withdrawals. Vanta reserves the right to refuse ' +
      'or suspend any account at its discretion.',
  },
  {
    title: '4. Risk Warning',
    body:
      'Trading leveraged financial instruments carries a high level of risk. A significant percentage of retail ' +
      'investor accounts lose money when trading leveraged products. You should not invest money you cannot afford ' +
      'to lose. Past performance is not indicative of future results.',
  },
  {
    title: '5. Order Execution',
    body:
      'Vanta operates as a matched-principal (B-book) broker. All prices shown are indicative quotes set by Vanta. ' +
      'By placing a trade you accept that Vanta may take the opposing side of your position. Slippage may occur ' +
      'during periods of low liquidity or high volatility.',
  },
  {
    title: '6. Fees & Charges',
    body:
      'Vanta earns revenue through the bid-ask spread built into quoted prices. Overnight financing (swap) fees ' +
      'apply to positions held past midnight UTC. Fee rates are published on the Platform and may change with ' +
      '7 days\' notice.',
  },
  {
    title: '7. Deposits & Withdrawals',
    body:
      'Deposits are credited to demo balances immediately upon confirmation of receipt of cleared funds. ' +
      'Withdrawals are processed within 1–5 business days, subject to KYC approval and anti-money-laundering ' +
      'checks. Minimum withdrawal amounts apply as published on the Platform.',
  },
  {
    title: '8. Prohibited Conduct',
    body:
      'You agree not to: (a) use the Platform for money laundering or terrorist financing; ' +
      '(b) abuse any technical glitch or error to gain an unfair advantage; ' +
      '(c) use automated scrapers or bots that strain infrastructure; ' +
      '(d) share your credentials with third parties. Violation may result in account termination ' +
      'and forfeiture of balances in accordance with applicable law.',
  },
  {
    title: '9. Intellectual Property',
    body:
      'All content, trademarks, and software on the Platform are the property of Vanta or its licensors. ' +
      'You may not reproduce, distribute, or create derivative works without prior written consent.',
  },
  {
    title: '10. Limitation of Liability',
    body:
      'To the maximum extent permitted by law, Vanta is not liable for any indirect, incidental, ' +
      'or consequential damages arising from your use of the Platform. Our total liability to you ' +
      'shall not exceed the amount of funds you deposited in the 30 days preceding the claim.',
  },
  {
    title: '11. Governing Law',
    body:
      'These Terms are governed by the laws of the Republic of the Marshall Islands. Any disputes ' +
      'shall be resolved by binding arbitration under UNCITRAL rules. You waive any right to ' +
      'participate in class-action proceedings.',
  },
  {
    title: '12. Contact',
    body:
      'Questions about these Terms may be directed to legal@vanta.markets. ' +
      'We aim to respond within 5 business days.',
  },
];

export default function Terms() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          paddingTop: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.bgElevated,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft color={colors.textSecondary} size={22} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 17 }}>
          Terms of Service
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg }}>
          Last updated: {LAST_UPDATED}
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.title} style={{ marginBottom: spacing.lg }}>
            <Text
              style={{
                ...typography.bodyBold,
                color: colors.textPrimary,
                fontSize: 14,
                marginBottom: spacing.xs ?? 6,
              }}
            >
              {s.title}
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.textSecondary,
                fontSize: 13,
                lineHeight: 20,
              }}
            >
              {s.body}
            </Text>
          </View>
        ))}

        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            backgroundColor: colors.bgSurface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
            This document does not constitute legal advice. Consult a qualified lawyer before operating as a broker.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
