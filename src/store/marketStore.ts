import { create } from 'zustand';
import type { Quote, OHLC, TechnicalIndicators, TimeRange, NewsItem } from '@/types';

interface MarketState {
  quotes: Record<string, Quote>;
  historicalData: Record<string, OHLC[]>;
  technicalIndicators: Record<string, TechnicalIndicators>;
  news: NewsItem[];
  selectedSymbol: string | null;
  selectedTimeRange: TimeRange;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;

  // Actions
  setQuote: (symbol: string, quote: Quote) => void;
  setQuotes: (quotes: Record<string, Quote>) => void;
  setHistoricalData: (symbol: string, data: OHLC[]) => void;
  setTechnicalIndicators: (symbol: string, indicators: TechnicalIndicators) => void;
  setNews: (news: NewsItem[]) => void;
  addNews: (newsItem: NewsItem) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  setTimeRange: (range: TimeRange) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearData: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  quotes: {},
  historicalData: {},
  technicalIndicators: {},
  news: [],
  selectedSymbol: null,
  selectedTimeRange: '1M',
  isLoading: false,
  lastUpdated: null,
  error: null,

  setQuote: (symbol, quote) =>
    set((state) => ({
      quotes: { ...state.quotes, [symbol]: quote },
      lastUpdated: new Date(),
    })),

  setQuotes: (quotes) =>
    set((state) => ({
      quotes: { ...state.quotes, ...quotes },
      lastUpdated: new Date(),
    })),

  setHistoricalData: (symbol, data) =>
    set((state) => ({
      historicalData: { ...state.historicalData, [symbol]: data },
    })),

  setTechnicalIndicators: (symbol, indicators) =>
    set((state) => ({
      technicalIndicators: { ...state.technicalIndicators, [symbol]: indicators },
    })),

  setNews: (news) => set({ news }),

  addNews: (newsItem) =>
    set((state) => ({
      news: [newsItem, ...state.news].slice(0, 100),
    })),

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  setTimeRange: (range) => set({ selectedTimeRange: range }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearData: () =>
    set({
      quotes: {},
      historicalData: {},
      technicalIndicators: {},
      news: [],
      selectedSymbol: null,
      lastUpdated: null,
    }),
}));
