import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SavedGoal } from '@/types';

interface GoalsState {
  goals: SavedGoal[];
  activeGoalId: string | null;

  addGoal: (goal: Omit<SavedGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGoal: (id: string, updates: Partial<Omit<SavedGoal, 'id' | 'createdAt'>>) => void;
  removeGoal: (id: string) => void;
  setActiveGoal: (id: string | null) => void;
  getActiveGoal: () => SavedGoal | null;
}

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      goals: [{
        id: 'demo-goal-001',
        name: 'Retirement Fund',
        targetAmount: 150000,
        targetGrowth: 15,
        timelineMonths: 60,
        monthlyContribution: 1000,
        expectedReturn: 10,
        volatility: 15,
        createdAt: '2024-04-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
      }],
      activeGoalId: 'demo-goal-001',

      addGoal: (goalData) => {
        const newGoal: SavedGoal = {
          ...goalData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          goals: [...state.goals, newGoal],
          activeGoalId: newGoal.id,
        }));
      },

      updateGoal: (id, updates) =>
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        })),

      removeGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((g) => g.id !== id),
          activeGoalId: state.activeGoalId === id ? (state.goals.length > 1 ? state.goals.find(g => g.id !== id)?.id || null : null) : state.activeGoalId,
        })),

      setActiveGoal: (id) => set({ activeGoalId: id }),

      getActiveGoal: () => {
        const state = get();
        return state.goals.find((g) => g.id === state.activeGoalId) || null;
      },
    }),
    {
      name: 'goals-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
