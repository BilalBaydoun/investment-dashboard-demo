'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useRouter } from 'next/navigation';
import { formatPercent } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';

interface TopMoversProps {
  className?: string;
}

export function TopMovers({ className }: TopMoversProps) {
  const router = useRouter();
  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <Card className={cn('flex flex-col', className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Top Movers
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No positions</p>
        </CardContent>
      </Card>
    );
  }

  const positionsWithChange = portfolio.positions.map((pos) => {
    const change = pos.currentPrice - pos.previousClose;
    const changePercent = (change / pos.previousClose) * 100;
    return { ...pos, change, changePercent };
  });

  const sorted = [...positionsWithChange].sort(
    (a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)
  );

  const topGainers = sorted.filter((p) => p.changePercent > 0).slice(0, 3);
  const topLosers = sorted.filter((p) => p.changePercent < 0).slice(0, 3);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Top Movers Today
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col justify-center space-y-3">
        {/* Gainers */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Gainers</p>
          {topGainers.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-2">No gainers today</p>
          ) : (
            topGainers.map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between text-sm py-1.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                onClick={() => router.push(`/analysis?symbol=${pos.symbol}`)}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="font-medium">{pos.symbol}</span>
                </div>
                <span className="text-green-500 font-semibold">
                  {formatPercent(pos.changePercent)}
                </span>
              </div>
            ))
          )}
        </div>
        {/* Losers */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Losers</p>
          {topLosers.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-2">No losers today</p>
          ) : (
            topLosers.map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between text-sm py-1.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                onClick={() => router.push(`/analysis?symbol=${pos.symbol}`)}
              >
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{pos.symbol}</span>
                </div>
                <span className="text-red-500 font-semibold">
                  {formatPercent(pos.changePercent)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
