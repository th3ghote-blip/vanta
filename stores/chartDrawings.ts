import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DrawingType = 'horizontal' | 'trendline' | 'fib';

export interface ChartPoint {
  time:  number;
  price: number;
}

export interface ChartDrawing {
  id:     string;
  type:   DrawingType;
  price?: number;        // horizontal: price level
  p1?:    ChartPoint;    // trendline/fib: first anchor
  p2?:    ChartPoint;    // trendline/fib: second anchor
  color?: string;
}

interface DrawingsState {
  data:     Record<string, ChartDrawing[]>; // keyed by symbol
  hydrated: boolean;
  get:      (symbol: string) => ChartDrawing[];
  save:     (symbol: string, drawings: ChartDrawing[]) => Promise<void>;
  hydrate:  () => Promise<void>;
}

const STORAGE_KEY = 'vanta:chart-drawings';

export const useChartDrawings = create<DrawingsState>((set, get) => ({
  data:     {},
  hydrated: false,

  get: (symbol) => get().data[symbol] ?? [],

  save: async (symbol, drawings) => {
    const next = { ...get().data, [symbol]: drawings };
    set({ data: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },

  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ data: JSON.parse(stored) as Record<string, ChartDrawing[]>, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
