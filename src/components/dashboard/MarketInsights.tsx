'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketInsight {
  marketDirection: 'up' | 'down' | 'flat';
  spyChange: number;
  spyChangePercent: number;
  summary: string;
  whyMoving: string[];
  keyDrivers: { sector: string; impact: 'positive' | 'negative' | 'neutral'; reason: string }[];
  whatToExpect: string;
  updatedAt: string;
}

export function MarketInsights() {
  const [insights, setInsights] = useState<MarketInsight | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First get SPY quote for market direction
      const spyResponse = await fetch('/api/stocks?symbol=SPY&action=quote');
      const spyResult = await spyResponse.json();

      let spyChange = 0;
      let spyChangePercent = 0;

      if (spyResult.success && spyResult.data) {
        const spy = spyResult.data;
        spyChange = spy.change || 0;
        spyChangePercent = spy.changePercent || 0;
      }
      const marketDirection = spyChangePercent > 0.1 ? 'up' : spyChangePercent < -0.1 ? 'down' : 'flat';

      // Fetch AI-generated insights
      const response = await fetch('/api/ai/market-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spyChange,
          spyChangePercent,
          marketDirection,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.insights) {
          setInsights({
            ...data.insights,
            marketDirection,
            spyChange,
            spyChangePercent,
            updatedAt: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          });
        } else {
          // Fallback to basic insights if AI fails
          setInsights(generateFallbackInsights(marketDirection, spyChange, spyChangePercent));
        }
      } else {
        // Fallback to basic insights
        setInsights(generateFallbackInsights(marketDirection, spyChange, spyChangePercent));
      }
    } catch (err) {
      console.error('Failed to fetch market insights:', err);
      // Still show basic market data
      setInsights(generateFallbackInsights('flat', 0, 0));
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackInsights = (
    direction: 'up' | 'down' | 'flat',
    change: number,
    changePercent: number
  ): MarketInsight => {
    const isUp = direction === 'up';
    const isDown = direction === 'down';

    return {
      marketDirection: direction,
      spyChange: change,
      spyChangePercent: changePercent,
      summary: isUp
        ? 'Markets are trading higher as investors show optimism.'
        : isDown
        ? 'Markets are pulling back amid cautious sentiment.'
        : 'Markets are trading sideways with mixed signals.',
      whyMoving: isUp
        ? ['Positive economic data', 'Strong corporate earnings', 'Risk-on sentiment']
        : isDown
        ? ['Profit-taking after recent gains', 'Economic uncertainty', 'Sector rotation']
        : ['Investors await key data', 'Mixed earnings reports', 'Consolidation phase'],
      keyDrivers: [
        { sector: 'Technology', impact: isUp ? 'positive' : isDown ? 'negative' : 'neutral', reason: isUp ? 'AI momentum continues' : 'Valuation concerns' },
        { sector: 'Financials', impact: 'neutral', reason: 'Awaiting Fed commentary' },
        { sector: 'Energy', impact: isDown ? 'negative' : 'positive', reason: 'Oil price movements' },
      ],
      whatToExpect: isUp
        ? 'Watch for continuation if volume supports the move. Key resistance levels ahead.'
        : isDown
        ? 'Monitor support levels. Could see buying interest if selling exhausts.'
        : 'Expect range-bound action until a catalyst emerges. Watch volume for direction clues.',
      updatedAt: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  };

  useEffect(() => {
    fetchInsights();
    // Refresh every 5 minutes
    const interval = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getDirectionIcon = () => {
    if (!insights) return <Minus className="h-5 w-5" />;
    if (insights.marketDirection === 'up') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (insights.marketDirection === 'down') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getDirectionColor = () => {
    if (!insights) return 'text-muted-foreground';
    if (insights.marketDirection === 'up') return 'text-green-500';
    if (insights.marketDirection === 'down') return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getImpactBadge = (impact: string) => {
    if (impact === 'positive') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] px-1.5">+</Badge>;
    if (impact === 'negative') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px] px-1.5">-</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] px-1.5">=</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Market Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {insights?.updatedAt}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchInsights}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-auto">
        {insights && (
          <>
            {/* Market Direction Header */}
            <div className={cn(
              'flex items-center gap-3 p-3 rounded-lg',
              insights.marketDirection === 'up' ? 'bg-green-500/10' :
              insights.marketDirection === 'down' ? 'bg-red-500/10' : 'bg-muted/50'
            )}>
              {getDirectionIcon()}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('font-semibold', getDirectionColor())}>
                    S&P 500 {insights.spyChangePercent >= 0 ? '+' : ''}{insights.spyChangePercent.toFixed(2)}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({insights.spyChange >= 0 ? '+' : ''}${insights.spyChange.toFixed(2)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{insights.summary}</p>
              </div>
            </div>

            {/* Why Markets Are Moving */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Why Markets Are Moving
              </h4>
              <ul className="space-y-1">
                {insights.whyMoving.slice(0, 3).map((reason, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <ArrowRight className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sector Drivers */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Key Sector Moves</h4>
              <div className="grid grid-cols-1 gap-1.5">
                {insights.keyDrivers.slice(0, 3).map((driver, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {getImpactBadge(driver.impact)}
                      <span className="font-medium">{driver.sector}</span>
                    </div>
                    <span className="text-muted-foreground text-[10px] truncate max-w-[120px]">{driver.reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What to Expect */}
            <div className="pt-2 border-t">
              <h4 className="text-xs font-medium text-muted-foreground mb-1">What to Expect Today</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{insights.whatToExpect}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
