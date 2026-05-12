import { View, Text, TouchableOpacity } from 'react-native';
import { useState } from 'react';

import { colors, spacing, typography } from '@/lib/theme';
import { Chart } from './Chart';
import { OrderEntry } from './OrderEntry';
import { TradeBook } from './TradeBook';
import { SymbolPicker } from './SymbolPicker';
import { TimeframeSelector, type Timeframe } from './TimeframeSelector';
import { PriceAlertModal } from './PriceAlertModal';
import { usePriceStore } from '@/stores/prices';

const DEFAULT_SYMBOL = 'BTCUSD';
const DEFAULT_TIMEFRAME: Timeframe = '5m';

export function ProTradeScreen() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [alertVisible, setAlertVisible] = useState(false);

  const quote = usePriceStore((s) => s.quotes[symbol]);
  const currentPrice = quote ? (quote.bid + quote.ask) / 2 : null;

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

      <OrderEntry symbol={symbol} />

      <Text style={{ ...typography.heading, fontSize: 18, color: colors.textPrimary, marginTop: spacing.md }}>
        Order Book
      </Text>
      <TradeBook />

      <PriceAlertModal
        visible={alertVisible}
        symbol={symbol}
        currentPrice={currentPrice}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}
