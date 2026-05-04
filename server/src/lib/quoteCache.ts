/** In-memory quote cache. Single source of truth for current prices. */

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  ts: number;
}

const quotes = new Map<string, Quote>();

export function setQuote(q: Quote) {
  quotes.set(q.symbol, q);
}

export function getQuote(symbol: string): Quote | undefined {
  return quotes.get(symbol);
}

export function getAllQuotes(): Quote[] {
  return Array.from(quotes.values());
}

/**
 * Mid-price helper for B-book P&L calculation. We trade at bid (sell) / ask (buy)
 * but mark to market at mid for display.
 */
export function getMid(symbol: string): number | null {
  const q = quotes.get(symbol);
  return q ? (q.bid + q.ask) / 2 : null;
}
