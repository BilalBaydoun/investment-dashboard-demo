'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InsightCard } from '@/components/ai/InsightCard';
import { EnhancedAnalysis } from '@/components/ai/EnhancedAnalysis';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { PriceChart } from '@/components/charts/PriceChart';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, Brain, TrendingUp, MessageSquare, Sparkles, Loader2, BarChart3, Eye, Check } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import type { AISignal, PortfolioAnalysis } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fetchWithApiKeys, postWithApiKeys } from '@/lib/api/apiKeys';

function AnalysisContent() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [aiSignal, setAiSignal] = useState<AISignal | null>(null);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [isLoadingSignal, setIsLoadingSignal] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [initialSymbolProcessed, setInitialSymbolProcessed] = useState(false);

  const { getActivePortfolio, getTotalValue, getTotalCost } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const { items: watchlistItems, addItem: addToWatchlist } = useWatchlistStore();

  // Wait for hydration to complete
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle symbol from URL query parameter
  useEffect(() => {
    if (mounted && !initialSymbolProcessed) {
      const symbolFromUrl = searchParams.get('symbol');
      if (symbolFromUrl) {
        setSearchSymbol(symbolFromUrl.toUpperCase());
        setInitialSymbolProcessed(true);
        // Trigger analysis after a small delay to ensure state is set
        setTimeout(() => {
          handleAnalyzeSymbol(symbolFromUrl);
        }, 100);
      }
    }
  }, [mounted, searchParams, initialSymbolProcessed]);

  const handleAnalyzeSymbol = async (symbol: string) => {
    if (!symbol.trim()) return;

    setSelectedSymbol(symbol.toUpperCase());
    setIsLoadingSignal(true);
    setAiSignal(null);

    // Get screener data from URL params if coming from AI Picks
    const screenerScore = searchParams.get('screenerScore');
    const screenerRating = searchParams.get('screenerRating');
    const screenerPE = searchParams.get('pe');
    const screenerDividend = searchParams.get('dividendYield');

    try {
      // Fetch Alpha Vantage analysis data
      const analysisRes = await fetchWithApiKeys(`/api/analysis?symbol=${symbol}`);
      const avAnalysis = await analysisRes.json();

      // Fetch news (with API key from localStorage) - get more articles for comprehensive analysis
      const newsResponse = await fetchWithApiKeys(`/api/news?symbol=${symbol}&limit=10`);
      const newsData = await newsResponse.json();

      // Get AI analysis (with API key from localStorage)
      // Include screener data if available for rating consistency
      const analysisResponse = await postWithApiKeys('/api/ai/analyze', {
        action: 'analyze',
        symbol: symbol.toUpperCase(),
        quote: avAnalysis.success ? {
          price: avAnalysis.data.fundamentals.day50MA,
          week52High: avAnalysis.data.fundamentals.week52High,
          week52Low: avAnalysis.data.fundamentals.week52Low,
        } : null,
        fundamentals: avAnalysis.success ? avAnalysis.data.fundamentals : null,
        fairValue: avAnalysis.success ? avAnalysis.data.fairValue : null,
        earnings: avAnalysis.success ? avAnalysis.data.earnings : null,
        news: newsData.data || [],
        screenerData: screenerScore ? {
          buyScore: parseInt(screenerScore),
          rating: screenerRating,
          pe: screenerPE ? parseFloat(screenerPE) : undefined,
          dividendYield: screenerDividend ? parseFloat(screenerDividend) : undefined,
        } : undefined,
      });

      const analysisData = await analysisResponse.json();

      if (analysisData.success) {
        // Include news data in the signal for display
        setAiSignal({
          ...analysisData.data,
          relatedNews: newsData.data || [],
        });
      } else {
        throw new Error(analysisData.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to analyze symbol. Please try again.');
    } finally {
      setIsLoadingSignal(false);
    }
  };

  const handleAnalyzePortfolio = async () => {
    if (!portfolio || portfolio.positions.length === 0) {
      toast.error('Add positions to your portfolio first');
      return;
    }

    setIsLoadingPortfolio(true);
    setPortfolioAnalysis(null);

    try {
      // Portfolio analysis with API key from localStorage
      const response = await postWithApiKeys('/api/ai/analyze', {
        action: 'portfolio',
        positions: portfolio.positions,
        totalValue: getTotalValue(),
        totalCost: getTotalCost(),
      });

      const data = await response.json();

      if (data.success) {
        setPortfolioAnalysis(data.data);
      } else {
        throw new Error(data.error || 'Portfolio analysis failed');
      }
    } catch (error) {
      console.error('Portfolio analysis error:', error);
      toast.error('Failed to analyze portfolio. Please try again.');
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleAnalyzeSymbol(searchSymbol);
  };

  // Quick analyze buttons for portfolio positions
  const quickAnalyzeSymbols = mounted ? (portfolio?.positions.slice(0, 5).map((p) => p.symbol) || []) : [];

  // Show loading skeleton until hydrated
  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header
          title="AI Analysis"
          subtitle="Get intelligent insights on your investments"
        />
        <div className="p-3 md:p-6 space-y-6">
          <div className="w-full max-w-md">
            <Skeleton className="h-10 w-full mb-4" />
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="AI Analysis"
        subtitle="Get intelligent insights on your investments"
      />

      <div className="p-3 md:p-6 space-y-6">
        <Tabs defaultValue="symbol" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="symbol">
              <Search className="h-4 w-4 mr-2" />
              Symbol
            </TabsTrigger>
            <TabsTrigger value="portfolio">
              <Brain className="h-4 w-4 mr-2" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
          </TabsList>

          {/* Symbol Analysis Tab */}
          <TabsContent value="symbol" className="space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSearch} className="flex gap-3">
                  <Input
                    placeholder="Enter symbol (e.g., AAPL, MSFT, BTC)"
                    value={searchSymbol}
                    onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoadingSignal}>
                    {isLoadingSignal ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analyze
                  </Button>
                </form>

                {/* Quick Analyze Buttons */}
                {quickAnalyzeSymbols.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">Quick analyze:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickAnalyzeSymbols.map((symbol) => (
                        <Button
                          key={symbol}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchSymbol(symbol);
                            handleAnalyzeSymbol(symbol);
                          }}
                          disabled={isLoadingSignal}
                        >
                          {symbol}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis Results */}
            {selectedSymbol && (
              <div className="space-y-6">
                {/* Deep Fundamental Analysis Section Header */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Deep Fundamental Analysis
                      <Badge variant="outline" className="text-xs ml-2">Alpha Vantage</Badge>
                    </h2>
                    {(() => {
                      const isInWatchlist = watchlistItems.some(item => item.symbol === selectedSymbol);
                      return (
                        <Button
                          variant={isInWatchlist ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={isInWatchlist}
                          onClick={() => {
                            addToWatchlist({
                              symbol: selectedSymbol,
                              name: aiSignal?.symbol || selectedSymbol,
                              assetType: 'stock',
                              alertEnabled: false,
                            });
                            toast.success(`${selectedSymbol} added to watchlist`);
                          }}
                        >
                          {isInWatchlist ? (
                            <>
                              <Check className="h-4 w-4 mr-1.5" />
                              In Watchlist
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-1.5" />
                              Add to Watchlist
                            </>
                          )}
                        </Button>
                      );
                    })()}
                  </div>

                  {/* Enhanced Analysis with Chart */}
                  <EnhancedAnalysis
                    symbol={selectedSymbol}
                    currentPrice={aiSignal?.entryPrice}
                    chartElement={<PriceChart symbol={selectedSymbol} isLoading={isLoadingSignal} />}
                  />
                </div>

                {/* AI Analysis & News Section - Below */}
                <div className="border-t pt-6">
                  {isLoadingSignal ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5 animate-pulse" />
                          Analyzing {selectedSymbol}...
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  ) : aiSignal ? (
                    <InsightCard signal={aiSignal} />
                  ) : null}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Portfolio Analysis Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Portfolio Optimization
                  </span>
                  <Button onClick={handleAnalyzePortfolio} disabled={isLoadingPortfolio}>
                    {isLoadingPortfolio ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Analyze Portfolio
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPortfolio ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                ) : portfolioAnalysis ? (
                  <div className="space-y-6">
                    {/* Scores */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Diversification</p>
                        <p className="text-3xl font-bold mt-1">
                          {portfolioAnalysis.diversificationScore}/10
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Risk Score</p>
                        <p className="text-3xl font-bold mt-1">
                          {portfolioAnalysis.riskScore}/10
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                        <p className="text-3xl font-bold mt-1">
                          {portfolioAnalysis.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <h3 className="font-semibold mb-3">Recommendations</h3>
                      <ul className="space-y-2">
                        {portfolioAnalysis.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Rebalance Suggestions */}
                    {portfolioAnalysis.rebalanceSuggestions.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3">Rebalancing Suggestions</h3>
                        <div className="space-y-3">
                          {portfolioAnalysis.rebalanceSuggestions.map((suggestion, index) => {
                            const amount = Number(suggestion.amount) || 0;
                            const currentAlloc = Number(suggestion.currentAllocation) || 0;
                            const targetAlloc = Number(suggestion.targetAllocation) || 0;
                            const isNewPosition = currentAlloc === 0;
                            const displayAmount = Math.abs(amount);

                            return (
                              <div
                                key={index}
                                className={cn(
                                  "p-4 rounded-lg border",
                                  suggestion.action === 'increase' && "border-green-500/30 bg-green-500/5",
                                  suggestion.action === 'decrease' && "border-red-500/30 bg-red-500/5"
                                )}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold">{suggestion.symbol}</p>
                                      {isNewPosition && (
                                        <Badge variant="outline" className="text-xs">NEW</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {suggestion.reason}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                      {isNewPosition
                                        ? `Suggested allocation: ${targetAlloc}%`
                                        : `Current: ${currentAlloc}% → Target: ${targetAlloc}%`
                                      }
                                    </p>
                                  </div>
                                  <Badge
                                    className={cn(
                                      "shrink-0 text-sm px-3 py-1",
                                      suggestion.action === 'increase' && "bg-green-500 hover:bg-green-600",
                                      suggestion.action === 'decrease' && "bg-red-500 hover:bg-red-600"
                                    )}
                                  >
                                    {suggestion.action === 'increase' ? '+' : '-'}{displayAmount}%
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Click "Analyze Portfolio" to get AI-powered optimization suggestions
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <ChatInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function AnalysisLoading() {
  return (
    <div className="min-h-screen">
      <Header
        title="AI Analysis"
        subtitle="Get intelligent insights on your investments"
      />
      <div className="p-3 md:p-6 space-y-6">
        <div className="w-full max-w-md">
          <Skeleton className="h-10 w-full mb-4" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisLoading />}>
      <AnalysisContent />
    </Suspense>
  );
}
