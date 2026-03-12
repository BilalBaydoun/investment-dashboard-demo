import type { Quote, OHLC, TimeRange } from '@/types';

export async function fetchCryptoQuote(symbol: string): Promise<Quote | null> {
  try {
    const response = await fetch(`/api/crypto?symbol=${symbol}&action=quote`);
    if (!response.ok) throw new Error('Failed to fetch crypto quote');
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error fetching crypto quote:', error);
    return null;
  }
}

export async function fetchMultipleCryptoQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  try {
    const response = await fetch(`/api/crypto?symbols=${symbols.join(',')}&action=quotes`);
    if (!response.ok) throw new Error('Failed to fetch crypto quotes');
    const data = await response.json();
    return data.data || {};
  } catch (error) {
    console.error('Error fetching multiple crypto quotes:', error);
    return {};
  }
}

export async function fetchCryptoHistory(symbol: string, range: TimeRange): Promise<OHLC[]> {
  try {
    const response = await fetch(`/api/crypto?symbol=${symbol}&action=history&range=${range}`);
    if (!response.ok) throw new Error('Failed to fetch crypto history');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching crypto history:', error);
    return [];
  }
}

export async function searchCrypto(query: string): Promise<{ id: string; symbol: string; name: string }[]> {
  try {
    const response = await fetch(`/api/crypto?query=${query}&action=search`);
    if (!response.ok) throw new Error('Failed to search crypto');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error searching crypto:', error);
    return [];
  }
}

export async function fetchTopCryptos(limit = 10): Promise<Quote[]> {
  try {
    const response = await fetch(`/api/crypto?action=top&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch top cryptos');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching top cryptos:', error);
    return [];
  }
}

// Get days for historical data based on time range
export function getDaysForRange(range: TimeRange): number {
  switch (range) {
    case '1D':
      return 1;
    case '1W':
      return 7;
    case '1M':
      return 30;
    case '3M':
      return 90;
    case '6M':
      return 180;
    case '1Y':
      return 365;
    case 'YTD':
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    case 'ALL':
      return 365 * 5; // 5 years
    default:
      return 30;
  }
}
