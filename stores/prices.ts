import { create } from 'zustand';

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  ts: number;
}

interface PriceState {
  quotes: Record<string, Quote>;
  setQuote: (q: Quote) => void;
  setQuotes: (qs: Quote[]) => void;
}

export const usePriceStore = create<PriceState>((set) => ({
  quotes: {},
  setQuote: (q) => set((s) => ({ quotes: { ...s.quotes, [q.symbol]: q } })),
  setQuotes: (qs) =>
    set((s) => {
      const next = { ...s.quotes };
      for (const q of qs) next[q.symbol] = q;
      return { quotes: next };
    }),
}));
