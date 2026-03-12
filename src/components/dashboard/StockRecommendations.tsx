'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  BarChart3,
  AlertTriangle,
  Search,
  Filter,
  Gem,
  Building2,
  ChevronLeft,
  Calendar,
  Zap,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '@/lib/api/stocks';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { type WeeklyScoredStock, type WeeklyAnalysisData } from '@/lib/weeklyData';

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Basic Materials',
  'Real Estate',
  'Utilities',
  'Communication Services',
];

export function StockRecommendations() {
  const [data, setData] = useState<WeeklyAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState('topPicks');
  const [sector, setSector] = useState('');
  const [sortBy, setSortBy] = useState('buyScore');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // UI state
  const [selectedStock, setSelectedStock] = useState<WeeklyScoredStock | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/weekly-data');
        const result = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || 'Weekly analysis not available yet');
        }
      } catch {
        setError('Failed to load weekly analysis');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get current stock list based on active tab
  const currentStocks = useMemo(() => {
    if (!data) return [];
    switch (activeTab) {
      case 'topPicks': return data.topPicks || [];
      case 'hiddenGems': return data.hiddenGems || [];
      case 'all': return data.allAnalyzed || [];
      default: return data.topPicks || [];
    }
  }, [data, activeTab]);

  // Filter and search
  const filteredStocks = useMemo(() => {
    let stocks = [...currentStocks];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      stocks = stocks.filter(s =>
        s.symbol.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query)
      );
    }

    // Sector filter
    if (sector) {
      stocks = stocks.filter(s => s.sector === sector);
    }

    // Sort
    stocks.sort((a, b) => {
      switch (sortBy) {
        case 'buyScore': return b.buyScore - a.buyScore;
        case 'upside': return b.upside - a.upside;
        case 'price': return a.currentPrice - b.currentPrice;
        case 'marketCap': return b.marketCap - a.marketCap;
        default: return b.buyScore - a.buyScore;
      }
    });

    return stocks;
  }, [currentStocks, searchQuery, sector, sortBy]);

  // Paginate
  const paginatedStocks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStocks.slice(start, start + pageSize);
  }, [filteredStocks, page]);

  const totalPages = Math.ceil(filteredStocks.length / pageSize);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeTab, sector, searchQuery, sortBy]);

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
    return `$${value.toFixed(0)}`;
  };

  const getBuyScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 65) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getRatingBadge = (rating: string) => {
    const styles: Record<string, string> = {
      strong_buy: 'bg-green-500/10 text-green-500 border-green-500/20',
      buy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      hold: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      sell: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    const labels: Record<string, string> = {
      strong_buy: 'Strong Buy',
      buy: 'Buy',
      hold: 'Hold',
      sell: 'Sell',
    };
    return (
      <Badge variant="outline" className={cn(styles[rating] || styles.hold)}>
        {labels[rating] || 'Hold'}
      </Badge>
    );
  };

  const getValuationBadge = (status: string) => {
    const styles: Record<string, string> = {
      undervalued: 'bg-green-500/10 text-green-500 border-green-500/20',
      fair: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      overvalued: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    const labels: Record<string, string> = {
      undervalued: 'Undervalued',
      fair: 'Fair Value',
      overvalued: 'Overvalued',
    };
    return (
      <Badge variant="outline" className={cn('text-xs', styles[status] || styles.fair)}>
        {labels[status] || 'Fair Value'}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const isStale = useMemo(() => {
    if (!data?.generatedAt) return true;
    const generated = new Date(data.generatedAt).getTime();
    const eightDays = 8 * 24 * 60 * 60 * 1000;
    return Date.now() - generated > eightDays;
  }, [data?.generatedAt]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Stock Picks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Sparkles className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading weekly analysis...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error / no data state
  if (error || !data || !data.generatedAt) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Stock Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Weekly Scanner Hasn't Run Yet</p>
            <p className="text-muted-foreground max-w-md">
              The AI scanner runs automatically every Sunday night via GitHub Actions.
              It analyzes thousands of stocks and picks the best opportunities.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              You can also trigger it manually from the GitHub Actions tab in your repository.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Stock Picks
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(data.generatedAt)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {data.totalTickersScanned.toLocaleString()} stocks scanned
                </span>
                {isStale && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Stale data
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 w-fit"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="topPicks" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Top Picks</span>
                <span className="sm:hidden">Top</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {data.topPicks?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="hiddenGems" className="gap-1.5">
                <Gem className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hidden Gems</span>
                <span className="sm:hidden">Gems</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {data.hiddenGems?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">All Analyzed</span>
                <span className="sm:hidden">All</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {data.allAnalyzed?.length || 0}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by symbol or company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sector */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Sector</Label>
                  <Select value={sector || 'all'} onValueChange={(v) => setSector(v === 'all' ? '' : v)}>
                    <SelectTrigger>
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Sectors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sectors</SelectItem>
                      {SECTORS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyScore">Buy Score (Highest)</SelectItem>
                      <SelectItem value="upside">Upside Potential</SelectItem>
                      <SelectItem value="price">Price (Lowest)</SelectItem>
                      <SelectItem value="marketCap">Market Cap (Largest)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Sector Breakdown */}
          {data.sectorBreakdown && Object.keys(data.sectorBreakdown).length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-1">Sectors:</span>
              {Object.entries(data.sectorBreakdown)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 6)
                .map(([sectorName, info]) => (
                  <Badge
                    key={sectorName}
                    variant="outline"
                    className={cn(
                      "cursor-pointer hover:bg-primary/10 text-xs",
                      sector === sectorName && "bg-primary/10 border-primary"
                    )}
                    onClick={() => setSector(sector === sectorName ? '' : sectorName)}
                  >
                    {sectorName}: {info.count}
                  </Badge>
                ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Results Table */}
        {filteredStocks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No stocks match your criteria</p>
            <p className="text-sm mt-1">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="hidden md:table-cell">Sector</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Target</TableHead>
                    <TableHead className="text-right">Upside</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Rating</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">Mkt Cap</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">P/E</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStocks.map((stock, index) => {
                    const rank = (page - 1) * pageSize + index + 1;
                    return (
                      <TableRow
                        key={stock.symbol}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedStock(stock)}
                      >
                        <TableCell>
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                            rank === 1 && "bg-yellow-500 text-yellow-950",
                            rank === 2 && "bg-gray-300 text-gray-700",
                            rank === 3 && "bg-amber-600 text-amber-50",
                            rank > 3 && "bg-muted text-muted-foreground"
                          )}>
                            {rank}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-bold">{stock.symbol}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {stock.name}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {stock.sector}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-medium">
                          {formatCurrency(stock.currentPrice)}
                        </TableCell>

                        <TableCell className="text-right hidden sm:table-cell">
                          <span className="font-medium text-primary">
                            {formatCurrency(stock.targetPrice)}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className={cn(
                            "font-bold",
                            stock.upside > 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {stock.upside > 0 ? '+' : ''}{stock.upside.toFixed(0)}%
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <span className={cn("font-bold text-lg", getBuyScoreColor(stock.buyScore))}>
                            {stock.buyScore}
                          </span>
                        </TableCell>

                        <TableCell className="text-center hidden lg:table-cell">
                          {getRatingBadge(stock.rating)}
                        </TableCell>

                        <TableCell className="text-right hidden xl:table-cell text-muted-foreground">
                          {formatMarketCap(stock.marketCap)}
                        </TableCell>

                        <TableCell className="text-right hidden xl:table-cell">
                          {stock.pe > 0 ? stock.pe.toFixed(1) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, filteredStocks.length)} of {filteredStocks.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {page}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Stock Detail Modal */}
        <Dialog open={!!selectedStock} onOpenChange={() => setSelectedStock(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedStock && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold">{selectedStock.symbol}</span>
                      {getRatingBadge(selectedStock.rating)}
                      {getValuationBadge(selectedStock.valuationStatus)}
                    </div>
                    <span className={cn("text-3xl font-bold", getBuyScoreColor(selectedStock.buyScore))}>
                      {selectedStock.buyScore}
                      <span className="text-sm text-muted-foreground font-normal ml-1">Score</span>
                    </span>
                  </DialogTitle>
                  <p className="text-muted-foreground">{selectedStock.name}</p>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                  {/* Price Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedStock.currentPrice)}</p>
                    </div>
                    <div className="text-center sm:border-x border-border">
                      <p className="text-sm text-muted-foreground">Target Price</p>
                      <p className="text-xl font-bold text-primary">
                        {formatCurrency(selectedStock.targetPrice)}
                      </p>
                    </div>
                    <div className="text-center col-span-2 sm:col-span-1">
                      <p className="text-sm text-muted-foreground">Upside</p>
                      <p className={cn(
                        "text-xl font-bold",
                        selectedStock.upside > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {selectedStock.upside > 0 ? '+' : ''}{selectedStock.upside.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Technical Score */}
                  {selectedStock.technicalScore !== null && selectedStock.technicalScore !== undefined && (
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <p className="text-sm text-muted-foreground">Technical Score</p>
                        <p className={cn(
                          "text-xl font-bold",
                          selectedStock.technicalScore > 0 ? "text-green-500" : selectedStock.technicalScore < 0 ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {selectedStock.technicalScore > 0 ? '+' : ''}{selectedStock.technicalScore.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-xl font-bold">{Math.round(selectedStock.confidence)}%</p>
                      </div>
                    </div>
                  )}

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">P/E Ratio</p>
                      <p className={cn("font-bold", selectedStock.pe > 0 && selectedStock.pe < 20 && "text-green-500")}>
                        {selectedStock.pe > 0 ? selectedStock.pe.toFixed(1) : 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">PEG Ratio</p>
                      <p className={cn("font-bold", selectedStock.pegRatio > 0 && selectedStock.pegRatio < 1.5 && "text-green-500")}>
                        {selectedStock.pegRatio > 0 ? selectedStock.pegRatio.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">P/B Ratio</p>
                      <p className={cn("font-bold", selectedStock.pbRatio > 0 && selectedStock.pbRatio < 2 && "text-green-500")}>
                        {selectedStock.pbRatio > 0 ? selectedStock.pbRatio.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">ROE</p>
                      <p className={cn("font-bold", selectedStock.roe > 15 && "text-green-500")}>
                        {selectedStock.roe > 0 ? `${selectedStock.roe.toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Profit Margin</p>
                      <p className={cn("font-bold", selectedStock.profitMargin > 15 && "text-green-500")}>
                        {selectedStock.profitMargin > 0 ? `${selectedStock.profitMargin.toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Dividend</p>
                      <p className={cn("font-bold", selectedStock.dividendYield > 2 && "text-green-500")}>
                        {selectedStock.dividendYield > 0 ? `${selectedStock.dividendYield.toFixed(1)}%` : 'None'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Market Cap</p>
                      <p className="font-bold">{formatMarketCap(selectedStock.marketCap)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Beta</p>
                      <p className={cn("font-bold", selectedStock.beta > 1.5 && "text-amber-500")}>
                        {selectedStock.beta > 0 ? selectedStock.beta.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* 52-Week Range Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-1">Sector</p>
                      <Badge variant="outline">{selectedStock.sector}</Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground mb-1">Industry</p>
                      <span className="text-sm">{selectedStock.industry}</span>
                    </div>
                  </div>

                  {/* Reasons to Consider */}
                  {selectedStock.reasonsToConsider && selectedStock.reasonsToConsider.length > 0 && (
                    <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-500 font-medium mb-3">
                        <Sparkles className="h-4 w-4" />
                        Why Consider This Stock
                      </div>
                      <ul className="space-y-2">
                        {selectedStock.reasonsToConsider.map((reason, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">+</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risks */}
                  {selectedStock.risks && selectedStock.risks.length > 0 && (
                    <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-2 text-red-500 font-medium mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        Key Risks
                      </div>
                      <ul className="space-y-2">
                        {selectedStock.risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">-</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        const params = new URLSearchParams({
                          symbol: selectedStock.symbol,
                          screenerScore: selectedStock.buyScore.toString(),
                          screenerRating: selectedStock.rating,
                          pe: selectedStock.pe.toString(),
                          dividendYield: selectedStock.dividendYield.toString(),
                        });
                        setSelectedStock(null);
                        router.push(`/analysis?${params}`);
                      }}
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Full Technical Analysis
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedStock(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-amber-500">Disclaimer:</span> AI stock picks
            are based on quantitative analysis and do not constitute financial advice. Past performance
            does not guarantee future results. Always do your own research before investing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
