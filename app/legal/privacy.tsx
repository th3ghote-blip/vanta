/**
 * Privacy Policy — static page.
 * Accessible from Profile → Help → Privacy Policy.
 */
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';

const LAST_UPDATED = 'May 2026';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Information We Collect',
    body:
      'We collect: (a) Registration data — email address, login number, password hash. ' +
      '(b) Identity verification documents (KYC) — government ID, proof of address, selfie. ' +
      '(c) Financial data — deposit/withdrawal history, trade history, account balances. ' +
      '(d) Device data — IP address, device type, operating system, push notification token. ' +
      '(e) Usage data — screens viewed, features used, session durations.',
  },
  {
    title: '2. How We Use Your Information',
    body:
      'We use your information to: operate and improve the Platform; verify your identity and comply with ' +
      'anti-money-laundering regulations; process deposits, withdrawals, and trades; send service notifications ' +
      '(trade results, price alerts, security alerts); detect and prevent fraud and abuse; and respond to support requests.',
  },
  {
    title: '3. Legal Basis for Processing',
    body:
      'We process your data on the following legal bases: (a) Contract — processing necessary to provide ' +
      'the trading service you signed up for. (b) Legal obligation — KYC and AML requirements. ' +
      '(c) Legitimate interest — fraud prevention, security, and service improvement. ' +
      '(d) Consent — marketing communications (you may opt out at any time).',
  },
  {
    title: '4. Data Sharing',
    body:
      'We do not sell your personal data. We share data with: (a) Supabase (database infrastructure, ' +
      'processors under data processing agreements); (b) Sentry (error monitoring — anonymised stack traces only); ' +
      '(c) Expo (push notification delivery); (d) KYC verification providers when you submit identity documents; ' +
      '(e) Law enforcement or regulators when legally required.',
  },
  {
    title: '5. Data Retention',
    body:
      'Account data is retained for the duration of your account and for 7 years afterward to comply with ' +
      'financial record-keeping obligations. Trade history is retained indefinitely for regulatory purposes. ' +
      'KYC documents are retained for 5 years after account closure.',
  },
  {
    title: '6. Your Rights',
    body:
      'Subject to applicable law, you have the right to: access the personal data we hold about you; ' +
      'correct inaccurate data; request deletion (subject to legal retention obligations); ' +
      'object to processing for direct marketing; and data portability for data you provided. ' +
      'To exercise these rights, contact privacy@vanta.markets.',
  },
  {
    title: '7. Security',
    body:
      'We implement industry-standard security measures: encrypted data transmission (TLS 1.3), ' +
      'hashed passwords (bcrypt), row-level security on all database tables, and two-factor authentication ' +
      'available to all users. No system is 100% secure — report suspected breaches to security@vanta.markets.',
  },
  {
    title: '8. Cookies & Tracking (Web)',
    body:
      'Our web version uses essential session cookies required to keep you logged in. We do not currently ' +
      'use third-party analytics or advertising cookies. If we add analytics in future, we will update ' +
      'this policy and obtain your consent.',
  },
  {
    title: '9. Push Notifications',
    body:
      'With your permission we send push notifications about trade results, price alerts, and account activity. ' +
      'You can manage notification preferences in Profile → Notifications or disable them in your device settings.',
  },
  {
    title: '10. Children',
    body:
      'The Platform is not directed at persons under 18 years of age. We do not knowingly collect data ' +
      'from children. If you believe a minor has registered, contact us immediately at privacy@vanta.markets.',
  },
  {
    title: '11. Changes to This Policy',
    body:
      'We may update this Privacy Policy periodically. Material changes will be communicated via in-app ' +
      'notification or email at least 14 days before they take effect. Continued use after the effective ' +
      'date constitutes acceptance.',
  },
  {
    title: '12. Contact',
    body:
      'Privacy enquiries: privacy@vanta.markets\n' +
      'Data Protection Officer: dpo@vanta.markets\n' +
      'Registered address: Trust Company Complex, Ajeltake Road, Majuro, Marshall Islands MH96960',
  },
];

export default function Privacy() {
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
          Privacy Policy
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
      </ScrollView>
    </View>
  );
}
