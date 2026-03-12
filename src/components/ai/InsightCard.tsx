'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Newspaper,
  ExternalLink,
  MessageSquare,
  Brain,
  Target,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Zap,
} from 'lucide-react';
import type { AISignal } from '@/types';
import { cn } from '@/lib/utils';

interface InsightCardProps {
  signal: AISignal;
}

interface AnalysisSection {
  summary?: string;
  valuation?: string;
  growth?: string;
  risks?: string;
  technicals?: string;
  catalyst?: string;
}

export function InsightCard({ signal }: InsightCardProps) {
  // Check if we have structured analysis
  const analysis = (signal as any).analysis as AnalysisSection | undefined;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Structured AI Analysis */}
        {analysis ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-5 w-5 text-primary" />
              <p className="text-base font-semibold">AI Analysis</p>
            </div>

            {/* Executive Summary */}
            {analysis.summary && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium">{analysis.summary}</p>
              </div>
            )}

            {/* Analysis Sections */}
            <div className="grid gap-3">
              {analysis.valuation && (
                <div className="flex gap-3">
                  <Target className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-500 mb-1">Valuation</p>
                    <p className="text-sm text-muted-foreground">{analysis.valuation}</p>
                  </div>
                </div>
              )}

              {analysis.growth && (
                <div className="flex gap-3">
                  <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-green-500 mb-1">Growth & Earnings</p>
                    <p className="text-sm text-muted-foreground">{analysis.growth}</p>
                  </div>
                </div>
              )}

              {analysis.risks && (
                <div className="flex gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-500 mb-1">Risk Factors</p>
                    <p className="text-sm text-muted-foreground">{analysis.risks}</p>
                  </div>
                </div>
              )}

              {analysis.technicals && (
                <div className="flex gap-3">
                  <BarChart3 className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-purple-500 mb-1">Technical Setup</p>
                    <p className="text-sm text-muted-foreground">{analysis.technicals}</p>
                  </div>
                </div>
              )}

              {analysis.catalyst && (
                <div className="flex gap-3">
                  <Zap className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-500 mb-1">Catalyst</p>
                    <p className="text-sm text-muted-foreground">{analysis.catalyst}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Brief Conclusion */}
            {signal.reasoning && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium">{signal.reasoning}</p>
              </div>
            )}
          </div>
        ) : (
          /* Fallback: Original unstructured analysis */
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">AI Analysis</p>
            </div>
            <p className="text-sm text-muted-foreground">{signal.reasoning}</p>
          </div>
        )}

        {/* News Summary */}
        {signal.newsSummary && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Newspaper className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground font-medium">News Sentiment</p>
            </div>
            <p className="text-sm text-muted-foreground">{signal.newsSummary}</p>
          </div>
        )}

        {/* Related News */}
        {signal.relatedNews && signal.relatedNews.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground font-medium">Latest News</p>
              </div>
              <span className="text-[10px] text-muted-foreground">Most recent first</span>
            </div>
            <div className="space-y-2">
              {signal.relatedNews.slice(0, 5).map((news, index) => (
                <a
                  key={index}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {news.title}
                    </p>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{news.source}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(news.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0',
                        news.sentiment === 'bullish' && 'text-green-500 border-green-500/30',
                        news.sentiment === 'bearish' && 'text-red-500 border-red-500/30',
                        news.sentiment === 'neutral' && 'text-muted-foreground'
                      )}
                    >
                      {news.sentiment}
                    </Badge>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
