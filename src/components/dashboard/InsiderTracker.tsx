'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserCheck,
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/api/stocks';

interface InsiderTransaction {
  name: string;
  relationship: string;
  transactionDate: string;
  transactionType: string;
  shares: number;
  price: number;
  value: number;
  sharesOwned: number;
}

export function InsiderTracker() {
  const [symbol, setSymbol] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<InsiderTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const fetchInsiderData = async (sym: string) => {
    if (!sym.trim()) return;

    setIsLoading(true);
    setSelectedSymbol(sym.toUpperCase());

    try {
      const response = await fetch(`/api/insider?symbol=${sym.toUpperCase()}`);
      const data = await response.json();

      if (data.success && data.data) {
        setTransactions(data.data);
        if (data.note) {
          toast.info(data.note);
        }
      } else {
        toast.error('Failed to fetch insider data');
        setTransactions([]);
      }
    } catch (error) {
      console.error('Insider fetch error:', error);
      toast.error('Failed to fetch insider data');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInsiderData(symbol);
  };

  // Calculate summary stats
  const buyTransactions = transactions.filter((t) =>
    t.transactionType.toLowerCase().includes('buy') ||
    t.transactionType.toLowerCase().includes('purchase')
  );
  const sellTransactions = transactions.filter((t) =>
    t.transactionType.toLowerCase().includes('sell') ||
    t.transactionType.toLowerCase().includes('sale')
  );

  const totalBuyValue = buyTransactions.reduce((sum, t) => sum + t.value, 0);
  const totalSellValue = sellTransactions.reduce((sum, t) => sum + t.value, 0);
  const netValue = totalBuyValue - totalSellValue;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Insider Trading
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            placeholder="Enter symbol..."
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="flex-1"
          />
          {portfolio && portfolio.positions.length > 0 && (
            <Select
              onValueChange={(v) => {
                setSymbol(v);
                fetchInsiderData(v);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolio.positions
                  .filter((p) => p.assetType === 'stock')
                  .map((pos) => (
                    <SelectItem key={pos.id} value={pos.symbol}>
                      {pos.symbol}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <Button type="submit" size="icon" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : selectedSymbol && transactions.length > 0 ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Buys</p>
                <p className="font-semibold text-green-500">{buyTransactions.length}</p>
                <p className="text-xs text-green-500">{formatCurrency(totalBuyValue)}</p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Sells</p>
                <p className="font-semibold text-red-500">{sellTransactions.length}</p>
                <p className="text-xs text-red-500">{formatCurrency(totalSellValue)}</p>
              </div>
              <div
                className={cn(
                  'p-3 rounded-lg text-center',
                  netValue >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                )}
              >
                <p className="text-xs text-muted-foreground">Net</p>
                <p className={cn('font-semibold', netValue >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {netValue >= 0 ? 'Bullish' : 'Bearish'}
                </p>
                <p className={cn('text-xs', netValue >= 0 ? 'text-green-500' : 'text-red-500')}>
                  {formatCurrency(Math.abs(netValue))}
                </p>
              </div>
            </div>

            {/* Transactions List */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {transactions.map((tx, index) => {
                  const isBuy =
                    tx.transactionType.toLowerCase().includes('buy') ||
                    tx.transactionType.toLowerCase().includes('purchase');

                  return (
                    <div
                      key={index}
                      className={cn(
                        'p-3 rounded-lg border',
                        isBuy
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-red-500/30 bg-red-500/5'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {isBuy ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium text-sm truncate max-w-[150px]">
                              {tx.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tx.relationship}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              isBuy ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'
                            )}
                          >
                            {tx.transactionType}
                          </Badge>
                          <p className="text-sm font-medium mt-1">
                            {tx.shares.toLocaleString()} shares
                          </p>
                          {tx.value > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(tx.value)}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {tx.transactionDate}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Insider buying is often a bullish signal
            </p>
          </>
        ) : selectedSymbol ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No insider transactions found for {selectedSymbol}</p>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Search for a stock to see insider activity</p>
            <p className="text-xs mt-1">Track when executives buy or sell shares</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
