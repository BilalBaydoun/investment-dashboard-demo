export interface WeeklyScoredStock {
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

export interface WeeklySectorBreakdown {
  count: number;
  avgScore: number;
  topPick: string;
  topPickScore: number;
}

export interface WeeklyAnalysisData {
  generatedAt: string | null;
  scanDurationMinutes: number;
  totalTickersScanned: number;
  totalCandidatesAnalyzed: number;
  topPicks: WeeklyScoredStock[];
  hiddenGems: WeeklyScoredStock[];
  sectorBreakdown: Record<string, WeeklySectorBreakdown>;
  allAnalyzed: WeeklyScoredStock[];
}

let cachedData: WeeklyAnalysisData | null = null;

export async function getWeeklyData(): Promise<WeeklyAnalysisData | null> {
  if (cachedData) return cachedData;

  try {
    const response = await fetch('/api/weekly-data');
    if (!response.ok) return null;
    const data = await response.json();
    if (data.success && data.data) {
      cachedData = data.data;
      return cachedData;
    }
    return null;
  } catch {
    return null;
  }
}

export function getWeeklyTopPicks(data: WeeklyAnalysisData): WeeklyScoredStock[] {
  return data.topPicks;
}

export function getWeeklyHiddenGems(data: WeeklyAnalysisData): WeeklyScoredStock[] {
  return data.hiddenGems;
}

export function getWeeklySectorBreakdown(data: WeeklyAnalysisData): Record<string, WeeklySectorBreakdown> {
  return data.sectorBreakdown;
}

export function getWeeklyAnalysisDate(data: WeeklyAnalysisData): string | null {
  return data.generatedAt;
}

export function isWeeklyDataStale(data: WeeklyAnalysisData): boolean {
  if (!data.generatedAt) return true;
  const generated = new Date(data.generatedAt).getTime();
  const eightDays = 8 * 24 * 60 * 60 * 1000;
  return Date.now() - generated > eightDays;
}

export function clearWeeklyCache(): void {
  cachedData = null;
}
