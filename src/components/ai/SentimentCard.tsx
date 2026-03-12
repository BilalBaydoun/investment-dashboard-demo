'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Newspaper } from 'lucide-react';
import type { SentimentAnalysis } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SentimentCardProps {
  sentiment: SentimentAnalysis;
}

const sentimentConfig = {
  bullish: { label: 'Bullish', color: 'text-green-500', bgColor: 'bg-green-500/10', Icon: TrendingUp },
  bearish: { label: 'Bearish', color: 'text-red-500', bgColor: 'bg-red-500/10', Icon: TrendingDown },
  neutral: { label: 'Neutral', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', Icon: Minus },
};

export function SentimentCard({ sentiment }: SentimentCardProps) {
  const config = sentimentConfig[sentiment.overallSentiment];
  const SentimentIcon = config.Icon;

  // Calculate sentiment bar position (-100 to +100 mapped to 0-100%)
  const barPosition = ((sentiment.sentimentScore + 100) / 200) * 100;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            {sentiment.symbol} Sentiment
          </CardTitle>
          <Badge className={cn(config.bgColor, config.color)} variant="outline">
            <SentimentIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sentiment Score Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-red-500">Bearish</span>
            <span className={cn('font-semibold', config.color)}>
              {sentiment.sentimentScore > 0 ? '+' : ''}{sentiment.sentimentScore}
            </span>
            <span className="text-green-500">Bullish</span>
          </div>
          <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-gray-800 shadow-lg"
              style={{ left: `calc(${barPosition}% - 8px)` }}
            />
          </div>
        </div>

        {/* News Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-green-500/10">
            <p className="text-xs text-muted-foreground">Positive</p>
            <p className="text-lg font-semibold text-green-500">{sentiment.positiveCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <p className="text-xs text-muted-foreground">Neutral</p>
            <p className="text-lg font-semibold text-yellow-500">{sentiment.neutralCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10">
            <p className="text-xs text-muted-foreground">Negative</p>
            <p className="text-lg font-semibold text-red-500">{sentiment.negativeCount}</p>
          </div>
        </div>

        {/* Key Topics */}
        {sentiment.keyTopics.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Key Topics</p>
            <div className="flex flex-wrap gap-1">
              {sentiment.keyTopics.map((topic, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent Headlines */}
        {sentiment.recentHeadlines.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Recent Headlines</p>
            <div className="space-y-2">
              {sentiment.recentHeadlines.slice(0, 3).map((news) => (
                <a
                  key={news.id}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm line-clamp-2">{news.title}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 text-xs',
                        sentimentConfig[news.sentiment].color
                      )}
                    >
                      {news.sentiment}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {news.source} • {format(new Date(news.publishedAt), 'MMM d, h:mm a')}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground text-right">
          Updated {format(new Date(sentiment.updatedAt), 'MMM d, h:mm a')}
        </p>
      </CardContent>
    </Card>
  );
}
