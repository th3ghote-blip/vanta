import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useState } from 'react';

import { colors, spacing, typography } from '@/lib/theme';
import { Chart } from './Chart';
import { OrderEntry } from './OrderEntry';
import { TradeBook } from './TradeBook';
import { SymbolPicker } from './SymbolPicker';
import { TimeframeSelector, type Timeframe } from './TimeframeSelector';
import { PriceAlertModal } from './PriceAlertModal';
import { usePriceStore } from '@/stores/prices';
import { useSymbolStore } from '@/stores/symbol';

const DEFAULT_TIMEFRAME: Timeframe = '5m';

export function ProTradeScreen({ onFirstTrade, onWinClose }: { onFirstTrade?: () => void; onWinClose?: (profit: number) => void } = {}) {
  // Shared with Quick mode so the asset persists across mode switches.
  const symbol = useSymbolStore((s) => s.symbol);
  const setSymbol = useSymbolStore((s) => s.setSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [alertVisible, setAlertVisible] = useState(false);

  const quote = usePriceStore((s) => s.quotes[symbol]);
  const currentPrice = quote ? (quote.bid + quote.ask) / 2 : null;

  // On wide screens put the order entry and order book side by side so the
  // order panel doesn't stretch full-width with wasted space and the book
  // isn't buried far below the fold.
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      <SymbolPicker value={symbol} onChange={setSymbol} />
      <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      <Chart symbol={symbol} timeframe={timeframe} />

      <TouchableOpacity
        onPress={() => setAlertVisible(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-end',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgSurface,
          gap: spacing.xs,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
          Set alert
        </Text>
      </TouchableOpacity>

      {wide ? (
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          {/* Order entry — fixed-width rail so its fields aren't stretched */}
          <View style={{ width: 420 }}>
            <OrderEntry symbol={symbol} onFirstTrade={onFirstTrade} />
          </View>
          {/* Order book fills the rest of the width, beside the entry */}
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.heading, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm }}>
              Order Book
            </Text>
            <TradeBook onWinClose={onWinClose} />
          </View>
        </View>
      ) : (
        <>
          <OrderEntry symbol={symbol} onFirstTrade={onFirstTrade} />
          <Text style={{ ...typography.heading, fontSize: 18, color: colors.textPrimary, marginTop: spacing.md }}>
            Order Book
          </Text>
          <TradeBook onWinClose={onWinClose} />
        </>
      )}

      <PriceAlertModal
        visible={alertVisible}
        symbol={symbol}
        currentPrice={currentPrice}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}
