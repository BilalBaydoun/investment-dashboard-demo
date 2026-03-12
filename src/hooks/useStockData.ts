import { useState, useEffect, useCallback } from 'react';
import type { Quote, OHLC, TechnicalIndicators, TimeRange } from '@/types';
import { useMarketStore } from '@/store/marketStore';

interface UseStockDataOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export function useStockData(
  symbol: string | null,
  options: UseStockDataOptions = {}
) {
  const { autoRefresh = false, refreshInterval = 5 * 60 * 1000 } = options;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [historicalData, setHistoricalData] = useState<OHLC[]>([]);
  const [technicals, setTechnicals] = useState<TechnicalIndicators | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setQuote: storeQuote, setHistoricalData: storeHistorical, setTechnicalIndicators } = useMarketStore();

  const fetchQuote = useCallback(async () => {
    if (!symbol) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stocks?symbol=${symbol}&action=quote`);
      const data = await response.json();

      if (data.success && data.data) {
        setQuote(data.data);
        storeQuote(symbol, data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch quote');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, storeQuote]);

  const fetchHistorical = useCallback(async (range: TimeRange = '1M') => {
    if (!symbol) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stocks?symbol=${symbol}&action=history&range=${range}`);
      const data = await response.json();

      if (data.success && data.data) {
        setHistoricalData(data.data);
        storeHistorical(symbol, data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch historical data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, storeHistorical]);

  const fetchTechnicals = useCallback(async () => {
    if (!symbol) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stocks?symbol=${symbol}&action=technicals`);
      const data = await response.json();

      if (data.success && data.data) {
        setTechnicals(data.data);
        setTechnicalIndicators(symbol, data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch technical indicators');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, setTechnicalIndicators]);

  const fetchAll = useCallback(async (range: TimeRange = '1M') => {
    if (!symbol) return;

    setIsLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchQuote(),
        fetchHistorical(range),
        fetchTechnicals(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, fetchQuote, fetchHistorical, fetchTechnicals]);

  // Initial fetch
  useEffect(() => {
    if (symbol) {
      fetchQuote();
    }
  }, [symbol, fetchQuote]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !symbol) return;

    const interval = setInterval(fetchQuote, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, symbol, refreshInterval, fetchQuote]);

  return {
    quote,
    historicalData,
    technicals,
    isLoading,
    error,
    fetchQuote,
    fetchHistorical,
    fetchTechnicals,
    fetchAll,
  };
}

export function useMultipleStockData(symbols: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setQuotes: storeQuotes } = useMarketStore();

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stocks?symbols=${symbols.join(',')}&action=quotes`);
      const data = await response.json();

      if (data.success && data.data) {
        setQuotes(data.data);
        storeQuotes(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch quotes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [symbols, storeQuotes]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    isLoading,
    error,
    refetch: fetchQuotes,
  };
}
