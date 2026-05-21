/**
 * Watchlist store — T.12 Symbol watchlist / favourites.
 *
 * Keeps a local Set of starred symbol tickers. On mount, call `fetch()` to
 * hydrate from the server. `toggle(symbol)` performs an optimistic update
 * and fires the matching API call.
 */

import { create } from 'zustand';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/api';

interface WatchlistState {
  /** Set of starred symbol tickers, e.g. new Set(['BTCUSD', 'EURUSD']). */
  starred: Set<string>;
  loading: boolean;
  /** Fetch the user's watchlist from the server and hydrate `starred`. */
  fetch: () => Promise<void>;
  /** Toggle star state for a symbol — optimistic, syncs with server. */
  toggle: (symbol: string) => Promise<void>;
  /** True if the given symbol is currently starred. */
  isStarred: (symbol: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  starred: new Set(),
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const symbols = await getWatchlist();
      set({ starred: new Set(symbols) });
    } catch {
      // Silently degrade — watchlist is a convenience feature.
    } finally {
      set({ loading: false });
    }
  },

  toggle: async (symbol: string) => {
    const prev = get().starred;
    const isNowStarred = !prev.has(symbol);

    // Optimistic update.
    const next = new Set(prev);
    if (isNowStarred) {
      next.add(symbol);
    } else {
      next.delete(symbol);
    }
    set({ starred: next });

    try {
      if (isNowStarred) {
        await addToWatchlist(symbol);
      } else {
        await removeFromWatchlist(symbol);
      }
    } catch {
      // Roll back on failure.
      set({ starred: prev });
    }
  },

  isStarred: (symbol: string) => get().starred.has(symbol),
}));
