'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { PortfolioTable } from '@/components/portfolio/PortfolioTable';
import { AddPositionForm } from '@/components/portfolio/AddPositionForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Download, Upload, Trash2, FolderPlus, Wallet, FileSpreadsheet } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import type { Position, AssetType } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CSVPosition {
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  assetType: AssetType;
}

export default function PortfolioPage() {
  const [mounted, setMounted] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showNewPortfolio, setShowNewPortfolio] = useState(false);
  const [showCashDialog, setShowCashDialog] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvData, setCSVData] = useState<CSVPosition[]>([]);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashAction, setCashAction] = useState<'deposit' | 'withdraw' | 'set'>('set');

  const {
    portfolios,
    activePortfolioId,
    setActivePortfolio,
    addPortfolio,
    deletePortfolio,
    addPosition,
    getActivePortfolio,
    getTotalValue,
    getTotalCost,
    getTotalGain,
    getTotalGainPercent,
    getCashBalance,
    depositCash,
    withdrawCash,
    setCashBalance,
  } = usePortfolioStore();

  // Wait for hydration to complete
  useEffect(() => {
    setMounted(true);
  }, []);

  const portfolio = getActivePortfolio();
  const totalValue = getTotalValue();
  const totalCost = getTotalCost();
  const totalGain = getTotalGain();
  const totalGainPercent = getTotalGainPercent();
  const cashBalance = getCashBalance();

  const handleCashAction = () => {
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    switch (cashAction) {
      case 'deposit':
        depositCash(amount);
        toast.success(`Deposited ${formatCurrency(amount)}`);
        break;
      case 'withdraw':
        if (amount > cashBalance) {
          toast.error('Insufficient cash balance');
          return;
        }
        withdrawCash(amount);
        toast.success(`Withdrew ${formatCurrency(amount)}`);
        break;
      case 'set':
        setCashBalance(amount);
        toast.success(`Cash balance set to ${formatCurrency(amount)}`);
        break;
    }

    setCashAmount('');
    setShowCashDialog(false);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          toast.error('CSV file is empty or has no data rows');
          return;
        }

        // Parse header
        const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
        const symbolIndex = header.findIndex((h) => h.includes('symbol') || h.includes('ticker'));
        const nameIndex = header.findIndex((h) => h.includes('name') || h.includes('company'));
        const quantityIndex = header.findIndex((h) => h.includes('quantity') || h.includes('shares') || h.includes('qty'));
        const costIndex = header.findIndex((h) => h.includes('cost') || h.includes('price') || h.includes('avg'));
        const typeIndex = header.findIndex((h) => h.includes('type') || h.includes('asset'));

        if (symbolIndex === -1 || quantityIndex === -1) {
          toast.error('CSV must have Symbol and Quantity columns');
          return;
        }

        const positions: CSVPosition[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));

          const symbol = values[symbolIndex]?.toUpperCase();
          if (!symbol) continue;

          const quantity = parseFloat(values[quantityIndex] || '0');
          if (isNaN(quantity) || quantity <= 0) continue;

          const avgCost = parseFloat(values[costIndex] || '0') || 0;
          const name = values[nameIndex] || symbol;

          let assetType: AssetType = 'stock';
          if (typeIndex >= 0) {
            const typeValue = values[typeIndex]?.toLowerCase();
            if (typeValue?.includes('crypto')) assetType = 'crypto';
            else if (typeValue?.includes('etf')) assetType = 'etf';
            else if (typeValue?.includes('bond')) assetType = 'bond';
            else if (typeValue?.includes('real')) assetType = 'real_estate';
          }

          positions.push({ symbol, name, quantity, avgCost, assetType });
        }

        if (positions.length === 0) {
          toast.error('No valid positions found in CSV');
          return;
        }

        setCSVData(positions);
        setShowCSVImport(true);
        toast.success(`Found ${positions.length} positions to import`);
      } catch (error) {
        console.error('CSV parse error:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImportCSV = async () => {
    if (!portfolio || csvData.length === 0) return;

    let imported = 0;
    for (const pos of csvData) {
      // Fetch current price if avgCost is 0
      let currentPrice = pos.avgCost;
      if (pos.avgCost === 0) {
        try {
          const endpoint = pos.assetType === 'crypto'
            ? `/api/crypto?symbol=${pos.symbol}&action=quote`
            : `/api/stocks?symbol=${pos.symbol}&action=quote`;
          const response = await fetch(endpoint);
          const data = await response.json();
          if (data.success && data.data?.price) {
            currentPrice = data.data.price;
          }
        } catch (e) {
          currentPrice = 100; // Fallback
        }
      }

      addPosition(portfolio.id, {
        symbol: pos.symbol,
        name: pos.name,
        assetType: pos.assetType,
        quantity: pos.quantity,
        avgCost: pos.avgCost || currentPrice,
        currentPrice: currentPrice,
        previousClose: currentPrice,
      });
      imported++;
    }

    toast.success(`Imported ${imported} positions`);
    setCSVData([]);
    setShowCSVImport(false);
  };

  const handleCreatePortfolio = () => {
    if (!newPortfolioName.trim()) {
      toast.error('Please enter a portfolio name');
      return;
    }
    addPortfolio(newPortfolioName);
    setNewPortfolioName('');
    setShowNewPortfolio(false);
    toast.success('Portfolio created successfully');
  };

  const handleDeletePortfolio = () => {
    if (!activePortfolioId) return;
    if (portfolios.length <= 1) {
      toast.error('Cannot delete the last portfolio');
      return;
    }
    deletePortfolio(activePortfolioId);
    toast.success('Portfolio deleted');
  };

  const handleExport = () => {
    if (!portfolio) return;
    const data = JSON.stringify(portfolio, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${portfolio.name.replace(/\s+/g, '-')}-portfolio.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Portfolio exported successfully');
  };

  const handleEdit = (position: Position) => {
    setEditPosition(position);
    setShowAddPosition(true);
  };

  // Show loading skeleton until hydrated
  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header
          title="Portfolio"
          subtitle="Manage your investment positions"
        />
        <div className="p-3 md:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Skeleton className="h-10 w-[200px]" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Portfolio"
        subtitle="Manage your investment positions"
      />

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Portfolio Selector & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <Select
              value={activePortfolioId || ''}
              onValueChange={setActivePortfolio}
            >
              <SelectTrigger className="w-[160px] md:w-[200px]">
                <SelectValue placeholder="Select portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowNewPortfolio(true)}
              title="Create new portfolio"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => {
              setEditPosition(null);
              setShowAddPosition(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Position
            </Button>
            <div className="relative">
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </Button>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={handleDeletePortfolio}
              disabled={portfolios.length <= 1}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Portfolio
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Gain/Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-2xl font-bold',
                  totalGain >= 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {totalGain >= 0 ? '+' : ''}{formatCurrency(totalGain)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  'text-2xl font-bold',
                  totalGainPercent >= 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {formatPercent(totalGainPercent)}
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowCashDialog(true)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Cash
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-500">
                {formatCurrency(cashBalance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Click to manage</p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Table */}
        <Card>
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioTable onEdit={handleEdit} />
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Position Dialog */}
      <AddPositionForm
        open={showAddPosition}
        onOpenChange={(open) => {
          setShowAddPosition(open);
          if (!open) setEditPosition(null);
        }}
        editPosition={editPosition}
      />

      {/* New Portfolio Dialog */}
      <Dialog open={showNewPortfolio} onOpenChange={setShowNewPortfolio}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Portfolio</DialogTitle>
            <DialogDescription>
              Create a new portfolio to track a different set of investments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="portfolioName">Portfolio Name</Label>
              <Input
                id="portfolioName"
                placeholder="e.g., Retirement, Trading, Long-term"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPortfolio(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePortfolio}>Create Portfolio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Management Dialog */}
      <Dialog open={showCashDialog} onOpenChange={setShowCashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Manage Cash
            </DialogTitle>
            <DialogDescription>
              Current balance: {formatCurrency(cashBalance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={cashAction}
                onValueChange={(value: 'deposit' | 'withdraw' | 'set') => setCashAction(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set Balance</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdraw">Withdraw</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cashAmount">Amount ($)</Label>
              <Input
                id="cashAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCashAction}>
              {cashAction === 'set' ? 'Set Balance' : cashAction === 'deposit' ? 'Deposit' : 'Withdraw'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showCSVImport} onOpenChange={setShowCSVImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Positions from CSV
            </DialogTitle>
            <DialogDescription>
              Review the positions below before importing. {csvData.length} positions found.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Avg Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvData.map((pos, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{pos.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">{pos.name}</TableCell>
                    <TableCell className="capitalize">{pos.assetType}</TableCell>
                    <TableCell className="text-right">{pos.quantity}</TableCell>
                    <TableCell className="text-right">
                      {pos.avgCost > 0 ? formatCurrency(pos.avgCost) : 'Auto-fetch'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>CSV format tips:</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>Required columns: Symbol, Quantity</li>
              <li>Optional columns: Name, Cost/Price, Type (stock/crypto/etf/bond)</li>
              <li>If no cost is provided, current price will be fetched</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCSVImport(false);
              setCSVData([]);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImportCSV}>
              Import {csvData.length} Positions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
