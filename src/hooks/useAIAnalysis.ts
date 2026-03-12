import { useState, useCallback } from 'react';
import type { AISignal, PortfolioAnalysis, SentimentAnalysis, Position, Quote, TechnicalIndicators, NewsItem } from '@/types';
import { fetchWithApiKeys, postWithApiKeys } from '@/lib/api/apiKeys';

interface UseAIAnalysisOptions {
  onSuccess?: (data: AISignal | PortfolioAnalysis) => void;
  onError?: (error: string) => void;
}

export function useAIAnalysis(options: UseAIAnalysisOptions = {}) {
  const [signal, setSignal] = useState<AISignal | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSymbol = useCallback(async (
    symbol: string,
    quote: Quote,
    technicals?: TechnicalIndicators | null,
    news?: NewsItem[]
  ) => {
    setIsLoading(true);
    setError(null);
    setSignal(null);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          symbol,
          quote,
          technicals,
          news: news || [],
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const signalData: AISignal = {
          ...data.data,
          symbol,
          generatedAt: new Date(data.data.generatedAt),
        };
        setSignal(signalData);
        options.onSuccess?.(signalData);
        return signalData;
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      options.onError?.(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const analyzePortfolio = useCallback(async (
    positions: Position[],
    totalValue: number,
    totalCost: number
  ) => {
    setIsLoading(true);
    setError(null);
    setPortfolioAnalysis(null);

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'portfolio',
          positions,
          totalValue,
          totalCost,
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const analysisData: PortfolioAnalysis = {
          ...data.data,
          totalValue,
          totalCost,
          totalGain: totalValue - totalCost,
          totalGainPercent: ((totalValue - totalCost) / totalCost) * 100,
          generatedAt: new Date(data.data.generatedAt),
        };
        setPortfolioAnalysis(analysisData);
        options.onSuccess?.(analysisData);
        return analysisData;
      } else {
        throw new Error(data.error || 'Portfolio analysis failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      options.onError?.(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const clearAnalysis = useCallback(() => {
    setSignal(null);
    setPortfolioAnalysis(null);
    setError(null);
  }, []);

  return {
    signal,
    portfolioAnalysis,
    isLoading,
    error,
    analyzeSymbol,
    analyzePortfolio,
    clearAnalysis,
  };
}

export function useSentimentAnalysis() {
  const [sentiment, setSentiment] = useState<SentimentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeSentiment = useCallback(async (symbol: string) => {
    setIsLoading(true);
    setError(null);
    setSentiment(null);

    try {
      // Fetch news first (uses Alpha Vantage for stock-specific news)
      const newsResponse = await fetchWithApiKeys(`/api/news?symbol=${symbol}&limit=10`);
      const newsData = await newsResponse.json();

      if (!newsData.success || !newsData.data || newsData.data.length === 0) {
        throw new Error('No news available for sentiment analysis');
      }

      // Analyze sentiment
      const response = await postWithApiKeys('/api/ai/analyze', {
        action: 'sentiment',
        symbol,
        news: newsData.data,
      });

      const data = await response.json();

      if (data.success && data.data) {
        const sentimentData: SentimentAnalysis = {
          symbol,
          overallSentiment: data.data.overallSentiment,
          sentimentScore: data.data.sentimentScore,
          newsCount: newsData.data.length,
          positiveCount: newsData.data.filter((n: NewsItem) => n.sentiment === 'bullish').length,
          negativeCount: newsData.data.filter((n: NewsItem) => n.sentiment === 'bearish').length,
          neutralCount: newsData.data.filter((n: NewsItem) => n.sentiment === 'neutral').length,
          keyTopics: data.data.keyTopics || [],
          recentHeadlines: newsData.data.slice(0, 5),
          updatedAt: new Date(),
        };
        setSentiment(sentimentData);
        return sentimentData;
      } else {
        // Fallback: calculate sentiment from news data
        const positiveCount = newsData.data.filter((n: NewsItem) => n.sentiment === 'bullish').length;
        const negativeCount = newsData.data.filter((n: NewsItem) => n.sentiment === 'bearish').length;
        const neutralCount = newsData.data.filter((n: NewsItem) => n.sentiment === 'neutral').length;
        const total = newsData.data.length;

        const sentimentScore = ((positiveCount - negativeCount) / total) * 100;
        const overallSentiment = sentimentScore > 20 ? 'bullish' : sentimentScore < -20 ? 'bearish' : 'neutral';

        const sentimentData: SentimentAnalysis = {
          symbol,
          overallSentiment,
          sentimentScore: Math.round(sentimentScore),
          newsCount: total,
          positiveCount,
          negativeCount,
          neutralCount,
          keyTopics: [],
          recentHeadlines: newsData.data.slice(0, 5),
          updatedAt: new Date(),
        };
        setSentiment(sentimentData);
        return sentimentData;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sentiment,
    isLoading,
    error,
    analyzeSentiment,
  };
}
