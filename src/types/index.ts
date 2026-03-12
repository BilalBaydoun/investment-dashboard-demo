// Asset Types
export type AssetType = 'stock' | 'crypto' | 'etf' | 'bond' | 'real_estate' | 'cash' | 'commodity';
export type QuantityUnit = 'units' | 'grams' | 'kg' | 'oz' | 'troy_oz';
export type TransactionType = 'buy' | 'sell' | 'dividend' | 'deposit' | 'withdrawal';
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';
export type SentimentType = 'bullish' | 'bearish' | 'neutral';

// Portfolio Types
export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  previousClose: number;
  createdAt: Date;
  updatedAt: Date;
  manualPriceOnly?: boolean; // If true, price won't be auto-updated by API
  isin?: string; // ISIN code for international securities
  exchange?: string; // Exchange code (e.g., LSE, XETRA)
  unit?: QuantityUnit; // Unit of measurement (for commodities like gold/silver)
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  positions: Position[];
  cashBalance: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  positionId: string;
  symbol: string;
  type: TransactionType;
  assetType?: AssetType;
  quantity: number;
  price: number;
  total: number;
  date: Date;
  notes?: string;
}

// Market Data Types
export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  assetType: AssetType;
  timestamp: Date;
}

export interface OHLC {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
}

// AI Analysis Types
export interface AISignal {
  symbol: string;
  action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number; // 0-100
  technicalScore: number; // 1-10
  fundamentalScore?: number; // 1-10
  sentimentScore: number; // 1-10
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  riskLevel: 'low' | 'medium' | 'high';
  reasoning: string;
  newsSummary?: string;
  patterns: string[];
  supportLevels: number[];
  resistanceLevels: number[];
  generatedAt: Date;
  relatedNews?: NewsItem[];
  // Real-time technicals from Alpha Vantage for comparison
  realTechnicals?: {
    indicators: {
      rsi?: { value: number; signal: string; period: number };
      macd?: { macd: number; signal: number; histogram: number; trend: string };
      sma?: { sma20?: number; sma50?: number; sma200?: number };
      ema?: { ema12?: number; ema26?: number };
      bollingerBands?: { upper: number; middle: number; lower: number };
      stochastic?: { k: number; d: number; signal: string };
      adx?: { value: number; trend: string };
      atr?: { value: number };
    };
    summary?: {
      technicalScore: number;
      overallSignal: string;
      bullishSignals: number;
      bearishSignals: number;
      totalSignals: number;
    };
  };
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  diversificationScore: number; // 1-10
  riskScore: number; // 1-10
  sharpeRatio: number;
  recommendations: string[];
  rebalanceSuggestions: RebalanceSuggestion[];
  generatedAt: Date;
}

export interface RebalanceSuggestion {
  symbol: string;
  currentAllocation: number;
  targetAllocation: number;
  action: 'increase' | 'decrease' | 'hold';
  amount: number;
  reason: string;
}

export interface SentimentAnalysis {
  symbol: string;
  overallSentiment: SentimentType;
  sentimentScore: number; // -100 to 100
  newsCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  keyTopics: string[];
  recentHeadlines: NewsItem[];
  updatedAt: Date;
}

// News Types
export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  sentiment: SentimentType;
  relevantSymbols: string[];
}

// Watchlist Types
export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  targetPrice?: number;
  alertEnabled: boolean;
  notes?: string;
  createdAt: Date;
}

// Goal Types
export interface InvestmentGoal {
  id: string;
  userId: string;
  targetPercentage: number;
  startDate: Date;
  targetDate?: Date;
  startingValue: number;
  currentValue: number;
  isAchieved: boolean;
}

export interface SavedGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetGrowth: number;
  timelineMonths: number;
  monthlyContribution: number;
  expectedReturn: number;
  volatility: number;
  createdAt: string;
  updatedAt: string;
}

// Chart Types
export interface ChartDataPoint {
  date: string;
  value: number;
  [key: string]: string | number;
}

export interface AllocationData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

// User Preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  defaultTimeRange: TimeRange;
  notifications: {
    priceAlerts: boolean;
    newsAlerts: boolean;
    goalProgress: boolean;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
