import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UIMode = 'pro' | 'quick';

interface ModeState {
  mode: UIMode;
  hydrated: boolean;
  setMode: (mode: UIMode) => Promise<void>;
  toggle: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'vanta:ui-mode';

export const useModeStore = create<ModeState>((set, get) => ({
  mode: 'pro',
  hydrated: false,
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'pro' || stored === 'quick') {
        set({ mode: stored, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
  setMode: async (mode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  },
  toggle: async () => {
    const next: UIMode = get().mode === 'pro' ? 'quick' : 'pro';
    await get().setMode(next);
  },
}));
