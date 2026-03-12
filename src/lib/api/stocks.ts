import type { Quote, OHLC, TimeRange, TechnicalIndicators } from '@/types';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Helper to get time series function and interval based on time range
function getTimeSeriesParams(range: TimeRange): { function: string; interval?: string; outputsize?: string } {
  switch (range) {
    case '1D':
      return { function: 'TIME_SERIES_INTRADAY', interval: '5min', outputsize: 'full' };
    case '1W':
      return { function: 'TIME_SERIES_INTRADAY', interval: '60min', outputsize: 'full' };
    case '1M':
    case '3M':
      return { function: 'TIME_SERIES_DAILY', outputsize: 'compact' };
    case '6M':
    case '1Y':
    case 'YTD':
      return { function: 'TIME_SERIES_DAILY', outputsize: 'full' };
    case 'ALL':
      return { function: 'TIME_SERIES_WEEKLY' };
    default:
      return { function: 'TIME_SERIES_DAILY', outputsize: 'compact' };
  }
}

export async function fetchStockQuote(symbol: string): Promise<Quote | null> {
  try {
    const response = await fetch(`/api/stocks?symbol=${symbol}&action=quote`);
    if (!response.ok) throw new Error('Failed to fetch quote');
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching stock quote:', error);
    return null;
  }
}

export async function fetchMultipleQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  try {
    const response = await fetch(`/api/stocks?symbols=${symbols.join(',')}&action=quotes`);
    if (!response.ok) throw new Error('Failed to fetch quotes');
    const data = await response.json();
    return data.data || {};
  } catch (error) {
    console.error('Error fetching multiple quotes:', error);
    return {};
  }
}

export async function fetchHistoricalData(symbol: string, range: TimeRange): Promise<OHLC[]> {
  try {
    const response = await fetch(`/api/stocks?symbol=${symbol}&action=history&range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch historical data');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
}

export async function fetchTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null> {
  try {
    const response = await fetch(`/api/stocks?symbol=${symbol}&action=technicals`);
    if (!response.ok) throw new Error('Failed to fetch technical indicators');
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching technical indicators:', error);
    return null;
  }
}

export async function searchStocks(query: string): Promise<{ symbol: string; name: string; type: string }[]> {
  try {
    const response = await fetch(`/api/stocks?query=${query}&action=search`);
    if (!response.ok) throw new Error('Failed to search stocks');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
}

// Format large numbers for display
export function formatNumber(num: number, decimals = 2): string {
  if (Math.abs(num) >= 1e12) {
    return (num / 1e12).toFixed(decimals) + 'T';
  }
  if (Math.abs(num) >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  }
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

// Format currency
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format percentage
export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}
