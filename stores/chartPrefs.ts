import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type IndicatorKey = 'ma20' | 'ma50' | 'bb' | 'rsi' | 'macd';

export interface ChartIndicators {
  ma20: boolean;
  ma50: boolean;
  bb:   boolean;
  rsi:  boolean;
  macd: boolean;
}

interface ChartPrefsState {
  indicators: ChartIndicators;
  hydrated:   boolean;
  toggle:     (key: IndicatorKey) => Promise<void>;
  hydrate:    () => Promise<void>;
}

const STORAGE_KEY = 'vanta:chart-prefs';

const DEFAULT: ChartIndicators = {
  ma20: false,
  ma50: false,
  bb:   false,
  rsi:  false,
  macd: false,
};

export const useChartPrefs = create<ChartPrefsState>((set, get) => ({
  indicators: { ...DEFAULT },
  hydrated:   false,

  toggle: async (key: IndicatorKey) => {
    const next: ChartIndicators = { ...get().indicators, [key]: !get().indicators[key] };
    set({ indicators: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored) as Partial<ChartIndicators>;
        set({
          indicators: {
            ma20: !!p.ma20,
            ma50: !!p.ma50,
            bb:   !!p.bb,
            rsi:  !!p.rsi,
            macd: !!p.macd,
          },
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
