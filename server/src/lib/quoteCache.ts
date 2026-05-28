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

const STALE_FEED_MS = 10_000; // symbol is stale if no tick in 10s

export interface SymbolFeedStatus {
  symbol: string;
  lastTickMs: number;
  lastTickAgo: string;
  stale: boolean;
}

/**
 * Returns per-symbol price feed health — last tick timestamp and whether
 * the feed is stale (no update in >10s).
 */
export function getPriceFeedHealth(): SymbolFeedStatus[] {
  const now = Date.now();
  return Array.from(quotes.values()).map((q) => {
    const ago = now - q.ts;
    return {
      symbol: q.symbol,
      lastTickMs: q.ts,
      lastTickAgo: `${Math.round(ago / 1000)}s ago`,
      stale: ago > STALE_FEED_MS,
    };
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));
}
