'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';

interface TimeChange {
  period: string;
  percent: number;
}

export function PortfolioValueCard() {
  const {
    getTotalValue,
    getTotalGain,
    getTotalGainPercent,
    getActivePortfolio,
    getPerformanceByPeriod,
    recordSnapshot,
  } = usePortfolioStore();

  const totalValue = getTotalValue();
  const totalGain = getTotalGain();
  const totalGainPercent = getTotalGainPercent();
  const portfolio = getActivePortfolio();

  const isPositive = totalGain >= 0;

  // Record a snapshot when portfolio value changes
  useEffect(() => {
    if (totalValue > 0) {
      recordSnapshot();
    }
  }, [totalValue, recordSnapshot]);

  // Get real performance from historical data
  const timeChanges: TimeChange[] = [
    { period: 'Today', percent: getPerformanceByPeriod('day') },
    { period: '1W', percent: getPerformanceByPeriod('week') },
    { period: '1M', percent: getPerformanceByPeriod('month') },
    { period: 'YTD', percent: getPerformanceByPeriod('ytd') },
  ];

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Portfolio Value
        </CardTitle>
        {portfolio && (
          <Badge variant="outline" className="font-normal">
            {portfolio.name}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <DollarSign className="h-6 w-6 text-muted-foreground" />
          <span className="text-3xl font-bold">{formatCurrency(totalValue)}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          {isPositive ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              isPositive ? 'text-green-500' : 'text-red-500'
            )}
          >
            {formatCurrency(Math.abs(totalGain))} ({formatPercent(totalGainPercent)})
          </span>
          <span className="text-sm text-muted-foreground">All Time</span>
        </div>

        {/* Time Period Changes */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          {timeChanges.map((change) => (
            <div key={change.period} className="text-center">
              <p className="text-xs text-muted-foreground">{change.period}</p>
              <p
                className={cn(
                  'text-sm font-semibold',
                  change.percent >= 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {change.percent === 0 ? '-' : formatPercent(change.percent)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
