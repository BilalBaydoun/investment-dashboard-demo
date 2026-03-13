'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface EarningsEvent {
  symbol: string;
  date: string;
  time: 'bmo' | 'amc' | 'unknown';
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  fiscalQuarter: string;
}

export function EarningsCalendar() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const portfolioSymbols = portfolio?.positions
    .filter(p => p.assetType !== 'commodity' && p.assetType !== 'crypto' && p.assetType !== 'cash')
    .map(p => p.symbol) || [];

  useEffect(() => {
    const fetchEarnings = async () => {
      if (earnings.length === 0) setIsLoading(true);
      try {
        const symbolsParam = portfolioSymbols.length > 0
          ? `&symbols=${portfolioSymbols.join(',')}`
          : '';

        const savedKeys = localStorage.getItem('investai-api-keys');
        const alphaVantageKey = savedKeys ? JSON.parse(savedKeys).alphaVantage : '';

        const response = await fetch(
          `/api/earnings?action=calendar${symbolsParam}`,
          { headers: alphaVantageKey ? { 'x-alphavantage-key': alphaVantageKey } : {} }
        );
        const data = await response.json();

        if (data.success) {
          let filtered = data.data;
          if (portfolioSymbols.length > 0) {
            filtered = data.data.filter((e: EarningsEvent) =>
              portfolioSymbols.includes(e.symbol)
            );
          }
          setEarnings(filtered.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch earnings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEarnings();
    const interval = setInterval(fetchEarnings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [portfolioSymbols.join(',')]);

  const getDaysUntil = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const earningsDate = new Date(date);
    return Math.ceil((earningsDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Upcoming Earnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {earnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No upcoming earnings</p>
          </div>
        ) : (
          <div className="space-y-1">
            {earnings.map((event, index) => {
              const daysUntil = getDaysUntil(event.date);
              const isUrgent = daysUntil <= 7 && daysUntil >= 0;
              const isToday = daysUntil === 0;

              return (
                <div
                  key={`${event.symbol}-${event.date}-${index}`}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50',
                    isUrgent && 'bg-amber-500/5'
                  )}
                  onClick={() => router.push(`/analysis?symbol=${event.symbol}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{event.symbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  {isToday ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Today
                    </Badge>
                  ) : (
                    <Badge
                      variant={isUrgent ? 'default' : 'secondary'}
                      className={cn('text-[10px] px-1.5 py-0', isUrgent && 'bg-amber-500')}
                    >
                      {daysUntil}d
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
