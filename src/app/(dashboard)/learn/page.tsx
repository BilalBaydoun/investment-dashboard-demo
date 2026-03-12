'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Target,
  Shield,
  BookOpen,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlossaryTerm {
  term: string;
  shortDefinition: string;
  fullExplanation: string;
  example?: string;
  interpretation?: {
    bullish?: string;
    bearish?: string;
    neutral?: string;
  };
  category: 'indicator' | 'pattern' | 'fundamental' | 'general';
  relatedTerms?: string[];
}

const glossaryTerms: GlossaryTerm[] = [
  // Technical Indicators
  {
    term: 'RSI (Relative Strength Index)',
    shortDefinition: 'Measures if a stock is overbought or oversold on a scale of 0-100.',
    fullExplanation: 'RSI compares the magnitude of recent gains to recent losses to determine if a stock has been bought or sold too aggressively. It oscillates between 0 and 100. The standard period is 14 days.',
    example: 'If UBER has an RSI of 75, it means the stock has been heavily bought recently and might be due for a pullback.',
    interpretation: {
      bullish: 'RSI below 30 suggests the stock is oversold and may bounce back up.',
      bearish: 'RSI above 70 suggests the stock is overbought and may pull back.',
      neutral: 'RSI between 30-70 indicates normal trading conditions.',
    },
    category: 'indicator',
    relatedTerms: ['Overbought', 'Oversold', 'Momentum'],
  },
  {
    term: 'MACD (Moving Average Convergence Divergence)',
    shortDefinition: 'Shows the relationship between two moving averages to identify trend direction and momentum.',
    fullExplanation: 'MACD is calculated by subtracting the 26-period EMA from the 12-period EMA. A 9-period EMA called the "signal line" is then plotted on top. When MACD crosses above the signal line, it\'s a bullish signal; when it crosses below, it\'s bearish.',
    example: 'If MACD is -0.14 and the signal is -0.60, MACD is above the signal line, suggesting bullish momentum.',
    interpretation: {
      bullish: 'MACD crossing above signal line, or MACD moving from negative to positive.',
      bearish: 'MACD crossing below signal line, or MACD moving from positive to negative.',
      neutral: 'MACD and signal line moving together with little divergence.',
    },
    category: 'indicator',
    relatedTerms: ['EMA', 'Signal Line', 'Histogram', 'Crossover'],
  },
  {
    term: 'SMA (Simple Moving Average)',
    shortDefinition: 'The average price over a specific number of days, smoothing out price fluctuations.',
    fullExplanation: 'SMA is calculated by adding up closing prices for a period and dividing by the number of periods. Common periods are 20 (short-term), 50 (medium-term), and 200 (long-term) days. When price is above the SMA, the trend is generally up; below suggests a downtrend.',
    example: 'If UBER\'s price is $82 and SMA50 is $86, the stock is trading below its 50-day average, suggesting short-term weakness.',
    interpretation: {
      bullish: 'Price above SMA, or shorter SMA crossing above longer SMA (Golden Cross).',
      bearish: 'Price below SMA, or shorter SMA crossing below longer SMA (Death Cross).',
    },
    category: 'indicator',
    relatedTerms: ['EMA', 'Golden Cross', 'Death Cross', 'Moving Average'],
  },
  {
    term: 'EMA (Exponential Moving Average)',
    shortDefinition: 'Similar to SMA but gives more weight to recent prices, reacting faster to price changes.',
    fullExplanation: 'EMA applies more weight to the most recent prices, making it more responsive to new information than SMA. The 12-period and 26-period EMAs are commonly used in MACD calculations.',
    example: 'If EMA12 ($84.45) is below EMA26 ($84.59), short-term momentum is slightly weaker than medium-term.',
    interpretation: {
      bullish: 'Shorter EMA above longer EMA indicates upward momentum.',
      bearish: 'Shorter EMA below longer EMA indicates downward momentum.',
    },
    category: 'indicator',
    relatedTerms: ['SMA', 'MACD', 'Moving Average'],
  },
  {
    term: 'Bollinger Bands',
    shortDefinition: 'Three lines that show if a stock price is relatively high or low compared to recent trading.',
    fullExplanation: 'Bollinger Bands consist of a middle band (20-day SMA) and upper/lower bands that are 2 standard deviations away. When price touches the upper band, the stock may be overbought; touching the lower band suggests oversold. Bands widen during volatile periods and narrow during calm periods.',
    example: 'If UBER is at $82 with lower band at $78.41, the stock is near the lower band, potentially oversold.',
    interpretation: {
      bullish: 'Price bouncing off lower band, or bands starting to widen after narrowing.',
      bearish: 'Price rejected at upper band, or breaking below lower band.',
      neutral: 'Price moving within the bands without touching extremes.',
    },
    category: 'indicator',
    relatedTerms: ['Standard Deviation', 'Volatility', 'SMA'],
  },
  {
    term: 'ADX (Average Directional Index)',
    shortDefinition: 'Measures the strength of a trend, regardless of direction.',
    fullExplanation: 'ADX ranges from 0 to 100. It doesn\'t tell you if the trend is up or down, just how strong it is. Values below 20 indicate a weak trend or ranging market; above 25 suggests a strong trend; above 50 indicates a very strong trend.',
    example: 'An ADX of 16 for UBER means the trend is weak - the stock is likely moving sideways without clear direction.',
    interpretation: {
      bullish: 'Rising ADX with price going up indicates strengthening uptrend.',
      bearish: 'Rising ADX with price going down indicates strengthening downtrend.',
      neutral: 'ADX below 20 suggests no clear trend - the market is ranging.',
    },
    category: 'indicator',
    relatedTerms: ['Trend', 'DMI', 'Trend Strength'],
  },
  {
    term: 'Stochastic Oscillator',
    shortDefinition: 'Compares current price to its price range over a period to identify overbought/oversold levels.',
    fullExplanation: 'Stochastic shows where the current price is relative to the high-low range over a period (usually 14 days). It has two lines: %K (fast) and %D (slow signal). Values above 80 suggest overbought; below 20 suggests oversold.',
    example: 'Stochastic K at 0 means the stock is at the very bottom of its recent trading range - extremely oversold.',
    interpretation: {
      bullish: 'Stochastic below 20 (oversold) and %K crossing above %D.',
      bearish: 'Stochastic above 80 (overbought) and %K crossing below %D.',
      neutral: 'Stochastic between 20-80 with no clear crossover.',
    },
    category: 'indicator',
    relatedTerms: ['Overbought', 'Oversold', '%K', '%D'],
  },
  {
    term: 'ATR (Average True Range)',
    shortDefinition: 'Measures market volatility by calculating average price movement.',
    fullExplanation: 'ATR shows how much a stock typically moves in a day. Higher ATR means more volatility and larger price swings. It\'s useful for setting stop-loss levels - a stop-loss 2x ATR below entry gives room for normal fluctuations.',
    example: 'If UBER has ATR of $2.44, the stock typically moves about $2.44 per day. A stop-loss might be set 2x ATR ($4.88) below entry.',
    category: 'indicator',
    relatedTerms: ['Volatility', 'Stop Loss', 'True Range'],
  },
  // Trading Concepts
  {
    term: 'Support Level',
    shortDefinition: 'A price level where a stock tends to stop falling and bounce back up.',
    fullExplanation: 'Support is a price level where buying interest is strong enough to overcome selling pressure. When a stock approaches support, buyers tend to step in, preventing further decline. If support breaks, it often becomes resistance.',
    example: 'If UBER has support at $82.35, buyers historically step in around that price, making it a good potential entry point.',
    interpretation: {
      bullish: 'Price bouncing off support level suggests buyers are defending that price.',
      bearish: 'Price breaking below support suggests sellers have overwhelmed buyers.',
    },
    category: 'general',
    relatedTerms: ['Resistance', 'Breakout', 'Breakdown'],
  },
  {
    term: 'Resistance Level',
    shortDefinition: 'A price level where a stock tends to stop rising and pull back.',
    fullExplanation: 'Resistance is where selling pressure overcomes buying interest. Sellers tend to take profits at resistance, causing the price to stall or reverse. If resistance breaks, it often becomes support.',
    example: 'If UBER has resistance at $86.17, sellers historically appear around that price, making it harder to go higher.',
    interpretation: {
      bullish: 'Price breaking above resistance suggests strong buying momentum.',
      bearish: 'Price rejected at resistance suggests sellers are in control.',
    },
    category: 'general',
    relatedTerms: ['Support', 'Breakout', 'Ceiling'],
  },
  {
    term: 'Entry Price',
    shortDefinition: 'The recommended price to buy a stock.',
    fullExplanation: 'Entry price is the suggested price point to open a position. A good entry price considers support levels, current momentum, and risk/reward ratio. Buying at a good entry can significantly improve your trade\'s success rate.',
    example: 'An entry price of $82.50 means waiting for the stock to reach that level before buying, rather than buying at the current higher price.',
    category: 'general',
    relatedTerms: ['Support', 'Stop Loss', 'Target Price'],
  },
  {
    term: 'Target Price',
    shortDefinition: 'The expected price level where you plan to sell for profit.',
    fullExplanation: 'Target price is based on technical analysis (resistance levels) or fundamental analysis (fair value). It helps you plan your exit and calculate potential return. Having a target prevents emotional decision-making.',
    example: 'A target of $92 with entry at $82.50 means you\'re aiming for roughly 11.5% profit.',
    category: 'general',
    relatedTerms: ['Resistance', 'Take Profit', 'Risk/Reward'],
  },
  {
    term: 'Stop Loss',
    shortDefinition: 'A predetermined price to sell and limit your losses.',
    fullExplanation: 'Stop loss is your safety net - the price at which you exit to prevent larger losses. It should be placed below support levels and account for normal volatility (using ATR). Never trade without a stop loss.',
    example: 'A stop loss at $78 with entry at $82.50 means you\'re risking $4.50 (5.5%) to protect against larger losses.',
    category: 'general',
    relatedTerms: ['Risk Management', 'ATR', 'Support'],
  },
  {
    term: 'Overbought',
    shortDefinition: 'A condition where a stock has risen too fast and may be due for a pullback.',
    fullExplanation: 'When indicators like RSI or Stochastic reach extreme high levels (typically above 70-80), it suggests the stock has been bought aggressively and may be due for a correction. It doesn\'t mean "sell immediately" but "be cautious about buying."',
    example: 'RSI at 75 means the stock is overbought - it might continue up but the risk of a pullback is higher.',
    category: 'general',
    relatedTerms: ['RSI', 'Stochastic', 'Pullback'],
  },
  {
    term: 'Oversold',
    shortDefinition: 'A condition where a stock has fallen too fast and may be due for a bounce.',
    fullExplanation: 'When indicators reach extreme low levels (typically below 20-30), it suggests the stock has been sold aggressively and may bounce. This can be a buying opportunity, but confirm with other factors - stocks can stay oversold longer than expected.',
    example: 'Stochastic at 0 is extremely oversold - the stock is at the bottom of its recent range and may bounce.',
    category: 'general',
    relatedTerms: ['RSI', 'Stochastic', 'Bounce'],
  },
  // Patterns
  {
    term: 'Golden Cross',
    shortDefinition: 'When a shorter-term moving average crosses above a longer-term one - a bullish signal.',
    fullExplanation: 'The classic Golden Cross is when the 50-day SMA crosses above the 200-day SMA. This signals that short-term momentum is turning positive and often precedes extended uptrends. It\'s considered one of the most reliable bullish patterns.',
    example: 'If SMA50 crosses above SMA200, it\'s a Golden Cross - historically associated with the start of bull markets.',
    category: 'pattern',
    relatedTerms: ['Death Cross', 'SMA', 'Trend Reversal'],
  },
  {
    term: 'Death Cross',
    shortDefinition: 'When a shorter-term moving average crosses below a longer-term one - a bearish signal.',
    fullExplanation: 'The Death Cross is the opposite of Golden Cross - when the 50-day SMA crosses below the 200-day SMA. It signals that short-term momentum is turning negative and may precede extended downtrends.',
    example: 'If SMA50 crosses below SMA200, it\'s a Death Cross - a warning sign that the trend may be turning bearish.',
    category: 'pattern',
    relatedTerms: ['Golden Cross', 'SMA', 'Trend Reversal'],
  },
  {
    term: 'MACD Crossover',
    shortDefinition: 'When the MACD line crosses the signal line - indicates potential trend change.',
    fullExplanation: 'A bullish MACD crossover occurs when MACD crosses above the signal line, suggesting upward momentum. A bearish crossover is when MACD crosses below. Crossovers near the zero line are considered more significant.',
    example: 'MACD at -0.14 above signal at -0.60 means a bullish crossover has occurred - momentum is turning positive.',
    category: 'pattern',
    relatedTerms: ['MACD', 'Signal Line', 'Momentum'],
  },
  // Fundamental Terms
  {
    term: 'Market Cap (Market Capitalization)',
    shortDefinition: 'The total value of a company\'s outstanding shares.',
    fullExplanation: 'Market cap = Share Price × Total Shares Outstanding. It categorizes companies as Large Cap (>$10B), Mid Cap ($2-10B), or Small Cap (<$2B). Larger companies are generally more stable but may grow slower.',
    example: 'If a company has 1 billion shares at $100 each, its market cap is $100 billion (large cap).',
    category: 'fundamental',
    relatedTerms: ['Shares Outstanding', 'Valuation', 'Large Cap'],
  },
  {
    term: 'P/E Ratio (Price-to-Earnings)',
    shortDefinition: 'How much investors pay for each dollar of company earnings.',
    fullExplanation: 'P/E = Stock Price ÷ Earnings Per Share. A high P/E (30+) suggests investors expect high growth but the stock may be expensive. A low P/E (<15) may indicate undervaluation or problems. Compare P/E to industry peers and historical averages.',
    example: 'A P/E of 25 means you pay $25 for every $1 of annual profit. If earnings grow, your investment becomes more valuable.',
    category: 'fundamental',
    relatedTerms: ['Earnings', 'Valuation', 'Growth Stock'],
  },
  {
    term: 'Volume',
    shortDefinition: 'The number of shares traded in a given period.',
    fullExplanation: 'Volume confirms price movements. High volume on an up day suggests strong buying interest; high volume on a down day suggests strong selling. Low volume moves are less reliable. Average volume helps identify unusual activity.',
    example: 'If UBER normally trades 20M shares but today traded 50M, something significant is happening - investigate.',
    category: 'fundamental',
    relatedTerms: ['Liquidity', 'Volume Spike', 'Average Volume'],
  },
  {
    term: '52-Week High/Low',
    shortDefinition: 'The highest and lowest prices a stock traded at over the past year.',
    fullExplanation: 'These levels show the stock\'s trading range. Approaching the 52-week high may indicate strength (or potential resistance). Approaching the 52-week low may indicate weakness (or potential support/value).',
    example: 'If UBER is at $82 with a 52-week low of $45 and high of $95, it\'s closer to the high end of its range.',
    category: 'fundamental',
    relatedTerms: ['Support', 'Resistance', 'Trading Range'],
  },
  {
    term: 'Dividend Yield',
    shortDefinition: 'Annual dividend payment as a percentage of stock price.',
    fullExplanation: 'Dividend Yield = (Annual Dividend ÷ Stock Price) × 100. Higher yields provide more income but very high yields (8%+) may signal risk - the company might cut the dividend. Growth stocks often pay little or no dividend.',
    example: 'A stock at $100 paying $3 annually has a 3% yield. You\'d earn $3 per share per year in dividends.',
    category: 'fundamental',
    relatedTerms: ['Dividend', 'Income Investing', 'Payout Ratio'],
  },
  // Trading Strategy Terms
  {
    term: 'Risk/Reward Ratio',
    shortDefinition: 'Compares potential loss to potential gain on a trade.',
    fullExplanation: 'Risk/Reward = (Entry - Stop Loss) ÷ (Target - Entry). A 1:3 ratio means you risk $1 to potentially make $3. Successful traders typically aim for at least 1:2 ratios - even winning only 50% of trades would be profitable.',
    example: 'Entry $82.50, Stop $78, Target $92: Risk = $4.50, Reward = $9.50. Ratio = 1:2.1 - acceptable.',
    category: 'general',
    relatedTerms: ['Stop Loss', 'Target Price', 'Position Sizing'],
  },
  {
    term: 'Trend',
    shortDefinition: 'The general direction a stock price is moving over time.',
    fullExplanation: 'An uptrend has higher highs and higher lows. A downtrend has lower highs and lower lows. A sideways trend (consolidation) moves within a range. "The trend is your friend" - trading with the trend has better odds than against it.',
    example: 'If UBER has been making higher lows ($70, $75, $80), it\'s in an uptrend despite daily fluctuations.',
    category: 'general',
    relatedTerms: ['Uptrend', 'Downtrend', 'Consolidation', 'Trend Line'],
  },
  {
    term: 'Volatility',
    shortDefinition: 'How much and how quickly a stock\'s price changes.',
    fullExplanation: 'High volatility means large price swings - more risk but more opportunity. Low volatility means smaller, steadier movements. ATR measures volatility. Options are more expensive during high volatility periods.',
    example: 'A stock that moves 5% daily is more volatile than one that moves 1%. Higher volatility requires wider stop losses.',
    category: 'general',
    relatedTerms: ['ATR', 'Beta', 'Standard Deviation'],
  },
  {
    term: 'Sentiment',
    shortDefinition: 'The overall attitude of investors toward a stock or market.',
    fullExplanation: 'Sentiment can be bullish (optimistic), bearish (pessimistic), or neutral. It\'s influenced by news, earnings, economic data, and market trends. Extreme sentiment can signal reversals - maximum bullishness often precedes tops.',
    example: 'A sentiment score of 7/10 suggests moderately positive market feeling about the stock.',
    category: 'general',
    relatedTerms: ['Fear & Greed', 'Bullish', 'Bearish', 'Market Psychology'],
  },
];

function TermCard({ term, isExpanded, onToggle }: { term: GlossaryTerm; isExpanded: boolean; onToggle: () => void }) {
  const categoryColors = {
    indicator: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    pattern: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
    fundamental: 'bg-green-500/10 text-green-500 border-green-500/30',
    general: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  };

  return (
    <Card className={cn('transition-all', isExpanded && 'ring-2 ring-primary/20')}>
      <CardHeader className="cursor-pointer pb-2" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base">{term.term}</CardTitle>
              <Badge variant="outline" className={cn('text-[10px]', categoryColors[term.category])}>
                {term.category}
              </Badge>
            </div>
            <CardDescription className="text-sm">{term.shortDefinition}</CardDescription>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed">{term.fullExplanation}</p>
          </div>

          {term.example && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span className="text-xs font-medium">Example</span>
              </div>
              <p className="text-sm text-muted-foreground">{term.example}</p>
            </div>
          )}

          {term.interpretation && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">How to Interpret:</p>
              <div className="grid gap-2">
                {term.interpretation.bullish && (
                  <div className="flex items-start gap-2 p-2 rounded bg-green-500/10">
                    <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-green-500">Bullish Signal</span>
                      <p className="text-xs text-muted-foreground">{term.interpretation.bullish}</p>
                    </div>
                  </div>
                )}
                {term.interpretation.bearish && (
                  <div className="flex items-start gap-2 p-2 rounded bg-red-500/10">
                    <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium text-red-500">Bearish Signal</span>
                      <p className="text-xs text-muted-foreground">{term.interpretation.bearish}</p>
                    </div>
                  </div>
                )}
                {term.interpretation.neutral && (
                  <div className="flex items-start gap-2 p-2 rounded bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-medium">Neutral</span>
                      <p className="text-xs text-muted-foreground">{term.interpretation.neutral}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {term.relatedTerms && term.relatedTerms.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Related Terms:</p>
              <div className="flex flex-wrap gap-1">
                {term.relatedTerms.map((related, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {related}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function LearnPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTerms = glossaryTerms.filter((term) => {
    const matchesSearch =
      term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.shortDefinition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      term.fullExplanation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || term.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleTerm = (termName: string) => {
    const newExpanded = new Set(expandedTerms);
    if (newExpanded.has(termName)) {
      newExpanded.delete(termName);
    } else {
      newExpanded.add(termName);
    }
    setExpandedTerms(newExpanded);
  };

  const expandAll = () => {
    setExpandedTerms(new Set(filteredTerms.map((t) => t.term)));
  };

  const collapseAll = () => {
    setExpandedTerms(new Set());
  };

  const categories = [
    { value: 'all', label: 'All Terms', count: glossaryTerms.length },
    { value: 'indicator', label: 'Indicators', count: glossaryTerms.filter((t) => t.category === 'indicator').length },
    { value: 'pattern', label: 'Patterns', count: glossaryTerms.filter((t) => t.category === 'pattern').length },
    { value: 'fundamental', label: 'Fundamentals', count: glossaryTerms.filter((t) => t.category === 'fundamental').length },
    { value: 'general', label: 'General', count: glossaryTerms.filter((t) => t.category === 'general').length },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Trading Glossary"
        subtitle="Learn trading terms and technical indicators explained for beginners"
      />

      <div className="p-3 md:p-6 space-y-6">
        {/* Introduction Card */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/20">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Welcome to the Trading Glossary</h2>
                <p className="text-sm text-muted-foreground">
                  New to trading? This guide explains all the technical terms and indicators you'll see in the app.
                  Click on any term to expand and learn more, including practical examples and how to interpret the signals.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-xs rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-transparent p-0">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.value}
                value={cat.value}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {cat.label}
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  {cat.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Terms List */}
        <div className="grid gap-4">
          {filteredTerms.length > 0 ? (
            filteredTerms.map((term) => (
              <TermCard
                key={term.term}
                term={term}
                isExpanded={expandedTerms.has(term.term)}
                onToggle={() => toggleTerm(term.term)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No terms found matching "{searchQuery}"</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Trading Tips for Beginners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">Never Trade Without a Stop Loss</h3>
                <p className="text-sm text-muted-foreground">
                  Always know your exit point before entering a trade. A stop loss protects you from large losses.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">Use Multiple Indicators</h3>
                <p className="text-sm text-muted-foreground">
                  Don't rely on a single indicator. Confirm signals with 2-3 different indicators for better accuracy.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">Trade With the Trend</h3>
                <p className="text-sm text-muted-foreground">
                  "The trend is your friend." Trading in the direction of the overall trend improves your odds.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">Manage Your Risk</h3>
                <p className="text-sm text-muted-foreground">
                  Never risk more than 1-2% of your portfolio on a single trade. Aim for at least 1:2 risk/reward.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
