'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { AllocationChart } from '@/components/dashboard/AllocationChart';
import { TopMovers } from '@/components/dashboard/TopMovers';
import { GoalProgress } from '@/components/dashboard/GoalProgress';
import { PerformanceChart } from '@/components/charts/PerformanceChart';
import { EarningsCalendar } from '@/components/dashboard/EarningsCalendar';
import { DividendTracker } from '@/components/dashboard/DividendTracker';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SectorAnalysis } from '@/components/dashboard/SectorAnalysis';
import { PriceAlerts } from '@/components/dashboard/PriceAlerts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Brain,
  RefreshCw,
  PieChart,
  GitCompare,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  TrendingUp,
  Calendar,
  Briefcase,
  Bitcoin,
  Gem
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useMarketStore } from '@/store/marketStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useGoalsStore } from '@/store/goalsStore';
import { Progress } from '@/components/ui/progress';
import { AddPositionForm } from '@/components/portfolio/AddPositionForm';
import { PortfolioExport } from '@/components/portfolio/PortfolioExport';
import { MarketSentiment } from '@/components/dashboard/MarketSentiment';
import { MarketNews } from '@/components/dashboard/MarketNews';
import { MarketInsights } from '@/components/dashboard/MarketInsights';
import Link from 'next/link';
import { formatCurrency, formatPercent } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    portfolios,
    addPortfolio,
    getActivePortfolio,
    getTotalValue,
    getTotalGain,
    getTotalGainPercent,
    getTotalCost,
    updatePrices,
    recordSnapshot,
  } = usePortfolioStore();

  const { setLoading, setQuotes } = useMarketStore();
  const { goal } = useWatchlistStore();
  const { getActiveGoal } = useGoalsStore();
  const savedGoal = getActiveGoal();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && portfolios.length === 0) {
      addPortfolio('My Portfolio');
    }
  }, [mounted, portfolios, addPortfolio]);

  const portfolio = getActivePortfolio();
  const totalValue = getTotalValue();
  const totalGain = getTotalGain();
  const totalGainPercent = getTotalGainPercent();
  const totalCost = getTotalCost();
  const positionCount = portfolio?.positions.length || 0;

  // Calculate today's gain/loss
  const todayGain = portfolio?.positions.reduce((sum, pos) => {
    const dailyChange = (pos.currentPrice - pos.previousClose) * pos.quantity;
    return sum + dailyChange;
  }, 0) || 0;

  const yesterdayValue = totalValue - todayGain;
  const todayGainPercent = yesterdayValue > 0 ? (todayGain / yesterdayValue) * 100 : 0;

  // Goal progress calculation — use watchlist goal OR saved goal from goals page
  const activeGoalName = goal ? `${goal.targetPercentage}% Growth` : savedGoal ? savedGoal.name : null;
  const activeGoalTarget = goal
    ? goal.startingValue * (1 + goal.targetPercentage / 100)
    : savedGoal ? savedGoal.targetAmount : null;
  const activeGoalStarting = goal ? goal.startingValue : savedGoal ? (savedGoal.targetAmount / (1 + savedGoal.targetGrowth / 100)) : null;
  const goalProgress = activeGoalTarget && activeGoalStarting && activeGoalStarting !== activeGoalTarget
    ? ((totalValue - activeGoalStarting) / (activeGoalTarget - activeGoalStarting)) * 100
    : null;
  const goalAmountRemaining = activeGoalTarget ? activeGoalTarget - totalValue : null;
  const hasGoal = goal || savedGoal;

  // Calculate totals by asset type
  const stockEtfTotal = portfolio?.positions
    .filter(p => p.assetType === 'stock' || p.assetType === 'etf')
    .reduce((sum, p) => sum + (p.currentPrice * p.quantity), 0) || 0;

  const cryptoTotal = portfolio?.positions
    .filter(p => p.assetType === 'crypto')
    .reduce((sum, p) => sum + (p.currentPrice * p.quantity), 0) || 0;

  const commodityTotal = portfolio?.positions
    .filter(p => p.assetType === 'commodity')
    .reduce((sum, p) => sum + (p.currentPrice * p.quantity), 0) || 0;

  const refreshPrices = useCallback(async () => {
    if (!portfolio || portfolio.positions.length === 0) {
      toast.info('No positions to refresh');
      return;
    }

    const autoUpdatePositions = portfolio.positions.filter(p => !p.manualPriceOnly);

    if (autoUpdatePositions.length === 0) {
      toast.info('All positions have manual pricing enabled');
      return;
    }

    setIsRefreshing(true);
    setLoading(true);

    try {
      const stockPositions = autoUpdatePositions.filter(p => p.assetType !== 'crypto' && p.assetType !== 'commodity');
      const cryptoPositions = autoUpdatePositions.filter(p => p.assetType === 'crypto');
      const commodityPositions = autoUpdatePositions.filter(p => p.assetType === 'commodity');

      const newPrices: Record<string, { price: number; previousClose: number }> = {};

      if (stockPositions.length > 0) {
        const symbols = stockPositions.map(p => p.symbol).join(',');
        const response = await fetch(`/api/stocks?symbols=${symbols}&action=quotes`);
        const data = await response.json();

        if (data.success && data.data) {
          Object.entries(data.data).forEach(([symbol, quote]: [string, any]) => {
            newPrices[symbol] = {
              price: quote.price,
              previousClose: quote.previousClose,
            };
          });
        }
      }

      if (cryptoPositions.length > 0) {
        const symbols = cryptoPositions.map(p => p.symbol).join(',');
        const response = await fetch(`/api/crypto?symbols=${symbols}&action=quotes`);
        const data = await response.json();

        if (data.success && data.data) {
          Object.entries(data.data).forEach(([symbol, quote]: [string, any]) => {
            newPrices[symbol] = {
              price: quote.price,
              previousClose: quote.previousClose,
            };
          });
        }
      }

      if (commodityPositions.length > 0) {
        for (const position of commodityPositions) {
          try {
            const response = await fetch(`/api/commodities?symbol=${position.symbol}&action=quote`);
            const data = await response.json();

            if (data.success && data.data) {
              let price = data.data.price;
              switch (position.unit) {
                case 'grams':
                  price = data.data.pricePerGram;
                  break;
                case 'kg':
                  price = data.data.pricePerKg;
                  break;
                case 'oz':
                  price = data.data.pricePerOz;
                  break;
                case 'troy_oz':
                  price = data.data.pricePerTroyOz;
                  break;
              }
              newPrices[position.symbol] = {
                price: price,
                previousClose: price,
              };
            }
          } catch (error) {
            console.error(`Failed to fetch commodity price for ${position.symbol}:`, error);
          }
        }
      }

      const manualOnlyCount = portfolio.positions.filter(p => p.manualPriceOnly).length;
      if (Object.keys(newPrices).length > 0) {
        updatePrices(newPrices);
        // Record snapshot for historical tracking
        setTimeout(() => recordSnapshot(), 100);
        const quotesForStore: Record<string, any> = {};
        Object.entries(newPrices).forEach(([symbol, data]) => {
          quotesForStore[symbol] = { price: data.price, previousClose: data.previousClose };
        });
        setQuotes(quotesForStore);
        const msg = manualOnlyCount > 0
          ? `Updated ${Object.keys(newPrices).length} positions (${manualOnlyCount} manual-only skipped)`
          : `Updated prices for ${Object.keys(newPrices).length} positions`;
        toast.success(msg);
      } else {
        setQuotes({});
        toast.info('No price updates available');
      }
    } catch (error) {
      console.error('Failed to refresh prices:', error);
      toast.error('Failed to refresh prices');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [portfolio, updatePrices, setLoading, setQuotes, recordSnapshot]);

  useEffect(() => {
    if (!mounted || !portfolio || portfolio.positions.length === 0) return;

    refreshPrices();
    const interval = setInterval(refreshPrices, 5 * 60 * 1000);

    // Also refresh when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshPrices();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mounted, portfolio?.id]);

  if (!mounted) {
    return (
      <div className="min-h-screen">
        <Header title="Dashboard" subtitle="Loading..." />
        <div className="p-3 md:p-6 space-y-6">
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const isPositive = totalGain >= 0;

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle={portfolio ? `${portfolio.name}` : 'Welcome to InvestAI'}
        actions={
          <Button size="sm" onClick={() => setShowAddPosition(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        }
      />

      <div className="p-3 md:p-6 space-y-6 md:space-y-8">
        {positionCount > 0 ? (
          <>
            {/* Hero Section - Portfolio Value */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Value Card */}
              <Card className="lg:col-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col gap-4">
                    {/* Top Row - Value and Actions */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Total Portfolio Value</p>
                        <p className="text-2xl md:text-4xl font-bold tracking-tight">{formatCurrency(totalValue)}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className={cn(
                            'flex items-center gap-1 text-sm font-medium',
                            isPositive ? 'text-green-500' : 'text-red-500'
                          )}>
                            {isPositive ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                            {formatCurrency(Math.abs(totalGain))}
                          </span>
                          <span className={cn(
                            'text-sm px-2 py-0.5 rounded-full',
                            isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          )}>
                            {formatPercent(totalGainPercent)} all time
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/analysis">
                            <Brain className="h-4 w-4 mr-2" />
                            AI Analysis
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/compare">
                            <GitCompare className="h-4 w-4 mr-2" />
                            Compare
                          </Link>
                        </Button>
                        <PortfolioExport />
                      </div>
                    </div>

                    {/* Bottom Row - Today's Performance & Goal Progress */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-primary/10">
                      {/* Today's Change */}
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          todayGain >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                        )}>
                          <Calendar className={cn(
                            'h-4 w-4',
                            todayGain >= 0 ? 'text-green-500' : 'text-red-500'
                          )} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Today</p>
                          <p className={cn(
                            'text-sm font-semibold',
                            todayGain >= 0 ? 'text-green-500' : 'text-red-500'
                          )}>
                            {todayGain >= 0 ? '+' : ''}{formatCurrency(todayGain)} ({todayGain >= 0 ? '+' : ''}{todayGainPercent.toFixed(2)}%)
                          </p>
                        </div>
                      </div>

                      {/* Goal Progress */}
                      {hasGoal && goalProgress !== null ? (
                        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-2">
                          <div className="p-2 rounded-lg bg-purple-500/10">
                            <Target className="h-4 w-4 text-purple-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-muted-foreground">
                                Goal: {activeGoalName}
                              </p>
                              <p className="text-xs font-medium">
                                {goalProgress >= 100 ? (
                                  <span className="text-green-500">Achieved!</span>
                                ) : (
                                  <span>{formatCurrency(Math.max(0, goalAmountRemaining || 0))} to go</span>
                                )}
                              </p>
                            </div>
                            <Progress
                              value={Math.min(Math.max(0, goalProgress), 100)}
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {goalProgress.toFixed(1)}% complete • Target: {formatCurrency(activeGoalTarget || 0)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-2">
                          <div className="p-2 rounded-lg bg-muted">
                            <Target className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">No Goal Set</p>
                            <Link href="/dashboard" className="text-xs text-primary hover:underline">
                              Set a growth target to track progress
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Asset Breakdown Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 pt-3 border-t border-primary/10">
                      {/* Stocks & ETFs */}
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-blue-500/10">
                          <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Stocks & ETFs</p>
                          <p className="text-sm font-semibold">{formatCurrency(stockEtfTotal)}</p>
                        </div>
                      </div>

                      {/* Crypto */}
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-orange-500/10">
                          <Bitcoin className="h-3.5 w-3.5 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Crypto</p>
                          <p className="text-sm font-semibold">{formatCurrency(cryptoTotal)}</p>
                        </div>
                      </div>

                      {/* Commodities */}
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-yellow-500/10">
                          <Gem className="h-3.5 w-3.5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Commodities</p>
                          <p className="text-sm font-semibold">{formatCurrency(commodityTotal)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Wallet className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Invested</p>
                        <p className="text-lg font-semibold">{formatCurrency(totalCost)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <PieChart className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Positions</p>
                        <p className="text-lg font-semibold">{positionCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="p-4">
                    <MarketSentiment compact />
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Performance Chart & Market Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 min-h-[320px] md:h-[360px]">
                <PerformanceChart />
              </div>
              <div className="lg:col-span-1 min-h-[280px] md:h-[360px]">
                <MarketInsights />
              </div>
            </div>

            {/* Sector Analysis with Allocation & Movers */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <SectorAnalysis />
              </div>
              <div className="lg:col-span-4 flex flex-col gap-4">
                <AllocationChart className="flex-1" />
                <TopMovers className="flex-1" />
              </div>
            </div>

            {/* Row 1: Transactions, Earnings, Goals, Alerts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <RecentTransactions />
              <EarningsCalendar />
              <GoalProgress />
              <PriceAlerts />
            </div>

            {/* Row 2: Dividends, News */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DividendTracker />
              <MarketNews />
            </div>
          </>
        ) : (
          /* Empty State */
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <PieChart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Start Building Your Portfolio</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Add your first investment position to begin tracking your portfolio performance
                and get AI-powered insights.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setShowAddPosition(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Position
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/watchlist">Browse Watchlist</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AddPositionForm open={showAddPosition} onOpenChange={setShowAddPosition} />
    </div>
  );
}
