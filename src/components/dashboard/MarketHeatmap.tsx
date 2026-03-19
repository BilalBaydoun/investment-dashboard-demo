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
import { LayoutGrid, RefreshCw, Loader2, Maximize2, Minimize2 } from 'lucide-react';
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
  // Mega cap (compressed weights so smaller stocks get more space)
  { symbol: 'AAPL', name: 'Apple', weight: 1400 },
  { symbol: 'MSFT', name: 'Microsoft', weight: 1300 },
  { symbol: 'NVDA', name: 'NVIDIA', weight: 1200 },
  { symbol: 'GOOGL', name: 'Alphabet', weight: 1000 },
  { symbol: 'AMZN', name: 'Amazon', weight: 950 },
  { symbol: 'META', name: 'Meta', weight: 800 },
  { symbol: 'TSLA', name: 'Tesla', weight: 600 },
  { symbol: 'BRK.B', name: 'Berkshire', weight: 580 },
  { symbol: 'AVGO', name: 'Broadcom', weight: 560 },
  { symbol: 'LLY', name: 'Eli Lilly', weight: 540 },
  // Large cap - financials & healthcare
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
  { symbol: 'ORCL', name: 'Oracle', weight: 340 },
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
  { symbol: 'IBM', name: 'IBM', weight: 195 },
  { symbol: 'GE', name: 'GE Aerospace', weight: 190 },
  { symbol: 'LIN', name: 'Linde', weight: 185 },
  { symbol: 'CAT', name: 'Caterpillar', weight: 180 },
  { symbol: 'ISRG', name: 'Intuitive Surgical', weight: 175 },
  { symbol: 'DIS', name: 'Disney', weight: 170 },
  { symbol: 'QCOM', name: 'Qualcomm', weight: 170 },
  { symbol: 'VZ', name: 'Verizon', weight: 165 },
  { symbol: 'UBER', name: 'Uber', weight: 160 },
  { symbol: 'INTC', name: 'Intel', weight: 160 },
  { symbol: 'GS', name: 'Goldman Sachs', weight: 155 },
  { symbol: 'NOW', name: 'ServiceNow', weight: 155 },
  { symbol: 'INTU', name: 'Intuit', weight: 150 },
  { symbol: 'AXP', name: 'American Express', weight: 150 },
  { symbol: 'PFE', name: 'Pfizer', weight: 148 },
  { symbol: 'TXN', name: 'Texas Instruments', weight: 145 },
  { symbol: 'NKE', name: 'Nike', weight: 140 },
  { symbol: 'BA', name: 'Boeing', weight: 140 },
  { symbol: 'BKNG', name: 'Booking Holdings', weight: 140 },
  { symbol: 'T', name: 'AT&T', weight: 135 },
  { symbol: 'MS', name: 'Morgan Stanley', weight: 130 },
  { symbol: 'SPGI', name: 'S&P Global', weight: 130 },
  { symbol: 'HON', name: 'Honeywell', weight: 128 },
  { symbol: 'AMGN', name: 'Amgen', weight: 125 },
  { symbol: 'LOW', name: 'Lowe\'s', weight: 125 },
  { symbol: 'BLK', name: 'BlackRock', weight: 122 },
  { symbol: 'PYPL', name: 'PayPal', weight: 120 },
  { symbol: 'NEE', name: 'NextEra Energy', weight: 118 },
  { symbol: 'RTX', name: 'RTX Corp', weight: 115 },
  { symbol: 'SBUX', name: 'Starbucks', weight: 112 },
  { symbol: 'UPS', name: 'UPS', weight: 110 },
  { symbol: 'DE', name: 'John Deere', weight: 108 },
  { symbol: 'SCHW', name: 'Charles Schwab', weight: 105 },
  { symbol: 'PLTR', name: 'Palantir', weight: 105 },
  { symbol: 'AMAT', name: 'Applied Materials', weight: 102 },
  { symbol: 'SYK', name: 'Stryker', weight: 100 },
  { symbol: 'MDT', name: 'Medtronic', weight: 98 },
  { symbol: 'ADP', name: 'ADP', weight: 96 },
  { symbol: 'GILD', name: 'Gilead Sciences', weight: 95 },
  { symbol: 'MMC', name: 'Marsh McLennan', weight: 93 },
  { symbol: 'LRCX', name: 'Lam Research', weight: 92 },
  { symbol: 'TGT', name: 'Target', weight: 90 },
  { symbol: 'CB', name: 'Chubb', weight: 88 },
  { symbol: 'MU', name: 'Micron', weight: 87 },
  { symbol: 'PANW', name: 'Palo Alto Networks', weight: 85 },
  { symbol: 'CI', name: 'Cigna', weight: 84 },
  { symbol: 'SO', name: 'Southern Company', weight: 82 },
  { symbol: 'DUK', name: 'Duke Energy', weight: 80 },
  { symbol: 'COP', name: 'ConocoPhillips', weight: 80 },
  { symbol: 'FDX', name: 'FedEx', weight: 78 },
  { symbol: 'SNAP', name: 'Snap', weight: 75 },
  { symbol: 'COIN', name: 'Coinbase', weight: 73 },
  { symbol: 'SHOP', name: 'Shopify', weight: 72 },
  { symbol: 'SQ', name: 'Block', weight: 70 },
  { symbol: 'ABNB', name: 'Airbnb', weight: 70 },
  { symbol: 'SNOW', name: 'Snowflake', weight: 68 },
  { symbol: 'CRWD', name: 'CrowdStrike', weight: 68 },
  { symbol: 'RIVN', name: 'Rivian', weight: 65 },
  { symbol: 'F', name: 'Ford', weight: 62 },
  { symbol: 'GM', name: 'General Motors', weight: 60 },
  { symbol: 'DELL', name: 'Dell', weight: 58 },
  { symbol: 'SPOT', name: 'Spotify', weight: 55 },
  { symbol: 'DDOG', name: 'Datadog', weight: 52 },
  { symbol: 'NET', name: 'Cloudflare', weight: 50 },
  { symbol: 'ZS', name: 'Zscaler', weight: 48 },
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
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Close fullscreen on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className={cn(
      isFullscreen && 'fixed inset-0 z-50 bg-background p-4 overflow-auto'
    )}>
    <Card className={cn(isFullscreen && 'h-full flex flex-col')}>
      <CardHeader className={cn(isFullscreen && 'shrink-0')}>
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
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(isFullscreen && 'flex-1 flex flex-col min-h-0')}>
        {isLoading && stocks.length === 0 ? (
          <Skeleton className={cn('w-full', isFullscreen ? 'flex-1' : 'aspect-[16/9]')} />
        ) : (
          <TooltipProvider delayDuration={100}>
           <div className={cn(isFullscreen && 'flex flex-col h-full')}>
            <div className={cn(
              'relative w-full rounded-lg overflow-hidden border border-border',
              isFullscreen ? 'flex-1 min-h-0' : 'aspect-[16/9]'
            )}>
              {treemapRects.map((rect) => {
                const { item } = rect;
                const minDim = Math.min(rect.w, rect.h);
                const area = rect.w * rect.h;

                // Tiered display based on tile size
                const isLarge = minDim > 10 && area > 150;
                const isMedium = minDim > 6 && area > 50;
                const isSmall = minDim > 3.5 && area > 15;
                const isTiny = !isSmall;

                return (
                  <Tooltip key={item.symbol}>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          'absolute flex flex-col items-center justify-center overflow-hidden transition-opacity hover:opacity-80 cursor-pointer border-[0.5px] border-black/20',
                          isLarge ? 'gap-0.5' : 'gap-0',
                          getHeatmapBg(item.changePercent),
                          getHeatmapTextColor(item.changePercent)
                        )}
                        style={{
                          left: `${rect.x}%`,
                          top: `${rect.y}%`,
                          width: `${rect.w}%`,
                          height: `${rect.h}%`,
                          padding: isTiny ? '1px' : '2px',
                        }}
                        onClick={() => router.push(`/analysis?symbol=${item.symbol}`)}
                      >
                        {/* Large tiles: logo + symbol + percent + name */}
                        {isLarge && (
                          <>
                            <AssetLogo
                              symbol={item.symbol}
                              name={item.name}
                              assetType="stock"
                              size={minDim > 14 ? 'lg' : 'md'}
                              className="mb-0.5"
                            />
                            <span className={cn('font-bold leading-tight', minDim > 14 ? 'text-base' : 'text-sm')}>
                              {item.symbol}
                            </span>
                            <span className="text-sm font-semibold leading-tight">
                              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </span>
                            {minDim > 12 && area > 250 && (
                              <span className="text-[10px] opacity-80 leading-tight truncate max-w-[95%]">
                                {item.name}
                              </span>
                            )}
                          </>
                        )}
                        {/* Medium tiles: logo + symbol + percent */}
                        {!isLarge && isMedium && (
                          <>
                            <AssetLogo
                              symbol={item.symbol}
                              name={item.name}
                              assetType="stock"
                              size="sm"
                            />
                            <span className="text-xs font-bold leading-none mt-0.5">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] font-semibold leading-none">
                              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </span>
                          </>
                        )}
                        {/* Small tiles: symbol + percent only */}
                        {!isLarge && !isMedium && isSmall && (
                          <>
                            <span className="text-[10px] font-bold leading-none">
                              {item.symbol}
                            </span>
                            <span className="text-[9px] font-semibold leading-none">
                              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                            </span>
                          </>
                        )}
                        {/* Tiny tiles: just colored box, info on hover */}
                        {isTiny && minDim > 2 && (
                          <span className="text-[7px] font-bold leading-none truncate max-w-full">
                            {item.symbol.length <= 3 ? item.symbol : ''}
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
           </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
