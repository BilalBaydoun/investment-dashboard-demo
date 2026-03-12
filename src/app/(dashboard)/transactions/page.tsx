'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  Search,
  Plus,
  Download,
  Filter,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatCurrency } from '@/lib/api/stocks';
import type { Transaction, TransactionType, AssetType } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function TransactionsPage() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    symbol: '',
    type: 'buy' as TransactionType,
    assetType: 'stock' as AssetType,
    quantity: '',
    price: '',
    notes: '',
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isValidatingTicker, setIsValidatingTicker] = useState(false);
  const [tickerValidation, setTickerValidation] = useState<{ valid: boolean; name?: string; price?: number } | null>(null);

  const { transactions, addTransaction, updateTransaction, deleteTransaction, getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((t) =>
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filtered;
  }, [transactions, searchQuery, filterType]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalBuys = transactions
      .filter((t) => t.type === 'buy')
      .reduce((sum, t) => sum + t.total, 0);
    const totalSells = transactions
      .filter((t) => t.type === 'sell')
      .reduce((sum, t) => sum + t.total, 0);
    const totalDividends = transactions
      .filter((t) => t.type === 'dividend')
      .reduce((sum, t) => sum + t.total, 0);

    return { totalBuys, totalSells, totalDividends };
  }, [transactions]);

  const validateTicker = async (symbol: string, assetType: AssetType) => {
    if (!symbol || symbol.length < 1) {
      setTickerValidation(null);
      return;
    }

    setIsValidatingTicker(true);
    setTickerValidation(null);

    try {
      // For crypto, validate via crypto API
      if (assetType === 'crypto') {
        const response = await fetch(`/api/crypto?symbol=${symbol.toLowerCase()}&action=quote`);
        if (response.ok) {
          const result = await response.json();
          // Handle both { data: {...} } and direct response formats
          const quote = result.data || result;
          if (quote.price) {
            setTickerValidation({ valid: true, name: quote.name || symbol, price: quote.price });
            // Auto-fill price if empty
            if (!newTransaction.price) {
              setNewTransaction(prev => ({ ...prev, price: quote.price.toString() }));
            }
          } else {
            setTickerValidation({ valid: false });
          }
        } else {
          setTickerValidation({ valid: false });
        }
      } else {
        // For stocks, ETFs, bonds, etc. use the stock API
        const response = await fetch(`/api/stocks?symbol=${symbol.toUpperCase()}&action=quote`);
        if (response.ok) {
          const result = await response.json();
          // API returns { success: true, data: { price, name, ... } }
          const quote = result.data || result;
          if (quote.price && quote.price > 0) {
            setTickerValidation({ valid: true, name: quote.name || quote.shortName || symbol, price: quote.price });
            // Auto-fill price if empty
            if (!newTransaction.price) {
              setNewTransaction(prev => ({ ...prev, price: quote.price.toString() }));
            }
          } else {
            setTickerValidation({ valid: false });
          }
        } else {
          setTickerValidation({ valid: false });
        }
      }
    } catch {
      setTickerValidation({ valid: false });
    } finally {
      setIsValidatingTicker(false);
    }
  };

  const handleAddTransaction = () => {
    if (!newTransaction.symbol || !newTransaction.quantity || !newTransaction.price) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Skip validation for manual/custom assets
    const skipValidationTypes: AssetType[] = ['real_estate', 'cash', 'commodity', 'bond'];
    if (!skipValidationTypes.includes(newTransaction.assetType) && tickerValidation && !tickerValidation.valid) {
      toast.error('Please enter a valid ticker symbol');
      return;
    }

    const quantity = parseFloat(newTransaction.quantity);
    const price = parseFloat(newTransaction.price);

    addTransaction({
      positionId: '',
      symbol: newTransaction.symbol.toUpperCase(),
      type: newTransaction.type,
      assetType: newTransaction.assetType,
      quantity,
      price,
      total: quantity * price,
      date: new Date(),
      notes: newTransaction.notes || undefined,
    });

    setNewTransaction({
      symbol: '',
      type: 'buy',
      assetType: 'stock',
      quantity: '',
      price: '',
      notes: '',
    });
    setTickerValidation(null);
    setShowAddTransaction(false);
    toast.success('Transaction added');
  };

  const handleEditTransaction = () => {
    if (!editingTransaction) return;

    const quantity = parseFloat(String(editingTransaction.quantity));
    const price = parseFloat(String(editingTransaction.price));

    if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
      toast.error('Please enter valid quantity and price');
      return;
    }

    updateTransaction(editingTransaction.id, {
      symbol: editingTransaction.symbol.toUpperCase(),
      type: editingTransaction.type,
      quantity,
      price,
      total: quantity * price,
      notes: editingTransaction.notes,
    });

    setEditingTransaction(null);
    toast.success('Transaction updated');
  };

  const handleDeleteTransaction = () => {
    if (!deletingTransaction) return;

    deleteTransaction(deletingTransaction.id);
    setDeletingTransaction(null);
    toast.success('Transaction deleted');
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Symbol', 'Type', 'Quantity', 'Price', 'Total', 'Notes'];
    const rows = filteredTransactions.map((t) => [
      format(new Date(t.date), 'yyyy-MM-dd HH:mm'),
      t.symbol,
      t.type,
      t.quantity,
      t.price,
      t.total,
      t.notes || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  };

  const getTypeIcon = (type: TransactionType) => {
    switch (type) {
      case 'buy':
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case 'sell':
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      case 'dividend':
        return <DollarSign className="h-4 w-4 text-blue-500" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: TransactionType) => {
    const variants: Record<TransactionType, string> = {
      buy: 'bg-green-500/10 text-green-500 border-green-500/20',
      sell: 'bg-red-500/10 text-red-500 border-red-500/20',
      dividend: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      deposit: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      withdrawal: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    };

    return (
      <Badge variant="outline" className={cn('capitalize', variants[type])}>
        {type}
      </Badge>
    );
  };

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header title="Transactions" subtitle="View your transaction history" />
        <div className="p-3 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Transactions" subtitle="View your transaction history" />

      <div className="p-3 md:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <ArrowDownCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bought</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalBuys)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/10">
                  <ArrowUpCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sold</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalSells)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dividends Received</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.totalDividends)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="dividend">Dividend</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setShowAddTransaction(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Transaction History
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredTransactions.length} transactions)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Add positions to your portfolio to start tracking transactions.
                </p>
                <Button onClick={() => setShowAddTransaction(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(transaction.date), 'MMM d, yyyy')}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(transaction.date), 'h:mm a')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(transaction.type)}
                          <span className="font-medium">{transaction.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(transaction.type)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {transaction.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(transaction.price)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(transaction.total)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {transaction.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingTransaction(transaction)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => setDeletingTransaction(transaction)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTransaction} onOpenChange={setShowAddTransaction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Manually record a buy, sell, or dividend transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Asset Type Selector */}
            <div className="space-y-2">
              <Label>Asset Type *</Label>
              <Select
                value={newTransaction.assetType}
                onValueChange={(value: AssetType) => {
                  setNewTransaction({ ...newTransaction, assetType: value });
                  setTickerValidation(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="bond">Bond</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="commodity">Commodity</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txSymbol">Symbol *</Label>
                <div className="relative">
                  <Input
                    id="txSymbol"
                    placeholder={newTransaction.assetType === 'crypto' ? 'BTC' : 'AAPL'}
                    value={newTransaction.symbol}
                    onChange={(e) => {
                      setNewTransaction({ ...newTransaction, symbol: e.target.value.toUpperCase() });
                      setTickerValidation(null);
                    }}
                    onBlur={() => {
                      if (newTransaction.symbol && !['real_estate', 'cash', 'commodity', 'bond'].includes(newTransaction.assetType)) {
                        validateTicker(newTransaction.symbol, newTransaction.assetType);
                      }
                    }}
                    className={cn(
                      tickerValidation && (tickerValidation.valid ? 'border-green-500 pr-10' : 'border-red-500 pr-10')
                    )}
                  />
                  {isValidatingTicker && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!isValidatingTicker && tickerValidation && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {tickerValidation.valid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {tickerValidation?.valid && tickerValidation.name && (
                  <p className="text-xs text-green-600">{tickerValidation.name}</p>
                )}
                {tickerValidation && !tickerValidation.valid && (
                  <p className="text-xs text-red-500">Invalid ticker symbol</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Transaction Type *</Label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(value: TransactionType) =>
                    setNewTransaction({ ...newTransaction, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                    <SelectItem value="dividend">Dividend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="txQuantity">Quantity *</Label>
                <Input
                  id="txQuantity"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="100"
                  value={newTransaction.quantity}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, quantity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="txPrice">Price ($) *</Label>
                <Input
                  id="txPrice"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={tickerValidation?.price ? tickerValidation.price.toFixed(2) : '150.00'}
                  value={newTransaction.price}
                  onChange={(e) =>
                    setNewTransaction({ ...newTransaction, price: e.target.value })
                  }
                />
                {tickerValidation?.valid && tickerValidation.price && !newTransaction.price && (
                  <p className="text-xs text-muted-foreground">
                    Current price: ${tickerValidation.price.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="txNotes">Notes (optional)</Label>
              <Input
                id="txNotes"
                placeholder="Add any notes..."
                value={newTransaction.notes}
                onChange={(e) =>
                  setNewTransaction({ ...newTransaction, notes: e.target.value })
                }
              />
            </div>

            {newTransaction.quantity && newTransaction.price && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">
                    {formatCurrency(parseFloat(newTransaction.quantity) * parseFloat(newTransaction.price))}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTransaction(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTransaction}>Add Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Modify the transaction details below.
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editSymbol">Symbol *</Label>
                  <Input
                    id="editSymbol"
                    placeholder="AAPL"
                    value={editingTransaction.symbol}
                    onChange={(e) =>
                      setEditingTransaction({ ...editingTransaction, symbol: e.target.value.toUpperCase() })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select
                    value={editingTransaction.type}
                    onValueChange={(value: TransactionType) =>
                      setEditingTransaction({ ...editingTransaction, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                      <SelectItem value="dividend">Dividend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editQuantity">Quantity *</Label>
                  <Input
                    id="editQuantity"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="100"
                    value={editingTransaction.quantity}
                    onChange={(e) =>
                      setEditingTransaction({ ...editingTransaction, quantity: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPrice">Price ($) *</Label>
                  <Input
                    id="editPrice"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="150.00"
                    value={editingTransaction.price}
                    onChange={(e) =>
                      setEditingTransaction({ ...editingTransaction, price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editNotes">Notes (optional)</Label>
                <Input
                  id="editNotes"
                  placeholder="Add any notes..."
                  value={editingTransaction.notes || ''}
                  onChange={(e) =>
                    setEditingTransaction({ ...editingTransaction, notes: e.target.value })
                  }
                />
              </div>

              {editingTransaction.quantity && editingTransaction.price && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">
                      {formatCurrency(editingTransaction.quantity * editingTransaction.price)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTransaction(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditTransaction}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTransaction} onOpenChange={(open) => !open && setDeletingTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingTransaction && (
            <div className="py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Symbol:</span>
                  <span className="font-medium">{deletingTransaction.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="capitalize">{deletingTransaction.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span>{deletingTransaction.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{formatCurrency(deletingTransaction.total)}</span>
                </div>
              </div>
              <p className="text-sm text-amber-600 mt-3">
                Note: Deleting this transaction will reverse its effect on your position quantity.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTransaction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTransaction}>
              Delete Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
