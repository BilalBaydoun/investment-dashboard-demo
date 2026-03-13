'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { usePortfolioStore } from '@/store/portfolioStore';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/api/stocks';

const CHART_CACHE_KEY = 'perf-chart-cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ChartCache {
  timestamp: number;
  sp500Data: HistoricalPrice[];
  currentSpyPrice: number | null;
  positionHistories: Record<string, HistoricalPrice[]>;
  portfolioId: string;
  range: string;
}

function loadChartCache(portfolioId: string, range: string): ChartCache | null {
  try {
    const raw = localStorage.getItem(CHART_CACHE_KEY);
    if (!raw) return null;
    const cache: ChartCache = JSON.parse(raw);
    if (cache.portfolioId !== portfolioId || cache.range !== range) return null;
    return cache;
  } catch {
    return null;
  }
}

function saveChartCache(cache: ChartCache) {
  try {
    localStorage.setItem(CHART_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full — ignore
  }
}

interface PerformanceChartProps {
  title?: string;
}

interface HistoricalPrice {
  date: string;
  close: number;
}

export function PerformanceChart({ title = 'Portfolio vs S&P 500' }: PerformanceChartProps) {
  const [sp500Data, setSp500Data] = useState<HistoricalPrice[]>([]);
  const [currentSpyPrice, setCurrentSpyPrice] = useState<number | null>(null);
  const [positionHistories, setPositionHistories] = useState<Record<string, HistoricalPrice[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getActivePortfolio, getTotalValue, getTotalCost } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const hasPositions = portfolio && portfolio.positions.length > 0;
  const totalValue = getTotalValue();
  const totalCost = getTotalCost();

  // Get portfolio start date (earliest position creation)
  const portfolioStartDate = useMemo(() => {
    if (!portfolio) return null;

    const positionDates = portfolio.positions
      .map(p => new Date(p.createdAt))
      .filter(d => !isNaN(d.getTime()));

    if (positionDates.length > 0) {
      const earliest = new Date(Math.min(...positionDates.map(d => d.getTime())));
      return earliest.toISOString().split('T')[0];
    }

    if (portfolio.createdAt) {
      return new Date(portfolio.createdAt).toISOString().split('T')[0];
    }

    return null;
  }, [portfolio]);

  // Calculate days since portfolio start
  const daysSinceStart = useMemo(() => {
    if (!portfolioStartDate) return 30;
    const start = new Date(portfolioStartDate);
    const now = new Date();
    const days = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(days, 1);
  }, [portfolioStartDate]);

  // Determine range — always at least 3M so the chart has meaningful shape
  const range = useMemo(() => {
    if (daysSinceStart <= 90) return '3M';
    if (daysSinceStart <= 180) return '6M';
    return '1Y';
  }, [daysSinceStart]);

  // Fetch historical data for S&P 500 AND all portfolio positions (with 24h cache)
  useEffect(() => {
    if (!hasPositions || !portfolioStartDate || !portfolio) {
      setSp500Data([]);
      setPositionHistories({});
      return;
    }

    let cancelled = false;

    const fetchAllHistoricalData = async () => {
      // Check localStorage cache first
      const cached = loadChartCache(portfolio.id, range);
      const cacheIsValid = cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS;

      if (cacheIsValid && cached && Object.keys(cached.positionHistories).length > 0) {
        // Show cached data immediately (only if position histories exist)
        setSp500Data(cached.sp500Data);
        setCurrentSpyPrice(cached.currentSpyPrice);
        setPositionHistories(cached.positionHistories);
        setIsLoading(false);
        return; // Cache is fresh enough, no need to fetch
      }

      // If we have stale cache, show it while we fetch fresh data
      if (cached) {
        setSp500Data(cached.sp500Data);
        setCurrentSpyPrice(cached.currentSpyPrice);
        setPositionHistories(cached.positionHistories);
      }

      setIsLoading(!cached); // Only show loading spinner if no cached data
      setError(null);

      try {
        // Get unique stock symbols (exclude crypto for now - different API)
        const stockSymbols = portfolio.positions
          .filter(p => p.assetType === 'stock' || p.assetType === 'etf')
          .map(p => p.symbol);

        // Fetch S&P 500 + all position histories in parallel
        const allSymbols = ['SPY', ...stockSymbols];
        const fetchPromises = allSymbols.map(async (symbol) => {
          const response = await fetch(`/api/stocks?symbol=${symbol}&action=history&range=${range}`);
          const result = await response.json();

          if (result.success && result.data) {
            return {
              symbol,
              data: result.data
                .map((item: any) => ({
                  date: item.date.split('T')[0],
                  close: Number(item.close),
                }))
                .filter((item: HistoricalPrice) => item.date >= portfolioStartDate)
            };
          }
          return { symbol, data: [] };
        });

        const results = await Promise.all(fetchPromises);
        if (cancelled) return;

        // Separate S&P 500 from position data
        const sp500Result = results.find(r => r.symbol === 'SPY');
        let spyPrice: number | null = null;

        if (sp500Result && sp500Result.data.length > 0) {
          setSp500Data(sp500Result.data);

          // Also fetch current SPY price for today's data point
          try {
            const quoteResponse = await fetch('/api/stocks?symbol=SPY&action=quote');
            const quoteResult = await quoteResponse.json();
            if (quoteResult.success && quoteResult.data?.price) {
              spyPrice = quoteResult.data.price;
              setCurrentSpyPrice(spyPrice);
            }
          } catch {
            console.log('Could not fetch current SPY price');
          }
        } else {
          console.log('S&P 500 data unavailable, showing portfolio data only');
        }

        // Store position histories
        const histories: Record<string, HistoricalPrice[]> = {};
        results.forEach(r => {
          if (r.symbol !== 'SPY') {
            histories[r.symbol] = r.data;
          }
        });
        if (cancelled) return;
        setPositionHistories(histories);

        // Only save to cache if we got valid SPY data AND position histories
        if (sp500Result && sp500Result.data.length > 0 && Object.keys(histories).length > 0) {
          saveChartCache({
            timestamp: Date.now(),
            sp500Data: sp500Result.data,
            currentSpyPrice: spyPrice,
            positionHistories: histories,
            portfolioId: portfolio.id,
            range,
          });
        }

      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch historical data:', err);
        // Only show error if we have no cached data to fall back on
        if (!cached) {
          setError('Failed to load market data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAllHistoricalData();
    return () => { cancelled = true; };
  }, [hasPositions, portfolioStartDate, range, portfolio]);

  // Get today's date string
  const today = new Date().toISOString().split('T')[0];

  // Calculate portfolio value for a given date using historical prices
  // For TODAY, use current live prices instead of closing prices
  const calculatePortfolioValueForDate = (date: string): number | null => {
    if (!portfolio) return null;

    // If it's today, use current live prices (the actual totalValue)
    if (date === today) {
      return totalValue;
    }

    let value = 0;

    for (const position of portfolio.positions) {
      if (position.assetType === 'crypto' || position.assetType === 'commodity') {
        // For crypto/commodity, use current price (we don't have historical data for these)
        value += position.quantity * position.currentPrice;
        continue;
      }

      const history = positionHistories[position.symbol];
      if (!history || history.length === 0) {
        value += position.quantity * position.currentPrice;
        continue;
      }

      // Find the price for this date (or closest available)
      const priceForDate = history.find(h => h.date === date);
      if (priceForDate) {
        value += position.quantity * priceForDate.close;
      } else {
        // Find closest price before this date
        const closestBefore = history.filter(h => h.date <= date).pop();
        if (closestBefore) {
          value += position.quantity * closestBefore.close;
        } else {
          value += position.quantity * position.currentPrice;
        }
      }
    }

    // Add cash balance
    value += portfolio.cashBalance || 0;

    return value;
  };

  // Check if we have meaningful position history data
  const hasPositionHistories = useMemo(() => {
    return Object.values(positionHistories).some(h => h.length > 1);
  }, [positionHistories]);

  // Calculate starting portfolio value (day 1)
  // When position histories are empty, use totalCost as the starting value
  const startingValue = useMemo(() => {
    if (sp500Data.length === 0) return totalCost || totalValue;
    const firstDate = sp500Data[0]?.date;
    if (!firstDate) return totalCost || totalValue;

    if (hasPositionHistories) {
      return calculatePortfolioValueForDate(firstDate) || totalCost || totalValue;
    }

    // No position histories — use cost basis as starting value
    return totalCost || totalValue;
  }, [sp500Data, positionHistories, portfolio, totalValue, totalCost, hasPositionHistories]);

  // Calculate what your money would be worth in S&P 500
  const sp500Comparison = useMemo(() => {
    if (sp500Data.length === 0 || startingValue === 0) return null;

    const startPrice = sp500Data[0].close;
    const endPrice = sp500Data[sp500Data.length - 1].close;
    const sp500Return = (endPrice - startPrice) / startPrice;

    // If you had invested your starting portfolio value in S&P 500
    const hypotheticalSP500Value = startingValue * (1 + sp500Return);
    const hypotheticalSP500Gain = hypotheticalSP500Value - startingValue;

    return {
      hypotheticalValue: hypotheticalSP500Value,
      hypotheticalGain: hypotheticalSP500Gain,
      sp500Return: sp500Return * 100,
    };
  }, [sp500Data, startingValue]);

  // Build chart data using ACTUAL historical prices
  // Include today's data point with live prices
  const chartData = useMemo(() => {
    if (startingValue === 0) return [];

    // If no SPY data, build chart from portfolio data only
    if (sp500Data.length === 0) {
      // Build dates from position histories
      const allDates = new Set<string>();
      Object.values(positionHistories).forEach(history => {
        history.forEach(h => {
          if (h.date >= (portfolioStartDate || '')) allDates.add(h.date);
        });
      });
      const sortedDates = Array.from(allDates).sort();
      if (sortedDates.length === 0) {
        // No historical data at all — show at least today
        return [{
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          portfolio: Number(totalValue.toFixed(2)),
          sp500: undefined as unknown as number,
        }];
      }
      const data = sortedDates.map(d => ({
        date: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        portfolio: Number((calculatePortfolioValueForDate(d) || startingValue).toFixed(2)),
        sp500: undefined as unknown as number,
      }));
      // Add today
      const lastDate = sortedDates[sortedDates.length - 1];
      if (lastDate < today) {
        data.push({
          date: new Date(today).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          portfolio: Number(totalValue.toFixed(2)),
          sp500: undefined as unknown as number,
        });
      }
      return data;
    }

    const sp500StartPrice = sp500Data[0].close;
    const lastSp500Data = sp500Data[sp500Data.length - 1];

    // Build data from historical prices
    const data = sp500Data.map((sp, index) => {
      let portfolioValue: number;

      if (hasPositionHistories) {
        // Use actual historical position data
        portfolioValue = calculatePortfolioValueForDate(sp.date) || startingValue;
      } else {
        // No position histories — interpolate between cost basis and current value
        // Use S&P 500 curve shape to distribute the portfolio's total return over time
        const sp500PercentFromStart = (sp.close - sp500StartPrice) / sp500StartPrice;
        const sp500TotalReturn = (lastSp500Data.close - sp500StartPrice) / sp500StartPrice;
        const totalPortfolioReturn = totalValue - startingValue;

        if (Math.abs(sp500TotalReturn) > 0.001) {
          // Scale portfolio return proportionally to S&P 500 curve shape
          const progressRatio = sp500PercentFromStart / sp500TotalReturn;
          portfolioValue = startingValue + totalPortfolioReturn * progressRatio;
        } else {
          // S&P flat too — simple linear interpolation
          const progress = index / Math.max(sp500Data.length - 1, 1);
          portfolioValue = startingValue + totalPortfolioReturn * progress;
        }
      }

      const sp500PercentChange = (sp.close - sp500StartPrice) / sp500StartPrice;
      const hypotheticalSP500Value = startingValue * (1 + sp500PercentChange);

      return {
        date: new Date(sp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        portfolio: Number(portfolioValue.toFixed(2)),
        sp500: Number(hypotheticalSP500Value.toFixed(2)),
      };
    });

    // Add today's data point if not already included
    const lastDataDate = lastSp500Data?.date;
    if (lastDataDate && lastDataDate < today) {
      // Use current SPY price if available, otherwise use last closing price
      const todaySpyPrice = currentSpyPrice || lastSp500Data.close;
      const sp500PercentChange = (todaySpyPrice - sp500StartPrice) / sp500StartPrice;
      const hypotheticalSP500Value = startingValue * (1 + sp500PercentChange);

      data.push({
        date: new Date(today).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        portfolio: Number(totalValue.toFixed(2)),
        sp500: Number(hypotheticalSP500Value.toFixed(2)),
      });
    }

    return data;
  }, [sp500Data, startingValue, positionHistories, hasPositionHistories, portfolio, totalValue, totalCost, today, currentSpyPrice]);

  // Get current portfolio value from chart data (last data point)
  const currentPortfolioValue = chartData.length > 0 ? chartData[chartData.length - 1].portfolio : totalValue;

  // Portfolio gain = current value - starting value
  const portfolioGainFromInitial = currentPortfolioValue - startingValue;

  // Determine who's winning - compare gains
  const portfolioWinning = sp500Comparison ? portfolioGainFromInitial > sp500Comparison.hypotheticalGain : false;
  const difference = sp500Comparison ? Math.abs(portfolioGainFromInitial - sp500Comparison.hypotheticalGain) : 0;

  if (!hasPositions) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Add positions to track performance</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {sp500Data.length > 0 ? title : 'Portfolio Performance'}
          </CardTitle>
          {portfolioStartDate && (
            <span className="text-[10px] md:text-xs text-muted-foreground">
              Since {new Date(portfolioStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              <span className="hidden sm:inline">
                {' '}({daysSinceStart} day{daysSinceStart !== 1 ? 's' : ''})
              </span>
            </span>
          )}
        </div>
        {sp500Comparison && (
          <div className="flex flex-col gap-0.5 md:gap-1 mt-1 md:mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0" style={{ backgroundColor: '#3b82f6' }} />
                <span className="text-xs md:text-sm">
                  Portfolio:{' '}
                  <span className="font-semibold">{formatCurrency(currentPortfolioValue)}</span>
                  <span className={cn('ml-1 text-[10px] md:text-xs', portfolioGainFromInitial >= 0 ? 'text-green-500' : 'text-red-500')}>
                    ({portfolioGainFromInitial >= 0 ? '+' : ''}{formatCurrency(portfolioGainFromInitial)})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full shrink-0" style={{ backgroundColor: '#9ca3af' }} />
                <span className="text-xs md:text-sm">
                  S&P 500:{' '}
                  <span className="font-semibold">{formatCurrency(sp500Comparison.hypotheticalValue)}</span>
                  <span className={cn('ml-1 text-[10px] md:text-xs', sp500Comparison.hypotheticalGain >= 0 ? 'text-green-500' : 'text-red-500')}>
                    ({sp500Comparison.hypotheticalGain >= 0 ? '+' : ''}{formatCurrency(sp500Comparison.hypotheticalGain)})
                  </span>
                </span>
              </div>
            </div>
            <p className="text-[10px] md:text-xs">
              {portfolioWinning ? (
                <span className="text-green-500">Beating S&P 500 by {formatCurrency(difference)}</span>
              ) : difference === 0 ? (
                <span className="text-muted-foreground">Matching S&P 500 performance</span>
              ) : (
                <span className="text-amber-500">S&P 500 ahead by {formatCurrency(difference)}</span>
              )}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="h-[200px] md:h-[260px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading chart...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] md:h-[260px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">No data available</div>
          </div>
        ) : (
          <div className="w-full h-[200px] md:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                  domain={['auto', 'auto']}
                  className="text-muted-foreground"
                  width={50}
                />
                <ReferenceLine y={startingValue} stroke="#666" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string) => {
                    if (value == null) return [null, null];
                    return [
                      formatCurrency(value),
                      name === 'portfolio' ? 'Your Portfolio' : 'If S&P 500'
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="portfolio"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  animationDuration={0}
                />
                {sp500Data.length > 0 && (
                  <Line
                    type="monotone"
                    dataKey="sp500"
                    name="sp500"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                    isAnimationActive={false}
                    animationDuration={0}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            {sp500Data.length === 0 && !isLoading && (
              <p className="text-[10px] text-muted-foreground text-center mt-1">
                S&P 500 comparison unavailable (API rate limit) — showing portfolio only
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
