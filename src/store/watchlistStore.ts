import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WatchlistItem, AssetType, InvestmentGoal } from '@/types';

interface WatchlistState {
  items: WatchlistItem[];
  goal: InvestmentGoal | null;

  // Watchlist Actions
  addItem: (item: Omit<WatchlistItem, 'id' | 'userId' | 'createdAt'>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<WatchlistItem>) => void;
  toggleAlert: (id: string) => void;

  // Goal Actions
  setGoal: (goal: Omit<InvestmentGoal, 'id' | 'userId' | 'isAchieved'>) => void;
  updateGoalProgress: (currentValue: number) => void;
  clearGoal: () => void;
}

const generateId = () => crypto.randomUUID();

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [
        { id: 'wl-001', userId: 'demo-user', symbol: 'TSLA', name: 'Tesla Inc.', assetType: 'stock' as const, targetPrice: 200, alertEnabled: true, createdAt: new Date('2024-10-01') },
        { id: 'wl-002', userId: 'demo-user', symbol: 'AMD', name: 'Advanced Micro Devices', assetType: 'stock' as const, targetPrice: 140, alertEnabled: false, createdAt: new Date('2024-10-15') },
        { id: 'wl-003', userId: 'demo-user', symbol: 'META', name: 'Meta Platforms Inc.', assetType: 'stock' as const, alertEnabled: false, createdAt: new Date('2024-11-01') },
      ],
      goal: null,

      addItem: (itemData) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              ...itemData,
              id: generateId(),
              userId: 'local-user',
              createdAt: new Date(),
            },
          ],
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      toggleAlert: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, alertEnabled: !item.alertEnabled } : item
          ),
        })),

      setGoal: (goalData) =>
        set({
          goal: {
            ...goalData,
            id: generateId(),
            userId: 'local-user',
            isAchieved: false,
          },
        }),

      updateGoalProgress: (currentValue) =>
        set((state) => {
          if (!state.goal) return state;
          const targetValue = state.goal.startingValue * (1 + state.goal.targetPercentage / 100);
          return {
            goal: {
              ...state.goal,
              currentValue,
              isAchieved: currentValue >= targetValue,
            },
          };
        }),

      clearGoal: () => set({ goal: null }),
    }),
    {
      name: 'watchlist-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
