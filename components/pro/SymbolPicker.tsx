import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';
import { symbolMeta } from '@/lib/symbolMeta';
import { SymbolPickerModal } from './SymbolPickerModal';

interface Props {
  value: string;
  onChange: (s: string) => void;
}

/**
 * Compact current-symbol tile.  Tap → opens a full-screen modal with all
 * 56 symbols (categories, search, prices).  Replaces the older horizontal
 * scroll of chips which was unusable past 13 items.
 */
export function SymbolPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const q = usePriceStore((s) => s.quotes[value]);
  const meta = symbolMeta(value);
  const mid = q ? (q.bid + q.ask) / 2 : null;

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bgElevated,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            <Text style={{ ...typography.heading, color: colors.textPrimary, fontSize: 20 }}>
              {value}
            </Text>
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 11 }}>
              · {meta.category}
            </Text>
          </View>
          <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 12, marginTop: 1 }}>
            {meta.name}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              ...typography.monoBold,
              color: mid != null ? colors.textPrimary : colors.textMuted,
              fontSize: 18,
            }}
          >
            {mid != null ? formatPrice(mid) : '—'}
          </Text>
          {q && (
            <Text style={{ ...typography.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
              {formatPrice(q.bid)} / {formatPrice(q.ask)}
            </Text>
          )}
        </View>

        <ChevronDown color={colors.textSecondary} size={20} />
      </Pressable>

      <SymbolPickerModal
        visible={open}
        current={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(7);
}
