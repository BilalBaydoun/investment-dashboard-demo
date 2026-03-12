'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GitCompare,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  avgVolume?: number;
  beta?: number;
}

export function StockComparison() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [stockData, setStockData] = useState<Record<string, StockData>>({});
  const [inputSymbol, setInputSymbol] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const addSymbol = async (symbol: string) => {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return;
    if (symbols.includes(sym)) {
      toast.error(`${sym} is already in the comparison`);
      return;
    }
    if (symbols.length >= 4) {
      toast.error('Maximum 4 stocks can be compared at once');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/stocks?symbol=${sym}&action=quote`);
      const data = await response.json();

      if (!data.success || !data.data) {
        toast.error(`Could not find stock: ${sym}`);
        return;
      }

      setSymbols((prev) => [...prev, sym]);
      setStockData((prev) => ({
        ...prev,
        [sym]: {
          symbol: sym,
          name: data.data.name,
          price: data.data.price,
          change: data.data.change,
          changePercent: data.data.changePercent,
          marketCap: data.data.marketCap,
          peRatio: data.data.peRatio,
          dividendYield: data.data.dividendYield,
          fiftyTwoWeekHigh: data.data.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: data.data.fiftyTwoWeekLow,
          volume: data.data.volume,
          avgVolume: data.data.avgVolume,
          beta: data.data.beta,
        },
      }));
      setInputSymbol('');
    } catch (error) {
      console.error('Failed to fetch stock:', error);
      toast.error('Failed to fetch stock data');
    } finally {
      setIsLoading(false);
    }
  };

  const removeSymbol = (symbol: string) => {
    setSymbols((prev) => prev.filter((s) => s !== symbol));
    setStockData((prev) => {
      const newData = { ...prev };
      delete newData[symbol];
      return newData;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSymbol(inputSymbol);
  };

  const formatMarketCap = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return formatCurrency(value);
  };

  const formatVolume = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toLocaleString();
  };

  const getBestValue = (values: (number | undefined)[], higher: boolean = true) => {
    const validValues = values.filter((v) => v !== undefined) as number[];
    if (validValues.length === 0) return undefined;
    return higher ? Math.max(...validValues) : Math.min(...validValues);
  };

  const comparisonMetrics = [
    { key: 'price', label: 'Current Price', format: formatCurrency, higherBetter: null },
    { key: 'changePercent', label: 'Daily Change', format: (v: number) => formatPercent(v), higherBetter: true },
    { key: 'marketCap', label: 'Market Cap', format: formatMarketCap, higherBetter: true },
    { key: 'peRatio', label: 'P/E Ratio', format: (v?: number) => v?.toFixed(2) || 'N/A', higherBetter: false },
    { key: 'dividendYield', label: 'Dividend Yield', format: (v?: number) => v ? `${v.toFixed(2)}%` : 'N/A', higherBetter: true },
    { key: 'fiftyTwoWeekHigh', label: '52W High', format: formatCurrency, higherBetter: null },
    { key: 'fiftyTwoWeekLow', label: '52W Low', format: formatCurrency, higherBetter: null },
    { key: 'volume', label: 'Volume', format: formatVolume, higherBetter: null },
    { key: 'beta', label: 'Beta', format: (v?: number) => v?.toFixed(2) || 'N/A', higherBetter: null },
  ];

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompare className="h-5 w-5" />
          Stock Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add Stocks */}
        <div className="flex flex-wrap gap-3 mb-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Enter symbol (e.g., AAPL)"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
              className="w-40"
              disabled={isLoading || symbols.length >= 4}
            />
            <Button type="submit" size="icon" disabled={isLoading || symbols.length >= 4}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </form>

          {portfolio && portfolio.positions.length > 0 && (
            <Select
              onValueChange={(value) => addSymbol(value)}
              disabled={isLoading || symbols.length >= 4}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="From portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolio.positions
                  .filter((p) => !symbols.includes(p.symbol))
                  .map((pos) => (
                    <SelectItem key={pos.id} value={pos.symbol}>
                      {pos.symbol} - {pos.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          {/* Selected Symbols */}
          <div className="flex flex-wrap gap-2 items-center">
            {symbols.map((symbol) => (
              <Badge
                key={symbol}
                variant="secondary"
                className="px-3 py-1 text-sm flex items-center gap-1"
              >
                {symbol}
                <button
                  onClick={() => removeSymbol(symbol)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Comparison Table */}
        {symbols.length > 0 ? (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Metric</TableHead>
                  {symbols.map((symbol) => (
                    <TableHead key={symbol} className="text-center min-w-[150px]">
                      <div className="flex flex-col items-center">
                        <span className="font-semibold">{symbol}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          {stockData[symbol]?.name}
                        </span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonMetrics.map((metric) => {
                  const values = symbols.map((s) => (stockData[s] as any)?.[metric.key]);
                  const bestValue =
                    metric.higherBetter !== null
                      ? getBestValue(values, metric.higherBetter)
                      : undefined;

                  return (
                    <TableRow key={metric.key}>
                      <TableCell className="font-medium">{metric.label}</TableCell>
                      {symbols.map((symbol) => {
                        const value = (stockData[symbol] as any)?.[metric.key];
                        const isBest = bestValue !== undefined && value === bestValue;
                        const isChangePercent = metric.key === 'changePercent';

                        return (
                          <TableCell
                            key={symbol}
                            className={cn(
                              'text-center',
                              isBest && 'bg-green-500/10 font-semibold',
                              isChangePercent && value > 0 && 'text-green-500',
                              isChangePercent && value < 0 && 'text-red-500'
                            )}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {isChangePercent && value !== undefined && (
                                value > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : value < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : null
                              )}
                              {metric.format(value)}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}

                {/* Distance from 52W High */}
                <TableRow>
                  <TableCell className="font-medium">Distance from 52W High</TableCell>
                  {symbols.map((symbol) => {
                    const data = stockData[symbol];
                    if (!data) return <TableCell key={symbol} className="text-center">N/A</TableCell>;
                    const distance = ((data.price - data.fiftyTwoWeekHigh) / data.fiftyTwoWeekHigh) * 100;
                    return (
                      <TableCell key={symbol} className="text-center text-red-500">
                        {distance.toFixed(1)}%
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Distance from 52W Low */}
                <TableRow>
                  <TableCell className="font-medium">Distance from 52W Low</TableCell>
                  {symbols.map((symbol) => {
                    const data = stockData[symbol];
                    if (!data) return <TableCell key={symbol} className="text-center">N/A</TableCell>;
                    const distance = ((data.price - data.fiftyTwoWeekLow) / data.fiftyTwoWeekLow) * 100;
                    return (
                      <TableCell key={symbol} className="text-center text-green-500">
                        +{distance.toFixed(1)}%
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No stocks selected</p>
            <p className="text-sm mt-1">Add up to 4 stocks to compare them side by side</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
