'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';

interface BacktestResult {
  symbol: string;
  name: string;
  investmentAmount: number;
  startDate: string;
  startPrice: number;
  endPrice: number;
  sharesOwned: number;
  currentValue: number;
  totalReturn: number;
  percentReturn: number;
  annualizedReturn: number;
  highestValue: number;
  lowestValue: number;
  maxDrawdown: number;
}

const PRESET_PERIODS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
  { label: '2 Years', months: 24 },
  { label: '5 Years', months: 60 },
];

export function Backtesting() {
  const [symbol, setSymbol] = useState('');
  const [amount, setAmount] = useState('1000');
  const [period, setPeriod] = useState('12');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const runBacktest = async () => {
    if (!symbol.trim()) {
      toast.error('Please enter a symbol');
      return;
    }

    const investmentAmount = parseFloat(amount);
    if (isNaN(investmentAmount) || investmentAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Calculate start date
      const months = parseInt(period);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);
      const startDateStr = startDate.toISOString().split('T')[0];

      // Fetch historical data
      const response = await fetch(
        `/api/stocks?symbol=${symbol.toUpperCase()}&action=history&from=${startDateStr}`
      );
      const data = await response.json();

      if (!data.success || !data.data || data.data.length === 0) {
        toast.error('Could not fetch historical data for this symbol');
        return;
      }

      const historicalData = data.data;
      const startPrice = historicalData[0].close;
      const endPrice = historicalData[historicalData.length - 1].close;
      const sharesOwned = investmentAmount / startPrice;
      const currentValue = sharesOwned * endPrice;
      const totalReturn = currentValue - investmentAmount;
      const percentReturn = ((currentValue - investmentAmount) / investmentAmount) * 100;

      // Calculate annualized return
      const years = months / 12;
      const annualizedReturn = (Math.pow(currentValue / investmentAmount, 1 / years) - 1) * 100;

      // Calculate max drawdown and highest/lowest values
      let highestValue = investmentAmount;
      let lowestValue = investmentAmount;
      let peak = investmentAmount;
      let maxDrawdown = 0;

      historicalData.forEach((day: any) => {
        const value = sharesOwned * day.close;
        if (value > highestValue) highestValue = value;
        if (value < lowestValue) lowestValue = value;
        if (value > peak) peak = value;
        const drawdown = ((peak - value) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      });

      // Get stock name
      const quoteResponse = await fetch(`/api/stocks?symbol=${symbol.toUpperCase()}&action=quote`);
      const quoteData = await quoteResponse.json();
      const stockName = quoteData.data?.name || symbol.toUpperCase();

      setResult({
        symbol: symbol.toUpperCase(),
        name: stockName,
        investmentAmount,
        startDate: historicalData[0].date,
        startPrice,
        endPrice,
        sharesOwned,
        currentValue,
        totalReturn,
        percentReturn,
        annualizedReturn,
        highestValue,
        lowestValue,
        maxDrawdown,
      });
    } catch (error) {
      console.error('Backtest error:', error);
      toast.error('Failed to run backtest');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Backtesting
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stock Symbol</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., AAPL, MSFT"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="flex-1"
                />
                {portfolio && portfolio.positions.length > 0 && (
                  <Select onValueChange={(v) => setSymbol(v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      {portfolio.positions
                        .filter((p) => p.assetType === 'stock' || p.assetType === 'etf')
                        .map((pos) => (
                          <SelectItem key={pos.id} value={pos.symbol}>
                            {pos.symbol}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Investment Amount ($)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_PERIODS.map((p) => (
                    <SelectItem key={p.months} value={p.months.toString()}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={runBacktest} className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <History className="h-4 w-4 mr-2" />
              )}
              Run Backtest
            </Button>
          </div>

          {/* Results Section */}
          <div>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Main Result */}
                <div
                  className={cn(
                    'p-4 rounded-lg border',
                    result.totalReturn >= 0
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  )}
                >
                  <p className="text-sm text-muted-foreground mb-1">
                    If you invested {formatCurrency(result.investmentAmount)} in {result.symbol}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold">
                      {formatCurrency(result.currentValue)}
                    </span>
                    <div
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded text-sm font-medium',
                        result.totalReturn >= 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                      )}
                    >
                      {result.totalReturn >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatPercent(result.percentReturn)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {result.totalReturn >= 0 ? 'Gain' : 'Loss'}: {formatCurrency(Math.abs(result.totalReturn))}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Start Price</p>
                    <p className="font-semibold">{formatCurrency(result.startPrice)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Current Price</p>
                    <p className="font-semibold">{formatCurrency(result.endPrice)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Shares Owned</p>
                    <p className="font-semibold">{result.sharesOwned.toFixed(4)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Annualized Return</p>
                    <p className={cn('font-semibold', result.annualizedReturn >= 0 ? 'text-green-500' : 'text-red-500')}>
                      {formatPercent(result.annualizedReturn)}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Highest Value</p>
                    <p className="font-semibold text-green-500">{formatCurrency(result.highestValue)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Max Drawdown</p>
                    <p className="font-semibold text-red-500">-{result.maxDrawdown.toFixed(1)}%</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Based on {result.startDate} to today
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm text-center">
                  Test &quot;what if&quot; scenarios to see how investments would have performed
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
