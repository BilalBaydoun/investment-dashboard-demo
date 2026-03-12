'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Bell,
  Calendar,
  DollarSign,
  Percent,
  Target,
  Plus,
  Minus,
  Settings,
  Info,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/api/stocks';

interface AllocationTarget {
  assetType: string;
  targetPercent: number;
  currentPercent: number;
  currentValue: number;
  drift: number;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
}

interface DCAReminder {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  amount: number;
  nextDate: Date;
  enabled: boolean;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const DEFAULT_TARGETS: Record<string, number> = {
  stock: 60,
  etf: 20,
  crypto: 10,
  bond: 5,
  real_estate: 5,
};

export default function RebalancePage() {
  const { getActivePortfolio, getTotalValue } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const [mounted, setMounted] = useState(false);
  const [targetAllocations, setTargetAllocations] = useState<Record<string, number>>(DEFAULT_TARGETS);
  const [driftThreshold, setDriftThreshold] = useState(5); // 5% drift triggers alert
  const [dcaSettings, setDcaSettings] = useState<DCAReminder>({
    frequency: 'monthly',
    amount: 500,
    nextDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    enabled: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalValue = mounted ? getTotalValue() : 0;

  // Calculate current allocations and drift
  const allocations = useMemo(() => {
    if (!portfolio?.positions || totalValue === 0) return [];

    // Group by asset type
    const byType: Record<string, number> = {};
    portfolio.positions.forEach((pos) => {
      const type = pos.assetType || 'stock';
      const value = (pos.currentPrice || pos.avgCost || 0) * (pos.quantity || 0);
      byType[type] = (byType[type] || 0) + value;
    });

    // Calculate allocations
    const result: AllocationTarget[] = [];
    const allTypes = new Set([...Object.keys(byType), ...Object.keys(targetAllocations)]);

    allTypes.forEach((type) => {
      const currentValue = byType[type] || 0;
      const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const targetPercent = targetAllocations[type] || 0;
      const drift = currentPercent - targetPercent;

      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let amount = 0;

      if (Math.abs(drift) > driftThreshold) {
        if (drift < 0) {
          action = 'buy';
          amount = (targetPercent - currentPercent) / 100 * totalValue;
        } else {
          action = 'sell';
          amount = (currentPercent - targetPercent) / 100 * totalValue;
        }
      }

      result.push({
        assetType: type,
        targetPercent,
        currentPercent,
        currentValue,
        drift,
        action,
        amount,
      });
    });

    return result.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
  }, [portfolio?.positions, totalValue, targetAllocations, driftThreshold]);

  // Check if rebalancing is needed
  const needsRebalancing = allocations.some((a) => Math.abs(a.drift) > driftThreshold);

  // Pie chart data
  const pieData = allocations
    .filter((a) => a.currentValue > 0)
    .map((a, i) => ({
      name: a.assetType.charAt(0).toUpperCase() + a.assetType.slice(1).replace('_', ' '),
      value: a.currentPercent,
      color: COLORS[i % COLORS.length],
    }));

  const targetPieData = allocations
    .filter((a) => a.targetPercent > 0)
    .map((a, i) => ({
      name: a.assetType.charAt(0).toUpperCase() + a.assetType.slice(1).replace('_', ' '),
      value: a.targetPercent,
      color: COLORS[i % COLORS.length],
    }));

  // DCA calculation
  const daysUntilDCA = Math.ceil((dcaSettings.nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const updateTarget = (type: string, value: number) => {
    setTargetAllocations((prev) => ({
      ...prev,
      [type]: Math.max(0, Math.min(100, value)),
    }));
  };

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header title="Rebalancing" subtitle="Keep your portfolio aligned with your targets" />
        <div className="p-3 md:p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/3"></div>
                <div className="h-64 bg-muted rounded"></div>
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
        title="Rebalancing"
        subtitle="Monitor allocation drift and get rebalancing suggestions"
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* Alert Banner */}
        {needsRebalancing && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div className="flex-1">
                  <p className="font-semibold">Rebalancing Recommended</p>
                  <p className="text-sm text-muted-foreground">
                    Your portfolio has drifted more than {driftThreshold}% from target allocations.
                    Review the suggestions below.
                  </p>
                </div>
                <Button>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  View Suggestions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DCA Reminder */}
        {dcaSettings.enabled && daysUntilDCA <= 7 && (
          <Card className="border-primary/50 bg-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Calendar className="h-8 w-8 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">DCA Investment Reminder</p>
                  <p className="text-sm text-muted-foreground">
                    Your next {formatCurrency(dcaSettings.amount)} investment is due in {daysUntilDCA} days
                    ({dcaSettings.nextDate.toLocaleDateString()})
                  </p>
                </div>
                <Badge variant="outline" className="text-primary border-primary/30">
                  {dcaSettings.frequency}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current vs Target Allocation */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Current vs Target Allocation
              </CardTitle>
              <CardDescription>
                Compare your current portfolio allocation with your targets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Current Allocation */}
                <div>
                  <p className="text-sm font-medium text-center mb-4">Current Allocation</p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Target Allocation */}
                <div>
                  <p className="text-sm font-medium text-center mb-4">Target Allocation</p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={targetPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                        >
                          {targetPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {allocations.map((a, i) => (
                  <div key={a.assetType} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm capitalize">{a.assetType.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Target Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Target Allocations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(targetAllocations).map(([type, target]) => (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="capitalize">{type.replace('_', ' ')}</Label>
                    <span className="text-sm font-medium">{target}%</span>
                  </div>
                  <Slider
                    value={[target]}
                    onValueChange={(v) => updateTarget(type, v[0])}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
              ))}

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className={cn(
                    "font-medium",
                    Object.values(targetAllocations).reduce((a, b) => a + b, 0) === 100
                      ? "text-green-500"
                      : "text-red-500"
                  )}>
                    {Object.values(targetAllocations).reduce((a, b) => a + b, 0)}%
                  </span>
                </div>
                {Object.values(targetAllocations).reduce((a, b) => a + b, 0) !== 100 && (
                  <p className="text-xs text-red-500 mt-1">
                    Total should equal 100%
                  </p>
                )}
              </div>

              <div className="pt-4 border-t space-y-2">
                <Label>Drift Alert Threshold</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[driftThreshold]}
                    onValueChange={(v) => setDriftThreshold(v[0])}
                    min={1}
                    max={20}
                    step={1}
                  />
                  <span className="text-sm font-medium w-12">{driftThreshold}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alert when allocation drifts more than this from target
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rebalancing Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Rebalancing Suggestions
            </CardTitle>
            <CardDescription>
              Actions needed to align your portfolio with target allocations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allocations.map((allocation, idx) => {
                const needsAction = Math.abs(allocation.drift) > driftThreshold;

                return (
                  <div
                    key={allocation.assetType}
                    className={cn(
                      "p-4 rounded-lg border",
                      needsAction && allocation.action === 'buy' && "border-green-500/30 bg-green-500/5",
                      needsAction && allocation.action === 'sell' && "border-red-500/30 bg-red-500/5",
                      !needsAction && "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium capitalize">{allocation.assetType.replace('_', ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            Current: {allocation.currentPercent.toFixed(1)}% | Target: {allocation.targetPercent}%
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={cn(
                            "text-sm font-medium",
                            allocation.drift > 0 ? "text-red-500" : allocation.drift < 0 ? "text-green-500" : ""
                          )}>
                            {allocation.drift > 0 ? '+' : ''}{allocation.drift.toFixed(1)}% drift
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(allocation.currentValue)}
                          </p>
                        </div>

                        {needsAction ? (
                          <Badge
                            className={cn(
                              allocation.action === 'buy' && "bg-green-500",
                              allocation.action === 'sell' && "bg-red-500"
                            )}
                          >
                            {allocation.action === 'buy' ? (
                              <Plus className="h-3 w-3 mr-1" />
                            ) : (
                              <Minus className="h-3 w-3 mr-1" />
                            )}
                            {allocation.action.toUpperCase()} {formatCurrency(allocation.amount)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-500 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            ON TARGET
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Progress bar showing current vs target */}
                    <div className="mt-3">
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="absolute h-full rounded-full"
                          style={{
                            width: `${Math.min(100, allocation.currentPercent)}%`,
                            backgroundColor: COLORS[idx % COLORS.length],
                          }}
                        />
                        {/* Target marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                          style={{ left: `${allocation.targetPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!needsRebalancing && (
              <div className="mt-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="font-medium text-green-500">Portfolio is Balanced</p>
                    <p className="text-sm text-muted-foreground">
                      All allocations are within your {driftThreshold}% drift threshold.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dollar Cost Averaging */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dollar Cost Averaging (DCA)
            </CardTitle>
            <CardDescription>
              Set up regular investment reminders to stay disciplined
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable DCA Reminders</Label>
                  <Switch
                    checked={dcaSettings.enabled}
                    onCheckedChange={(enabled) =>
                      setDcaSettings((prev) => ({ ...prev, enabled }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Investment Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={dcaSettings.amount}
                      onChange={(e) =>
                        setDcaSettings((prev) => ({ ...prev, amount: Number(e.target.value) }))
                      }
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <div className="flex gap-2">
                    {(['weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                      <Button
                        key={freq}
                        variant={dcaSettings.frequency === freq ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setDcaSettings((prev) => ({ ...prev, frequency: freq }))
                        }
                        className="capitalize"
                      >
                        {freq}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-4">DCA Summary</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Per Investment</span>
                    <span className="font-medium">{formatCurrency(dcaSettings.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly Total</span>
                    <span className="font-medium">
                      {formatCurrency(
                        dcaSettings.amount *
                          (dcaSettings.frequency === 'weekly' ? 4 :
                           dcaSettings.frequency === 'biweekly' ? 2 : 1)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Annual Total</span>
                    <span className="font-medium">
                      {formatCurrency(
                        dcaSettings.amount *
                          (dcaSettings.frequency === 'weekly' ? 52 :
                           dcaSettings.frequency === 'biweekly' ? 26 : 12)
                      )}
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Next Investment</span>
                      <span className="font-medium">
                        {dcaSettings.enabled
                          ? `${daysUntilDCA} days (${dcaSettings.nextDate.toLocaleDateString()})`
                          : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Why DCA?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Dollar cost averaging helps reduce the impact of volatility by spreading your investments
                    over time. You buy more shares when prices are low and fewer when prices are high,
                    potentially lowering your average cost per share.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
