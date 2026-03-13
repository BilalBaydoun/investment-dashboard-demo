'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Flame,
  Building2,
  Globe,
  AlertTriangle,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fetchWithApiKeys } from '@/lib/api/apiKeys';
import { usePortfolioStore } from '@/store/portfolioStore';

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  category: string;
  relatedSymbols: string[];
  tags: string[];
}

type NewsFilter = 'general' | 'portfolio';

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<NewsFilter>('general');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');

  const { getActivePortfolio } = usePortfolioStore();
  const portfolio = getActivePortfolio();
  const portfolioSymbols = portfolio?.positions.map(p => p.symbol) || [];

  // Build symbol → company name lookup from portfolio positions
  const symbolNames: Record<string, string> = {};
  portfolio?.positions.forEach(p => { symbolNames[p.symbol] = p.name; });

  const fetchNews = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetchWithApiKeys('/api/news?limit=50');
      const data = await response.json();

      if (data.success && data.data?.length > 0) {
        const transformedNews: NewsItem[] = data.data.map((item: any, index: number) => ({
          id: item.id || index.toString(),
          title: item.title,
          description: item.description || '',
          source: item.source || 'News',
          url: item.url,
          imageUrl: item.imageUrl,
          publishedAt: new Date(item.publishedAt),
          sentiment: item.sentiment || 'neutral',
          impact: index < 5 ? 'high' : index < 15 ? 'medium' : 'low',
          category: getCategory(item.title),
          relatedSymbols: item.relevantSymbols || [],
          tags: item.tags || [],
        }));
        setNews(transformedNews);
      } else {
        setNews([]);
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, []);

  const getCategory = (title: string): string => {
    const lower = title.toLowerCase();
    if (lower.includes('fed') || lower.includes('rate') || lower.includes('powell')) return 'Fed & Policy';
    if (lower.includes('earnings') || lower.includes('quarterly') || lower.includes('profit')) return 'Earnings';
    if (lower.includes('gdp') || lower.includes('inflation') || lower.includes('jobs') || lower.includes('employment')) return 'Economy';
    if (lower.includes('china') || lower.includes('war') || lower.includes('tariff') || lower.includes('sanctions')) return 'Geopolitics';
    if (lower.includes('tech') || lower.includes('energy') || lower.includes('bank')) return 'Sector';
    if (lower.includes('crypto') || lower.includes('bitcoin') || lower.includes('ethereum')) return 'Crypto';
    return 'Market';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Fed & Policy': return <Building2 className="h-3.5 w-3.5" />;
      case 'Earnings': return <TrendingUp className="h-3.5 w-3.5" />;
      case 'Economy': return <Globe className="h-3.5 w-3.5" />;
      case 'Geopolitics': return <AlertTriangle className="h-3.5 w-3.5" />;
      default: return <Newspaper className="h-3.5 w-3.5" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'bearish': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-muted-foreground bg-muted/50 border-border';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Apply portfolio / symbol filter (client-side)
  const portfolioFilteredNews = (() => {
    if (filter !== 'portfolio' || portfolioSymbols.length === 0) return news;

    // If a specific symbol is selected, filter to just that symbol
    if (selectedSymbol) {
      return news.filter(n =>
        n.relatedSymbols.some(s => s.toUpperCase() === selectedSymbol) ||
        n.title.toUpperCase().includes(selectedSymbol)
      );
    }

    // Otherwise show all portfolio-related news
    return news.filter(n =>
      n.relatedSymbols.some(s => portfolioSymbols.includes(s)) ||
      portfolioSymbols.some(ps => n.title.toUpperCase().includes(ps))
    );
  })();

  // Apply sentiment filter
  const filteredNews = sentimentFilter === 'all'
    ? portfolioFilteredNews
    : portfolioFilteredNews.filter(n => n.sentiment === sentimentFilter);

  // Count sentiments (based on portfolio-filtered news)
  const bullishCount = portfolioFilteredNews.filter(n => n.sentiment === 'bullish').length;
  const bearishCount = portfolioFilteredNews.filter(n => n.sentiment === 'bearish').length;
  const neutralCount = portfolioFilteredNews.filter(n => n.sentiment === 'neutral').length;

  return (
    <div className="min-h-screen">
      <Header title="News Feed" subtitle="Financial news and market updates" />

      <div className="p-3 md:p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* Source filter */}
          <div className="flex gap-2">
            <Button
              variant={filter === 'general' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilter('general'); setSelectedSymbol(null); }}
              className="gap-1.5"
            >
              <Globe className="h-3.5 w-3.5" />
              General News
            </Button>
            <Button
              variant={filter === 'portfolio' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('portfolio')}
              className="gap-1.5"
              disabled={portfolioSymbols.length === 0}
            >
              <Briefcase className="h-3.5 w-3.5" />
              My Portfolio
              {portfolioSymbols.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                  {portfolioSymbols.length}
                </Badge>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fetchNews(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>

          {/* Sentiment filter */}
          <div className="flex gap-1.5 overflow-x-auto">
            <Button
              variant={sentimentFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSentimentFilter('all')}
            >
              All ({portfolioFilteredNews.length})
            </Button>
            <Button
              variant={sentimentFilter === 'bullish' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7 text-green-500"
              onClick={() => setSentimentFilter('bullish')}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Bullish ({bullishCount})
            </Button>
            <Button
              variant={sentimentFilter === 'bearish' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7 text-red-500"
              onClick={() => setSentimentFilter('bearish')}
            >
              <TrendingDown className="h-3 w-3 mr-1" />
              Bearish ({bearishCount})
            </Button>
            <Button
              variant={sentimentFilter === 'neutral' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSentimentFilter('neutral')}
            >
              Neutral ({neutralCount})
            </Button>
          </div>
        </div>

        {/* Portfolio symbols indicator */}
        {filter === 'portfolio' && portfolioSymbols.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSymbol(null)}
              className={cn(
                "text-[10px] h-5 px-2 rounded-full border font-medium transition-colors",
                !selectedSymbol
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:bg-muted"
              )}
            >
              All
            </button>
            {portfolioSymbols.map(s => (
              <button
                key={s}
                onClick={() => setSelectedSymbol(selectedSymbol === s ? null : s)}
                className={cn(
                  "text-[10px] h-5 px-2 rounded-full border font-mono font-medium transition-colors",
                  selectedSymbol === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredNews.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Newspaper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === 'portfolio'
                  ? selectedSymbol
                    ? `No news found for ${selectedSymbol}`
                    : 'No news found for your portfolio positions'
                  : 'No news available at the moment'}
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchNews(true)}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* News grid */}
        {!isLoading && filteredNews.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredNews.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex gap-3">
                      {/* Sentiment indicator */}
                      <div className="mt-0.5 shrink-0">
                        {item.sentiment === 'bullish' ? (
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          </div>
                        ) : item.sentiment === 'bearish' ? (
                          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            {getCategoryIcon(item.category)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <h3 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>

                        {/* Description */}
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", getSentimentColor(item.sentiment))}>
                            {item.sentiment}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {item.category}
                          </Badge>
                          {item.impact === 'high' && (
                            <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", getImpactColor(item.impact))}>
                              <Flame className="h-2.5 w-2.5 mr-0.5" />
                              High Impact
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                            {item.source} · {formatDistanceToNow(item.publishedAt, { addSuffix: true })}
                          </span>
                        </div>

                        {/* Related companies */}
                        {item.relatedSymbols.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.relatedSymbols.slice(0, 5).map(s => (
                              <Badge key={s} variant="secondary" className="text-[10px] h-4 px-1.5">
                                <span className="font-mono font-semibold">{s}</span>
                                {symbolNames[s] && (
                                  <span className="ml-1 font-normal text-muted-foreground">{symbolNames[s]}</span>
                                )}
                              </Badge>
                            ))}
                            {item.relatedSymbols.length > 5 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{item.relatedSymbols.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
