import { View, Text } from 'react-native';
import { useState } from 'react';

import { colors, spacing, typography } from '@/lib/theme';
import { Chart } from './Chart';
import { OrderEntry } from './OrderEntry';
import { TradeBook } from './TradeBook';
import { SymbolPicker } from './SymbolPicker';
import { TimeframeSelector, type Timeframe } from './TimeframeSelector';

const DEFAULT_SYMBOL = 'BTCUSD';
const DEFAULT_TIMEFRAME: Timeframe = '5m';

export function ProTradeScreen() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
      <SymbolPicker value={symbol} onChange={setSymbol} />
      <TimeframeSelector value={timeframe} onChange={setTimeframe} />
      <Chart symbol={symbol} timeframe={timeframe} />
      <OrderEntry symbol={symbol} />

      <Text style={{ ...typography.heading, fontSize: 18, color: colors.textPrimary, marginTop: spacing.md }}>
        Order Book
      </Text>
      <TradeBook />
    </View>
  );
}
