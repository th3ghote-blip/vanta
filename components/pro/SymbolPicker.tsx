import { ScrollView, Pressable, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';

const SYMBOLS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD',
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'BNBUSD', 'DOGEUSD',
  'AAPL', 'TSLA', 'AMZN',
];

interface Props {
  value: string;
  onChange: (s: string) => void;
}

export function SymbolPicker({ value, onChange }: Props) {
  const quotes = usePriceStore((s) => s.quotes);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {SYMBOLS.map((s) => {
        const active = s === value;
        const q = quotes[s];
        const mid = q ? (q.bid + q.ask) / 2 : null;
        return (
          <Pressable
            key={s}
            onPress={() => onChange(s)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: active ? colors.primary : colors.bgSurface,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              minWidth: 90,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textPrimary, fontSize: 13 }}>
              {s}
            </Text>
            <Text
              style={{
                ...typography.mono,
                fontSize: 11,
                color: active ? '#fff' : colors.textSecondary,
                marginTop: 2,
              }}
            >
              {mid != null ? formatPrice(mid) : '—'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(7);
}
