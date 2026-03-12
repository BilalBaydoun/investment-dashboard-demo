import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Portfolio, Position, Transaction, AssetType } from '@/types';
import { DEMO_PORTFOLIO, DEMO_TRANSACTIONS } from '@/lib/demoData';

interface HistoricalSnapshot {
  date: string;
  totalValue: number;
  totalCost: number;
  cashBalance: number;
}

interface PortfolioState {
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  transactions: Transaction[];
  historicalData: HistoricalSnapshot[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setActivePortfolio: (id: string) => void;
  addPortfolio: (name: string) => Portfolio;
  deletePortfolio: (id: string) => void;
  addPosition: (portfolioId: string, position: Omit<Position, 'id' | 'portfolioId' | 'createdAt' | 'updatedAt'>) => void;
  updatePosition: (positionId: string, updates: Partial<Position>) => void;
  removePosition: (positionId: string) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  updatePrices: (prices: Record<string, { price: number; previousClose: number }>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Cash actions
  depositCash: (amount: number) => void;
  withdrawCash: (amount: number) => void;
  setCashBalance: (amount: number) => void;

  // Historical data actions
  recordSnapshot: () => void;
  getHistoricalData: (days?: number) => HistoricalSnapshot[];
  getPerformanceByPeriod: (period: 'day' | 'week' | 'month' | 'ytd' | 'year') => number;

  // Computed helpers
  getActivePortfolio: () => Portfolio | null;
  getTotalValue: () => number;
  getTotalCost: () => number;
  getTotalGain: () => number;
  getTotalGainPercent: () => number;
  getCashBalance: () => number;
  getPositionsByType: () => Record<AssetType, Position[]>;
  getAllocationData: () => { name: string; value: number; percentage: number; color: string }[];
}

const generateId = () => crypto.randomUUID();

const ASSET_COLORS: Record<AssetType, string> = {
  stock: '#3b82f6',    // Blue
  crypto: '#f59e0b',   // Amber/Orange
  etf: '#06b6d4',      // Cyan/Teal
  bond: '#8b5cf6',     // Violet
  real_estate: '#ec4899', // Pink
  cash: '#22c55e',     // Green
  commodity: '#eab308', // Yellow/Gold
};

export const usePortfolioStore = create<PortfolioState>()(
  persist(
    (set, get) => ({
      portfolios: [DEMO_PORTFOLIO],
      activePortfolioId: DEMO_PORTFOLIO.id,
      transactions: DEMO_TRANSACTIONS,
      historicalData: [],
      isLoading: false,
      error: null,

      setActivePortfolio: (id) => set({ activePortfolioId: id }),

      addPortfolio: (name) => {
        const newPortfolio: Portfolio = {
          id: generateId(),
          userId: 'local-user',
          name,
          positions: [],
          cashBalance: 0,
          createdAt: new Date(),
        };
        set((state) => ({
          portfolios: [...state.portfolios, newPortfolio],
          activePortfolioId: state.activePortfolioId || newPortfolio.id,
        }));
        return newPortfolio;
      },

      deletePortfolio: (id) =>
        set((state) => {
          const newPortfolios = state.portfolios.filter((p) => p.id !== id);
          return {
            portfolios: newPortfolios,
            activePortfolioId:
              state.activePortfolioId === id
                ? newPortfolios[0]?.id || null
                : state.activePortfolioId,
          };
        }),

      addPosition: (portfolioId, positionData) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === portfolioId
              ? {
                  ...p,
                  positions: [
                    ...p.positions,
                    {
                      ...positionData,
                      id: generateId(),
                      portfolioId,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  ],
                }
              : p
          ),
        })),

      updatePosition: (positionId, updates) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) => ({
            ...p,
            positions: p.positions.map((pos) =>
              pos.id === positionId
                ? { ...pos, ...updates, updatedAt: new Date() }
                : pos
            ),
          })),
        })),

      removePosition: (positionId) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) => ({
            ...p,
            positions: p.positions.filter((pos) => pos.id !== positionId),
          })),
        })),

      addTransaction: (transactionData) =>
        set((state) => {
          const newTransaction = { ...transactionData, id: generateId() };

          // Also update the position quantity if it's a buy/sell transaction
          let updatedPortfolios = state.portfolios;

          if (transactionData.type === 'buy' || transactionData.type === 'sell') {
            updatedPortfolios = state.portfolios.map((p) => {
              if (p.id !== state.activePortfolioId) return p;

              return {
                ...p,
                positions: p.positions.map((pos) => {
                  if (pos.symbol !== transactionData.symbol) return pos;

                  const quantityChange = transactionData.type === 'buy'
                    ? transactionData.quantity
                    : -transactionData.quantity;

                  const newQuantity = pos.quantity + quantityChange;

                  // Recalculate average cost for buys
                  let newAvgCost = pos.avgCost;
                  if (transactionData.type === 'buy' && newQuantity > 0) {
                    const oldValue = pos.quantity * pos.avgCost;
                    const newValue = transactionData.quantity * transactionData.price;
                    newAvgCost = (oldValue + newValue) / newQuantity;
                  }

                  return {
                    ...pos,
                    quantity: Math.max(0, newQuantity),
                    avgCost: newAvgCost,
                    updatedAt: new Date(),
                  };
                }),
              };
            });
          }

          return {
            portfolios: updatedPortfolios,
            transactions: [
              ...state.transactions,
              newTransaction,
            ],
          };
        }),

      updateTransaction: (id, updates) =>
        set((state) => {
          const oldTransaction = state.transactions.find((t) => t.id === id);
          if (!oldTransaction) return state;

          // Reverse the old transaction's effect on position
          let updatedPortfolios = state.portfolios;

          if (oldTransaction.type === 'buy' || oldTransaction.type === 'sell') {
            updatedPortfolios = updatedPortfolios.map((p) => {
              if (p.id !== state.activePortfolioId) return p;

              return {
                ...p,
                positions: p.positions.map((pos) => {
                  if (pos.symbol !== oldTransaction.symbol) return pos;

                  // Reverse old transaction
                  const oldQuantityChange = oldTransaction.type === 'buy'
                    ? -oldTransaction.quantity
                    : oldTransaction.quantity;

                  let newQuantity = pos.quantity + oldQuantityChange;

                  // Apply new transaction (if type/quantity changed)
                  const newType = updates.type || oldTransaction.type;
                  const newTransQty = updates.quantity ?? oldTransaction.quantity;
                  const newPrice = updates.price ?? oldTransaction.price;

                  if (newType === 'buy' || newType === 'sell') {
                    const newQuantityChange = newType === 'buy' ? newTransQty : -newTransQty;
                    newQuantity = newQuantity + newQuantityChange;
                  }

                  // Recalculate average cost
                  let newAvgCost = pos.avgCost;
                  if (newType === 'buy' && newQuantity > 0) {
                    // Simplified: just use the new price for the updated portion
                    const totalValue = newQuantity * newPrice;
                    newAvgCost = totalValue / newQuantity;
                  }

                  return {
                    ...pos,
                    quantity: Math.max(0, newQuantity),
                    avgCost: newAvgCost,
                    updatedAt: new Date(),
                  };
                }),
              };
            });
          }

          return {
            portfolios: updatedPortfolios,
            transactions: state.transactions.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          };
        }),

      deleteTransaction: (id) =>
        set((state) => {
          const transaction = state.transactions.find((t) => t.id === id);
          if (!transaction) return state;

          // Reverse the transaction's effect on position
          let updatedPortfolios = state.portfolios;

          if (transaction.type === 'buy' || transaction.type === 'sell') {
            updatedPortfolios = updatedPortfolios.map((p) => {
              if (p.id !== state.activePortfolioId) return p;

              return {
                ...p,
                positions: p.positions.map((pos) => {
                  if (pos.symbol !== transaction.symbol) return pos;

                  // Reverse the transaction
                  const quantityChange = transaction.type === 'buy'
                    ? -transaction.quantity  // Reverse buy: subtract
                    : transaction.quantity;   // Reverse sell: add back

                  const newQuantity = pos.quantity + quantityChange;

                  return {
                    ...pos,
                    quantity: Math.max(0, newQuantity),
                    updatedAt: new Date(),
                  };
                }),
              };
            });
          }

          return {
            portfolios: updatedPortfolios,
            transactions: state.transactions.filter((t) => t.id !== id),
          };
        }),

      updatePrices: (prices) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) => ({
            ...p,
            positions: p.positions.map((pos) =>
              prices[pos.symbol]
                ? {
                    ...pos,
                    currentPrice: prices[pos.symbol].price,
                    previousClose: prices[pos.symbol].previousClose,
                    updatedAt: new Date(),
                  }
                : pos
            ),
          })),
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Cash actions
      depositCash: (amount) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === state.activePortfolioId
              ? { ...p, cashBalance: (p.cashBalance || 0) + amount }
              : p
          ),
        })),

      withdrawCash: (amount) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === state.activePortfolioId
              ? { ...p, cashBalance: Math.max(0, (p.cashBalance || 0) - amount) }
              : p
          ),
        })),

      setCashBalance: (amount) =>
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === state.activePortfolioId
              ? { ...p, cashBalance: Math.max(0, amount) }
              : p
          ),
        })),

      // Historical data actions
      recordSnapshot: () => {
        const state = get();
        const portfolio = state.getActivePortfolio();
        if (!portfolio) return;

        const today = new Date().toISOString().split('T')[0];
        const totalValue = state.getTotalValue();
        const totalCost = state.getTotalCost();
        const cashBalance = state.getCashBalance();

        // Check if we already have a snapshot for today
        const existingIndex = state.historicalData.findIndex((s) => s.date === today);

        if (existingIndex >= 0) {
          // Update existing snapshot
          set((state) => ({
            historicalData: state.historicalData.map((s, i) =>
              i === existingIndex
                ? { date: today, totalValue, totalCost, cashBalance }
                : s
            ),
          }));
        } else {
          // Add new snapshot
          set((state) => ({
            historicalData: [
              ...state.historicalData,
              { date: today, totalValue, totalCost, cashBalance },
            ].slice(-365), // Keep only last 365 days
          }));
        }
      },

      getHistoricalData: (days = 30) => {
        const state = get();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        return state.historicalData
          .filter((s) => s.date >= cutoffStr)
          .sort((a, b) => a.date.localeCompare(b.date));
      },

      getPerformanceByPeriod: (period) => {
        const state = get();
        const currentValue = state.getTotalValue();
        const historicalData = state.historicalData;

        if (historicalData.length === 0 || currentValue === 0) return 0;

        let daysAgo = 1;
        switch (period) {
          case 'day':
            daysAgo = 1;
            break;
          case 'week':
            daysAgo = 7;
            break;
          case 'month':
            daysAgo = 30;
            break;
          case 'ytd':
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            daysAgo = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
            break;
          case 'year':
            daysAgo = 365;
            break;
        }

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - daysAgo);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // Find the closest historical snapshot
        const sortedData = [...historicalData].sort((a, b) => a.date.localeCompare(b.date));
        let pastValue = sortedData[0]?.totalValue || currentValue;

        for (const snapshot of sortedData) {
          if (snapshot.date <= targetDateStr) {
            pastValue = snapshot.totalValue;
          } else {
            break;
          }
        }

        if (pastValue === 0) return 0;
        return ((currentValue - pastValue) / pastValue) * 100;
      },

      getActivePortfolio: () => {
        const state = get();
        return state.portfolios.find((p) => p.id === state.activePortfolioId) || null;
      },

      getTotalValue: () => {
        const portfolio = get().getActivePortfolio();
        if (!portfolio) return 0;
        const positionsValue = portfolio.positions.reduce(
          (sum, pos) => sum + pos.quantity * pos.currentPrice,
          0
        );
        return positionsValue + (portfolio.cashBalance || 0);
      },

      getTotalCost: () => {
        const portfolio = get().getActivePortfolio();
        if (!portfolio) return 0;
        return portfolio.positions.reduce(
          (sum, pos) => sum + pos.quantity * pos.avgCost,
          0
        );
      },

      getTotalGain: () => {
        return get().getTotalValue() - get().getTotalCost();
      },

      getTotalGainPercent: () => {
        const cost = get().getTotalCost();
        if (cost === 0) return 0;
        return (get().getTotalGain() / cost) * 100;
      },

      getCashBalance: () => {
        const portfolio = get().getActivePortfolio();
        return portfolio?.cashBalance || 0;
      },

      getPositionsByType: () => {
        const portfolio = get().getActivePortfolio();
        if (!portfolio) return {} as Record<AssetType, Position[]>;

        return portfolio.positions.reduce((acc, pos) => {
          if (!acc[pos.assetType]) acc[pos.assetType] = [];
          acc[pos.assetType].push(pos);
          return acc;
        }, {} as Record<AssetType, Position[]>);
      },

      getAllocationData: () => {
        const portfolio = get().getActivePortfolio();
        if (!portfolio) return [];

        const totalValue = get().getTotalValue();
        if (totalValue === 0) return [];

        const byType: Record<string, number> = {};

        portfolio.positions.forEach((pos) => {
          const value = pos.quantity * pos.currentPrice;
          const typeName = pos.assetType.charAt(0).toUpperCase() + pos.assetType.slice(1);
          byType[typeName] = (byType[typeName] || 0) + value;
        });

        // Add cash to allocation
        if (portfolio.cashBalance && portfolio.cashBalance > 0) {
          byType['Cash'] = portfolio.cashBalance;
        }

        return Object.entries(byType).map(([name, value]) => ({
          name: name.replace('_', ' '),
          value,
          percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
          color: ASSET_COLORS[name.toLowerCase().replace(' ', '_') as AssetType] || '#6b7280',
        }));
      },
    }),
    {
      name: 'portfolio-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        portfolios: state.portfolios,
        activePortfolioId: state.activePortfolioId,
        transactions: state.transactions,
        historicalData: state.historicalData,
      }),
    }
  )
);
