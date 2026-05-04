import { View, Text, ScrollView } from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

const SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      ['What is Vanta?', 'A modern trading platform with two modes: Pro (full charts and orders) and Quick (fast, simple bets on price direction).'],
      ['Pro vs Quick mode', 'Pro is for traditional traders — charts, stop-loss, take-profit, lots. Quick is for fast plays — pick a direction, pick a duration, win or lose at expiry.'],
      ['Demo accounts', 'Every new account starts with $10,000 in virtual funds. No real money at risk. Switch to live when you\'re ready and have completed identity verification.'],
    ],
  },
  {
    title: 'Trading',
    items: [
      ['Opening a trade (Pro)', 'Pick a symbol, set your volume, choose Buy or Sell. Optional stop-loss and take-profit set the levels where the trade auto-closes.'],
      ['Opening a round (Quick)', 'Pick an asset, pick a duration (60s, 5min, 15min), pick your stake, then tap Up or Down. If price moves your way at expiry, you win the payout.'],
      ['Stop-loss & take-profit', 'These are price levels that automatically close your trade — useful to lock in profit or limit losses if you can\'t watch the chart.'],
    ],
  },
  {
    title: 'AI Robots',
    items: [
      ['What are robots?', 'Custom strategies you describe in plain English. Vanta\'s AI translates your description into rules and runs them for you.'],
      ['Robot tips', 'Some robots send you trade ideas instead of executing — choose what works for you when building.'],
      ['Pausing / stopping', 'Active robots can be paused at any time from the Robots tab. Paused robots keep their history.'],
    ],
  },
  {
    title: 'Money',
    items: [
      ['Depositing', 'Tap Deposit on the Portfolio tab. We accept crypto, bank wire, and cards depending on your region.'],
      ['Withdrawing', 'You must complete identity verification before your first withdrawal. Withdrawals process in 1–3 business days.'],
      ['Fees', 'Spread is built into the prices you see. There\'s a small overnight financing fee on positions held past midnight UTC.'],
    ],
  },
  {
    title: 'Support',
    items: [
      ['Live chat', 'Tap Support Chat in your profile. Average response under 5 minutes.'],
      ['Phone support', 'Available 9am–9pm in your account currency\'s time zone.'],
      ['Account locked?', 'Contact support immediately. We\'ll verify it\'s you and restore access.'],
    ],
  },
];

export default function Help() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgDeep }} contentContainerStyle={{ padding: spacing.md }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 24, marginBottom: spacing.md }}>
        Help Center
      </Text>

      {SECTIONS.map((section) => (
        <View key={section.title} style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              ...typography.bodyBold,
              color: colors.primary,
              fontSize: 12,
              letterSpacing: 1,
              marginBottom: spacing.sm,
            }}
          >
            {section.title.toUpperCase()}
          </Text>
          <View
            style={{
              backgroundColor: colors.bgElevated,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {section.items.map(([q, a], i) => (
              <View
                key={q}
                style={{
                  padding: spacing.md,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14, marginBottom: 4 }}>
                  {q}
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                  {a}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={{ alignItems: 'center', marginTop: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
          Powered by AI App Genius · info@aiappgenius.com
        </Text>
        <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 10, marginTop: 4 }}>
          Analytics by Nifield
        </Text>
      </View>
    </ScrollView>
  );
}
