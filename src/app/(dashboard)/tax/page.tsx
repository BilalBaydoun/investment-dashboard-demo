'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Clock,
  Scale,
  PiggyBank,
  Calculator,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/api/stocks';

interface TaxLot {
  symbol: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  purchaseDate: Date;
  gain: number;
  gainPercent: number;
  isLongTerm: boolean;
  daysHeld: number;
  daysUntilLongTerm: number;
}

interface TaxSummary {
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netShortTerm: number;
  netLongTerm: number;
  totalGains: number;
  totalLosses: number;
  netGain: number;
  estimatedTax: number;
}

// Tax rates (2024 US Federal rates - simplified)
const TAX_RATES = {
  shortTerm: 0.32, // Assuming 32% marginal rate (income tax)
  longTerm: 0.15, // 15% LTCG rate (typical)
  harvestingLimit: 3000, // Annual loss deduction limit against ordinary income
};

export default function TaxPage() {
  const { getActivePortfolio, getTotalValue } = usePortfolioStore();
  const portfolio = getActivePortfolio();

  const [mounted, setMounted] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate tax lots and gains
  const taxData = useMemo(() => {
    if (!portfolio?.positions) return { lots: [], summary: null };

    const lots: TaxLot[] = [];
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    portfolio.positions.forEach((position) => {
      const purchaseDate = position.createdAt ? new Date(position.createdAt) : new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const daysHeld = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const isLongTerm = daysHeld >= 365;
      const daysUntilLongTerm = isLongTerm ? 0 : 365 - daysHeld;

      const costBasis = (position.avgCost || 0) * (position.quantity || 0);
      const currentValue = (position.currentPrice || position.avgCost || 0) * (position.quantity || 0);
      const gain = currentValue - costBasis;
      const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;

      lots.push({
        symbol: position.symbol,
        quantity: position.quantity || 0,
        costBasis,
        currentPrice: position.currentPrice || position.avgCost || 0,
        purchaseDate,
        gain,
        gainPercent,
        isLongTerm,
        daysHeld,
        daysUntilLongTerm,
      });
    });

    // Calculate summary
    const shortTermGains = lots.filter(l => !l.isLongTerm && l.gain > 0).reduce((sum, l) => sum + l.gain, 0);
    const shortTermLosses = lots.filter(l => !l.isLongTerm && l.gain < 0).reduce((sum, l) => sum + Math.abs(l.gain), 0);
    const longTermGains = lots.filter(l => l.isLongTerm && l.gain > 0).reduce((sum, l) => sum + l.gain, 0);
    const longTermLosses = lots.filter(l => l.isLongTerm && l.gain < 0).reduce((sum, l) => sum + Math.abs(l.gain), 0);

    const netShortTerm = shortTermGains - shortTermLosses;
    const netLongTerm = longTermGains - longTermLosses;
    const totalGains = shortTermGains + longTermGains;
    const totalLosses = shortTermLosses + longTermLosses;
    const netGain = totalGains - totalLosses;

    // Estimate tax (simplified)
    let estimatedTax = 0;
    if (netShortTerm > 0) {
      estimatedTax += netShortTerm * TAX_RATES.shortTerm;
    }
    if (netLongTerm > 0) {
      estimatedTax += netLongTerm * TAX_RATES.longTerm;
    }
    // Account for loss carryover
    if (netShortTerm < 0 && netLongTerm > 0) {
      const offsetAmount = Math.min(Math.abs(netShortTerm), netLongTerm);
      estimatedTax = (netLongTerm - offsetAmount) * TAX_RATES.longTerm;
    }

    const summary: TaxSummary = {
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      netShortTerm,
      netLongTerm,
      totalGains,
      totalLosses,
      netGain,
      estimatedTax: Math.max(0, estimatedTax),
    };

    return { lots, summary };
  }, [portfolio?.positions]);

  // Tax loss harvesting candidates
  const harvestingCandidates = useMemo(() => {
    return taxData.lots
      .filter(lot => lot.gain < 0)
      .sort((a, b) => a.gain - b.gain)
      .slice(0, 5);
  }, [taxData.lots]);

  // Positions approaching long-term status
  const approachingLongTerm = useMemo(() => {
    return taxData.lots
      .filter(lot => !lot.isLongTerm && lot.daysUntilLongTerm <= 60 && lot.daysUntilLongTerm > 0)
      .sort((a, b) => a.daysUntilLongTerm - b.daysUntilLongTerm);
  }, [taxData.lots]);

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header title="Tax Optimization" subtitle="Track gains and optimize your tax strategy" />
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

  const { lots, summary } = taxData;

  return (
    <div className="min-h-screen">
      <Header
        title="Tax Optimization"
        subtitle="Track capital gains, harvest losses, and estimate tax liability"
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full", summary && summary.netGain >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
                  {summary && summary.netGain >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Gain/Loss</p>
                  <p className={cn("text-2xl font-bold", summary && summary.netGain >= 0 ? "text-green-500" : "text-red-500")}>
                    {summary ? formatCurrency(summary.netGain) : '$0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Short-Term Net</p>
                  <p className={cn("text-2xl font-bold", summary && summary.netShortTerm >= 0 ? "text-green-500" : "text-red-500")}>
                    {summary ? formatCurrency(summary.netShortTerm) : '$0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Long-Term Net</p>
                  <p className={cn("text-2xl font-bold", summary && summary.netLongTerm >= 0 ? "text-green-500" : "text-red-500")}>
                    {summary ? formatCurrency(summary.netLongTerm) : '$0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/10">
                  <Receipt className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Est. Tax Liability</p>
                  <p className="text-2xl font-bold text-red-500">
                    {summary ? formatCurrency(summary.estimatedTax) : '$0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="harvesting">Tax-Loss Harvesting</TabsTrigger>
            <TabsTrigger value="lots">All Tax Lots</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Short-Term vs Long-Term Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    Short-Term vs Long-Term
                  </CardTitle>
                  <CardDescription>
                    Short-term gains (&lt;1 year) are taxed at income rates. Long-term gains are taxed at lower rates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Short-Term */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Short-Term (&lt;1 year)</span>
                        <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                          ~{(TAX_RATES.shortTerm * 100).toFixed(0)}% tax
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <p className="text-muted-foreground">Gains</p>
                        <p className="text-lg font-semibold text-green-500">
                          +{summary ? formatCurrency(summary.shortTermGains) : '$0'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <p className="text-muted-foreground">Losses</p>
                        <p className="text-lg font-semibold text-red-500">
                          -{summary ? formatCurrency(summary.shortTermLosses) : '$0'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Long-Term */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Long-Term (&gt;1 year)</span>
                        <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                          ~{(TAX_RATES.longTerm * 100).toFixed(0)}% tax
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <p className="text-muted-foreground">Gains</p>
                        <p className="text-lg font-semibold text-green-500">
                          +{summary ? formatCurrency(summary.longTermGains) : '$0'}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10">
                        <p className="text-muted-foreground">Losses</p>
                        <p className="text-lg font-semibold text-red-500">
                          -{summary ? formatCurrency(summary.longTermLosses) : '$0'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tax Estimate */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Estimated Tax Liability
                  </CardTitle>
                  <CardDescription>
                    Based on current unrealized gains if sold today
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-muted-foreground">Short-term tax ({(TAX_RATES.shortTerm * 100).toFixed(0)}%)</span>
                      <span className="font-medium">
                        {summary && summary.netShortTerm > 0
                          ? formatCurrency(summary.netShortTerm * TAX_RATES.shortTerm)
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-muted-foreground">Long-term tax ({(TAX_RATES.longTerm * 100).toFixed(0)}%)</span>
                      <span className="font-medium">
                        {summary && summary.netLongTerm > 0
                          ? formatCurrency(summary.netLongTerm * TAX_RATES.longTerm)
                          : '$0'}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Total Estimated Tax</span>
                        <span className="text-2xl font-bold text-red-500">
                          {summary ? formatCurrency(summary.estimatedTax) : '$0'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-primary mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        This is an estimate. Actual tax depends on your total income, filing status, and other factors.
                        Consult a tax professional for accurate calculations.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Approaching Long-Term Status */}
            {approachingLongTerm.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    Approaching Long-Term Status
                  </CardTitle>
                  <CardDescription>
                    These positions will qualify for lower long-term capital gains rates soon
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {approachingLongTerm.map((lot) => (
                      <div key={lot.symbol} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{lot.symbol}</p>
                            <p className="text-sm text-muted-foreground">
                              Held for {lot.daysHeld} days
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                            {lot.daysUntilLongTerm} days until long-term
                          </Badge>
                          <p className={cn("text-sm mt-1", lot.gain >= 0 ? "text-green-500" : "text-red-500")}>
                            {lot.gain >= 0 ? '+' : ''}{formatCurrency(lot.gain)} ({lot.gainPercent.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        <strong>Tip:</strong> Consider holding these positions until they qualify for long-term rates.
                        You could save {(TAX_RATES.shortTerm - TAX_RATES.longTerm) * 100}% in taxes on any gains.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tax-Loss Harvesting Tab */}
          <TabsContent value="harvesting" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  Tax-Loss Harvesting Opportunities
                </CardTitle>
                <CardDescription>
                  Sell losing positions to offset gains and reduce your tax bill
                </CardDescription>
              </CardHeader>
              <CardContent>
                {harvestingCandidates.length > 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {harvestingCandidates.map((lot) => (
                        <div key={lot.symbol} className="flex items-center justify-between p-4 rounded-lg border">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{lot.symbol}</p>
                              <Badge variant="outline" className={lot.isLongTerm ? "text-blue-500" : "text-orange-500"}>
                                {lot.isLongTerm ? 'Long-term' : 'Short-term'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {lot.quantity} shares @ {formatCurrency(lot.currentPrice)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-red-500">
                              {formatCurrency(lot.gain)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {lot.gainPercent.toFixed(1)}% loss
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-2">Potential Tax Savings</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Harvestable Losses</p>
                          <p className="text-xl font-semibold text-red-500">
                            {formatCurrency(harvestingCandidates.reduce((sum, l) => sum + Math.abs(l.gain), 0))}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Potential Tax Savings</p>
                          <p className="text-xl font-semibold text-green-500">
                            {formatCurrency(
                              harvestingCandidates.reduce((sum, l) => {
                                const rate = l.isLongTerm ? TAX_RATES.longTerm : TAX_RATES.shortTerm;
                                return sum + Math.abs(l.gain) * rate;
                              }, 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Wash Sale Rule Warning</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            If you sell a security at a loss and buy the same or "substantially identical" security
                            within 30 days before or after, the loss is disallowed. Consider waiting 31 days or
                            buying a similar (but not identical) investment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No tax-loss harvesting opportunities. All your positions are profitable!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How Tax-Loss Harvesting Works */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  How Tax-Loss Harvesting Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">1</div>
                        <span className="font-medium">Sell Losing Positions</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Sell investments that have declined in value to realize a capital loss.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">2</div>
                        <span className="font-medium">Offset Your Gains</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Use the losses to offset capital gains, reducing your taxable income.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">3</div>
                        <span className="font-medium">Reinvest Smartly</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Wait 31 days (wash sale rule) then buy back, or buy a similar investment immediately.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> You can deduct up to ${TAX_RATES.harvestingLimit.toLocaleString()} of
                    capital losses against ordinary income per year. Excess losses carry forward to future years.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Tax Lots Tab */}
          <TabsContent value="lots">
            <Card>
              <CardHeader>
                <CardTitle>All Tax Lots</CardTitle>
                <CardDescription>
                  Detailed breakdown of all positions by purchase date
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lots.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Symbol</th>
                          <th className="text-right py-3 px-2 font-medium">Quantity</th>
                          <th className="text-right py-3 px-2 font-medium">Cost Basis</th>
                          <th className="text-right py-3 px-2 font-medium">Current Value</th>
                          <th className="text-right py-3 px-2 font-medium">Gain/Loss</th>
                          <th className="text-center py-3 px-2 font-medium">Type</th>
                          <th className="text-right py-3 px-2 font-medium">Days Held</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lots.map((lot, idx) => (
                          <tr key={`${lot.symbol}-${idx}`} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2 font-medium">{lot.symbol}</td>
                            <td className="py-3 px-2 text-right">{lot.quantity}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(lot.costBasis)}</td>
                            <td className="py-3 px-2 text-right">{formatCurrency(lot.costBasis + lot.gain)}</td>
                            <td className={cn("py-3 px-2 text-right font-medium", lot.gain >= 0 ? "text-green-500" : "text-red-500")}>
                              {lot.gain >= 0 ? '+' : ''}{formatCurrency(lot.gain)}
                              <span className="text-xs ml-1">({lot.gainPercent.toFixed(1)}%)</span>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Badge variant="outline" className={lot.isLongTerm ? "text-blue-500 border-blue-500/30" : "text-orange-500 border-orange-500/30"}>
                                {lot.isLongTerm ? 'Long' : 'Short'}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-right text-muted-foreground">{lot.daysHeld}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No positions in your portfolio
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
