'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  AlertTriangle,
  Target,
  TrendingDown,
  Calculator,
  PieChart,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import { AssetLogo } from '@/components/ui/asset-logo';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';

interface StopLoss {
  symbol: string;
  stopPrice: number;
  targetPrice?: number;
  notes?: string;
}

export function RiskManagement() {
  const { getActivePortfolio, getTotalValue } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const positions = portfolio?.positions || [];
  const totalValue = getTotalValue();

  // Stop-loss tracking (stored in localStorage)
  const [stopLosses, setStopLosses] = useState<Record<string, StopLoss>>({});
  const [showStopLossDialog, setShowStopLossDialog] = useState(false);
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [stopLossForm, setStopLossForm] = useState({
    stopPrice: '',
    targetPrice: '',
    notes: '',
  });

  // Position sizing calculator state
  const [positionCalc, setPositionCalc] = useState({
    accountSize: totalValue.toString(),
    riskPercent: '2',
    entryPrice: '',
    stopLoss: '',
  });

  // Load stop-losses from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('portfolio-stop-losses');
    if (saved) {
      setStopLosses(JSON.parse(saved));
    }
  }, []);

  // Save stop-losses to localStorage
  useEffect(() => {
    localStorage.setItem('portfolio-stop-losses', JSON.stringify(stopLosses));
  }, [stopLosses]);

  // Calculate portfolio risk metrics
  const riskMetrics = useMemo(() => {
    if (positions.length === 0) return null;

    // Calculate position concentration
    const positionWeights = positions.map(p => ({
      symbol: p.symbol,
      weight: (p.quantity * p.currentPrice) / totalValue * 100,
      value: p.quantity * p.currentPrice,
    })).sort((a, b) => b.weight - a.weight);

    const maxPosition = positionWeights[0];
    const top3Concentration = positionWeights.slice(0, 3).reduce((sum, p) => sum + p.weight, 0);

    // Calculate portfolio at risk (based on stop-losses)
    let totalAtRisk = 0;
    let protectedValue = 0;
    positions.forEach(p => {
      const sl = stopLosses[p.symbol];
      const positionValue = p.quantity * p.currentPrice;
      if (sl && sl.stopPrice < p.currentPrice) {
        const riskAmount = (p.currentPrice - sl.stopPrice) * p.quantity;
        totalAtRisk += riskAmount;
        protectedValue += positionValue;
      } else {
        // No stop-loss = full position at risk
        totalAtRisk += positionValue * 0.2; // Assume 20% potential loss
      }
    });

    // Calculate potential upside (based on targets)
    let totalUpside = 0;
    positions.forEach(p => {
      const sl = stopLosses[p.symbol];
      if (sl && sl.targetPrice && sl.targetPrice > p.currentPrice) {
        totalUpside += (sl.targetPrice - p.currentPrice) * p.quantity;
      }
    });

    const riskRewardRatio = totalUpside > 0 && totalAtRisk > 0
      ? totalUpside / totalAtRisk
      : 0;

    // Diversification score (1-10)
    // Penalize for high concentration and few positions
    let diversificationScore = 10;
    if (positions.length < 5) diversificationScore -= (5 - positions.length);
    if (maxPosition && maxPosition.weight > 30) diversificationScore -= 2;
    if (maxPosition && maxPosition.weight > 50) diversificationScore -= 2;
    if (top3Concentration > 70) diversificationScore -= 1;
    diversificationScore = Math.max(1, Math.min(10, diversificationScore));

    return {
      positionWeights,
      maxPosition,
      top3Concentration,
      totalAtRisk,
      protectedValue,
      protectedPercent: (protectedValue / totalValue) * 100,
      totalUpside,
      riskRewardRatio,
      diversificationScore,
      positionsWithStopLoss: Object.keys(stopLosses).filter(s =>
        positions.some(p => p.symbol === s)
      ).length,
    };
  }, [positions, totalValue, stopLosses]);

  // Position sizing calculation
  const positionSize = useMemo(() => {
    const account = parseFloat(positionCalc.accountSize) || 0;
    const riskPct = parseFloat(positionCalc.riskPercent) || 0;
    const entry = parseFloat(positionCalc.entryPrice) || 0;
    const stop = parseFloat(positionCalc.stopLoss) || 0;

    if (!account || !riskPct || !entry || !stop || entry <= stop) {
      return null;
    }

    const riskAmount = account * (riskPct / 100);
    const riskPerShare = entry - stop;
    const shares = Math.floor(riskAmount / riskPerShare);
    const positionValue = shares * entry;
    const positionPercent = (positionValue / account) * 100;

    return {
      riskAmount,
      riskPerShare,
      shares,
      positionValue,
      positionPercent,
    };
  }, [positionCalc]);

  const handleSaveStopLoss = () => {
    if (!editingSymbol) return;

    setStopLosses(prev => ({
      ...prev,
      [editingSymbol]: {
        symbol: editingSymbol,
        stopPrice: parseFloat(stopLossForm.stopPrice) || 0,
        targetPrice: stopLossForm.targetPrice ? parseFloat(stopLossForm.targetPrice) : undefined,
        notes: stopLossForm.notes || undefined,
      },
    }));

    setShowStopLossDialog(false);
    setEditingSymbol(null);
    setStopLossForm({ stopPrice: '', targetPrice: '', notes: '' });
  };

  const handleEditStopLoss = (symbol: string) => {
    const existing = stopLosses[symbol];
    setEditingSymbol(symbol);
    setStopLossForm({
      stopPrice: existing?.stopPrice?.toString() || '',
      targetPrice: existing?.targetPrice?.toString() || '',
      notes: existing?.notes || '',
    });
    setShowStopLossDialog(true);
  };

  const handleRemoveStopLoss = (symbol: string) => {
    setStopLosses(prev => {
      const updated = { ...prev };
      delete updated[symbol];
      return updated;
    });
  };

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Risk Management
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Shield className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Add positions to manage risk
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Risk Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="stopLoss" className="text-xs">Stop-Loss</TabsTrigger>
            <TabsTrigger value="calculator" className="text-xs">Calculator</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {riskMetrics && (
              <>
                {/* Risk Score Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <PieChart className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Diversification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-2xl font-bold',
                        riskMetrics.diversificationScore >= 7 ? 'text-green-500' :
                        riskMetrics.diversificationScore >= 4 ? 'text-amber-500' : 'text-red-500'
                      )}>
                        {riskMetrics.diversificationScore}/10
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Risk/Reward</span>
                    </div>
                    <span className={cn(
                      'text-2xl font-bold',
                      riskMetrics.riskRewardRatio >= 2 ? 'text-green-500' :
                      riskMetrics.riskRewardRatio >= 1 ? 'text-amber-500' : 'text-muted-foreground'
                    )}>
                      {riskMetrics.riskRewardRatio > 0 ? `${riskMetrics.riskRewardRatio.toFixed(1)}:1` : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Risk Metrics */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Largest Position</span>
                    <span className="font-medium">
                      {riskMetrics.maxPosition?.symbol} ({riskMetrics.maxPosition?.weight.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Top 3 Concentration</span>
                    <span className={cn(
                      'font-medium',
                      riskMetrics.top3Concentration > 70 && 'text-amber-500'
                    )}>
                      {riskMetrics.top3Concentration.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Protected by Stop-Loss</span>
                    <span className="font-medium">
                      {riskMetrics.positionsWithStopLoss}/{positions.length} positions
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Capital at Risk</span>
                    <span className="font-medium text-red-500">
                      {formatCurrency(riskMetrics.totalAtRisk)}
                    </span>
                  </div>

                  {riskMetrics.totalUpside > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Potential Upside</span>
                      <span className="font-medium text-green-500">
                        {formatCurrency(riskMetrics.totalUpside)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {(riskMetrics.maxPosition?.weight > 30 || riskMetrics.positionsWithStopLoss < positions.length / 2) && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                      <div className="text-xs">
                        {riskMetrics.maxPosition?.weight > 30 && (
                          <p className="text-amber-500 mb-1">
                            {riskMetrics.maxPosition.symbol} is {riskMetrics.maxPosition.weight.toFixed(0)}% of portfolio (consider rebalancing)
                          </p>
                        )}
                        {riskMetrics.positionsWithStopLoss < positions.length / 2 && (
                          <p className="text-amber-500">
                            Only {riskMetrics.positionsWithStopLoss} of {positions.length} positions have stop-losses set
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Stop-Loss Tab */}
          <TabsContent value="stopLoss" className="space-y-3">
            {positions.map(position => {
              const sl = stopLosses[position.symbol];
              const hasStopLoss = !!sl?.stopPrice;
              const isTriggered = hasStopLoss && position.currentPrice <= sl.stopPrice;
              const distancePercent = hasStopLoss
                ? ((position.currentPrice - sl.stopPrice) / position.currentPrice) * 100
                : 0;
              const targetPercent = sl?.targetPrice
                ? ((sl.targetPrice - position.currentPrice) / position.currentPrice) * 100
                : 0;

              return (
                <div
                  key={position.symbol}
                  className={cn(
                    'p-3 rounded-lg border',
                    isTriggered ? 'bg-red-500/10 border-red-500/30' :
                    hasStopLoss ? 'bg-muted/30' : 'bg-muted/10'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AssetLogo
                        symbol={position.symbol}
                        assetType={position.assetType}
                        size="sm"
                      />
                      <div>
                        <span className="font-medium">{position.symbol}</span>
                        <p className="text-xs text-muted-foreground">
                          Current: {formatCurrency(position.currentPrice)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleEditStopLoss(position.symbol)}
                    >
                      {hasStopLoss ? <Edit2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </div>

                  {hasStopLoss ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          Stop: {formatCurrency(sl.stopPrice)}
                        </span>
                        <span className={cn(
                          isTriggered ? 'text-red-500 font-medium' : 'text-muted-foreground'
                        )}>
                          {isTriggered ? 'TRIGGERED!' : `-${distancePercent.toFixed(1)}%`}
                        </span>
                      </div>

                      {sl.targetPrice && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-green-500" />
                            Target: {formatCurrency(sl.targetPrice)}
                          </span>
                          <span className="text-green-500">+{targetPercent.toFixed(1)}%</span>
                        </div>
                      )}

                      {!isTriggered && (
                        <Progress
                          value={Math.min(100, distancePercent * 5)}
                          className="h-1.5"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No stop-loss set - click + to add
                    </p>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Position Calculator Tab */}
          <TabsContent value="calculator" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Account Size ($)</Label>
                <Input
                  type="number"
                  value={positionCalc.accountSize}
                  onChange={(e) => setPositionCalc(p => ({ ...p, accountSize: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Risk per Trade (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={positionCalc.riskPercent}
                  onChange={(e) => setPositionCalc(p => ({ ...p, riskPercent: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Entry Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="150.00"
                  value={positionCalc.entryPrice}
                  onChange={(e) => setPositionCalc(p => ({ ...p, entryPrice: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stop-Loss Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="140.00"
                  value={positionCalc.stopLoss}
                  onChange={(e) => setPositionCalc(p => ({ ...p, stopLoss: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {positionSize && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Position Size</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Shares to Buy</p>
                    <p className="font-bold text-lg">{positionSize.shares.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Position Value</p>
                    <p className="font-bold text-lg">{formatCurrency(positionSize.positionValue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Risk Amount</p>
                    <p className="font-medium text-red-500">{formatCurrency(positionSize.riskAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Portfolio %</p>
                    <p className="font-medium">{positionSize.positionPercent.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}

            {!positionSize && positionCalc.entryPrice && (
              <p className="text-xs text-muted-foreground text-center">
                Enter entry price and stop-loss to calculate position size
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Stop-Loss Dialog */}
      <Dialog open={showStopLossDialog} onOpenChange={setShowStopLossDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Set Stop-Loss for {editingSymbol}
            </DialogTitle>
            <DialogDescription>
              Protect your position by setting price alerts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stop-Loss Price ($) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter stop-loss price"
                value={stopLossForm.stopPrice}
                onChange={(e) => setStopLossForm(f => ({ ...f, stopPrice: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                You'll be alerted when price drops to this level
              </p>
            </div>

            <div className="space-y-2">
              <Label>Target Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Optional target price"
                value={stopLossForm.targetPrice}
                onChange={(e) => setStopLossForm(f => ({ ...f, targetPrice: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={stopLossForm.notes}
                onChange={(e) => setStopLossForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {stopLosses[editingSymbol || ''] && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleRemoveStopLoss(editingSymbol || '');
                  setShowStopLossDialog(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowStopLossDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStopLoss} disabled={!stopLossForm.stopPrice}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
