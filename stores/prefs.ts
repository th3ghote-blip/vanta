/**
 * User preference store — miscellaneous display/trading preferences that
 * don't belong in the profile or theme stores.
 *
 * Persisted to AsyncStorage so they survive app restarts.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 19.1 — Order-entry sizing mode.
 *   'lots'     → classic MT4 lot sizing (1 lot = contractSize units).
 *   'stake'    → T.19 spread-bet: "$ per pip/point" stake.
 *   'notional' → Binance-style "$ amount": user enters USD to deploy, the
 *                client converts to lots before sending the order.
 */
export type SizingMode = 'lots' | 'stake' | 'notional';

interface PrefsState {
  /**
   * T.19 Spread-betting mode. Derived convenience flag kept in sync with
   * `sizingMode` (`spreadBet === (sizingMode === 'stake')`) so existing
   * consumers (e.g. Profile → Display) keep working unchanged.
   */
  spreadBet: boolean;
  /** 19.1 — three-way order sizing mode (source of truth). */
  sizingMode: SizingMode;
  hydrated: boolean;
  setSpreadBet: (v: boolean) => Promise<void>;
  setSizingMode: (m: SizingMode) => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'vanta:prefs:spreadBet'; // legacy boolean key (kept for back-compat)
const MODE_KEY = 'vanta:prefs:sizingMode';   // 19.1 three-way mode key

function isSizingMode(v: unknown): v is SizingMode {
  return v === 'lots' || v === 'stake' || v === 'notional';
}

export const usePrefsStore = create<PrefsState>((set) => ({
  spreadBet: false,
  sizingMode: 'lots',
  hydrated: false,

  setSpreadBet: async (v: boolean) => {
    // Map the legacy boolean toggle onto the three-way mode.
    const mode: SizingMode = v ? 'stake' : 'lots';
    set({ spreadBet: v, sizingMode: mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, v ? '1' : '0');
      await AsyncStorage.setItem(MODE_KEY, mode);
    } catch {}
  },

  setSizingMode: async (m: SizingMode) => {
    set({ sizingMode: m, spreadBet: m === 'stake' });
    try {
      await AsyncStorage.setItem(MODE_KEY, m);
      // Keep the legacy key consistent so a downgrade still reads sanely.
      await AsyncStorage.setItem(STORAGE_KEY, m === 'stake' ? '1' : '0');
    } catch {}
  },

  hydrate: async () => {
    try {
      const storedMode = await AsyncStorage.getItem(MODE_KEY);
      if (isSizingMode(storedMode)) {
        set({ sizingMode: storedMode, spreadBet: storedMode === 'stake', hydrated: true });
        return;
      }
      // Fall back to the legacy boolean key for users upgrading in place.
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const sb = stored === '1';
      set({ spreadBet: sb, sizingMode: sb ? 'stake' : 'lots', hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
