'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LayoutGrid, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SectorData {
  name: string;
  symbol: string;
  change: number;
  price: number;
  volume?: number;
}

const SECTOR_ETFS: Record<string, { symbol: string; name: string }> = {
  Technology: { symbol: 'XLK', name: 'Technology Select Sector' },
  Healthcare: { symbol: 'XLV', name: 'Health Care Select Sector' },
  Financials: { symbol: 'XLF', name: 'Financial Select Sector' },
  'Consumer Disc.': { symbol: 'XLY', name: 'Consumer Discretionary' },
  Communication: { symbol: 'XLC', name: 'Communication Services' },
  Industrials: { symbol: 'XLI', name: 'Industrial Select Sector' },
  'Consumer Staples': { symbol: 'XLP', name: 'Consumer Staples' },
  Energy: { symbol: 'XLE', name: 'Energy Select Sector' },
  Utilities: { symbol: 'XLU', name: 'Utilities Select Sector' },
  'Real Estate': { symbol: 'XLRE', name: 'Real Estate Select Sector' },
  Materials: { symbol: 'XLB', name: 'Materials Select Sector' },
};

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'ytd', label: 'YTD' },
];

function getHeatmapColor(change: number): string {
  if (change >= 3) return 'bg-green-600';
  if (change >= 2) return 'bg-green-500';
  if (change >= 1) return 'bg-green-400';
  if (change >= 0.5) return 'bg-green-300';
  if (change >= 0) return 'bg-green-200';
  if (change >= -0.5) return 'bg-red-200';
  if (change >= -1) return 'bg-red-300';
  if (change >= -2) return 'bg-red-400';
  if (change >= -3) return 'bg-red-500';
  return 'bg-red-600';
}

function getTextColor(change: number): string {
  const absChange = Math.abs(change);
  if (absChange >= 2) return 'text-white';
  return 'text-foreground';
}

export function SectorHeatmap() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState('day');

  const fetchSectorData = async () => {
    setIsLoading(true);

    try {
      const symbols = Object.entries(SECTOR_ETFS).map(([_, etf]) => etf.symbol);
      const response = await fetch(`/api/stocks?symbols=${symbols.join(',')}&action=quotes`);
      const data = await response.json();

      if (data.success && data.data) {
        const sectorData: SectorData[] = [];

        Object.entries(SECTOR_ETFS).forEach(([name, etf]) => {
          const quote = data.data[etf.symbol];
          if (quote) {
            sectorData.push({
              name,
              symbol: etf.symbol,
              change: quote.changePercent || 0,
              price: quote.price || 0,
              volume: quote.volume,
            });
          }
        });

        // Sort by performance (best to worst)
        sectorData.sort((a, b) => b.change - a.change);
        setSectors(sectorData);
      }
    } catch (error) {
      console.error('Sector data error:', error);
      toast.error('Failed to fetch sector data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSectorData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSectorData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [period]);

  const bestSector = sectors.length > 0 ? sectors[0] : null;
  const worstSector = sectors.length > 0 ? sectors[sectors.length - 1] : null;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Sector Heatmap
          </span>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={fetchSectorData} disabled={isLoading}>
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
        {isLoading && sectors.length === 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {[...Array(11)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <TooltipProvider>
            {/* Summary */}
            <div className="flex gap-4 mb-4 text-sm">
              {bestSector && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Best:</span>
                  <span className="font-medium text-green-500">
                    {bestSector.name} (+{bestSector.change.toFixed(2)}%)
                  </span>
                </div>
              )}
              {worstSector && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Worst:</span>
                  <span className="font-medium text-red-500">
                    {worstSector.name} ({worstSector.change.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Heatmap Grid */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {sectors.map((sector) => (
                <Tooltip key={sector.symbol}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'p-3 rounded-lg cursor-pointer transition-transform hover:scale-105',
                        getHeatmapColor(sector.change),
                        getTextColor(sector.change)
                      )}
                    >
                      <p className="font-medium text-sm truncate">{sector.name}</p>
                      <p className="text-lg font-bold">
                        {sector.change >= 0 ? '+' : ''}
                        {sector.change.toFixed(2)}%
                      </p>
                      <p className="text-xs opacity-80">{sector.symbol}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-medium">{SECTOR_ETFS[sector.name]?.name || sector.name}</p>
                      <p>Price: ${sector.price.toFixed(2)}</p>
                      <p>Change: {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%</p>
                      {sector.volume && (
                        <p>Volume: {(sector.volume / 1e6).toFixed(2)}M</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t flex items-center justify-center gap-1 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-red-600"></div>
                <span>-3%</span>
              </div>
              <div className="w-8 h-1 bg-gradient-to-r from-red-500 via-gray-300 to-green-500 rounded"></div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-green-600"></div>
                <span>+3%</span>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
