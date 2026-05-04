import { View, Text, ScrollView, Pressable } from 'react-native';
import { Camera, FileImage, ShieldCheck, ArrowRight } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';

const STEPS = [
  { key: 'id_front', label: 'ID — Front', icon: 'id', done: false },
  { key: 'id_back', label: 'ID — Back', icon: 'id', done: false },
  { key: 'selfie', label: 'Selfie with ID', icon: 'selfie', done: false },
  { key: 'proof_of_address', label: 'Proof of Address', icon: 'doc', done: false },
];

export default function Kyc() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgDeep }} contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <ShieldCheck color={colors.primary} size={24} />
        <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 22 }}>Verify Your Identity</Text>
      </View>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl }}>
        We're required by regulation to verify everyone who deposits real money. Takes about 2 minutes.
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
        {STEPS.map((s, i) => (
          <Pressable
            key={s.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                backgroundColor: colors.bgSurface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.icon === 'selfie' ? (
                <Camera color={colors.textSecondary} size={20} />
              ) : (
                <FileImage color={colors.textSecondary} size={20} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary, fontSize: 14 }}>{s.label}</Text>
              <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }}>
                {s.done ? 'Uploaded' : 'Tap to upload'}
              </Text>
            </View>
            <ArrowRight color={colors.textMuted} size={18} />
          </Pressable>
        ))}
      </View>

      <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11, marginTop: spacing.lg, textAlign: 'center' }}>
        Your documents are encrypted and only used for compliance verification.
      </Text>
    </ScrollView>
  );
}
