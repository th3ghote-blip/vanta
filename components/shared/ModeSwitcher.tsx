import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { useModeStore, type UIMode } from '@/stores/mode';

export function ModeSwitcher() {
  const { mode, setMode } = useModeStore();

  const onPress = (next: UIMode) => {
    if (next !== mode) {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      setMode(next);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSurface,
        borderRadius: radius.pill,
        padding: 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Segment label="Pro" active={mode === 'pro'} onPress={() => onPress('pro')} />
      <Segment label="Quick" active={mode === 'quick'} onPress={() => onPress('quick')} />
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: active ? colors.primary : 'transparent',
        borderRadius: radius.pill,
      }}
    >
      <Text
        style={{
          ...typography.bodyBold,
          color: active ? '#fff' : colors.textSecondary,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
