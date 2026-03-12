'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  DollarSign,
  Users,
  Building2,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Calculator,
  PieChart,
  Activity,
} from 'lucide-react';
import { formatCurrency } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';
import { fetchWithApiKeys } from '@/lib/api/apiKeys';
import { AssetLogo } from '@/components/ui/asset-logo';

interface EnhancedAnalysisProps {
  symbol: string;
  currentPrice?: number;
  chartElement?: React.ReactNode;
}

interface TechnicalsData {
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
}

interface BuffettBreakdown {
  category: string;
  metric: string;
  value: string;
  points: number;
  maxPoints: number;
}

interface BuffettScore {
  total: number;
  rating: string;
  breakdown: BuffettBreakdown[];
}

interface AnalysisData {
  symbol: string;
  fundamentals: any;
  currentQuotePrice?: number;
  buffettScore?: BuffettScore;
  fairValue: {
    estimates: Array<{ method: string; value: number; description: string }>;
    average: number;
    currentPrice: number;
    upside: number;
  };
  earnings: {
    history: Array<{
      fiscalDateEnding: string;
      reportedDate: string;
      reportedEPS: number;
      estimatedEPS: number;
      surprise: number;
      surprisePercentage: number;
      beat: boolean;
    }>;
    nextDate: string;
    nextEstimate: number;
    nextIsEstimated?: boolean;
    beatRate: number;
    avgSurprise: number;
  };
  trends: {
    revenue: { direction: string; cagr: number; consistent: boolean };
    earnings: { direction: string; cagr: number; consistent: boolean };
    freeCashFlow: { direction: string; cagr: number; consistent: boolean };
  };
  analystRatings: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    total: number;
    consensus: string;
  };
  ownership: {
    insiderPercent: number;
    institutionPercent: number;
    shortPercent: number;
    shortRatio: number;
  };
}

interface InsiderTrade {
  name: string;
  title: string;
  date: string;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  value: number;
}

export function EnhancedAnalysis({ symbol, currentPrice, chartElement }: EnhancedAnalysisProps) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [technicals, setTechnicals] = useState<TechnicalsData | null>(null);
  const [insiderTrades, setInsiderTrades] = useState<InsiderTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEarnings, setShowAllEarnings] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!symbol) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch analysis + technicals + insider trades in parallel
        const [analysisRes, techRes, insiderRes] = await Promise.all([
          fetchWithApiKeys(`/api/analysis?symbol=${symbol}`),
          fetchWithApiKeys(`/api/stocks?symbol=${symbol}&action=technicals`),
          fetchWithApiKeys(`/api/insider?symbol=${symbol}`),
        ]);

        const analysisResult = await analysisRes.json();
        if (analysisResult.success) {
          setAnalysisData(analysisResult.data);
        } else {
          setError(analysisResult.error || 'Failed to fetch analysis');
        }

        const techResult = await techRes.json();
        if (techResult.success && techResult.data) {
          setTechnicals(techResult.data);
        }

        const insiderResult = await insiderRes.json();
        if (insiderResult.success && insiderResult.data) {
          setInsiderTrades(insiderResult.data.transactions?.slice(0, 10) || []);
        }
      } catch (err) {
        setError('Failed to load analysis data');
        console.error('Analysis error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [symbol]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Loading Deep Analysis...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !analysisData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-500">
            <AlertCircle className="h-5 w-5" />
            Analysis Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">{error || 'Unable to load analysis data'}</p>
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium mb-2">Troubleshooting:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Check your Alpha Vantage API key in Settings</li>
              <li>Premium plan allows 75 requests/minute - you may have hit the limit</li>
              <li>Wait 30 seconds and try again</li>
              <li>Make sure the symbol is a valid US stock ticker</li>
            </ul>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/settings'}
          >
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { fundamentals, fairValue, earnings, trends, analystRatings, ownership, buffettScore } = analysisData;
  const price = analysisData.currentQuotePrice || currentPrice || fairValue.currentPrice;

  // Use analyst consensus directly from Alpha Vantage
  const getVerdictFromAnalysts = () => {
    const consensus = analystRatings.consensus;
    if (consensus === 'Strong Buy') return { label: 'Strong Buy', color: 'text-green-600', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' };
    if (consensus === 'Buy') return { label: 'Buy', color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' };
    if (consensus === 'Hold') return { label: 'Hold', color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' };
    if (consensus === 'Sell') return { label: 'Sell', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' };
    if (consensus === 'Strong Sell') return { label: 'Strong Sell', color: 'text-red-600', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' };
    return { label: 'No Coverage', color: 'text-muted-foreground', bgColor: 'bg-muted/50', borderColor: 'border-muted' };
  };

  const verdict = getVerdictFromAnalysts();

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <Card className={cn("border-2", verdict.borderColor)}>
        <CardContent className="p-4 md:pt-6">
          <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <AssetLogo
                symbol={symbol}
                assetType="stock"
                size="lg"
              />
              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-bold">{symbol}</h2>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{fundamentals.name}</p>
              </div>
            </div>
            <div className={cn("px-3 py-1.5 md:px-4 md:py-2 rounded-lg shrink-0", verdict.bgColor)}>
              <p className="text-[10px] md:text-xs text-muted-foreground">Consensus</p>
              <p className={cn("text-base md:text-xl font-bold", verdict.color)}>{verdict.label}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="text-center p-2 md:p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] md:text-xs text-muted-foreground">Fair Value</p>
              <p className={cn(
                "text-sm md:text-lg font-bold",
                fairValue.upside > 10 ? "text-green-500" : fairValue.upside < -10 ? "text-red-500" : "text-muted-foreground"
              )}>
                {fairValue.upside > 0 ? '+' : ''}{fairValue.upside.toFixed(0)}%
              </p>
            </div>
            <div className="text-center p-2 md:p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] md:text-xs text-muted-foreground">Rating</p>
              <p className={cn(
                "text-sm md:text-lg font-bold",
                analystRatings.consensus.includes('Buy') ? "text-green-500" :
                analystRatings.consensus.includes('Sell') ? "text-red-500" : "text-amber-500"
              )}>
                {analystRatings.consensus}
              </p>
            </div>
            <div className="text-center p-2 md:p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] md:text-xs text-muted-foreground">Beat Rate</p>
              <p className={cn(
                "text-sm md:text-lg font-bold",
                earnings.beatRate >= 70 ? "text-green-500" : earnings.beatRate < 50 ? "text-red-500" : "text-amber-500"
              )}>
                {earnings.beatRate.toFixed(0)}%
              </p>
            </div>
            <div className="text-center p-2 md:p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] md:text-xs text-muted-foreground">Rev Growth</p>
              <p className={cn(
                "text-sm md:text-lg font-bold",
                trends.revenue.cagr > 10 ? "text-green-500" : trends.revenue.cagr < 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                {trends.revenue.cagr !== 0
                  ? `${trends.revenue.cagr > 0 ? '+' : ''}${trends.revenue.cagr.toFixed(0)}%`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart + Fair Value Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Price Chart on Left */}
        {chartElement && (
          <div className="h-full [&>*]:h-full">
            {chartElement}
          </div>
        )}

        {/* Fair Value Section on Right */}
        <Card className={cn("h-full flex flex-col", !chartElement && "lg:col-span-2")}>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Target className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Fair Value Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-3 md:space-y-4 flex-1">
          {/* Main Fair Value */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="text-center p-2 md:p-4 rounded-lg bg-muted/50">
              <p className="text-[10px] md:text-sm text-muted-foreground">Price</p>
              <p className="text-sm md:text-2xl font-bold">{formatCurrency(price)}</p>
            </div>
            <div className="text-center p-2 md:p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[10px] md:text-sm text-muted-foreground">Fair Value</p>
              <p className="text-sm md:text-2xl font-bold text-primary">{formatCurrency(fairValue.average)}</p>
            </div>
            <div className="text-center p-2 md:p-4 rounded-lg bg-muted/50">
              <p className="text-[10px] md:text-sm text-muted-foreground">Upside</p>
              <p className={cn(
                "text-sm md:text-2xl font-bold",
                fairValue.upside > 0 ? "text-green-500" : "text-red-500"
              )}>
                {fairValue.upside > 0 ? '+' : ''}{fairValue.upside.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Fair Value Methods */}
          <div className="space-y-2">
            <p className="text-xs md:text-sm font-medium text-muted-foreground">Valuation Methods</p>
            <div className="space-y-1.5 md:space-y-2">
              {fairValue.estimates.map((estimate, idx) => {
                const diff = price > 0 ? ((estimate.value - price) / price) * 100 : 0;
                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-help">
                          <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                            <Calculator className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs md:text-sm font-medium truncate">{estimate.method}</span>
                          </div>
                          <div className="flex items-center gap-2 md:gap-3 shrink-0">
                            <span className="font-mono text-xs md:text-sm font-semibold">{formatCurrency(estimate.value)}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] md:text-xs',
                                diff > 10 && 'text-green-500 border-green-500/30',
                                diff < -10 && 'text-red-500 border-red-500/30',
                                diff >= -10 && diff <= 10 && 'text-muted-foreground'
                              )}
                            >
                              {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs">{estimate.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          {/* Valuation Verdict */}
          <div className={cn(
            "p-3 md:p-4 rounded-lg border",
            fairValue.upside > 15 && "bg-green-500/10 border-green-500/30",
            fairValue.upside < -15 && "bg-red-500/10 border-red-500/30",
            fairValue.upside >= -15 && fairValue.upside <= 15 && "bg-amber-500/10 border-amber-500/30"
          )}>
            <div className="flex items-center gap-2">
              {fairValue.upside > 15 ? (
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              ) : fairValue.upside < -15 ? (
                <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
              ) : (
                <Minus className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
              )}
              <span className="text-sm md:text-base font-semibold">
                {fairValue.upside > 15 ? 'Undervalued' : fairValue.upside < -15 ? 'Overvalued' : 'Fairly Valued'}
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {fairValue.upside > 15
                ? `${fairValue.upside.toFixed(0)}% undervalued based on multiple methods`
                : fairValue.upside < -15
                ? `${Math.abs(fairValue.upside).toFixed(0)}% overvalued based on multiple methods`
                : 'Trading near estimated fair value'}
            </p>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Earnings Section */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Earnings Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-3 md:space-y-4">
          {/* Next Earnings */}
          {earnings.nextDate && (
            <div className={cn(
              "p-3 md:p-4 rounded-lg border",
              earnings.nextIsEstimated
                ? "bg-muted/50 border-muted-foreground/20"
                : "bg-primary/10 border-primary/20"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary shrink-0" />
                    <p className="text-xs md:text-sm font-medium">Next Earnings</p>
                    {earnings.nextIsEstimated && (
                      <Badge variant="outline" className="text-[10px]">Est</Badge>
                    )}
                  </div>
                  <p className="text-sm md:text-xl font-bold mt-1">{new Date(earnings.nextDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] md:text-sm text-muted-foreground">EPS Est</p>
                  <p className="text-sm md:text-xl font-bold font-mono text-primary">
                    ${earnings.nextEstimate > 0 ? earnings.nextEstimate.toFixed(2) : 'TBD'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Earnings Stats */}
          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">Beat Rate</p>
              <p className={cn(
                "text-lg md:text-2xl font-bold",
                earnings.beatRate >= 75 && "text-green-500",
                earnings.beatRate < 50 && "text-red-500"
              )}>
                {earnings.beatRate.toFixed(0)}%
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground">Last 12 quarters</p>
            </div>
            <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">Avg Surprise</p>
              <p className={cn(
                "text-lg md:text-2xl font-bold",
                earnings.avgSurprise > 0 && "text-green-500",
                earnings.avgSurprise < 0 && "text-red-500"
              )}>
                {earnings.avgSurprise > 0 ? '+' : ''}{earnings.avgSurprise.toFixed(1)}%
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground">vs estimates</p>
            </div>
          </div>

          {/* Earnings History */}
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-2">Earnings History</p>
            <div className="space-y-1.5 md:space-y-2">
              {earnings.history.slice(0, showAllEarnings ? 12 : 4).map((q, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/30 gap-2"
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {q.beat ? (
                      <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 md:h-5 md:w-5 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium">
                        {new Date(q.fiscalDateEnding).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
                        Reported: {new Date(q.reportedDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 md:gap-2">
                      <span className="text-[10px] md:text-xs text-muted-foreground">E:</span>
                      <span className="font-mono text-xs md:text-sm">${q.estimatedEPS.toFixed(2)}</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">A:</span>
                      <span className={cn(
                        "font-mono text-xs md:text-sm font-semibold",
                        q.beat ? "text-green-500" : "text-red-500"
                      )}>
                        ${q.reportedEPS.toFixed(2)}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] md:text-xs mt-0.5 md:mt-1',
                        q.surprisePercentage > 0 ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30'
                      )}
                    >
                      {q.surprisePercentage > 0 ? '+' : ''}{q.surprisePercentage.toFixed(1)}% {q.beat ? 'Beat' : 'Miss'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {earnings.history.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAllEarnings(!showAllEarnings)}
              >
                {showAllEarnings ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show More ({earnings.history.length - 4} more)
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analyst Ratings & Ownership */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {/* Analyst Ratings */}
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Analyst Ratings
              <span className="text-[10px] md:text-xs text-muted-foreground font-normal ml-auto">
                {analystRatings.total} analysts
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
            <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50">
              <span className="text-xs md:text-sm font-medium">Consensus</span>
              <Badge className={cn(
                'text-white',
                analystRatings.consensus.includes('Strong Buy') && 'bg-green-600',
                analystRatings.consensus === 'Buy' && 'bg-green-500',
                analystRatings.consensus === 'Hold' && 'bg-amber-500',
                analystRatings.consensus === 'Sell' && 'bg-red-500',
                analystRatings.consensus.includes('Strong Sell') && 'bg-red-600'
              )}>
                {analystRatings.consensus}
              </Badge>
            </div>
            <div className="space-y-1.5 md:space-y-2">
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-xs w-16 md:w-20 text-green-600 font-medium">Strong Buy</span>
                <Progress
                  value={(analystRatings.strongBuy / analystRatings.total) * 100}
                  className="h-2 md:h-2.5 flex-1 bg-green-500/20"
                  indicatorClassName="bg-green-600"
                />
                <span className="text-[10px] md:text-xs w-6 md:w-8 text-right font-mono">{analystRatings.strongBuy}</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-xs w-16 md:w-20 text-green-500 font-medium">Buy</span>
                <Progress
                  value={(analystRatings.buy / analystRatings.total) * 100}
                  className="h-2 md:h-2.5 flex-1 bg-green-500/20"
                  indicatorClassName="bg-green-500"
                />
                <span className="text-[10px] md:text-xs w-6 md:w-8 text-right font-mono">{analystRatings.buy}</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-xs w-16 md:w-20 text-amber-500 font-medium">Hold</span>
                <Progress
                  value={(analystRatings.hold / analystRatings.total) * 100}
                  className="h-2 md:h-2.5 flex-1 bg-amber-500/20"
                  indicatorClassName="bg-amber-500"
                />
                <span className="text-[10px] md:text-xs w-6 md:w-8 text-right font-mono">{analystRatings.hold}</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-xs w-16 md:w-20 text-red-500 font-medium">Sell</span>
                <Progress
                  value={(analystRatings.sell / analystRatings.total) * 100}
                  className="h-2 md:h-2.5 flex-1 bg-red-500/20"
                  indicatorClassName="bg-red-500"
                />
                <span className="text-[10px] md:text-xs w-6 md:w-8 text-right font-mono">{analystRatings.sell}</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-xs w-16 md:w-20 text-red-600 font-medium">Strong Sell</span>
                <Progress
                  value={(analystRatings.strongSell / analystRatings.total) * 100}
                  className="h-2 md:h-2.5 flex-1 bg-red-500/20"
                  indicatorClassName="bg-red-600"
                />
                <span className="text-[10px] md:text-xs w-6 md:w-8 text-right font-mono">{analystRatings.strongSell}</span>
              </div>
            </div>
            {fundamentals.analystTargetPrice > 0 && (
              <div className="pt-2 md:pt-3 border-t">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-muted-foreground">Target Price</span>
                  <div className="text-right">
                    <span className="font-semibold">{formatCurrency(fundamentals.analystTargetPrice)}</span>
                    {price > 0 && (
                      <span className={cn(
                        "text-xs ml-2",
                        fundamentals.analystTargetPrice > price ? "text-green-500" : "text-red-500"
                      )}>
                        ({((fundamentals.analystTargetPrice - price) / price * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ownership */}
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <PieChart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              <span className="hidden md:inline">Ownership & Short Interest</span>
              <span className="md:hidden">Ownership</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-2 md:space-y-3">
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">Insider</p>
                <p className="text-base md:text-lg font-bold">{ownership.insiderPercent.toFixed(1)}%</p>
              </div>
              <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-[10px] md:text-xs text-muted-foreground">Institutional</p>
                <p className="text-base md:text-lg font-bold">{ownership.institutionPercent.toFixed(1)}%</p>
              </div>
            </div>
            <div className="pt-2 border-t space-y-1.5 md:space-y-2">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Short % of Float</span>
                <span className={cn(
                  "font-semibold",
                  ownership.shortPercent > 20 && "text-amber-500",
                  ownership.shortPercent > 40 && "text-red-500"
                )}>
                  {ownership.shortPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Short Ratio (Days)</span>
                <span className="font-semibold">{ownership.shortRatio.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insider Trades */}
      {insiderTrades.length > 0 && (
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Insider Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-1.5 md:space-y-2">
              {insiderTrades.map((trade, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-2 md:p-3 rounded-lg gap-2",
                    trade.type === 'buy' ? "bg-green-500/10" : "bg-red-500/10"
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-xs md:text-sm truncate">{trade.name}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">{trade.title}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {new Date(trade.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={trade.type === 'buy' ? 'default' : 'destructive'} className="mb-0.5 md:mb-1 text-[10px] md:text-xs">
                      {trade.type === 'buy' ? 'BUY' : 'SELL'}
                    </Badge>
                    <p className="text-xs md:text-sm font-mono">
                      {trade.shares.toLocaleString()} shares
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      @ ${trade.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Growth Trends */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Growth Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Revenue</p>
              {trends.revenue.cagr !== 0 ? (
                <>
                  <div className="flex items-center justify-center gap-1">
                    {trends.revenue.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {trends.revenue.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                    {trends.revenue.direction === 'flat' && <Minus className="h-4 w-4 text-muted-foreground" />}
                    <span className={cn(
                      "font-bold",
                      trends.revenue.cagr > 0 && "text-green-500",
                      trends.revenue.cagr < 0 && "text-red-500"
                    )}>
                      {trends.revenue.cagr > 0 ? '+' : ''}{trends.revenue.cagr.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">5Y CAGR</p>
                </>
              ) : (
                <p className="font-bold text-muted-foreground">N/A</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Earnings</p>
              {trends.earnings.cagr !== 0 ? (
                <>
                  <div className="flex items-center justify-center gap-1">
                    {trends.earnings.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {trends.earnings.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                    {trends.earnings.direction === 'flat' && <Minus className="h-4 w-4 text-muted-foreground" />}
                    <span className={cn(
                      "font-bold",
                      trends.earnings.cagr > 0 && "text-green-500",
                      trends.earnings.cagr < 0 && "text-red-500"
                    )}>
                      {trends.earnings.cagr > 0 ? '+' : ''}{trends.earnings.cagr.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">5Y CAGR</p>
                </>
              ) : (
                <p className="font-bold text-muted-foreground">N/A</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Free Cash Flow</p>
              {trends.freeCashFlow.cagr !== 0 ? (
                <>
                  <div className="flex items-center justify-center gap-1">
                    {trends.freeCashFlow.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                    {trends.freeCashFlow.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
                    {trends.freeCashFlow.direction === 'flat' && <Minus className="h-4 w-4 text-muted-foreground" />}
                    <span className={cn(
                      "font-bold",
                      trends.freeCashFlow.cagr > 0 && "text-green-500",
                      trends.freeCashFlow.cagr < 0 && "text-red-500"
                    )}>
                      {trends.freeCashFlow.cagr > 0 ? '+' : ''}{trends.freeCashFlow.cagr.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">5Y CAGR</p>
                </>
              ) : (
                <p className="font-bold text-muted-foreground">N/A</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Key Fundamentals
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="grid grid-cols-4 gap-1.5 md:gap-3">
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">P/E</p>
              <p className={cn("font-bold", fundamentals.peRatio > 0 && fundamentals.peRatio < 20 && "text-green-500")}>
                {fundamentals.peRatio > 0 ? fundamentals.peRatio.toFixed(1) : 'N/A'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Forward P/E</p>
              <p className={cn("font-bold", fundamentals.forwardPE > 0 && fundamentals.forwardPE < 20 && "text-green-500")}>
                {fundamentals.forwardPE > 0 ? fundamentals.forwardPE.toFixed(1) : 'N/A'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">PEG</p>
              <p className={cn("font-bold", fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1.5 && "text-green-500")}>
                {fundamentals.pegRatio > 0 ? fundamentals.pegRatio.toFixed(2) : 'N/A'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">P/B</p>
              <p className={cn("font-bold", fundamentals.priceToBook > 0 && fundamentals.priceToBook < 3 && "text-green-500")}>
                {fundamentals.priceToBook > 0 ? fundamentals.priceToBook.toFixed(2) : 'N/A'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">ROE</p>
              <p className={cn("font-bold", fundamentals.returnOnEquity > 15 && "text-green-500")}>
                {fundamentals.returnOnEquity > 0 ? `${fundamentals.returnOnEquity.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Profit Margin</p>
              <p className={cn("font-bold", fundamentals.profitMargin > 15 && "text-green-500")}>
                {fundamentals.profitMargin > 0 ? `${fundamentals.profitMargin.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Dividend</p>
              <p className={cn("font-bold", fundamentals.dividendYield > 2 && "text-green-500")}>
                {fundamentals.dividendYield > 0 ? `${fundamentals.dividendYield.toFixed(2)}%` : 'None'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground">Beta</p>
              <p className={cn("font-bold", fundamentals.beta > 1.5 && "text-amber-500")}>
                {fundamentals.beta > 0 ? fundamentals.beta.toFixed(2) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profitability & Moat */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            Profitability & Moat
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">ROE</p>
              <p className={cn("text-base md:text-xl font-bold", fundamentals.returnOnEquity > 15 ? "text-green-500" : fundamentals.returnOnEquity < 0 ? "text-red-500" : "")}>
                {fundamentals.returnOnEquity !== 0 ? `${fundamentals.returnOnEquity.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[10px] text-muted-foreground">{fundamentals.returnOnEquity > 20 ? 'Excellent' : fundamentals.returnOnEquity > 15 ? 'Good' : fundamentals.returnOnEquity > 10 ? 'Fair' : 'Weak'}</p>
            </div>
            <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">ROA</p>
              <p className={cn("text-base md:text-xl font-bold", fundamentals.returnOnAssets > 10 ? "text-green-500" : fundamentals.returnOnAssets < 0 ? "text-red-500" : "")}>
                {fundamentals.returnOnAssets !== 0 ? `${fundamentals.returnOnAssets.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[10px] text-muted-foreground">{fundamentals.returnOnAssets > 10 ? 'Excellent' : fundamentals.returnOnAssets > 5 ? 'Good' : 'Fair'}</p>
            </div>
            <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">Profit Margin</p>
              <p className={cn("text-base md:text-xl font-bold", fundamentals.profitMargin > 15 ? "text-green-500" : fundamentals.profitMargin < 0 ? "text-red-500" : "")}>
                {fundamentals.profitMargin !== 0 ? `${fundamentals.profitMargin.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[10px] text-muted-foreground">{fundamentals.profitMargin > 25 ? 'Wide moat' : fundamentals.profitMargin > 15 ? 'Good' : 'Narrow'}</p>
            </div>
            <div className="p-2 md:p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] md:text-xs text-muted-foreground">Op. Margin</p>
              <p className={cn("text-base md:text-xl font-bold", fundamentals.operatingMargin > 15 ? "text-green-500" : fundamentals.operatingMargin < 0 ? "text-red-500" : "")}>
                {fundamentals.operatingMargin !== 0 ? `${fundamentals.operatingMargin.toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[10px] text-muted-foreground">{fundamentals.operatingMargin > 25 ? 'Excellent' : fundamentals.operatingMargin > 15 ? 'Good' : 'Fair'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Indicators */}
      {technicals && technicals.indicators && (
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              <span className="hidden md:inline">Technical Indicators</span>
              <span className="md:hidden">Technicals</span>
              {technicals.summary && (
                <Badge className={cn(
                  'ml-auto text-white text-[10px] md:text-xs',
                  technicals.summary.overallSignal === 'bullish' && 'bg-green-500',
                  technicals.summary.overallSignal === 'bearish' && 'bg-red-500',
                  technicals.summary.overallSignal === 'neutral' && 'bg-amber-500',
                )}>
                  {technicals.summary.overallSignal?.toUpperCase()} ({technicals.summary.technicalScore}/10)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
              {/* RSI */}
              {technicals.indicators.rsi && (
                <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground">RSI (14)</p>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      technicals.indicators.rsi.signal === 'overbought' && 'text-red-500 border-red-500/30',
                      technicals.indicators.rsi.signal === 'oversold' && 'text-green-500 border-green-500/30',
                    )}>
                      {technicals.indicators.rsi.signal}
                    </Badge>
                  </div>
                  <p className={cn(
                    "text-xl md:text-2xl font-bold",
                    technicals.indicators.rsi.value > 70 && "text-red-500",
                    technicals.indicators.rsi.value < 30 && "text-green-500",
                  )}>
                    {technicals.indicators.rsi.value.toFixed(1)}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        technicals.indicators.rsi.value > 70 ? "bg-red-500" :
                        technicals.indicators.rsi.value < 30 ? "bg-green-500" : "bg-amber-500"
                      )}
                      style={{ width: `${technicals.indicators.rsi.value}%` }}
                    />
                  </div>
                </div>
              )}

              {/* MACD */}
              {technicals.indicators.macd && (
                <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground">MACD</p>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      technicals.indicators.macd.trend === 'bullish' ? 'text-green-500 border-green-500/30' : 'text-red-500 border-red-500/30',
                    )}>
                      {technicals.indicators.macd.trend}
                    </Badge>
                  </div>
                  <p className={cn(
                    "text-base md:text-lg font-bold font-mono",
                    technicals.indicators.macd.histogram > 0 ? "text-green-500" : "text-red-500",
                  )}>
                    {technicals.indicators.macd.macd.toFixed(2)}
                  </p>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Signal: {technicals.indicators.macd.signal.toFixed(2)}</span>
                    <span>Hist: {technicals.indicators.macd.histogram > 0 ? '+' : ''}{technicals.indicators.macd.histogram.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* ADX */}
              {technicals.indicators.adx && (
                <div className="p-2 md:p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] md:text-xs font-medium text-muted-foreground">ADX (14)</p>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      technicals.indicators.adx.trend === 'strong' ? 'text-green-500 border-green-500/30' : 'text-muted-foreground',
                    )}>
                      {technicals.indicators.adx.trend} trend
                    </Badge>
                  </div>
                  <p className={cn(
                    "text-xl md:text-2xl font-bold",
                    technicals.indicators.adx.value > 25 && "text-green-500",
                  )}>
                    {technicals.indicators.adx.value.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {technicals.indicators.adx.value > 50 ? 'Very strong trend' : technicals.indicators.adx.value > 25 ? 'Trending' : 'Weak/No trend'}
                  </p>
                </div>
              )}
            </div>

            {/* Moving Averages */}
            <div>
              <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2">Moving Averages</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5 md:gap-2">
                {technicals.indicators.sma?.sma20 != null && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">SMA 20</p>
                    <p className={cn("font-bold text-sm font-mono", price > technicals.indicators.sma.sma20 ? "text-green-500" : "text-red-500")}>
                      ${technicals.indicators.sma.sma20.toFixed(2)}
                    </p>
                    <p className="text-[10px]">{price > technicals.indicators.sma.sma20 ? '▲ Above' : '▼ Below'}</p>
                  </div>
                )}
                {technicals.indicators.sma?.sma50 != null && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">SMA 50</p>
                    <p className={cn("font-bold text-sm font-mono", price > technicals.indicators.sma.sma50 ? "text-green-500" : "text-red-500")}>
                      ${technicals.indicators.sma.sma50.toFixed(2)}
                    </p>
                    <p className="text-[10px]">{price > technicals.indicators.sma.sma50 ? '▲ Above' : '▼ Below'}</p>
                  </div>
                )}
                {technicals.indicators.sma?.sma200 != null && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">SMA 200</p>
                    <p className={cn("font-bold text-sm font-mono", price > technicals.indicators.sma.sma200 ? "text-green-500" : "text-red-500")}>
                      ${technicals.indicators.sma.sma200.toFixed(2)}
                    </p>
                    <p className="text-[10px]">{price > technicals.indicators.sma.sma200 ? '▲ Above' : '▼ Below'}</p>
                  </div>
                )}
                {technicals.indicators.ema?.ema12 != null && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">EMA 12</p>
                    <p className={cn("font-bold text-sm font-mono", price > technicals.indicators.ema.ema12 ? "text-green-500" : "text-red-500")}>
                      ${technicals.indicators.ema.ema12.toFixed(2)}
                    </p>
                    <p className="text-[10px]">{price > technicals.indicators.ema.ema12 ? '▲ Above' : '▼ Below'}</p>
                  </div>
                )}
                {technicals.indicators.ema?.ema26 != null && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">EMA 26</p>
                    <p className={cn("font-bold text-sm font-mono", price > technicals.indicators.ema.ema26 ? "text-green-500" : "text-red-500")}>
                      ${technicals.indicators.ema.ema26.toFixed(2)}
                    </p>
                    <p className="text-[10px]">{price > technicals.indicators.ema.ema26 ? '▲ Above' : '▼ Below'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Signal Summary */}
            {technicals.summary && (
              <div className="flex items-center gap-2 md:gap-4 p-2 md:p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-1 md:gap-2">
                  <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-green-500" />
                  <span className="text-xs md:text-sm">{technicals.summary.bullishSignals} Bullish</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <TrendingDown className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                  <span className="text-xs md:text-sm">{technicals.summary.bearishSignals} Bearish</span>
                </div>
                <div className="flex items-center gap-1 md:gap-2 ml-auto">
                  <span className="text-xs md:text-sm text-muted-foreground">Score:</span>
                  <span className={cn(
                    "font-bold",
                    technicals.summary.technicalScore >= 7 && "text-green-500",
                    technicals.summary.technicalScore <= 3 && "text-red-500",
                  )}>
                    {technicals.summary.technicalScore}/10
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Buffett Score */}
      {buffettScore && (
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2 md:pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg flex-wrap">
              <Target className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              <span className="hidden md:inline">Fundamental Score</span>
              <span className="md:hidden">Score</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs mb-1 font-semibold">Buffett-style scoring (100 pts)</p>
                    <ul className="text-xs space-y-0.5 text-muted-foreground">
                      <li>• Profitability & Moat: 30 pts (ROE, margins)</li>
                      <li>• Valuation: 25 pts (P/E, PEG, P/B, P/S)</li>
                      <li>• Financial Health: 15 pts (EV/EBITDA, Beta)</li>
                      <li>• Growth: 15 pts (earnings & revenue growth)</li>
                      <li>• Analyst Upside: 5 pts</li>
                      <li>• Dividends: 5 pts</li>
                      <li>• 52-Week Position: 5 pts</li>
                    </ul>
                    <p className="text-xs mt-1 text-muted-foreground">Base: 50 pts. 75+ Strong Buy, 60-74 Buy, 45-59 Hold, &lt;45 Sell</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className={cn(
                'ml-auto px-2 md:px-3 py-0.5 md:py-1 rounded-lg text-xs md:text-sm font-bold',
                buffettScore.rating === 'Strong Buy' && 'bg-green-500/20 text-green-500',
                buffettScore.rating === 'Buy' && 'bg-green-500/10 text-green-400',
                buffettScore.rating === 'Hold' && 'bg-amber-500/10 text-amber-500',
                buffettScore.rating === 'Sell' && 'bg-red-500/10 text-red-500',
              )}>
                {buffettScore.total}/100 — {buffettScore.rating}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            {/* Score bar */}
            <div className="mb-3 md:mb-4">
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    buffettScore.total >= 75 ? "bg-green-500" :
                    buffettScore.total >= 60 ? "bg-green-400" :
                    buffettScore.total >= 45 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${buffettScore.total}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0 (Sell)</span>
                <span>45 (Hold)</span>
                <span>60 (Buy)</span>
                <span>75 (Strong Buy)</span>
                <span>100</span>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="rounded-lg border overflow-x-auto -mx-1 md:mx-0">
              <table className="w-full text-xs md:text-sm min-w-[320px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-medium text-muted-foreground">Metric</th>
                    <th className="text-right px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-medium text-muted-foreground">Value</th>
                    <th className="text-right px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-medium text-muted-foreground">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {buffettScore.breakdown.map((row, idx) => (
                    <tr key={idx} className={cn("border-t border-muted", idx % 2 === 0 && "bg-muted/20")}>
                      <td className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs text-muted-foreground">{row.category}</td>
                      <td className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-medium">{row.metric}</td>
                      <td className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs text-right font-mono">{row.value}</td>
                      <td className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs text-right">
                        <span className={cn(
                          "font-bold",
                          row.points > 0 && "text-green-500",
                          row.points < 0 && "text-red-500",
                          row.points === 0 && "text-muted-foreground",
                        )}>
                          {row.points > 0 ? '+' : ''}{row.points}
                        </span>
                        <span className="text-muted-foreground">/{row.maxPoints}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
