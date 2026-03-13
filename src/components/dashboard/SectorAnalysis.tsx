'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  PieChart as PieChartIcon,
  Globe,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { usePortfolioStore } from '@/store/portfolioStore';
import { cn } from '@/lib/utils';

interface AllocationItem {
  name: string;
  weight: number;
}

interface PositionData {
  symbol: string;
  value: number;
  weight: number;
  sector: string;
  industry: string;
  country: string;
}

interface AllocationData {
  totalValue: number;
  sectors: AllocationItem[];
  industries: AllocationItem[];
  countries: AllocationItem[];
  positions: PositionData[];
}

interface CorrelationData {
  symbols: string[];
  matrix: Record<string, Record<string, number>>;
  averageCorrelation: number;
  diversificationScore: number;
}

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3b82f6',
  'Financial Services': '#10b981',
  Healthcare: '#ef4444',
  'Consumer Cyclical': '#f59e0b',
  'Consumer Defensive': '#8b5cf6',
  'Communication Services': '#ec4899',
  Industrials: '#6366f1',
  Energy: '#f97316',
  Utilities: '#14b8a6',
  'Real Estate': '#84cc16',
  'Basic Materials': '#a855f7',
  ETF: '#0ea5e9',
  Cryptocurrency: '#eab308',
  Other: '#6b7280',
};

const COUNTRY_COLORS: Record<string, string> = {
  'United States': '#3b82f6',
  China: '#ef4444',
  Japan: '#f59e0b',
  'United Kingdom': '#10b981',
  Germany: '#8b5cf6',
  Canada: '#ec4899',
  Switzerland: '#6366f1',
  Taiwan: '#f97316',
  Netherlands: '#14b8a6',
  Denmark: '#84cc16',
  International: '#0ea5e9',
  'Emerging Markets': '#a855f7',
  Decentralized: '#eab308',
  Unknown: '#6b7280',
};

export function SectorAnalysis() {
  const [allocation, setAllocation] = useState<AllocationData | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sectors');

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const positions = portfolio?.positions || [];

  useEffect(() => {
    const fetchData = async () => {
      if (positions.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const symbols = positions.map((p) => p.symbol).join(',');
        const values = positions.map((p) => p.currentPrice * p.quantity).join(',');

        // Get FMP API key from localStorage
        const savedKeys = localStorage.getItem('investai-api-keys');
        const fmpKey = savedKeys ? JSON.parse(savedKeys).fmp : '';
        const headers: Record<string, string> = fmpKey ? { 'x-fmp-key': fmpKey } : {};

        // Fetch allocation data
        const allocResponse = await fetch(
          `/api/sectors?action=allocation&symbols=${symbols}&values=${values}`,
          { headers }
        );
        const allocData = await allocResponse.json();
        if (allocData.success) {
          setAllocation(allocData.data);
        }

        // Fetch correlation data
        const corrResponse = await fetch(`/api/sectors?action=correlation&symbols=${symbols}`, { headers });
        const corrData = await corrResponse.json();
        if (corrData.success) {
          setCorrelation(corrData.data);
        }
      } catch (error) {
        console.error('Failed to fetch sector data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [positions.map((p) => `${p.symbol}:${p.quantity}:${p.currentPrice}`).join(',')]);

  // Prepare chart data
  const sectorChartData = useMemo(() => {
    if (!allocation) return [];
    return allocation.sectors.map((s) => ({
      name: s.name,
      value: s.weight,
      color: SECTOR_COLORS[s.name] || SECTOR_COLORS.Other,
    }));
  }, [allocation]);

  const countryChartData = useMemo(() => {
    if (!allocation) return [];
    return allocation.countries.map((c) => ({
      name: c.name,
      value: c.weight,
      color: COUNTRY_COLORS[c.name] || COUNTRY_COLORS.Unknown,
    }));
  }, [allocation]);

  // Check for concentration warnings
  const concentrationWarnings = useMemo(() => {
    if (!allocation) return [];
    const warnings: string[] = [];

    // Check sector concentration
    const topSector = allocation.sectors[0];
    if (topSector && topSector.weight > 40) {
      warnings.push(`Heavy ${topSector.name} exposure (${topSector.weight.toFixed(0)}%)`);
    }

    // Check single stock concentration
    const topPosition = allocation.positions.sort((a, b) => b.weight - a.weight)[0];
    if (topPosition && topPosition.weight > 25) {
      warnings.push(`${topPosition.symbol} is ${topPosition.weight.toFixed(0)}% of portfolio`);
    }

    // Check geographic concentration
    const usWeight = allocation.countries.find((c) => c.name === 'United States')?.weight || 0;
    if (usWeight > 80 && allocation.countries.length > 1) {
      warnings.push('Low international diversification');
    }

    return warnings;
  }, [allocation]);

  if (isLoading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Sector & Correlation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Sector & Correlation Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <PieChartIcon className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Add positions to see sector analysis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Sector & Correlation Analysis
          </CardTitle>
          {correlation && (
            <Badge
              variant={correlation.diversificationScore >= 50 ? 'default' : 'destructive'}
              className="text-xs"
            >
              Diversification: {correlation.diversificationScore}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Warnings */}
        {concentrationWarnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-500">Concentration Alerts</span>
            </div>
            <ul className="space-y-1">
              {concentrationWarnings.map((warning, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  • {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="sectors" className="text-xs">
              <PieChartIcon className="h-3 w-3 mr-1" />
              Sectors
            </TabsTrigger>
            <TabsTrigger value="correlation" className="text-xs">
              <GitBranch className="h-3 w-3 mr-1" />
              Correlation
            </TabsTrigger>
            <TabsTrigger value="geographic" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              Geographic
            </TabsTrigger>
          </TabsList>

          {/* Sector Allocation Tab */}
          <TabsContent value="sectors" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {sectorChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Weight']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Sector List */}
              <div className="space-y-2">
                {allocation?.sectors.slice(0, 6).map((sector) => (
                  <div key={sector.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: SECTOR_COLORS[sector.name] || SECTOR_COLORS.Other,
                      }}
                    />
                    <span className="text-sm flex-1 truncate">{sector.name}</span>
                    <span className="text-sm font-medium">{sector.weight.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Industry Breakdown */}
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Top Industries</p>
              <div className="space-y-2">
                {allocation?.industries.slice(0, 4).map((industry) => (
                  <div key={industry.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate">{industry.name}</span>
                      <span className="font-medium">{industry.weight.toFixed(1)}%</span>
                    </div>
                    <Progress value={industry.weight} className="h-1" />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Correlation Matrix Tab */}
          <TabsContent value="correlation" className="space-y-4">
            {correlation && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Avg Correlation</p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        correlation.averageCorrelation > 0.7
                          ? 'text-red-500'
                          : correlation.averageCorrelation > 0.4
                            ? 'text-amber-500'
                            : 'text-green-500'
                      )}
                    >
                      {correlation.averageCorrelation.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Diversification</p>
                    <p
                      className={cn(
                        'text-xl font-bold',
                        correlation.diversificationScore >= 50 ? 'text-green-500' : 'text-amber-500'
                      )}
                    >
                      {correlation.diversificationScore}%
                    </p>
                  </div>
                </div>

                {/* Correlation Heatmap */}
                <div className="overflow-x-auto">
                  <div className="min-w-fit">
                    {/* Header row */}
                    <div className="flex">
                      <div className="w-16 h-8" /> {/* Empty corner */}
                      {correlation.symbols.slice(0, 8).map((sym) => (
                        <div
                          key={sym}
                          className="w-12 h-8 flex items-center justify-center text-[10px] font-medium"
                        >
                          {sym}
                        </div>
                      ))}
                    </div>

                    {/* Data rows */}
                    {correlation.symbols.slice(0, 8).map((sym1) => (
                      <div key={sym1} className="flex">
                        <div className="w-16 h-10 flex items-center text-[10px] font-medium truncate pr-1">
                          {sym1}
                        </div>
                        {correlation.symbols.slice(0, 8).map((sym2) => {
                          const value = correlation.matrix[sym1]?.[sym2] ?? 0;
                          const bgColor = getCorrelationColor(value);
                          return (
                            <div
                              key={`${sym1}-${sym2}`}
                              className="w-12 h-10 flex items-center justify-center text-[10px] font-medium rounded-sm m-0.5"
                              style={{ backgroundColor: bgColor }}
                              title={`${sym1} vs ${sym2}: ${value.toFixed(2)}`}
                            >
                              {value.toFixed(1)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
                    <span>Low (&lt;0.3)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} />
                    <span>Medium (0.3-0.7)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }} />
                    <span>High (&gt;0.7)</span>
                  </div>
                </div>

                {/* Interpretation */}
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">What this means:</p>
                      {correlation.averageCorrelation > 0.6 ? (
                        <p>
                          Your holdings tend to move together. Consider adding uncorrelated assets
                          like bonds or international stocks for better diversification.
                        </p>
                      ) : correlation.averageCorrelation > 0.3 ? (
                        <p>
                          Good diversification! Your assets have moderate correlation, providing
                          some protection during market swings.
                        </p>
                      ) : (
                        <p>
                          Excellent diversification! Your portfolio has low correlation between
                          assets, which helps reduce overall risk.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Geographic Tab */}
          <TabsContent value="geographic" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={countryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {countryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Weight']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Country List */}
              <div className="space-y-2">
                {allocation?.countries.map((country) => (
                  <div key={country.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: COUNTRY_COLORS[country.name] || COUNTRY_COLORS.Unknown,
                      }}
                    />
                    <span className="text-sm flex-1 truncate">{country.name}</span>
                    <span className="text-sm font-medium">{country.weight.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Geographic Analysis */}
            <div className="pt-3 border-t space-y-3">
              {/* US Exposure Check */}
              {(() => {
                const usWeight =
                  allocation?.countries.find((c) => c.name === 'United States')?.weight || 0;
                const internationalWeight = 100 - usWeight;
                const cryptoWeight =
                  allocation?.countries.find((c) => c.name === 'Decentralized')?.weight || 0;

                return (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>US Exposure</span>
                        <span className="font-medium">{usWeight.toFixed(1)}%</span>
                      </div>
                      <Progress
                        value={usWeight}
                        className={cn('h-2', usWeight > 80 ? 'bg-amber-100' : '')}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>International Exposure</span>
                        <span className="font-medium">
                          {(internationalWeight - cryptoWeight).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={internationalWeight - cryptoWeight} className="h-2" />
                    </div>

                    {/* Recommendation */}
                    <div
                      className={cn(
                        'p-3 rounded-lg border',
                        usWeight > 80
                          ? 'bg-amber-500/10 border-amber-500/20'
                          : 'bg-green-500/10 border-green-500/20'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {usWeight > 80 ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        )}
                        <div className="text-xs">
                          {usWeight > 80 ? (
                            <p>
                              <span className="font-medium text-amber-500">Low diversification:</span>{' '}
                              Consider adding international ETFs (VEA, VWO, EFA) for geographic
                              diversification.
                            </p>
                          ) : (
                            <p>
                              <span className="font-medium text-green-500">Good exposure:</span> Your
                              portfolio has international diversification, reducing single-country
                              risk.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Helper function for correlation heatmap colors
function getCorrelationColor(value: number): string {
  if (value >= 0.9) return '#dc2626'; // Red for very high
  if (value >= 0.7) return '#ef4444'; // Light red
  if (value >= 0.5) return '#f97316'; // Orange
  if (value >= 0.3) return '#eab308'; // Yellow
  if (value >= 0) return '#22c55e'; // Green for low positive
  if (value >= -0.3) return '#14b8a6'; // Teal for slight negative
  return '#3b82f6'; // Blue for negative (good diversification)
}
