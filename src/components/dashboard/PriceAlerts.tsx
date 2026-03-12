'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useAlertsStore, type AlertCondition } from '@/store/alertsStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/api/stocks';

export function PriceAlerts() {
  const [isOpen, setIsOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const {
    addAlert,
    removeAlert,
    checkAlerts,
    getActiveAlerts,
    getTriggeredAlerts,
    notificationsEnabled,
  } = useAlertsStore();

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const checkAndNotify = useCallback(async () => {
    const activeAlerts = getActiveAlerts();
    if (activeAlerts.length === 0) return;

    const symbols = [...new Set(activeAlerts.map((a) => a.symbol))];
    const prices: Record<string, number> = {};

    try {
      const stockSymbols = symbols.filter((s) => !s.includes('-USD'));
      if (stockSymbols.length > 0) {
        const response = await fetch(
          `/api/stocks?symbols=${stockSymbols.join(',')}&action=quotes`
        );
        const data = await response.json();
        if (data.success && data.data) {
          Object.entries(data.data).forEach(([sym, quote]: [string, any]) => {
            prices[sym] = quote.price;
          });
        }
      }

      const triggered = checkAlerts(prices);
      if (triggered.length > 0 && notificationsEnabled && 'Notification' in window) {
        triggered.forEach((alert) => {
          const direction = alert.condition === 'above' ? 'risen above' : 'fallen below';
          toast.success(`${alert.symbol} has ${direction} ${formatCurrency(alert.targetPrice)}!`);
        });
      }
    } catch (error) {
      console.error('Failed to check alerts:', error);
    }
  }, [checkAlerts, getActiveAlerts, notificationsEnabled]);

  useEffect(() => {
    checkAndNotify();
    const interval = setInterval(checkAndNotify, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndNotify]);

  const fetchCurrentPrice = async (sym: string) => {
    if (!sym) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stocks?symbol=${sym}&action=quote`);
      const data = await response.json();
      if (data.success && data.data) {
        setCurrentPrice(data.data.price);
        setName(data.data.name || sym);
      }
    } catch (error) {
      console.error('Failed to fetch price:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAlert = () => {
    if (!symbol || !targetPrice || !name) {
      toast.error('Please fill in all fields');
      return;
    }

    addAlert({
      symbol: symbol.toUpperCase(),
      name,
      targetPrice: parseFloat(targetPrice),
      condition,
      currentPrice,
    });

    toast.success(`Alert set for ${symbol.toUpperCase()}`);
    setIsOpen(false);
    setSymbol('');
    setName('');
    setTargetPrice('');
    setCurrentPrice(0);
  };

  const activeAlerts = getActiveAlerts();
  const triggeredAlerts = getTriggeredAlerts();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Price Alerts
            {triggeredAlerts.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {triggeredAlerts.length}
              </Badge>
            )}
          </span>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Price Alert</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., AAPL"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      onBlur={() => fetchCurrentPrice(symbol)}
                    />
                    {portfolio && portfolio.positions.length > 0 && (
                      <Select
                        onValueChange={(value) => {
                          const pos = portfolio.positions.find((p) => p.symbol === value);
                          if (pos) {
                            setSymbol(pos.symbol);
                            setName(pos.name);
                            setCurrentPrice(pos.currentPrice);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Portfolio" />
                        </SelectTrigger>
                        <SelectContent>
                          {portfolio.positions.map((pos) => (
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
                  <Label>Name</Label>
                  <Input
                    placeholder="Asset name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Condition</Label>
                    <Select
                      value={condition}
                      onValueChange={(v) => setCondition(v as AlertCondition)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="below">Below</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={handleAddAlert} className="w-full" disabled={isLoading}>
                  Create Alert
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeAlerts.length === 0 && triggeredAlerts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No price alerts set</p>
          </div>
        ) : (
          <div className="space-y-1">
            {triggeredAlerts.slice(0, 2).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-[10px] px-1 py-0">!</Badge>
                  <span className="font-medium text-sm">{alert.symbol}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(alert.currentPrice)}
                </span>
              </div>
            ))}
            {activeAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {alert.condition === 'above' ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className="font-medium text-sm">{alert.symbol}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(alert.targetPrice)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeAlert(alert.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
