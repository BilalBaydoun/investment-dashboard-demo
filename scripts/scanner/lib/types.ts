export interface AlphaVantageFundamentals {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  pbRatio: number;
  roe: number;
  profitMargin: number;
  operatingMargin: number;
  dividendYield: number;
  eps: number;
  analystTargetPrice: number;
  week52High: number;
  week52Low: number;
  beta: number;
  revenueGrowth: number;
  earningsGrowth: number;
  priceToSales: number;
  evToEbitda: number;
}

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
}

export interface TechnicalIndicators {
  rsi: number | null;
  macdSignal: 'bullish' | 'bearish' | 'neutral';
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  bbMiddle: number | null;
}

export interface ScoredStock {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  currentPrice: number;
  targetPrice: number;
  upside: number;
  buyScore: number;
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell';
  confidence: number;
  marketCap: number;
  marketCapCategory: string;
  pe: number;
  pegRatio: number;
  pbRatio: number;
  roe: number;
  profitMargin: number;
  dividendYield: number;
  priceToSales: number;
  beta: number;
  below52WeekHigh: number;
  above52WeekLow: number;
  reasonsToConsider: string[];
  risks: string[];
  valuationStatus: 'undervalued' | 'fair' | 'overvalued';
  technicalScore: number | null;
}

export interface SectorBreakdown {
  count: number;
  avgScore: number;
  topPick: string;
  topPickScore: number;
}

export interface WeeklyAnalysis {
  generatedAt: string;
  scanDurationMinutes: number;
  totalTickersScanned: number;
  totalCandidatesAnalyzed: number;
  topPicks: ScoredStock[];
  hiddenGems: ScoredStock[];
  sectorBreakdown: Record<string, SectorBreakdown>;
  allAnalyzed: ScoredStock[];
}

export interface Checkpoint {
  phase: string;
  completedSymbols: string[];
  results: Record<string, any>;
  timestamp: string;
}

export interface Ticker {
  symbol: string;
  name: string;
  exchange: string;
  assetType: string;
  ipoDate: string;
  status: string;
}
