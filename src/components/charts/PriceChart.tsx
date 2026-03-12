'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TimeRange, OHLC } from '@/types';
import { cn } from '@/lib/utils';

interface PriceChartProps {
  symbol: string;
  data?: OHLC[];
  isLoading?: boolean;
  onTimeRangeChange?: (range: TimeRange) => void;
}

const timeRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

type ChartDataPoint = { date: string; open: number; high: number; low: number; close: number; volume: number };

interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
}

export function PriceChart({ symbol, data, isLoading: externalLoading, onTimeRangeChange }: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1D');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeQuote, setRealTimeQuote] = useState<QuoteData | null>(null);

  // Fetch real-time quote for current price display
  useEffect(() => {
    if (!symbol) return;

    const fetchQuote = async () => {
      try {
        const response = await fetch(`/api/stocks?symbol=${symbol}&action=quote`);
        const result = await response.json();

        if (result.success && result.data) {
          setRealTimeQuote({
            price: result.data.price,
            change: result.data.change,
            changePercent: result.data.changePercent,
            previousClose: result.data.previousClose,
          });
        }
      } catch (error) {
        console.error('Failed to fetch real-time quote:', error);
      }
    };

    fetchQuote();
    // Refresh every 60 seconds
    const interval = setInterval(fetchQuote, 60000);
    return () => clearInterval(interval);
  }, [symbol]);

  // Fetch historical data when symbol or range changes
  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/stocks?symbol=${symbol}&action=history&range=${selectedRange}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          const formattedData = result.data.map((item: any) => ({
            date: selectedRange === '1D'
              ? new Date(item.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume),
          }));
          setChartData(formattedData);
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [symbol, selectedRange]);

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    onTimeRangeChange?.(range);
  };

  // Use real-time quote for current price display, fall back to chart data
  const currentPrice = realTimeQuote?.price || (chartData[chartData.length - 1]?.close ?? 0);
  const priceChange = realTimeQuote?.change ?? 0;
  const priceChangePercent = realTimeQuote?.changePercent ?? 0;

  // First price for chart reference line
  const firstPrice = chartData[0];

  // Calculate min/max for Y axis
  const allPrices = chartData.flatMap(d => [d.high, d.low]);
  const minPrice = Math.min(...allPrices) * 0.995;
  const maxPrice = Math.max(...allPrices) * 1.005;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold">{symbol}</CardTitle>
          {currentPrice > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold">${currentPrice.toFixed(2)}</span>
              <span
                className={cn(
                  'text-sm font-medium',
                  priceChange >= 0 ? 'text-green-500' : 'text-red-500'
                )}
              >
                {priceChange >= 0 ? '+' : ''}
                {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <Button
              key={range}
              variant={selectedRange === range ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleRangeChange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || externalLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="70%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[minPrice, maxPrice]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  className="text-muted-foreground"
                  orientation="right"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      close: 'Close',
                      open: 'Open',
                      high: 'High',
                      low: 'Low',
                    };
                    return [`$${value.toFixed(2)}`, labels[name] || name];
                  }}
                />
                {/* Price line */}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {/* High line (thin) */}
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  dot={false}
                />
                {/* Low line (thin) */}
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={0.5}
                  strokeOpacity={0.3}
                  dot={false}
                />
                {/* Starting price reference */}
                <ReferenceLine
                  y={firstPrice?.close}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
            {/* Volume Chart */}
            <ResponsiveContainer width="100%" height="28%">
              <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M`, 'Volume']}
                />
                <Bar
                  dataKey="volume"
                  fill="hsl(var(--primary))"
                  opacity={0.3}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
