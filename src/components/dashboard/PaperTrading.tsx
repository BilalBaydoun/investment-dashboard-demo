'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  PlayCircle,
  StopCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  RefreshCw,
  History,
  Briefcase,
  RotateCcw,
} from 'lucide-react';
import { usePaperTradingStore } from '@/store/paperTradingStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';

export function PaperTrading() {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [stockName, setStockName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [startingAmount, setStartingAmount] = useState('100000');
  const [showStartDialog, setShowStartDialog] = useState(false);

  const {
    isActive,
    cashBalance,
    startingBalance,
    positions,
    trades,
    startPaperTrading,
    resetPaperTrading,
    executeBuy,
    executeSell,
    updatePrices,
    getTotalValue,
    getTotalPnL,
    getTotalPnLPercent,
    getPositionPnL,
  } = usePaperTradingStore();

  // Fetch current price for symbol
  const fetchPrice = async (sym: string) => {
    if (!sym.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stocks?symbol=${sym.toUpperCase()}&action=quote`);
      const data = await response.json();
      if (data.success && data.data) {
        setCurrentPrice(data.data.price);
        setStockName(data.data.name || sym.toUpperCase());
      } else {
        toast.error('Could not find stock');
        setCurrentPrice(0);
      }
    } catch (error) {
      toast.error('Failed to fetch price');
    } finally {
      setIsLoading(false);
    }
  };

  // Update all position prices
  const refreshPrices = useCallback(async () => {
    if (positions.length === 0) return;

    const symbols = positions.map((p) => p.symbol).join(',');
    try {
      const response = await fetch(`/api/stocks?symbols=${symbols}&action=quotes`);
      const data = await response.json();
      if (data.success && data.data) {
        const prices: Record<string, number> = {};
        Object.entries(data.data).forEach(([sym, quote]: [string, any]) => {
          prices[sym] = quote.price;
        });
        updatePrices(prices);
      }
    } catch (error) {
      console.error('Failed to refresh prices:', error);
    }
  }, [positions, updatePrices]);

  // Auto-refresh prices
  useEffect(() => {
    if (isActive && positions.length > 0) {
      refreshPrices();
      const interval = setInterval(refreshPrices, 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, positions.length, refreshPrices]);

  const handleBuy = () => {
    if (!symbol || !quantity || currentPrice <= 0) {
      toast.error('Please enter symbol and quantity');
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Invalid quantity');
      return;
    }

    const total = qty * currentPrice;
    if (total > cashBalance) {
      toast.error('Insufficient funds');
      return;
    }

    const success = executeBuy(symbol.toUpperCase(), stockName, qty, currentPrice);
    if (success) {
      toast.success(`Bought ${qty} shares of ${symbol.toUpperCase()}`);
      setSymbol('');
      setQuantity('');
      setCurrentPrice(0);
      setStockName('');
    }
  };

  const handleSell = (posSymbol: string, qty: number, price: number) => {
    const success = executeSell(posSymbol, qty, price);
    if (success) {
      toast.success(`Sold ${qty} shares of ${posSymbol}`);
    } else {
      toast.error('Failed to sell');
    }
  };

  const handleStart = () => {
    const amount = parseFloat(startingAmount);
    if (isNaN(amount) || amount < 1000) {
      toast.error('Minimum starting balance is $1,000');
      return;
    }
    startPaperTrading(amount);
    setShowStartDialog(false);
    toast.success('Paper trading started!');
  };

  const totalValue = getTotalValue();
  const totalPnL = getTotalPnL();
  const totalPnLPercent = getTotalPnLPercent();

  if (!isActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Paper Trading
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <PlayCircle className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Practice Without Risk</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Simulate trades with virtual money to test strategies
            </p>

            <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <PlayCircle className="h-5 w-5 mr-2" />
                  Start Paper Trading
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start Paper Trading</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Starting Balance</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={startingAmount}
                        onChange={(e) => setStartingAmount(e.target.value)}
                        className="pl-9"
                        placeholder="100000"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Minimum: $1,000 | Recommended: $100,000
                    </p>
                  </div>
                  <Button onClick={handleStart} className="w-full">
                    Start Trading
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-green-500" />
            Paper Trading
            <Badge variant="outline" className="text-green-500 border-green-500">
              LIVE
            </Badge>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={refreshPrices} title="Refresh prices">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm('Reset all paper trading data?')) {
                  resetPaperTrading();
                  toast.success('Paper trading reset');
                }
              }}
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Portfolio Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Value</p>
            <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Cash</p>
            <p className="text-lg font-bold">{formatCurrency(cashBalance)}</p>
          </div>
          <div
            className={cn(
              'p-3 rounded-lg',
              totalPnL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
            )}
          >
            <p className="text-xs text-muted-foreground">P&L</p>
            <p
              className={cn(
                'text-lg font-bold',
                totalPnL >= 0 ? 'text-green-500' : 'text-red-500'
              )}
            >
              {totalPnL >= 0 ? '+' : ''}
              {formatCurrency(totalPnL)}
              <span className="text-xs ml-1">({formatPercent(totalPnLPercent)})</span>
            </p>
          </div>
        </div>

        <Tabs defaultValue="trade" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trade">Trade</TabsTrigger>
            <TabsTrigger value="positions">
              Positions ({positions.length})
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Trade Tab */}
          <TabsContent value="trade" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input
                  placeholder="AAPL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  onBlur={() => fetchPrice(symbol)}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            {currentPrice > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{stockName}</p>
                    <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
                  </div>
                  {quantity && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total Cost</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(parseInt(quantity || '0') * currentPrice)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleBuy}
              className="w-full bg-green-500 hover:bg-green-600"
              disabled={isLoading || !symbol || !quantity || currentPrice <= 0}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              Buy
            </Button>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions">
            {positions.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {positions.map((position) => {
                    const { pnl, percent } = getPositionPnL(position.id);
                    return (
                      <div
                        key={position.id}
                        className="p-3 border rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">{position.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            {position.quantity} shares @ {formatCurrency(position.avgCost)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(position.quantity * position.currentPrice)}
                          </p>
                          <p
                            className={cn(
                              'text-xs',
                              pnl >= 0 ? 'text-green-500' : 'text-red-500'
                            )}
                          >
                            {pnl >= 0 ? '+' : ''}
                            {formatCurrency(pnl)} ({formatPercent(percent)})
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                          onClick={() =>
                            handleSell(position.symbol, position.quantity, position.currentPrice)
                          }
                        >
                          Sell
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No positions yet</p>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            {trades.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {[...trades].reverse().map((trade) => (
                    <div
                      key={trade.id}
                      className={cn(
                        'p-3 rounded-lg border',
                        trade.type === 'buy'
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-red-500/30 bg-red-500/5'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {trade.type === 'buy' ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium">{trade.symbol}</span>
                          <Badge variant="outline" className="text-xs">
                            {trade.type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="font-medium">{formatCurrency(trade.total)}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {trade.quantity} shares @ {formatCurrency(trade.price)}
                        {trade.pnl !== undefined && (
                          <span
                            className={cn(
                              'ml-2',
                              trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                            )}
                          >
                            P&L: {trade.pnl >= 0 ? '+' : ''}
                            {formatCurrency(trade.pnl)}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(trade.date).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No trades yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
