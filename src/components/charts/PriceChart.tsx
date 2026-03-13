'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  LineChart,
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

type ChartTab = 'price' | 'technical';

// ─── Client-side technical indicator calculations ───

function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (ema === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      ema = sum / period;
    } else {
      ema = data[i] * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

function calcRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) result.push(null);
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs2));
  }
  return result;
}

function calcMACD(closes: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) macdLine.push(ema12[i]! - ema26[i]!);
    else macdLine.push(null);
  }
  // Signal line = 9-period EMA of MACD
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalEma = calcEMA(validMacd, 9);
  let validIdx = 0;
  const signalLine: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] !== null) {
      const sig = signalEma[validIdx] ?? null;
      signalLine.push(sig);
      histogram.push(sig !== null ? macdLine[i]! - sig : null);
      validIdx++;
    } else {
      signalLine.push(null);
      histogram.push(null);
    }
  }
  return { macd: macdLine, signal: signalLine, histogram };
}

function calcBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) { upper.push(null); lower.push(null); continue; }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - middle[i]!) ** 2;
    const sd = Math.sqrt(variance / period);
    upper.push(middle[i]! + stdDev * sd);
    lower.push(middle[i]! - stdDev * sd);
  }
  return { upper, middle, lower };
}

export function PriceChart({ symbol, data, isLoading: externalLoading, onTimeRangeChange }: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [realTimeQuote, setRealTimeQuote] = useState<QuoteData | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('price');

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

  // When switching to technical tab, ensure we have enough data
  useEffect(() => {
    if (activeTab === 'technical' && (selectedRange === '1D' || selectedRange === '1W')) {
      setSelectedRange('1M');
    }
  }, [activeTab, selectedRange]);

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    onTimeRangeChange?.(range);
  };

  // Compute technical indicators from chart data
  const technicalData = useMemo(() => {
    if (chartData.length < 14) return null;

    const closes = chartData.map(d => d.close);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, Math.min(50, closes.length));
    const rsi = calcRSI(closes, 14);
    const macd = calcMACD(closes);
    const bb = calcBollingerBands(closes, 20);

    return chartData.map((d, i) => ({
      ...d,
      sma20: sma20[i] !== null ? parseFloat(sma20[i]!.toFixed(2)) : undefined,
      sma50: sma50[i] !== null ? parseFloat(sma50[i]!.toFixed(2)) : undefined,
      bbUpper: bb.upper[i] !== null ? parseFloat(bb.upper[i]!.toFixed(2)) : undefined,
      bbMiddle: bb.middle[i] !== null ? parseFloat(bb.middle[i]!.toFixed(2)) : undefined,
      bbLower: bb.lower[i] !== null ? parseFloat(bb.lower[i]!.toFixed(2)) : undefined,
      rsi: rsi[i] !== null ? parseFloat(rsi[i]!.toFixed(2)) : undefined,
      macd: macd.macd[i] !== null ? parseFloat(macd.macd[i]!.toFixed(4)) : undefined,
      macdSignal: macd.signal[i] !== null ? parseFloat(macd.signal[i]!.toFixed(4)) : undefined,
      macdHist: macd.histogram[i] !== null ? parseFloat(macd.histogram[i]!.toFixed(4)) : undefined,
    }));
  }, [chartData]);

  // Latest indicator values for badges
  const latestIndicators = useMemo(() => {
    if (!technicalData || technicalData.length === 0) return null;
    const last = technicalData[technicalData.length - 1];
    return {
      rsi: last.rsi,
      macd: last.macd,
      macdSignal: last.macdSignal,
      sma20: last.sma20,
      sma50: last.sma50,
    };
  }, [technicalData]);

  const currentPrice = realTimeQuote?.price || (chartData[chartData.length - 1]?.close ?? 0);
  const priceChange = realTimeQuote?.change ?? 0;
  const priceChangePercent = realTimeQuote?.changePercent ?? 0;

  const firstPrice = chartData[0];

  const allPrices = chartData.flatMap(d => [d.high, d.low]);
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) * 0.995 : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) * 1.005 : 100;

  // For technical chart, expand Y range to include Bollinger Bands
  const techPrices = technicalData
    ? technicalData.flatMap(d => [d.high, d.low, d.bbUpper, d.bbLower].filter((v): v is number => v !== undefined))
    : allPrices;
  const techMinPrice = techPrices.length > 0 ? Math.min(...techPrices) * 0.995 : minPrice;
  const techMaxPrice = techPrices.length > 0 ? Math.max(...techPrices) * 1.005 : maxPrice;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
  };

  const rsiSignal = latestIndicators?.rsi
    ? latestIndicators.rsi > 70 ? 'overbought' : latestIndicators.rsi < 30 ? 'oversold' : 'neutral'
    : null;

  const macdTrend = latestIndicators?.macd !== undefined && latestIndicators?.macdSignal !== undefined
    ? latestIndicators.macd > latestIndicators.macdSignal ? 'bullish' : 'bearish'
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          {/* Symbol + Price */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                  disabled={activeTab === 'technical' && (range === '1D' || range === '1W')}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>

          {/* Tab Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('price')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  activeTab === 'price'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Price
              </button>
              <button
                onClick={() => setActiveTab('technical')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  activeTab === 'technical'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Technical
              </button>
            </div>

            {/* Indicator badges when technical tab is active */}
            {activeTab === 'technical' && latestIndicators && (
              <div className="flex flex-wrap gap-1.5">
                {latestIndicators.rsi !== undefined && (
                  <Badge variant="outline" className={cn(
                    'text-[10px] h-5',
                    rsiSignal === 'overbought' ? 'border-red-500/50 text-red-500' :
                    rsiSignal === 'oversold' ? 'border-green-500/50 text-green-500' :
                    'border-border text-muted-foreground'
                  )}>
                    RSI {latestIndicators.rsi.toFixed(1)}
                    {rsiSignal !== 'neutral' && ` · ${rsiSignal}`}
                  </Badge>
                )}
                {macdTrend && (
                  <Badge variant="outline" className={cn(
                    'text-[10px] h-5',
                    macdTrend === 'bullish' ? 'border-green-500/50 text-green-500' : 'border-red-500/50 text-red-500'
                  )}>
                    MACD · {macdTrend}
                  </Badge>
                )}
                {latestIndicators.sma20 && latestIndicators.sma50 && (
                  <Badge variant="outline" className={cn(
                    'text-[10px] h-5',
                    latestIndicators.sma20 > latestIndicators.sma50
                      ? 'border-green-500/50 text-green-500'
                      : 'border-red-500/50 text-red-500'
                  )}>
                    {latestIndicators.sma20 > latestIndicators.sma50 ? 'Golden Cross' : 'Death Cross'}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || externalLoading ? (
          <Skeleton className="h-[500px] w-full" />
        ) : activeTab === 'price' ? (
          /* ─── Price Tab ─── */
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
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { close: 'Close', open: 'Open', high: 'High', low: 'Low' };
                    return [`$${value.toFixed(2)}`, labels[name] || name];
                  }}
                />
                <Line type="monotone" dataKey="close" stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="high" stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={0.5} strokeOpacity={0.3} dot={false} />
                <Line type="monotone" dataKey="low" stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={0.5} strokeOpacity={0.3} dot={false} />
                <ReferenceLine y={firstPrice?.close} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
              </ComposedChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height="28%">
              <ComposedChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${(value / 1000000).toFixed(1)}M`, 'Volume']} />
                <Bar dataKey="volume" fill="hsl(var(--primary))" opacity={0.3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : technicalData && technicalData.length > 0 ? (
          /* ─── Technical Tab ─── */
          <div className="h-[600px] w-full flex flex-col gap-0">
            {/* Price + Bollinger Bands + SMAs (50%) */}
            <ResponsiveContainer width="100%" height="50%">
              <ComposedChart data={technicalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} className="text-muted-foreground" interval="preserveStartEnd" />
                <YAxis
                  domain={[techMinPrice, techMaxPrice]}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v.toFixed(0)}`}
                  className="text-muted-foreground"
                  orientation="right"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      close: 'Close', sma20: 'SMA 20', sma50: 'SMA 50',
                      bbUpper: 'BB Upper', bbMiddle: 'BB Middle', bbLower: 'BB Lower',
                    };
                    return [`$${value.toFixed(2)}`, labels[name] || name];
                  }}
                />
                {/* Bollinger Band fill */}
                <Area type="monotone" dataKey="bbUpper" stroke="none" fill="#8b5cf6" fillOpacity={0.05} />
                <Area type="monotone" dataKey="bbLower" stroke="none" fill="transparent" fillOpacity={0} />
                {/* Bollinger Band lines */}
                <Line type="monotone" dataKey="bbUpper" stroke="#8b5cf6" strokeWidth={1} strokeOpacity={0.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="bbLower" stroke="#8b5cf6" strokeWidth={1} strokeOpacity={0.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="bbMiddle" stroke="#8b5cf6" strokeWidth={1} strokeOpacity={0.3} dot={false} strokeDasharray="2 2" />
                {/* SMA lines */}
                <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="sma50" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                {/* Price line */}
                <Line type="monotone" dataKey="close" stroke={priceChange >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>

            {/* RSI (25%) */}
            <ResponsiveContainer width="100%" height="25%">
              <ComposedChart data={technicalData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.2} />
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={[0, 100]}
                  ticks={[30, 50, 70]}
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  orientation="right"
                  width={30}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [value.toFixed(2), 'RSI']}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" strokeOpacity={0.3} />
                <Line type="monotone" dataKey="rsi" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                {/* Label */}
                <text x={5} y={15} fontSize={10} fill="hsl(var(--muted-foreground))">RSI (14)</text>
              </ComposedChart>
            </ResponsiveContainer>

            {/* MACD (25%) */}
            <ResponsiveContainer width="100%" height="25%">
              <ComposedChart data={technicalData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} className="text-muted-foreground" interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  orientation="right"
                  width={40}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { macd: 'MACD', macdSignal: 'Signal', macdHist: 'Histogram' };
                    return [value.toFixed(4), labels[name] || name];
                  }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                <Bar dataKey="macdHist" fill="#6366f1" opacity={0.4} />
                <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="macdSignal" stroke="#f97316" strokeWidth={1.5} dot={false} />
                {/* Label */}
                <text x={5} y={15} fontSize={10} fill="hsl(var(--muted-foreground))">MACD</text>
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block rounded" /> SMA 20</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> SMA 50</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500 inline-block rounded border-dashed" /> Bollinger Bands</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block rounded" /> RSI</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> MACD</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block rounded" /> Signal</span>
            </div>
          </div>
        ) : (
          <div className="h-[500px] flex items-center justify-center text-muted-foreground text-sm">
            Not enough data for technical analysis. Try a longer time range.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
