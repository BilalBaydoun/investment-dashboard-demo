'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BarChart3,
  Gauge,
  Info,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MarketIndicator {
  name: string;
  value: number | string;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

interface MarketData {
  overallSentiment: number; // 0-100, 50 is neutral
  sentimentLabel: string;
  indicators: MarketIndicator[];
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours';
  lastUpdated: Date;
  changes: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  source: string;
}

interface MarketSentimentProps {
  compact?: boolean;
}

export function MarketSentiment({ compact = false }: MarketSentimentProps) {
  const [data, setData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSentiment = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);

    try {
      // Fetch from CNN Fear & Greed API
      const response = await fetch('/api/sentiment');
      const result = await response.json();

      if (result.success && result.data) {
        const { score, rating, changes, source } = result.data;

        // Determine market status based on US Eastern Time
        const now = new Date();
        const etFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
        });
        const etParts = etFormatter.formatToParts(now);
        const etHour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0', 10);
        const etMinute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0', 10);
        const etWeekday = etParts.find(p => p.type === 'weekday')?.value || '';
        const etMonth = parseInt(etParts.find(p => p.type === 'month')?.value || '0', 10);
        const etDay = parseInt(etParts.find(p => p.type === 'day')?.value || '0', 10);

        const isWeekend = ['Sat', 'Sun'].includes(etWeekday);

        // US Market Holidays (2025-2026)
        const holidays = [
          '1-1',   // New Year's Day
          '1-20',  // MLK Day (3rd Monday Jan)
          '2-17',  // Presidents Day (3rd Monday Feb)
          '4-18',  // Good Friday
          '5-26',  // Memorial Day (Last Monday May)
          '6-19',  // Juneteenth
          '7-4',   // Independence Day
          '9-1',   // Labor Day (1st Monday Sep)
          '11-27', // Thanksgiving (4th Thursday Nov)
          '12-25', // Christmas
        ];
        const isHoliday = holidays.includes(`${etMonth}-${etDay}`);

        // Market hours: 9:30 AM - 4:00 PM ET
        const timeInMinutes = etHour * 60 + etMinute;
        const marketOpen = 9 * 60 + 30;  // 9:30 AM
        const marketClose = 16 * 60;      // 4:00 PM
        const preMarketStart = 4 * 60;    // 4:00 AM
        const afterHoursEnd = 20 * 60;    // 8:00 PM

        let marketStatus: MarketData['marketStatus'] = 'closed';
        if (!isWeekend && !isHoliday) {
          if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
            marketStatus = 'open';
          } else if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
            marketStatus = 'pre-market';
          } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
            marketStatus = 'after-hours';
          }
        }

        // Create indicators based on the sentiment data
        const indicators: MarketIndicator[] = [
          {
            name: 'Daily',
            value: changes.daily > 0 ? `+${changes.daily}` : changes.daily.toString(),
            signal: changes.daily > 0 ? 'bullish' : changes.daily < 0 ? 'bearish' : 'neutral',
            description: 'Change from previous close',
          },
          {
            name: 'Weekly',
            value: changes.weekly > 0 ? `+${changes.weekly}` : changes.weekly.toString(),
            signal: changes.weekly > 0 ? 'bullish' : changes.weekly < 0 ? 'bearish' : 'neutral',
            description: 'Change from 1 week ago',
          },
          {
            name: 'Monthly',
            value: changes.monthly > 0 ? `+${changes.monthly}` : changes.monthly.toString(),
            signal: changes.monthly > 0 ? 'bullish' : changes.monthly < 0 ? 'bearish' : 'neutral',
            description: 'Change from 1 month ago',
          },
        ];

        setData({
          overallSentiment: score,
          sentimentLabel: rating,
          indicators,
          marketStatus,
          lastUpdated: new Date(),
          changes,
          source,
        });
      }
    } catch (error) {
      console.error('Failed to fetch sentiment:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(() => fetchSentiment(), 5 * 60 * 1000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !data) {
    if (compact) {
      return (
        <div className="flex items-center justify-center h-12">
          <Activity className="h-4 w-4 animate-pulse text-muted-foreground" />
        </div>
      );
    }
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 flex items-center justify-center">
            <Activity className="h-5 w-5 animate-pulse text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSentimentColor = (value: number) => {
    if (value <= 25) return 'from-red-600 to-red-500';
    if (value <= 45) return 'from-orange-500 to-amber-500';
    if (value <= 55) return 'from-yellow-500 to-yellow-400';
    if (value <= 75) return 'from-lime-500 to-green-500';
    return 'from-green-500 to-emerald-500';
  };

  const getSentimentTextColor = (value: number) => {
    if (value <= 25) return 'text-red-500';
    if (value <= 45) return 'text-orange-500';
    if (value <= 55) return 'text-yellow-500';
    if (value <= 75) return 'text-lime-500';
    return 'text-green-500';
  };

  const getMarketStatusBadge = () => {
    const statusConfig = {
      'open': { label: 'Market Open', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      'closed': { label: 'Market Closed', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
      'pre-market': { label: 'Pre-Market', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'after-hours': { label: 'After Hours', className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
    };
    const config = statusConfig[data.marketStatus];
    return (
      <Badge variant="outline" className={cn('text-xs', config.className)}>
        {config.label}
      </Badge>
    );
  };

  const getSignalIcon = (signal: 'bullish' | 'bearish' | 'neutral') => {
    switch (signal) {
      case 'bullish':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-yellow-500" />;
    }
  };

  // Get sentiment explanation based on value
  const getSentimentExplanation = (value: number) => {
    if (value <= 20) return "Extreme fear - investors are very worried. May signal buying opportunity.";
    if (value <= 40) return "Fear in market - cautious sentiment. Consider accumulating.";
    if (value <= 60) return "Neutral sentiment - market is balanced.";
    if (value <= 80) return "Greed - investors are confident. Be cautious.";
    return "Extreme greed - market may be overvalued. Consider taking profits.";
  };

  // Compact view for embedding in other cards
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Fear & Greed Index</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-bold", getSentimentTextColor(data.overallSentiment))}>
              {data.overallSentiment}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                data.overallSentiment <= 40 ? "border-red-500/30 text-red-500" :
                data.overallSentiment >= 60 ? "border-green-500/30 text-green-500" :
                "border-yellow-500/30 text-yellow-500"
              )}
            >
              {data.sentimentLabel}
            </Badge>
          </div>
        </div>

        {/* Sentiment Bar */}
        <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30" />
          <div
            className={cn(
              "absolute left-0 top-0 h-full rounded-full bg-gradient-to-r transition-all duration-500",
              getSentimentColor(data.overallSentiment)
            )}
            style={{ width: `${data.overallSentiment}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-foreground rounded-full transition-all duration-500"
            style={{ left: `${data.overallSentiment}%` }}
          />
        </div>

        {/* Scale Labels */}
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Extreme Fear</span>
          <span>Neutral</span>
          <span>Extreme Greed</span>
        </div>

        {/* Explanation */}
        <p className="text-[11px] text-muted-foreground leading-tight">
          {getSentimentExplanation(data.overallSentiment)}
        </p>

        {/* Changes */}
        <div className="flex items-center gap-3 pt-1">
          {data.indicators.slice(0, 2).map((indicator) => (
            <div key={indicator.name} className="flex items-center gap-1">
              {getSignalIcon(indicator.signal)}
              <span className="text-[10px] text-muted-foreground">{indicator.name}:</span>
              <span className={cn(
                "text-[10px] font-medium",
                indicator.signal === 'bullish' && "text-green-500",
                indicator.signal === 'bearish' && "text-red-500",
                indicator.signal === 'neutral' && "text-muted-foreground"
              )}>
                {indicator.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Sentiment Gauge */}
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Gauge className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Fear & Greed</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm font-medium">{data.source}</p>
                  <p className="text-xs text-muted-foreground">Updated every 5 minutes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex items-center gap-3">
              <div className="relative w-32 h-3 bg-muted rounded-full overflow-hidden">
                {/* Background gradient showing full range */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30" />
                {/* Filled portion */}
                <div
                  className={cn(
                    "absolute left-0 top-0 h-full rounded-full bg-gradient-to-r transition-all duration-500",
                    getSentimentColor(data.overallSentiment)
                  )}
                  style={{ width: `${data.overallSentiment}%` }}
                />
                {/* Indicator needle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white border border-gray-400 rounded-full shadow-sm transition-all duration-500"
                  style={{ left: `calc(${data.overallSentiment}% - 2px)` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className={cn("text-xl font-bold", getSentimentTextColor(data.overallSentiment))}>
                  {data.overallSentiment}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs cursor-help",
                          data.overallSentiment <= 40 ? "border-red-500/30 text-red-500" :
                          data.overallSentiment >= 60 ? "border-green-500/30 text-green-500" :
                          "border-yellow-500/30 text-yellow-500"
                        )}
                      >
                        {data.sentimentLabel}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-sm">
                        0-20: Extreme Fear | 20-40: Fear | 40-60: Neutral | 60-80: Greed | 80-100: Extreme Greed
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-8 bg-border" />

          {/* Indicators */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {data.indicators.map((indicator) => (
              <TooltipProvider key={indicator.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 cursor-help">
                      {getSignalIcon(indicator.signal)}
                      <span className="text-xs font-medium">{indicator.name}</span>
                      <span className={cn(
                        "text-xs",
                        indicator.signal === 'bullish' && "text-green-500",
                        indicator.signal === 'bearish' && "text-red-500",
                        indicator.signal === 'neutral' && "text-muted-foreground"
                      )}>
                        {indicator.value}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{indicator.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>

          {/* Market Status & Refresh */}
          <div className="flex items-center gap-2">
            {getMarketStatusBadge()}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => fetchSentiment(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
