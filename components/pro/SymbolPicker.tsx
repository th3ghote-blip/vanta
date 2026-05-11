import { useState, useMemo } from 'react';
import { ScrollView, Pressable, Text, View, TextInput } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { usePriceStore } from '@/stores/prices';

/**
 * Symbol catalog — matches what the backend pricefeed carries:
 *   Crypto:  Coinbase Advanced Trade WS (47 pairs).
 *   Forex:   Twelve Data /price.
 *   Metals:  Twelve Data.
 *   Stocks:  Twelve Data.
 *
 * Adding a symbol here without adding it to the backend feed will show "—".
 * Removing one here doesn't break anything — backend keeps streaming, just nothing
 * to render.
 */
type Category = 'Forex' | 'Metals' | 'Stocks' | 'Crypto';

const CATALOG: Record<Category, string[]> = {
  Forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'],
  Metals: ['XAUUSD'],
  Stocks: ['AAPL', 'TSLA', 'AMZN'],
  Crypto: [
    'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'AVAXUSD',
    'LINKUSD', 'DOTUSD', 'MATICUSD', 'SHIBUSD', 'LTCUSD', 'UNIUSD', 'ATOMUSD',
    'NEARUSD', 'APTUSD', 'ARBUSD', 'OPUSD', 'FILUSD', 'ICPUSD', 'INJUSD',
    'SUIUSD', 'TIAUSD', 'SEIUSD', 'ETCUSD', 'BCHUSD', 'STXUSD', 'RNDRUSD',
    'PEPEUSD', 'WIFUSD', 'BONKUSD', 'JUPUSD', 'PYTHUSD', 'WLDUSD', 'AAVEUSD',
    'MKRUSD', 'SNXUSD', 'CRVUSD', 'COMPUSD', 'LDOUSD', 'PENDLEUSD', 'ENAUSD',
    'SANDUSD', 'AXSUSD', 'MANAUSD', 'APEUSD', 'GALAUSD',
  ],
};

const CATEGORIES: Array<Category | 'All'> = ['All', 'Forex', 'Metals', 'Stocks', 'Crypto'];

interface Props {
  value: string;
  onChange: (s: string) => void;
}

export function SymbolPicker({ value, onChange }: Props) {
  const quotes = usePriceStore((s) => s.quotes);
  const [category, setCategory] = useState<Category | 'All'>('All');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const base =
      category === 'All'
        ? ([] as string[]).concat(CATALOG.Forex, CATALOG.Metals, CATALOG.Stocks, CATALOG.Crypto)
        : CATALOG[category];
    const q = search.trim().toUpperCase();
    return q ? base.filter((s) => s.includes(q)) : base;
  }, [category, search]);

  return (
    <View style={{ gap: spacing.sm }}>
      {/* Category tabs + search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {CATEGORIES.map((c) => {
            const active = c === category;
            const count = c === 'All'
              ? CATALOG.Forex.length + CATALOG.Metals.length + CATALOG.Stocks.length + CATALOG.Crypto.length
              : CATALOG[c].length;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.primary : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ ...typography.bodyBold, color: active ? '#fff' : colors.textSecondary, fontSize: 12 }}>
                  {c}
                </Text>
                <Text style={{ ...typography.mono, color: active ? '#fff' : colors.textMuted, fontSize: 11 }}>
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bgSurface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.sm,
        }}
      >
        <Search color={colors.textMuted} size={14} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search symbols"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: 13,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.xs,
            ...typography.mono,
          }}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <X color={colors.textMuted} size={14} />
          </Pressable>
        )}
      </View>

      {/* Symbol chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {visible.length === 0 ? (
          <View style={{ padding: spacing.sm }}>
            <Text style={{ ...typography.body, color: colors.textMuted, fontSize: 12 }}>
              No symbols match "{search}".
            </Text>
          </View>
        ) : (
          visible.map((s) => {
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
                    color: active ? '#fff' : mid != null ? colors.textSecondary : colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {mid != null ? formatPrice(mid) : '—'}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(7);
}
