import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Cache: 12 hours TTL (twice daily updates)
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours in ms
const cache = new Map<string, { data: any; timestamp: number }>();

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const symbols = searchParams.get('symbols')?.toUpperCase().split(',');

  // Alpha Vantage API key from header or environment
  const apiKeyFromHeader = request.headers.get('x-alphavantage-key');
  const apiKey = apiKeyFromHeader || process.env.ALPHA_VANTAGE_API_KEY || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_KEY;

  try {
    switch (action) {
      case 'calendar': {
        // Check cache first
        const cacheKey = `earnings-calendar-${symbols?.sort().join(',') || 'all'}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        // Get earnings calendar for portfolio symbols
        if (apiKey && symbols && symbols.length > 0) {
          const earnings: any[] = [];

          // Fetch earnings calendar (returns CSV)
          const response = await fetch(
            `${ALPHA_VANTAGE_BASE}?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`
          );
          const csvText = await response.text();

          if (csvText && !csvText.includes('Error') && !csvText.includes('Note')) {
            // Parse CSV
            const lines = csvText.trim().split('\n');
            if (lines.length > 1) {
              const headers = lines[0].split(',');
              const data = lines.slice(1).map(line => {
                const values = line.split(',');
                const entry: any = {};
                headers.forEach((h, i) => {
                  entry[h.trim()] = values[i]?.trim() || '';
                });
                return entry;
              });

              // Filter for portfolio symbols
              const filtered = data.filter(e => symbols.includes(e.symbol));

              for (const e of filtered) {
                earnings.push({
                  symbol: e.symbol,
                  date: e.reportDate,
                  time: 'unknown',
                  epsEstimate: parseFloat(e.estimate) || null,
                  epsActual: null,
                  revenueEstimate: null,
                  revenueActual: null,
                  fiscalQuarter: e.fiscalDateEnding,
                  currency: e.currency,
                });
              }
            }
          }

          if (earnings.length > 0) {
            const sortedEarnings = earnings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setCachedData(cacheKey, sortedEarnings);
            return NextResponse.json({ success: true, data: sortedEarnings });
          }
        }

        // If no API key or no data, try fetching from individual symbol EARNINGS endpoint
        if (apiKey && symbols && symbols.length > 0) {
          const earnings: any[] = [];

          for (const sym of symbols.slice(0, 5)) { // Limit to avoid rate limits
            try {
              await new Promise(r => setTimeout(r, 200)); // Rate limit delay

              const response = await fetch(
                `${ALPHA_VANTAGE_BASE}?function=EARNINGS&symbol=${sym}&apikey=${apiKey}`
              );
              const data = await response.json();

              if (data.quarterlyEarnings && data.quarterlyEarnings.length > 0) {
                // Get the most recent reported quarter to estimate next
                const lastQ = data.quarterlyEarnings[0];
                const lastReportDate = new Date(lastQ.reportedDate);
                const nextDate = new Date(lastReportDate);
                nextDate.setMonth(nextDate.getMonth() + 3);

                if (nextDate > new Date()) {
                  earnings.push({
                    symbol: sym,
                    date: nextDate.toISOString().split('T')[0],
                    time: 'unknown',
                    epsEstimate: parseFloat(lastQ.estimatedEPS) || null,
                    epsActual: null,
                    revenueEstimate: null,
                    revenueActual: null,
                    fiscalQuarter: `Est. next quarter`,
                    isEstimated: true,
                  });
                }
              }
            } catch (e) {
              console.error(`Failed to fetch earnings for ${sym}:`, e);
            }
          }

          if (earnings.length > 0) {
            const sortedEarnings = earnings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setCachedData(cacheKey, sortedEarnings);
            return NextResponse.json({ success: true, data: sortedEarnings });
          }
        }

        // Fallback: No data available
        return NextResponse.json({
          success: true,
          data: [],
          message: 'Add Alpha Vantage API key in Settings for earnings data',
        });
      }

      case 'history': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        // Check cache
        const cacheKey = `earnings-history-${symbol}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        if (apiKey) {
          const response = await fetch(
            `${ALPHA_VANTAGE_BASE}?function=EARNINGS&symbol=${symbol}&apikey=${apiKey}`
          );
          const data = await response.json();

          if (data.quarterlyEarnings && Array.isArray(data.quarterlyEarnings)) {
            const history = data.quarterlyEarnings.slice(0, 12).map((e: any) => {
              const reported = parseFloat(e.reportedEPS) || 0;
              const estimated = parseFloat(e.estimatedEPS) || 0;
              const surprise = estimated !== 0 ? ((reported - estimated) / Math.abs(estimated)) * 100 : 0;

              return {
                date: e.reportedDate,
                fiscalDateEnding: e.fiscalDateEnding,
                epsEstimate: estimated,
                epsActual: reported,
                epsSurprise: surprise,
                beat: reported > estimated,
              };
            });

            setCachedData(cacheKey, history);
            return NextResponse.json({ success: true, data: history });
          }
        }

        return NextResponse.json({
          success: true,
          data: [],
          message: 'Add Alpha Vantage API key in Settings for earnings history',
        });
      }

      case 'surprises': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        // Check cache
        const cacheKey = `earnings-surprises-${symbol}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        if (apiKey) {
          const response = await fetch(
            `${ALPHA_VANTAGE_BASE}?function=EARNINGS&symbol=${symbol}&apikey=${apiKey}`
          );
          const data = await response.json();

          if (data.quarterlyEarnings && Array.isArray(data.quarterlyEarnings)) {
            const surprises = data.quarterlyEarnings.slice(0, 8).map((e: any) => {
              const reported = parseFloat(e.reportedEPS) || 0;
              const estimated = parseFloat(e.estimatedEPS) || 0;
              const surprise = estimated !== 0 ? ((reported - estimated) / Math.abs(estimated)) * 100 : null;

              return {
                date: e.reportedDate,
                epsEstimate: estimated,
                epsActual: reported,
                surprise,
                surprisePercentage: parseFloat(e.surprisePercentage) || surprise,
              };
            });

            setCachedData(cacheKey, surprises);
            return NextResponse.json({ success: true, data: surprises });
          }
        }

        return NextResponse.json({
          success: true,
          data: [],
          message: 'Add Alpha Vantage API key in Settings',
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Earnings API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch earnings data' },
      { status: 500 }
    );
  }
}
