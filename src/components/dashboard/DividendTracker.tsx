'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Calendar, Wallet } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';

interface DividendBreakdown {
  symbol: string;
  quantity: number;
  dividendPerShare: number;
  frequency: 'quarterly' | 'monthly' | 'annual';
  yield: number;
  annualIncome: number;
  monthlyIncome: number;
  nextExDate: string;
}

interface DividendData {
  totalAnnualIncome: number;
  totalMonthlyIncome: number;
  breakdown: DividendBreakdown[];
}

export function DividendTracker() {
  const router = useRouter();
  const [dividendData, setDividendData] = useState<DividendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const allPositions = portfolio?.positions || [];
  const positions = allPositions.filter(p =>
    p.assetType !== 'commodity' &&
    p.assetType !== 'crypto' &&
    p.assetType !== 'cash'
  );

  useEffect(() => {
    const fetchDividendIncome = async () => {
      if (positions.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const symbols = positions.map(p => p.symbol).join(',');
        const quantities = positions.map(p => p.quantity).join(',');

        const savedKeys = localStorage.getItem('investai-api-keys');
        const fmpKey = savedKeys ? JSON.parse(savedKeys).fmp : '';

        const response = await fetch(
          `/api/dividends?action=portfolio-income&symbols=${symbols}&quantities=${quantities}`,
          { headers: fmpKey ? { 'x-fmp-key': fmpKey } : {} }
        );
        const data = await response.json();

        if (data.success) {
          setDividendData(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch dividend data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDividendIncome();
    const interval = setInterval(fetchDividendIncome, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [positions.map(p => `${p.symbol}:${p.quantity}`).join(',')]);

  const getDaysUntilExDate = (exDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(exDate);
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Dividend Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Dividend Income
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-4">
          <Wallet className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Add positions to track</p>
        </CardContent>
      </Card>
    );
  }

  const hasNoDividends = !dividendData || dividendData.breakdown.length === 0;
  const upcomingDividends = dividendData?.breakdown
    .filter(d => getDaysUntilExDate(d.nextExDate) > 0)
    .sort((a, b) => getDaysUntilExDate(a.nextExDate) - getDaysUntilExDate(b.nextExDate))
    .slice(0, 3) || [];

  // Get top dividend payers sorted by annual income
  const topDividendPayers = dividendData?.breakdown
    .filter(d => d.annualIncome > 0)
    .sort((a, b) => b.annualIncome - a.annualIncome)
    .slice(0, 4) || [];

  return (
    <Card>
      <CardHeader className="pb-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Dividend Income
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Annual</p>
              <p className="text-sm font-bold text-green-500">
                {formatCurrency(dividendData?.totalAnnualIncome || 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Monthly</p>
              <p className="text-sm font-bold text-green-500">
                {formatCurrency(dividendData?.totalMonthlyIncome || 0)}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {hasNoDividends ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No dividend-paying stocks
          </p>
        ) : (
          <div className="space-y-0.5">
            {topDividendPayers.map(item => {
              const days = item.nextExDate ? getDaysUntilExDate(item.nextExDate) : null;
              const showExDate = days !== null && days > 0 && days <= 60;
              return (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between text-xs py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer border-b border-border/50 last:border-0"
                  onClick={() => router.push(`/analysis?symbol=${item.symbol}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium w-12">{item.symbol}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      {(typeof item.yield === 'number' ? item.yield : parseFloat(String(item.yield)) || 0).toFixed(1)}%
                    </Badge>
                    {showExDate && (
                      <span className={cn(
                        'text-[10px]',
                        days <= 7 ? 'text-amber-500 font-medium' : 'text-muted-foreground'
                      )}>
                        Ex: {days}d
                      </span>
                    )}
                  </div>
                  <span className="text-green-500 font-medium">
                    {formatCurrency(item.annualIncome)}/yr
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
