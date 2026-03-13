'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Newspaper,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Flame,
  AlertTriangle,
  Building2,
  Globe,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fetchWithApiKeys } from '@/lib/api/apiKeys';
import Link from 'next/link';

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  category: 'earnings' | 'fed' | 'economy' | 'geopolitics' | 'sector' | 'company';
  relatedSymbols?: string[];
}

export function MarketNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresSetup, setRequiresSetup] = useState(false);

  const fetchNews = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      // Use fetchWithApiKeys to include News API key from localStorage
      const response = await fetchWithApiKeys('/api/news?limit=6&category=market');
      const data = await response.json();

      if (!data.success) {
        if (data.requiresSetup) {
          setRequiresSetup(true);
          setError(data.error);
        } else {
          setError(data.error || 'Failed to fetch news');
        }
        setNews([]);
        return;
      }

      if (data.data && data.data.length > 0) {
        const transformedNews: NewsItem[] = data.data.slice(0, 6).map((item: any, index: number) => ({
          id: item.id || index.toString(),
          title: item.title,
          source: item.source || 'News',
          url: item.url,
          publishedAt: new Date(item.publishedAt),
          sentiment: item.sentiment || 'neutral',
          impact: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
          category: getCategory(item.title),
          relatedSymbols: item.relevantSymbols || [],
        }));
        setNews(transformedNews);
        setRequiresSetup(false);
      } else {
        setNews([]);
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('Failed to connect to news service');
      setNews([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(() => fetchNews(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getCategory = (title: string): NewsItem['category'] => {
    const lower = title.toLowerCase();
    if (lower.includes('fed') || lower.includes('rate') || lower.includes('powell')) return 'fed';
    if (lower.includes('earnings') || lower.includes('quarterly') || lower.includes('profit')) return 'earnings';
    if (lower.includes('gdp') || lower.includes('inflation') || lower.includes('jobs') || lower.includes('employment')) return 'economy';
    if (lower.includes('china') || lower.includes('war') || lower.includes('tariff') || lower.includes('sanctions')) return 'geopolitics';
    if (lower.includes('tech') || lower.includes('energy') || lower.includes('bank')) return 'sector';
    return 'company';
  };

  const getCategoryIcon = (category: NewsItem['category']) => {
    switch (category) {
      case 'fed':
        return <Building2 className="h-3.5 w-3.5" />;
      case 'earnings':
        return <TrendingUp className="h-3.5 w-3.5" />;
      case 'economy':
        return <Globe className="h-3.5 w-3.5" />;
      case 'geopolitics':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      default:
        return <Newspaper className="h-3.5 w-3.5" />;
    }
  };

  const getImpactBadge = (impact: NewsItem['impact']) => {
    const config = {
      high: { label: 'High Impact', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
      medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
      low: { label: 'Low', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
    };
    return config[impact];
  };

  const getSentimentIndicator = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-2 py-1.5">
                <Skeleton className="h-4 w-4 shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requiresSetup || error) {
    return (
      <Card>
        <CardHeader className="pb-1.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Market News
            </CardTitle>
            {!requiresSetup && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => fetchNews(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Alert className="py-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertDescription className="flex flex-col gap-1.5 text-xs">
              <span>{error || 'News API not configured'}</span>
              {requiresSetup && (
                <Button variant="outline" size="sm" asChild className="w-fit h-6 text-xs">
                  <Link href="/settings">
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (news.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-1.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 min-w-0">
              <Flame className="h-4 w-4 text-orange-500 shrink-0" />
              Market News
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => fetchNews(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground text-center py-2">
            No news available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-1.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 min-w-0">
            <Flame className="h-4 w-4 text-orange-500 shrink-0" />
            Market News
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fetchNews(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-0.5">
          {news.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-2 py-1.5 px-1 rounded transition-colors hover:bg-muted/50 border-b border-border/50 last:border-0"
            >
              <div className="mt-0.5 shrink-0">
                {getSentimentIndicator(item.sentiment) || (
                  <div className="h-4 w-4 rounded-full bg-muted" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {item.source}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(item.publishedAt, { addSuffix: true })}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
