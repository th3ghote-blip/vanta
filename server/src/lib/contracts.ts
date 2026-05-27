/**
 * Contract size per lot, per asset class. Used everywhere P&L is calculated
 * to keep client and server consistent.
 *
 * Conventions (matches typical offshore B-book broker setup):
 * - Forex pairs: 1 lot = 100,000 base currency units
 * - Gold (XAU/USD): 1 lot = 100 oz
 * - Silver (XAG/USD): 1 lot = 5,000 oz
 * - Stocks: 1 lot = 1 share
 * - Crypto: 1 lot = 1 unit of base coin (BTC, ETH, etc.)
 */

const FOREX_PAIRS = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURCHF', 'GBPCHF',
]);

const STOCK_SYMBOLS = new Set([
  'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'NVDA',
  'NFLX', 'AMD', 'INTC', 'CRM', 'ORCL', 'IBM', 'BA', 'JPM', 'BAC',
]);

export function contractSize(symbol: string): number {
  if (FOREX_PAIRS.has(symbol)) return 100_000;
  if (symbol === 'XAUUSD') return 100; // 100 oz
  if (symbol === 'XAGUSD') return 5_000;
  if (STOCK_SYMBOLS.has(symbol)) return 1;
  // Crypto and anything else default to 1 unit per lot
  return 1;
}

/**
 * Realized or unrealized P&L in account currency (USD).
 *   buy:  (current - open) * volume * contractSize
 *   sell: (open - current) * volume * contractSize
 */
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
 * Notional value of a position in USD (for margin calculations).
 */
export function notionalUSD(volume: number, price: number, symbol: string): number {
  return volume * price * contractSize(symbol);
}

/**
 * Sensible default lot size when a symbol is first selected, before the user
 * has typed anything.
 */
export function defaultVolumeFor(symbol: string): string {
  if (FOREX_PAIRS.has(symbol)) return '0.10';
  if (symbol === 'XAUUSD' || symbol === 'XAGUSD') return '0.10';
  if (STOCK_SYMBOLS.has(symbol)) return '1';
  return '0.01';
}

export function isCrypto(symbol: string): boolean {
  if (FOREX_PAIRS.has(symbol)) return false;
  if (symbol === 'XAUUSD' || symbol === 'XAGUSD') return false;
  if (STOCK_SYMBOLS.has(symbol)) return false;
  return symbol.endsWith('USD');
}

export function pipSizeFor(symbol: string): number {
  if (FOREX_PAIRS.has(symbol)) return 0.0001;
  return 1;
}

export function pipValueFor(lots: number, symbol: string): number {
  return lots * contractSize(symbol) * pipSizeFor(symbol);
}

export function lotsFromPipValue(stakePip: number, symbol: string): number {
  const denom = contractSize(symbol) * pipSizeFor(symbol);
  return denom > 0 ? stakePip / denom : 0;
}

export function pipLabel(symbol: string): string {
  return FOREX_PAIRS.has(symbol) ? 'pip' : 'pt';
}
