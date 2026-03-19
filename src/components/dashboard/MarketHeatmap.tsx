'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutGrid, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { AssetLogo } from '@/components/ui/asset-logo';

interface StockItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: number; // relative weight
}

// Top US stocks by approximate market cap (relative weights for treemap sizing)
const TOP_STOCKS: { symbol: string; name: string; weight: number }[] = [
  { symbol: 'AAPL', name: 'Apple', weight: 3400 },
  { symbol: 'MSFT', name: 'Microsoft', weight: 3100 },
  { symbol: 'NVDA', name: 'NVIDIA', weight: 2800 },
  { symbol: 'GOOGL', name: 'Alphabet', weight: 2100 },
  { symbol: 'AMZN', name: 'Amazon', weight: 2000 },
  { symbol: 'META', name: 'Meta', weight: 1500 },
  { symbol: 'TSLA', name: 'Tesla', weight: 900 },
  { symbol: 'BRK.B', name: 'Berkshire', weight: 870 },
  { symbol: 'AVGO', name: 'Broadcom', weight: 800 },
  { symbol: 'LLY', name: 'Eli Lilly', weight: 750 },
  { symbol: 'JPM', name: 'JPMorgan', weight: 680 },
  { symbol: 'WMT', name: 'Walmart', weight: 650 },
  { symbol: 'V', name: 'Visa', weight: 600 },
  { symbol: 'XOM', name: 'ExxonMobil', weight: 500 },
  { symbol: 'UNH', name: 'UnitedHealth', weight: 490 },
  { symbol: 'MA', name: 'Mastercard', weight: 450 },
  { symbol: 'COST', name: 'Costco', weight: 420 },
  { symbol: 'HD', name: 'Home Depot', weight: 400 },
  { symbol: 'PG', name: 'Procter & Gamble', weight: 390 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', weight: 380 },
  { symbol: 'NFLX', name: 'Netflix', weight: 370 },
  { symbol: 'ABBV', name: 'AbbVie', weight: 350 },
  { symbol: 'CRM', name: 'Salesforce', weight: 300 },
  { symbol: 'BAC', name: 'Bank of America', weight: 290 },
  { symbol: 'KO', name: 'Coca-Cola', weight: 280 },
  { symbol: 'CVX', name: 'Chevron', weight: 270 },
  { symbol: 'MRK', name: 'Merck', weight: 260 },
  { symbol: 'AMD', name: 'AMD', weight: 250 },
  { symbol: 'PEP', name: 'PepsiCo', weight: 240 },
  { symbol: 'ADBE', name: 'Adobe', weight: 230 },
  { symbol: 'TMO', name: 'Thermo Fisher', weight: 220 },
  { symbol: 'CSCO', name: 'Cisco', weight: 210 },
  { symbol: 'WFC', name: 'Wells Fargo', weight: 200 },
  { symbol: 'MCD', name: 'McDonald\'s', weight: 200 },
  { symbol: 'IBM', name: 'IBM', weight: 190 },
  { symbol: 'GE', name: 'GE Aerospace', weight: 190 },
  { symbol: 'CAT', name: 'Caterpillar', weight: 180 },
  { symbol: 'INTC', name: 'Intel', weight: 160 },
  { symbol: 'DIS', name: 'Disney', weight: 170 },
  { symbol: 'QCOM', name: 'Qualcomm', weight: 170 },
  { symbol: 'VZ', name: 'Verizon', weight: 165 },
  { symbol: 'UBER', name: 'Uber', weight: 160 },
  { symbol: 'GS', name: 'Goldman Sachs', weight: 155 },
  { symbol: 'NKE', name: 'Nike', weight: 140 },
  { symbol: 'BA', name: 'Boeing', weight: 140 },
  { symbol: 'T', name: 'AT&T', weight: 135 },
  { symbol: 'MS', name: 'Morgan Stanley', weight: 130 },
  { symbol: 'PYPL', name: 'PayPal', weight: 120 },
  { symbol: 'NEE', name: 'NextEra', weight: 115 },
  { symbol: 'RTX', name: 'RTX Corp', weight: 110 },
];

function getHeatmapBg(change: number): string {
  if (change >= 3) return 'bg-green-700';
  if (change >= 2) return 'bg-green-600';
  if (change >= 1) return 'bg-green-500';
  if (change >= 0.5) return 'bg-green-500/70';
  if (change >= 0) return 'bg-green-500/40';
  if (change >= -0.5) return 'bg-red-500/40';
  if (change >= -1) return 'bg-red-500/70';
  if (change >= -2) return 'bg-red-500';
  if (change >= -3) return 'bg-red-600';
  return 'bg-red-700';
}

function getHeatmapTextColor(change: number): string {
  const abs = Math.abs(change);
  if (abs >= 0.5) return 'text-white';
  return 'text-foreground';
}

// Squarified treemap algorithm
interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  item: StockItem;
}

function squarify(
  items: StockItem[],
  x: number,
  y: number,
  w: number,
  h: number
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ x, y, w, h, item: items[0] }];
  }

  const totalArea = w * h;
  const totalWeight = items.reduce((s, i) => s + i.marketCap, 0);

  // Sort descending by weight
  const sorted = [...items].sort((a, b) => b.marketCap - a.marketCap);

  const results: TreemapRect[] = [];
  layoutStrip(sorted, x, y, w, h, totalWeight, results);
  return results;
}

function layoutStrip(
  items: StockItem[],
  x: number,
  y: number,
  w: number,
  h: number,
  totalWeight: number,
  results: TreemapRect[]
) {
  if (items.length === 0) return;
  if (items.length === 1) {
    results.push({ x, y, w, h, item: items[0] });
    return;
  }

  const isHorizontal = w >= h;

  // Find the best split
  let bestRatio = Infinity;
  let bestSplit = 1;

  for (let i = 1; i < items.length; i++) {
    const stripWeight = items.slice(0, i).reduce((s, it) => s + it.marketCap, 0);
    const stripFraction = stripWeight / totalWeight;

    const stripSize = isHorizontal ? w * stripFraction : h * stripFraction;
    const otherSize = isHorizontal ? h : w;

    // Calculate worst aspect ratio in this strip
    let worstRatio = 0;
    for (let j = 0; j < i; j++) {
      const itemFraction = items[j].marketCap / stripWeight;
      const itemSize = otherSize * itemFraction;
      const ratio = Math.max(stripSize / itemSize, itemSize / stripSize);
      worstRatio = Math.max(worstRatio, ratio);
    }

    if (worstRatio < bestRatio) {
      bestRatio = worstRatio;
      bestSplit = i;
    } else if (worstRatio > bestRatio * 1.5) {
      // Getting worse, stop searching
      break;
    }
  }

  const stripItems = items.slice(0, bestSplit);
  const remaining = items.slice(bestSplit);
  const stripWeight = stripItems.reduce((s, it) => s + it.marketCap, 0);
  const stripFraction = stripWeight / totalWeight;

  if (isHorizontal) {
    const stripW = w * stripFraction;
    // Layout strip items vertically
    let cy = y;
    for (const item of stripItems) {
      const itemH = h * (item.marketCap / stripWeight);
      results.push({ x, y: cy, w: stripW, h: itemH, item });
      cy += itemH;
    }
    // Recurse on remaining
    layoutStrip(remaining, x + stripW, y, w - stripW, h, totalWeight - stripWeight, results);
  } else {
    const stripH = h * stripFraction;
    // Layout strip items horizontally
    let cx = x;
    for (const item of stripItems) {
      const itemW = w * (item.marketCap / stripWeight);
      results.push({ x: cx, y, w: itemW, h: stripH, item });
      cx += itemW;
    }
    // Recurse on remaining
    layoutStrip(remaining, x, y + stripH, w, h - stripH, totalWeight - stripWeight, results);
  }
}

export function MarketHeatmap() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const symbols = TOP_STOCKS.map((s) => s.symbol);
      const response = await fetch(`/api/stocks?symbols=${symbols.join(',')}&action=quotes`);
      const data = await response.json();

      if (data.success && data.data) {
        const items: StockItem[] = TOP_STOCKS.map((stock) => {
          const quote = data.data[stock.symbol];
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: quote?.price || 0,
            changePercent: quote?.changePercent || 0,
            marketCap: stock.weight,
          };
        }).filter((s) => s.price > 0);

        setStocks(items);
      }
    } catch (error) {
      console.error('Market heatmap error:', error);
      toast.error('Failed to fetch market data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const treemapRects = useMemo(() => {
    if (stocks.length === 0) return [];
    return squarify(stocks, 0, 0, 100, 100);
  }, [stocks]);

  const advancers = stocks.filter((s) => s.changePercent > 0).length;
  const decliners = stocks.filter((s) => s.changePercent < 0).length;
  const unchanged = stocks.filter((s) => s.changePercent === 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Market Heatmap
          </span>
          <div className="flex items-center gap-3">
            {stocks.length > 0 && (
              <div className="flex items-center gap-3 text-sm font-normal">
                <span className="text-green-500">{advancers} up</span>
                <span className="text-red-500">{decliners} down</span>
                {unchanged > 0 && <span className="text-muted-foreground">{unchanged} flat</span>}
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && stocks.length === 0 ? (
          <Skeleton className="w-full aspect-[16/9]" />
        ) : (
          <TooltipProvider delayDuration={100}>
            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border border-border">
              {treemapRects.map((rect) => {
                const { item } = rect;
                const minDim = Math.min(rect.w, rect.h);
                const showLogo = minDim > 5;
                const showSymbol = minDim > 4;
                const showPercent = minDim > 3.5;
                const showName = minDim > 8;
                const fontSize = minDim > 12 ? 'text-base' : minDim > 7 ? 'text-sm' : 'text-xs';
                return (
                  <Tooltip key={item.symbol}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          'absolute flex flex-col items-center justify-center gap-0.5 transition-opacity hover:opacity-80 cursor-pointer border-[0.5px] border-black/20',
                          getHeatmapBg(item.changePercent),
                          getHeatmapTextColor(item.changePercent)
                        )}
                        style={{
                          left: `${rect.x}%`,
                          top: `${rect.y}%`,
                          width: `${rect.w}%`,
                          height: `${rect.h}%`,
                        }}
                        onClick={() => router.push(`/analysis?symbol=${item.symbol}`)}
                      >
                        {showLogo && (
                          <AssetLogo
                            symbol={item.symbol}
                            name={item.name}
                            assetType="stock"
                            size={minDim > 12 ? 'lg' : minDim > 7 ? 'md' : 'sm'}
                            className="mb-0.5"
                          />
                        )}
                        {showSymbol && (
                          <span className={cn('font-bold leading-tight', fontSize)}>
                            {item.symbol}
                          </span>
                        )}
                        {showPercent && (
                          <span className={cn('font-semibold leading-tight', minDim > 7 ? 'text-sm' : 'text-[10px]')}>
                            {item.changePercent >= 0 ? '+' : ''}
                            {item.changePercent.toFixed(2)}%
                          </span>
                        )}
                        {showName && (
                          <span className="text-[10px] opacity-80 leading-tight truncate max-w-[90%]">
                            {item.name}
                          </span>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="z-50">
                      <div className="text-sm">
                        <p className="font-semibold">{item.name} ({item.symbol})</p>
                        <p>Price: ${item.price.toFixed(2)}</p>
                        <p className={item.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <span>-3%+</span>
              <div className="flex gap-0.5">
                <div className="w-5 h-3 rounded-sm bg-red-700" />
                <div className="w-5 h-3 rounded-sm bg-red-600" />
                <div className="w-5 h-3 rounded-sm bg-red-500" />
                <div className="w-5 h-3 rounded-sm bg-red-500/70" />
                <div className="w-5 h-3 rounded-sm bg-red-500/40" />
                <div className="w-5 h-3 rounded-sm bg-green-500/40" />
                <div className="w-5 h-3 rounded-sm bg-green-500/70" />
                <div className="w-5 h-3 rounded-sm bg-green-500" />
                <div className="w-5 h-3 rounded-sm bg-green-600" />
                <div className="w-5 h-3 rounded-sm bg-green-700" />
              </div>
              <span>+3%+</span>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-1">
              Tile size represents relative market cap. Click any stock to analyze.
            </p>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
