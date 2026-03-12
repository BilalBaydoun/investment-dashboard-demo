'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Bell, BellOff, MoreHorizontal, Trash2, TrendingUp, TrendingDown, Eye, Brain } from 'lucide-react';
import { AssetLogo } from '@/components/ui/asset-logo';
import { useWatchlistStore } from '@/store/watchlistStore';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import type { AssetType, Quote } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function WatchlistPage() {
  const [mounted, setMounted] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    assetType: 'stock' as AssetType,
    targetPrice: '',
    notes: '',
  });

  const { items, addItem, removeItem, toggleAlert } = useWatchlistStore();

  // Track notification permission and sent alerts
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const sentAlertsRef = useRef<Set<string>>(new Set());

  // Wait for hydration to complete
  useEffect(() => {
    setMounted(true);
    // Check notification permission on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Notifications not supported in this browser');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success('Notifications enabled');
        // Send a test notification
        new Notification('InvestAI Alerts', {
          body: 'Price alerts are now enabled!',
          icon: '/favicon.ico',
        });
      } else if (permission === 'denied') {
        toast.error('Notifications blocked. Please enable in browser settings.');
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      toast.error('Failed to enable notifications');
    }
  }, []);

  // Send notification for price alert
  const sendPriceAlert = useCallback((symbol: string, name: string, currentPrice: number, targetPrice: number) => {
    const alertKey = `${symbol}-${targetPrice}`;

    // Don't send duplicate alerts
    if (sentAlertsRef.current.has(alertKey)) return;

    if (notificationPermission === 'granted') {
      new Notification(`${symbol} Price Alert`, {
        body: `${name || symbol} has reached ${formatCurrency(currentPrice)}! (Target: ${formatCurrency(targetPrice)})`,
        icon: '/favicon.ico',
        tag: alertKey, // Prevents duplicate notifications
      });
      sentAlertsRef.current.add(alertKey);
      toast.success(`${symbol} reached target price!`);
    }
  }, [notificationPermission]);

  // Check for price alerts
  useEffect(() => {
    if (!mounted || Object.keys(quotes).length === 0) return;

    items.forEach((item) => {
      if (!item.alertEnabled || !item.targetPrice) return;

      const quote = quotes[item.symbol];
      if (!quote?.price) return;

      if (quote.price >= item.targetPrice) {
        sendPriceAlert(item.symbol, item.name, quote.price, item.targetPrice);
      }
    });
  }, [mounted, items, quotes, sendPriceAlert]);

  // Fetch quotes for all watchlist items
  useEffect(() => {
    const fetchQuotes = async () => {
      if (!mounted || items.length === 0) return;

      setIsLoading(true);
      try {
        const symbols = items.map((item) => item.symbol);
        const stockSymbols = items
          .filter((item) => item.assetType !== 'crypto')
          .map((item) => item.symbol);
        const cryptoSymbols = items
          .filter((item) => item.assetType === 'crypto')
          .map((item) => item.symbol);

        const newQuotes: Record<string, Quote> = {};

        // Fetch stock quotes
        if (stockSymbols.length > 0) {
          const response = await fetch(
            `/api/stocks?symbols=${stockSymbols.join(',')}&action=quotes`
          );
          const data = await response.json();
          if (data.success) {
            Object.assign(newQuotes, data.data);
          }
        }

        // Fetch crypto quotes
        if (cryptoSymbols.length > 0) {
          const response = await fetch(
            `/api/crypto?symbols=${cryptoSymbols.join(',')}&action=quotes`
          );
          const data = await response.json();
          if (data.success) {
            Object.assign(newQuotes, data.data);
          }
        }

        setQuotes(newQuotes);
      } catch (error) {
        console.error('Failed to fetch quotes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuotes();
    // Refresh every 5 minutes
    const interval = setInterval(fetchQuotes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mounted, items]);

  const handleAddItem = () => {
    if (!formData.symbol.trim()) {
      toast.error('Symbol is required');
      return;
    }

    addItem({
      symbol: formData.symbol.toUpperCase(),
      name: formData.name || formData.symbol.toUpperCase(),
      assetType: formData.assetType,
      targetPrice: formData.targetPrice ? parseFloat(formData.targetPrice) : undefined,
      alertEnabled: !!formData.targetPrice,
      notes: formData.notes,
    });

    setFormData({
      symbol: '',
      name: '',
      assetType: 'stock',
      targetPrice: '',
      notes: '',
    });
    setShowAddDialog(false);
    toast.success('Added to watchlist');
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
    toast.success('Removed from watchlist');
  };

  const assetTypeColors: Record<AssetType, string> = {
    stock: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    crypto: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    etf: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    bond: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    real_estate: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    cash: 'bg-green-500/10 text-green-500 border-green-500/20',
    commodity: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  };

  // Show loading skeleton until hydrated
  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header
          title="Watchlist"
          subtitle="Track potential investments"
        />
        <div className="p-3 md:p-6 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-36" />
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Watchlist"
        subtitle="Track potential investments"
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'} in watchlist
            </p>
            {notificationPermission !== 'granted' && (
              <Button
                variant="outline"
                size="sm"
                onClick={requestNotificationPermission}
                className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
              >
                <Bell className="h-4 w-4 mr-2" />
                Enable Notifications
              </Button>
            )}
            {notificationPermission === 'granted' && (
              <Badge variant="outline" className="text-green-500 border-green-500/50">
                <Bell className="h-3 w-3 mr-1" />
                Notifications On
              </Badge>
            )}
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add to Watchlist
          </Button>
        </div>

        {/* Watchlist Table */}
        <Card>
          <CardContent className="p-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your watchlist is empty</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Add stocks, ETFs, or crypto to your watchlist to track potential investments.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-center">Alert</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const quote = quotes[item.symbol];
                    const isPositive = quote?.changePercent >= 0;
                    const atTarget =
                      item.targetPrice && quote?.price && quote.price >= item.targetPrice;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <AssetLogo
                              symbol={item.symbol}
                              name={item.name}
                              assetType={item.assetType}
                              size="md"
                            />
                            <div>
                              <p className="font-medium">{item.symbol}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {item.name}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('capitalize', assetTypeColors[item.assetType])}
                          >
                            {item.assetType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {quote ? formatCurrency(quote.price) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {quote ? (
                            <div
                              className={cn(
                                'flex items-center justify-end gap-1',
                                isPositive ? 'text-green-500' : 'text-red-500'
                              )}
                            >
                              {isPositive ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              <span className="font-mono">
                                {formatPercent(quote.changePercent)}
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.targetPrice ? (
                            <span
                              className={cn(
                                'font-mono',
                                atTarget ? 'text-green-500 font-semibold' : ''
                              )}
                            >
                              {formatCurrency(item.targetPrice)}
                              {atTarget && ' ✓'}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAlert(item.id)}
                            className={item.alertEnabled ? 'text-primary' : 'text-muted-foreground'}
                          >
                            {item.alertEnabled ? (
                              <Bell className="h-4 w-4" />
                            ) : (
                              <BellOff className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                            {item.notes || '-'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/analysis?symbol=${item.symbol}`}>
                                  <Brain className="mr-2 h-4 w-4" />
                                  Analyze
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add to Watchlist Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Watchlist</DialogTitle>
            <DialogDescription>
              Track an asset and set price alerts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol *</Label>
                <Input
                  id="symbol"
                  placeholder="AAPL"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assetType">Type</Label>
                <Select
                  value={formData.assetType}
                  onValueChange={(value: AssetType) =>
                    setFormData({ ...formData, assetType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="etf">ETF</SelectItem>
                    <SelectItem value="bond">Bond</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                placeholder="Apple Inc."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetPrice">Target Price ($)</Label>
              <Input
                id="targetPrice"
                type="number"
                step="any"
                placeholder="Set a target price for alerts"
                value={formData.targetPrice}
                onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Why are you watching this asset?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem}>Add to Watchlist</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
