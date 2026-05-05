/**
 * Contract sizes — keep in sync with /c/Claude/vanta/lib/contracts.ts (client).
 */

const FOREX_PAIRS = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURCHF', 'GBPCHF',
]);

const STOCK_SYMBOLS = new Set([
  'AAPL', 'TSLA', 'AMZN', 'MSFT', 'GOOGL', 'GOOG', 'META', 'NVDA',
  'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'IBM', 'BA', 'JPM', 'BAC',
]);

export function contractSize(symbol: string): number {
  if (FOREX_PAIRS.has(symbol)) return 100_000;
  if (symbol === 'XAUUSD') return 100;
  if (symbol === 'XAGUSD') return 5_000;
  if (STOCK_SYMBOLS.has(symbol)) return 1;
  return 1;
}

export function calculatePnL(
  side: 'buy' | 'sell',
  volume: number,
  openPrice: number,
  currentPrice: number,
  symbol: string,
): number {
  const direction = side === 'buy' ? 1 : -1;
  return (currentPrice - openPrice) * direction * volume * contractSize(symbol);
}

/**
 * Notional value of a position in USD — base for margin calculations.
 *   notional = volume × price × contractSize
 * For a 0.1 BTC position at $80,000: 0.1 × 80000 × 1 = $8,000.
 * For 1 lot EURUSD at 1.10:        1 × 1.10 × 100,000 = $110,000.
 */
export function notionalUSD(volume: number, price: number, symbol: string): number {
  return volume * price * contractSize(symbol);
}
