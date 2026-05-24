/**
 * User preference store — miscellaneous display/trading preferences that
 * don't belong in the profile or theme stores.
 *
 * Persisted to AsyncStorage so they survive app restarts.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PrefsState {
  /**
   * T.19 Spread-betting mode.
   * When true, the order entry shows stake in "$ per pip" (forex) or
   * "$ per point" (crypto/stocks/gold) instead of lots.
   */
  spreadBet: boolean;
  hydrated: boolean;
  setSpreadBet: (v: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'vanta:prefs:spreadBet';

export const usePrefsStore = create<PrefsState>((set) => ({
  spreadBet: false,
  hydrated: false,

  setSpreadBet: async (v: boolean) => {
    set({ spreadBet: v });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {}
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      set({ spreadBet: stored === '1', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
