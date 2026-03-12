'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Grid3X3, RefreshCw, Loader2, Info } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
}

const PERIOD_OPTIONS = [
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: '180', label: '6 Months' },
  { value: '365', label: '1 Year' },
];

function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  // Calculate returns
  const xReturns = [];
  const yReturns = [];
  for (let i = 1; i < n; i++) {
    xReturns.push((x[i] - x[i - 1]) / x[i - 1]);
    yReturns.push((y[i] - y[i - 1]) / y[i - 1]);
  }

  const meanX = xReturns.reduce((a, b) => a + b, 0) / xReturns.length;
  const meanY = yReturns.reduce((a, b) => a + b, 0) / yReturns.length;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < xReturns.length; i++) {
    const dx = xReturns[i] - meanX;
    const dy = yReturns[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;

  return sumXY / denominator;
}

function getCorrelationColor(value: number): string {
  // Green for positive, Red for negative, intensity based on absolute value
  const absValue = Math.abs(value);
  if (value >= 0) {
    if (absValue > 0.7) return 'bg-green-500 text-white';
    if (absValue > 0.4) return 'bg-green-400/70 text-white';
    if (absValue > 0.2) return 'bg-green-300/50';
    return 'bg-green-200/30';
  } else {
    if (absValue > 0.7) return 'bg-red-500 text-white';
    if (absValue > 0.4) return 'bg-red-400/70 text-white';
    if (absValue > 0.2) return 'bg-red-300/50';
    return 'bg-red-200/30';
  }
}

function getCorrelationDescription(value: number): string {
  const absValue = Math.abs(value);
  const direction = value >= 0 ? 'positive' : 'negative';
  if (absValue > 0.7) return `Strong ${direction} correlation`;
  if (absValue > 0.4) return `Moderate ${direction} correlation`;
  if (absValue > 0.2) return `Weak ${direction} correlation`;
  return 'Very weak/no correlation';
}

export function CorrelationMatrix() {
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState('90');

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const fetchCorrelations = async () => {
    if (!portfolio || portfolio.positions.length < 2) {
      toast.info('Need at least 2 positions to calculate correlations');
      return;
    }

    // Filter to stocks/ETFs only (they have historical data)
    const eligiblePositions = portfolio.positions.filter(
      (p) => p.assetType === 'stock' || p.assetType === 'etf'
    );

    if (eligiblePositions.length < 2) {
      toast.info('Need at least 2 stock/ETF positions');
      return;
    }

    setIsLoading(true);

    try {
      const symbols = eligiblePositions.slice(0, 8).map((p) => p.symbol); // Limit to 8 for readability
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Fetch historical data for all symbols
      const historicalDataMap: Record<string, number[]> = {};

      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const response = await fetch(
              `/api/stocks?symbol=${symbol}&action=history&from=${startDateStr}`
            );
            const data = await response.json();
            if (data.success && data.data) {
              historicalDataMap[symbol] = data.data.map((d: any) => d.close);
            }
          } catch (error) {
            console.error(`Failed to fetch data for ${symbol}:`, error);
          }
        })
      );

      // Filter symbols that have data
      const validSymbols = symbols.filter(
        (s) => historicalDataMap[s] && historicalDataMap[s].length > 10
      );

      if (validSymbols.length < 2) {
        toast.error('Could not fetch enough historical data');
        return;
      }

      // Calculate correlation matrix
      const matrix: number[][] = [];
      for (let i = 0; i < validSymbols.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < validSymbols.length; j++) {
          if (i === j) {
            row.push(1);
          } else {
            const correlation = calculateCorrelation(
              historicalDataMap[validSymbols[i]],
              historicalDataMap[validSymbols[j]]
            );
            row.push(correlation);
          }
        }
        matrix.push(row);
      }

      setCorrelationData({ symbols: validSymbols, matrix });
    } catch (error) {
      console.error('Correlation calculation error:', error);
      toast.error('Failed to calculate correlations');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount if positions exist
  useEffect(() => {
    if (portfolio && portfolio.positions.length >= 2) {
      fetchCorrelations();
    }
  }, [portfolio?.id, period]);

  const positionCount = portfolio?.positions.filter(
    (p) => p.assetType === 'stock' || p.assetType === 'etf'
  ).length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Correlation Matrix
          </span>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchCorrelations}
              disabled={isLoading || positionCount < 2}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : correlationData && correlationData.symbols.length >= 2 ? (
          <TooltipProvider>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left"></th>
                    {correlationData.symbols.map((symbol) => (
                      <th key={symbol} className="p-2 text-center font-medium">
                        {symbol}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlationData.symbols.map((symbol, i) => (
                    <tr key={symbol}>
                      <td className="p-2 font-medium">{symbol}</td>
                      {correlationData.matrix[i].map((value, j) => (
                        <td key={j} className="p-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'p-2 text-center rounded cursor-help transition-colors',
                                  i === j ? 'bg-muted' : getCorrelationColor(value)
                                )}
                              >
                                {value.toFixed(2)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                {correlationData.symbols[i]} vs {correlationData.symbols[j]}
                              </p>
                              <p className="text-xs">{getCorrelationDescription(value)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Correlation ranges from -1 (inverse) to +1 (same direction)</span>
              </div>
              <div className="flex gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-xs">Strong +</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-green-300/50"></div>
                  <span className="text-xs">Weak +</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-300/50"></div>
                  <span className="text-xs">Weak -</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-500"></div>
                  <span className="text-xs">Strong -</span>
                </div>
              </div>
            </div>
          </TooltipProvider>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Grid3X3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">
              {positionCount < 2
                ? 'Add at least 2 stock/ETF positions to see correlations'
                : 'Click refresh to calculate correlations'}
            </p>
            <p className="text-xs mt-2">
              See how your assets move together to improve diversification
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
