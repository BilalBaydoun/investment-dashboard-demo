import { NextRequest, NextResponse } from 'next/server';

const AV_BASE = 'https://www.alphavantage.co/query';

// In-memory cache for news (30 minutes)
const newsCache: Record<string, { data: any[]; timestamp: number }> = {};
const NEWS_CACHE_DURATION = 30 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const limit = parseInt(searchParams.get('limit') || '10');

  const apiKeyFromHeader = request.headers.get('x-alphavantage-key');
  const apiKey = apiKeyFromHeader || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_KEY;

  try {
    // Check cache first
    const cacheKey = symbol || '_general';
    const cached = newsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < NEWS_CACHE_DURATION) {
      return NextResponse.json({ success: true, data: cached.data.slice(0, limit), cached: true });
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Alpha Vantage API key not configured. Please add your key in Settings to get financial news.',
        requiresSetup: true,
      }, { status: 503 });
    }

    // Use Alpha Vantage NEWS_SENTIMENT API
    const params = new URLSearchParams({
      function: 'NEWS_SENTIMENT',
      apikey: apiKey,
      limit: String(Math.min(limit, 50)),
    });

    if (symbol) {
      params.set('tickers', symbol);
    }

    const response = await fetch(`${AV_BASE}?${params}`);

    if (!response.ok) {
      throw new Error(`Alpha Vantage API returned ${response.status}`);
    }

    const data = await response.json();

    // Check for rate limiting or errors
    if (data['Note'] || data['Information']) {
      // Return cached data if available (even if expired)
      if (cached) {
        return NextResponse.json({ success: true, data: cached.data.slice(0, limit), cached: true, stale: true });
      }
      return NextResponse.json({
        success: true,
        data: [],
        message: 'News temporarily unavailable due to API rate limits. Will refresh automatically.',
      });
    }

    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }

    if (data.feed && Array.isArray(data.feed) && data.feed.length > 0) {
      const news = data.feed.map((article: any, index: number) => ({
        id: `news-${index}`,
        title: article.title,
        description: article.summary?.substring(0, 300) + (article.summary?.length > 300 ? '...' : ''),
        source: article.source || extractSource(article.url),
        url: article.url,
        imageUrl: article.banner_image || null,
        publishedAt: parseAlphaVantageDate(article.time_published),
        sentiment: mapSentimentLabel(article.overall_sentiment_label) || analyzeSentiment(article.title + ' ' + (article.summary || '')),
        relevantSymbols: article.ticker_sentiment?.map((t: any) => t.ticker) || (symbol ? [symbol] : []),
        tags: article.topics?.map((t: any) => t.topic) || [],
      }));

      // Cache the results
      newsCache[cacheKey] = { data: news, timestamp: Date.now() };

      return NextResponse.json({ success: true, data: news.slice(0, limit) });
    }

    return NextResponse.json({
      success: true,
      data: [],
      message: 'No news articles found',
    });
  } catch (error) {
    console.error('News API error:', error);
    // Return cached data on error
    const cacheKey = symbol || '_general';
    const cached = newsCache[cacheKey];
    if (cached) {
      return NextResponse.json({ success: true, data: cached.data.slice(0, limit), cached: true, stale: true });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}

// Parse Alpha Vantage date format "YYYYMMDDTHHMMSS" to ISO string
function parseAlphaVantageDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const min = dateStr.substring(11, 13);
    const sec = dateStr.substring(13, 15);
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function mapSentimentLabel(label: string | undefined): 'bullish' | 'bearish' | 'neutral' | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  if (lower.includes('bullish')) return 'bullish';
  if (lower.includes('bearish')) return 'bearish';
  return 'neutral';
}

function extractSource(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace(/^www\./, '');
    return domain.split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return 'News';
  }
}

function analyzeSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const bullishKeywords = ['surge', 'rally', 'gain', 'beat', 'record', 'strong', 'growth', 'breakthrough', 'optimism', 'rise', 'soar', 'upgrade', 'buy'];
  const bearishKeywords = ['drop', 'fall', 'decline', 'concern', 'risk', 'scrutiny', 'challenge', 'fear', 'worry', 'loss', 'plunge', 'downgrade', 'sell'];

  const lowerText = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;

  bullishKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) bullishScore++;
  });

  bearishKeywords.forEach((keyword) => {
    if (lowerText.includes(keyword)) bearishScore++;
  });

  if (bullishScore > bearishScore) return 'bullish';
  if (bearishScore > bullishScore) return 'bearish';
  return 'neutral';
}
