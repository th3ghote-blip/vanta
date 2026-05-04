import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';

const EXAMPLES = [
  'Buy Amazon every NYSE open and sell at close',
  'Give me 3 stock picks every morning',
  'Buy EURUSD when it dips 0.5% in 5 minutes',
  'Send me an alert when Bitcoin moves 3%',
];

export function RobotPromptBuilder() {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    // TODO: POST to /api/robots/compile with { prompt }
    // backend uses Claude to generate config JSON, returns parsed strategy
    setTimeout(() => setBusy(false), 1200);
  };

  return (
    <View
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Sparkles color={colors.primary} size={16} />
        <Text style={{ ...typography.bodyBold, color: colors.primary, fontSize: 12, letterSpacing: 1 }}>
          BUILD A ROBOT
        </Text>
      </View>

      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe what you want your robot to do..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={3}
        style={{
          backgroundColor: colors.bgSurface,
          borderRadius: radius.md,
          padding: spacing.md,
          color: colors.textPrimary,
          fontSize: 15,
          minHeight: 80,
          textAlignVertical: 'top',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {EXAMPLES.map((ex) => (
          <Pressable
            key={ex}
            onPress={() => setPrompt(ex)}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 6,
              borderRadius: radius.pill,
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 11 }}>{ex}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={submit}
        disabled={busy || !prompt.trim()}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          alignItems: 'center',
          opacity: busy || !prompt.trim() ? 0.5 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ ...typography.heading, color: '#fff', fontSize: 15 }}>Generate Robot</Text>
        )}
      </Pressable>
    </View>
  );
}
