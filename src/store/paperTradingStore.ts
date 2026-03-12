import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface PaperPosition {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  openDate: Date;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  name: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  date: Date;
  pnl?: number; // Profit/loss for sell orders
}

interface PaperTradingState {
  cashBalance: number;
  startingBalance: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
  isActive: boolean;

  // Actions
  startPaperTrading: (startingBalance?: number) => void;
  resetPaperTrading: () => void;
  executeBuy: (symbol: string, name: string, quantity: number, price: number) => boolean;
  executeSell: (symbol: string, quantity: number, price: number) => boolean;
  updatePrices: (prices: Record<string, number>) => void;

  // Computed
  getTotalValue: () => number;
  getTotalPnL: () => number;
  getTotalPnLPercent: () => number;
  getPositionPnL: (positionId: string) => { pnl: number; percent: number };
}

const generateId = () => crypto.randomUUID();

const DEFAULT_STARTING_BALANCE = 100000;

export const usePaperTradingStore = create<PaperTradingState>()(
  persist(
    (set, get) => ({
      cashBalance: DEFAULT_STARTING_BALANCE,
      startingBalance: DEFAULT_STARTING_BALANCE,
      positions: [],
      trades: [],
      isActive: false,

      startPaperTrading: (startingBalance = DEFAULT_STARTING_BALANCE) => {
        set({
          cashBalance: startingBalance,
          startingBalance,
          positions: [],
          trades: [],
          isActive: true,
        });
      },

      resetPaperTrading: () => {
        const currentStarting = get().startingBalance;
        set({
          cashBalance: currentStarting,
          positions: [],
          trades: [],
        });
      },

      executeBuy: (symbol, name, quantity, price) => {
        const state = get();
        const total = quantity * price;

        if (total > state.cashBalance) {
          return false; // Insufficient funds
        }

        const existingPosition = state.positions.find((p) => p.symbol === symbol);

        if (existingPosition) {
          // Average up/down
          const newQuantity = existingPosition.quantity + quantity;
          const newAvgCost =
            (existingPosition.avgCost * existingPosition.quantity + total) / newQuantity;

          set((s) => ({
            cashBalance: s.cashBalance - total,
            positions: s.positions.map((p) =>
              p.id === existingPosition.id
                ? { ...p, quantity: newQuantity, avgCost: newAvgCost, currentPrice: price }
                : p
            ),
            trades: [
              ...s.trades,
              {
                id: generateId(),
                symbol,
                name,
                type: 'buy',
                quantity,
                price,
                total,
                date: new Date(),
              },
            ],
          }));
        } else {
          // New position
          set((s) => ({
            cashBalance: s.cashBalance - total,
            positions: [
              ...s.positions,
              {
                id: generateId(),
                symbol,
                name,
                quantity,
                avgCost: price,
                currentPrice: price,
                openDate: new Date(),
              },
            ],
            trades: [
              ...s.trades,
              {
                id: generateId(),
                symbol,
                name,
                type: 'buy',
                quantity,
                price,
                total,
                date: new Date(),
              },
            ],
          }));
        }

        return true;
      },

      executeSell: (symbol, quantity, price) => {
        const state = get();
        const position = state.positions.find((p) => p.symbol === symbol);

        if (!position || position.quantity < quantity) {
          return false; // Can't sell what you don't have
        }

        const total = quantity * price;
        const costBasis = position.avgCost * quantity;
        const pnl = total - costBasis;

        if (position.quantity === quantity) {
          // Close entire position
          set((s) => ({
            cashBalance: s.cashBalance + total,
            positions: s.positions.filter((p) => p.id !== position.id),
            trades: [
              ...s.trades,
              {
                id: generateId(),
                symbol,
                name: position.name,
                type: 'sell',
                quantity,
                price,
                total,
                date: new Date(),
                pnl,
              },
            ],
          }));
        } else {
          // Partial sell
          set((s) => ({
            cashBalance: s.cashBalance + total,
            positions: s.positions.map((p) =>
              p.id === position.id
                ? { ...p, quantity: p.quantity - quantity, currentPrice: price }
                : p
            ),
            trades: [
              ...s.trades,
              {
                id: generateId(),
                symbol,
                name: position.name,
                type: 'sell',
                quantity,
                price,
                total,
                date: new Date(),
                pnl,
              },
            ],
          }));
        }

        return true;
      },

      updatePrices: (prices) => {
        set((s) => ({
          positions: s.positions.map((p) =>
            prices[p.symbol] !== undefined ? { ...p, currentPrice: prices[p.symbol] } : p
          ),
        }));
      },

      getTotalValue: () => {
        const state = get();
        const positionsValue = state.positions.reduce(
          (sum, p) => sum + p.quantity * p.currentPrice,
          0
        );
        return state.cashBalance + positionsValue;
      },

      getTotalPnL: () => {
        const state = get();
        return get().getTotalValue() - state.startingBalance;
      },

      getTotalPnLPercent: () => {
        const state = get();
        if (state.startingBalance === 0) return 0;
        return (get().getTotalPnL() / state.startingBalance) * 100;
      },

      getPositionPnL: (positionId) => {
        const position = get().positions.find((p) => p.id === positionId);
        if (!position) return { pnl: 0, percent: 0 };

        const currentValue = position.quantity * position.currentPrice;
        const costBasis = position.quantity * position.avgCost;
        const pnl = currentValue - costBasis;
        const percent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        return { pnl, percent };
      },
    }),
    {
      name: 'paper-trading-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
