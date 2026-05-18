import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'auto' | 'dark' | 'light';

interface ThemeState {
  theme: ThemePreference;
  hydrated: boolean;
  setTheme: (t: ThemePreference) => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'vanta:theme';

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark',
  hydrated: false,
  setTheme: async (t: ThemePreference) => {
    set({ theme: t });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, t);
    } catch {}
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'auto' || stored === 'dark' || stored === 'light') {
        set({ theme: stored as ThemePreference, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));
