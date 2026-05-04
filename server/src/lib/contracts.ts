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
