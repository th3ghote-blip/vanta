import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shared selected trading symbol, persisted across Pro/Quick mode switches and
 * app restarts. Both ProTradeScreen and QuickTradeScreen read/write this so the
 * chosen asset doesn't reset to BTC when you toggle modes.
 *
 * Note: Quick mode shows a narrower universe (crypto/metals) than Pro. If the
 * stored symbol isn't in Quick's list, Quick displays its first symbol WITHOUT
 * overwriting the store — so a Pro-only pick (e.g. a forex pair) survives a Quick
 * visit. Picking a symbol in either mode updates the shared value.
 */
interface SymbolState {
  symbol: string;
  hydrated: boolean;
  setSymbol: (symbol: string) => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'vanta:symbol';

export const useSymbolStore = create<SymbolState>((set) => ({
  symbol: 'BTCUSD',
  hydrated: false,
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) set({ symbol: stored, hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setSymbol: (symbol) => {
    set({ symbol });
    AsyncStorage.setItem(STORAGE_KEY, symbol).catch(() => {});
  },
}));
