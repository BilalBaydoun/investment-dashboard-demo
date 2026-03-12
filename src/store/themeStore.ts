import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserPreferences } from '@/types';

interface ThemeState {
  theme: 'light' | 'dark' | 'system';
  preferences: UserPreferences;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'system',
  currency: 'USD',
  defaultTimeRange: '1M',
  notifications: {
    priceAlerts: true,
    newsAlerts: true,
    goalProgress: true,
  },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      preferences: defaultPreferences,

      setTheme: (theme) =>
        set((state) => ({
          theme,
          preferences: { ...state.preferences, theme },
        })),

      updatePreferences: (updates) =>
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        })),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
