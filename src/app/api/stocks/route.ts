import { NextRequest, NextResponse } from 'next/server';
import { getCachedData, getStaleCachedData, setCachedData, getCacheStats, clearCache } from '@/lib/cache/tickerCache';

// Prevent Vercel edge caching — always run fresh
export const dynamic = 'force-dynamic';

const ALPHA_VANTAGE_KEY = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_KEY || '';

// Stock name lookup for better display
const STOCK_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc.',
  AMZN: 'Amazon.com Inc.',
  NVDA: 'NVIDIA Corporation',
  TSLA: 'Tesla, Inc.',
  META: 'Meta Platforms, Inc.',
  JPM: 'JPMorgan Chase & Co.',
  V: 'Visa Inc.',
  SPY: 'SPDR S&P 500 ETF',
  QQQ: 'Invesco QQQ Trust',
  UBER: 'Uber Technologies',
  NFLX: 'Netflix Inc.',
  DIS: 'Walt Disney Co.',
  AMD: 'Advanced Micro Devices',
};

const AV_BASE_URL = 'https://www.alphavantage.co/query';

// Check for Alpha Vantage error/rate-limit responses
function checkAVError(data: any): string | null {
  if (data['Error Message']) return data['Error Message'];
  if (data['Note']) return 'Alpha Vantage API rate limit reached. Please wait and try again.';
  if (data['Information']) return 'Alpha Vantage API rate limit reached. Please wait and try again.';
  return null;
}

// Alpha Vantage API helper functions
async function fetchAVQuote(symbol: string, apiKey: string) {
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `${AV_BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const err = checkAVError(data);
    if (err) {
      console.error('Alpha Vantage quote error:', err);
      return null;
    }
    const gq = data['Global Quote'];
    if (!gq || Object.keys(gq).length === 0) return null;
    return {
      symbol: gq['01. symbol'],
      open: parseFloat(gq['02. open']),
      high: parseFloat(gq['03. high']),
      low: parseFloat(gq['04. low']),
      price: parseFloat(gq['05. price']),
      volume: parseInt(gq['06. volume'], 10),
      latestTradingDay: gq['07. latest trading day'],
      previousClose: parseFloat(gq['08. previous close']),
      change: parseFloat(gq['09. change']),
      changePercent: parseFloat(gq['10. change percent']?.replace('%', '') || '0'),
    };
  } catch (error) {
    console.error('Alpha Vantage quote error:', error);
    return null;
  }
}

async function fetchAVHistory(symbol: string, range: string, apiKey: string) {
  if (!apiKey) return null;
  try {
    let url: string;
    let timeSeriesKey: string;

    if (range === '1D' || range === '1W') {
      // Use intraday for short ranges
      url = `${AV_BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=60min&outputsize=full&apikey=${apiKey}`;
      timeSeriesKey = 'Time Series (60min)';
    } else {
      const outputsize = (range === '1M' || range === '3M') ? 'compact' : 'full';
      url = `${AV_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${apiKey}`;
      timeSeriesKey = 'Time Series (Daily)';
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const err = checkAVError(data);
    if (err) {
      console.error('Alpha Vantage history error:', err);
      return null;
    }

    const timeSeries = data[timeSeriesKey];
    if (!timeSeries) return null;

    // Determine how many days of data to keep
    let days = 30;
    switch (range) {
      case '1D': days = 1; break;
      case '1W': days = 7; break;
      case '1M': days = 35; break;
      case '3M': days = 100; break;
      case '6M': days = 190; break;
      case '1Y': days = 370; break;
      case 'YTD': {
        const now = new Date();
        days = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 5;
        break;
      }
      case 'ALL': days = 365 * 10; break;
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Convert to sorted array (ascending by date)
    const entries = Object.entries(timeSeries)
      .map(([dateStr, values]: [string, any]) => ({
        date: dateStr.split(' ')[0], // handle intraday datetime strings
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'], 10),
      }))
      .filter(entry => new Date(entry.date) >= cutoffDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    return entries.length > 0 ? entries : null;
  } catch (error) {
    console.error('Alpha Vantage history error:', error);
    return null;
  }
}

async function fetchAVSearch(query: string, apiKey: string) {
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `${AV_BASE_URL}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${apiKey}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    const err = checkAVError(data);
    if (err) {
      console.error('Alpha Vantage search error:', err);
      return null;
    }
    const matches = data['bestMatches'];
    if (!matches || !Array.isArray(matches)) return null;
    return matches;
  } catch (error) {
    console.error('Alpha Vantage search error:', error);
    return null;
  }
}

async function fetchAVTechnical(func: string, symbol: string, apiKey: string, params: Record<string, string> = {}) {
  if (!apiKey) return null;
  try {
    const queryParams = new URLSearchParams({
      function: func,
      symbol,
      apikey: apiKey,
      ...params,
    });
    const response = await fetch(`${AV_BASE_URL}?${queryParams.toString()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const err = checkAVError(data);
    if (err) {
      console.error(`Alpha Vantage ${func} error:`, err);
      return null;
    }
    return data;
  } catch (error) {
    console.error(`Alpha Vantage ${func} error:`, error);
    return null;
  }
}

// Get the latest value from an Alpha Vantage technical analysis response
function getLatestTechnical(data: any, analysisKey: string): Record<string, string> | null {
  const analysis = data[analysisKey];
  if (!analysis) return null;
  const dates = Object.keys(analysis);
  if (dates.length === 0) return null;
  // First key is the latest date (sorted descending by Alpha Vantage)
  return analysis[dates[0]];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const symbols = searchParams.get('symbols')?.toUpperCase().split(',');
  const range = searchParams.get('range') || '1M';
  const query = searchParams.get('query');
  const testKey = searchParams.get('testKey');
  const includeHistorical = searchParams.get('includeHistorical') === 'true';

  // Get Alpha Vantage API key from header or environment
  const apiKeyFromHeader = request.headers.get('x-alphavantage-key');
  const avApiKey = apiKeyFromHeader || ALPHA_VANTAGE_KEY;

  // Check if Alpha Vantage API key is configured
  if (!avApiKey && action !== 'test') {
    return NextResponse.json({
      success: false,
      error: 'Alpha Vantage API key not configured. Please add your Alpha Vantage key in Settings.',
      requiresSetup: true,
    }, { status: 503 });
  }

  try {
    switch (action) {
      case 'test': {
        // Test Alpha Vantage key
        if (testKey) {
          try {
            const response = await fetch(
              `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${testKey}`
            );
            const data = await response.json();

            if (data['Error Message'] || data['Note']) {
              return NextResponse.json({
                success: false,
                error: data['Error Message'] || 'API rate limit reached. Free tier allows 25 calls/day.'
              }, { status: 400 });
            }

            if (data['Information']) {
              return NextResponse.json({
                success: false,
                error: 'API rate limit reached. Please wait and try again.'
              }, { status: 400 });
            }

            if (data['Global Quote'] && Object.keys(data['Global Quote']).length > 0) {
              return NextResponse.json({
                success: true,
                message: 'Alpha Vantage API key is valid',
                data: {
                  symbol: 'AAPL',
                  price: parseFloat(data['Global Quote']['05. price']),
                },
              });
            }

            return NextResponse.json({
              success: false,
              error: 'No data returned. The API key may be invalid.'
            }, { status: 400 });
          } catch (error) {
            return NextResponse.json({
              success: false,
              error: 'Failed to connect to Alpha Vantage API'
            }, { status: 500 });
          }
        }
        return NextResponse.json({ success: false, error: 'API key required for testing' }, { status: 400 });
      }

      case 'quote': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        // Fetch fresh quote data
        const avQuote = await fetchAVQuote(symbol, avApiKey);
        if (avQuote) {
          // Only fetch 52-week high/low when explicitly requested
          let fiftyTwoWeekHigh = avQuote.high;
          let fiftyTwoWeekLow = avQuote.low;

          if (includeHistorical) {
            const cachedHistory = getCachedData<any[]>(symbol, 'history', '1Y');
            let historicalData = cachedHistory;

            if (!historicalData) {
              historicalData = await fetchAVHistory(symbol, '1Y', avApiKey);
              if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
                setCachedData(symbol, 'history', historicalData, '1Y');
              }
            }

            if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
              fiftyTwoWeekHigh = Math.max(...historicalData.map((d: any) => d.high));
              fiftyTwoWeekLow = Math.min(...historicalData.map((d: any) => d.low));
            }
          }

          const quoteData = {
            symbol,
            name: STOCK_NAMES[symbol] || avQuote.symbol,
            price: avQuote.price,
            change: avQuote.change,
            changePercent: avQuote.changePercent,
            previousClose: avQuote.previousClose,
            open: avQuote.open,
            high: avQuote.high,
            low: avQuote.low,
            volume: avQuote.volume,
            fiftyTwoWeekHigh,
            fiftyTwoWeekLow,
            assetType: ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO'].includes(symbol) ? 'etf' : 'stock',
            timestamp: new Date(avQuote.latestTradingDay),
            source: 'Alpha Vantage',
          };

          // Cache fresh quote for fallback
          setCachedData(symbol, 'quote', quoteData);

          return NextResponse.json({
            success: true,
            data: quoteData,
          });
        }

        // API failed — fall back to cached data (stale OK)
        const cachedQuote = getStaleCachedData<any>(symbol, 'quote');
        if (cachedQuote) {
          return NextResponse.json({
            success: true,
            data: { ...cachedQuote, stale: true },
          });
        }

        return NextResponse.json({
          success: false,
          error: `Unable to fetch data for ${symbol}. Please verify the symbol is correct.`,
        }, { status: 404 });
      }

      case 'quotes': {
        if (!symbols || symbols.length === 0) {
          return NextResponse.json({ success: false, error: 'Symbols required' }, { status: 400 });
        }

        const quotes: Record<string, any> = {};

        // Parallel GLOBAL_QUOTE calls for all symbols
        const results = await Promise.all(
          symbols.map(async (sym) => {
            const avQuote = await fetchAVQuote(sym, avApiKey);
            return { sym, avQuote };
          })
        );

        for (const { sym, avQuote } of results) {
          if (avQuote) {
            const quoteData = {
              symbol: sym,
              name: STOCK_NAMES[sym] || avQuote.symbol,
              price: avQuote.price,
              change: avQuote.change,
              changePercent: avQuote.changePercent,
              previousClose: avQuote.previousClose,
              volume: avQuote.volume,
              assetType: ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO'].includes(sym) ? 'etf' : 'stock',
              timestamp: new Date(avQuote.latestTradingDay),
            };
            quotes[sym] = quoteData;
            setCachedData(sym, 'quote', quoteData);
          } else {
            // API failed — try cached data as fallback (stale OK)
            const cached = getStaleCachedData<any>(sym, 'quote');
            if (cached) {
              quotes[sym] = { ...cached, stale: true };
            }
          }
        }

        if (Object.keys(quotes).length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Unable to fetch quotes for the requested symbols',
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          data: quotes,
          source: 'Alpha Vantage',
        });
      }

      case 'history': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        // Check cache first for historical data
        const cachedHistory = getCachedData<any[]>(symbol, 'history', range);
        if (cachedHistory && cachedHistory.length > 0) {
          return NextResponse.json({
            success: true,
            data: cachedHistory,
            source: 'Alpha Vantage',
            cached: true,
          });
        }

        const historyData = await fetchAVHistory(symbol, range, avApiKey);
        if (historyData && historyData.length > 0) {
          // Cache the historical data
          setCachedData(symbol, 'history', historyData, range);

          return NextResponse.json({ success: true, data: historyData, source: 'Alpha Vantage' });
        }

        // Fallback - try to get real quote for current price at minimum
        const fallbackQuote = await fetchAVQuote(symbol, avApiKey);
        if (fallbackQuote) {
          return NextResponse.json({
            success: true,
            data: [{
              date: fallbackQuote.latestTradingDay,
              open: fallbackQuote.open,
              high: fallbackQuote.high,
              low: fallbackQuote.low,
              close: fallbackQuote.price,
              volume: fallbackQuote.volume,
            }],
            source: 'Alpha Vantage'
          });
        }

        return NextResponse.json({
          success: false,
          error: `Unable to fetch historical data for ${symbol}`,
        }, { status: 404 });
      }

      case 'search': {
        if (!query) {
          return NextResponse.json({ success: false, error: 'Query required' }, { status: 400 });
        }

        // Try Alpha Vantage search
        const searchResults = await fetchAVSearch(query, avApiKey);
        if (searchResults && searchResults.length > 0) {
          const results = searchResults
            .slice(0, 10)
            .map((item: any) => ({
              symbol: item['1. symbol'],
              name: item['2. name'],
              type: (item['3. type'] || 'stock').toLowerCase(),
              exchange: item['4. region'] || 'US',
            }));

          return NextResponse.json({ success: true, data: results, source: 'Alpha Vantage' });
        }

        // Search in our name lookup as fallback
        const localResults = Object.entries(STOCK_NAMES)
          .filter(([sym, name]) =>
            sym.toLowerCase().includes(query.toLowerCase()) ||
            name.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10)
          .map(([sym, name]) => ({
            symbol: sym,
            name: name,
            type: ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO'].includes(sym) ? 'etf' : 'stock',
            exchange: 'US',
          }));

        if (localResults.length > 0) {
          return NextResponse.json({ success: true, data: localResults, source: 'local' });
        }

        return NextResponse.json({
          success: true,
          data: [],
          message: 'No results found',
        });
      }

      case 'cache-stats': {
        const stats = getCacheStats();
        return NextResponse.json({
          success: true,
          data: {
            totalFiles: stats.totalFiles,
            totalSizeKB: (stats.totalSize / 1024).toFixed(2),
            entries: stats.entries,
          },
        });
      }

      case 'clear-cache': {
        const symbolToClear = searchParams.get('clearSymbol');
        clearCache(symbolToClear || undefined);
        return NextResponse.json({
          success: true,
          message: symbolToClear ? `Cache cleared for ${symbolToClear}` : 'All cache cleared',
        });
      }

      case 'technicals': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        try {
          const indicators: Record<string, any> = {};

          // RSI (14-day)
          const rsiData = await fetchAVTechnical('RSI', symbol, avApiKey, {
            interval: 'daily',
            time_period: '14',
            series_type: 'close',
          });
          if (rsiData) {
            const latest = getLatestTechnical(rsiData, 'Technical Analysis: RSI');
            if (latest) {
              const rsiValue = parseFloat(latest['RSI']);
              indicators.rsi = {
                value: parseFloat(rsiValue.toFixed(2)),
                signal: rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral',
                period: 14,
              };
            }
          }

          // MACD
          const macdData = await fetchAVTechnical('MACD', symbol, avApiKey, {
            interval: 'daily',
            series_type: 'close',
          });
          if (macdData) {
            const latest = getLatestTechnical(macdData, 'Technical Analysis: MACD');
            if (latest) {
              const macdLine = parseFloat(latest['MACD']);
              const signalLine = parseFloat(latest['MACD_Signal']);
              const histogram = parseFloat(latest['MACD_Hist']);
              indicators.macd = {
                macd: parseFloat(macdLine.toFixed(4)),
                signal: parseFloat(signalLine.toFixed(4)),
                histogram: parseFloat(histogram.toFixed(4)),
                trend: macdLine > signalLine ? 'bullish' : 'bearish',
              };
            }
          }

          // SMA (20, 50, 200)
          const smaPromises = [20, 50, 200].map(async (period) => {
            const data = await fetchAVTechnical('SMA', symbol, avApiKey, {
              interval: 'daily',
              time_period: String(period),
              series_type: 'close',
            });
            if (data) {
              const latest = getLatestTechnical(data, 'Technical Analysis: SMA');
              if (latest) {
                return { period, value: parseFloat(parseFloat(latest['SMA']).toFixed(2)) };
              }
            }
            return null;
          });
          const smaResults = await Promise.all(smaPromises);
          indicators.sma = {};
          smaResults.filter(Boolean).forEach((r: any) => {
            indicators.sma[`sma${r.period}`] = r.value;
          });

          // EMA (12, 26)
          const emaPromises = [12, 26].map(async (period) => {
            const data = await fetchAVTechnical('EMA', symbol, avApiKey, {
              interval: 'daily',
              time_period: String(period),
              series_type: 'close',
            });
            if (data) {
              const latest = getLatestTechnical(data, 'Technical Analysis: EMA');
              if (latest) {
                return { period, value: parseFloat(parseFloat(latest['EMA']).toFixed(2)) };
              }
            }
            return null;
          });
          const emaResults = await Promise.all(emaPromises);
          indicators.ema = {};
          emaResults.filter(Boolean).forEach((r: any) => {
            indicators.ema[`ema${r.period}`] = r.value;
          });

          // Bollinger Bands
          const bbData = await fetchAVTechnical('BBANDS', symbol, avApiKey, {
            interval: 'daily',
            time_period: '20',
            series_type: 'close',
          });
          if (bbData) {
            const latest = getLatestTechnical(bbData, 'Technical Analysis: BBANDS');
            if (latest) {
              indicators.bollingerBands = {
                upper: parseFloat(parseFloat(latest['Real Upper Band']).toFixed(2)),
                middle: parseFloat(parseFloat(latest['Real Middle Band']).toFixed(2)),
                lower: parseFloat(parseFloat(latest['Real Lower Band']).toFixed(2)),
              };
            }
          }

          // Stochastic
          const stochData = await fetchAVTechnical('STOCH', symbol, avApiKey, {
            interval: 'daily',
          });
          if (stochData) {
            const latest = getLatestTechnical(stochData, 'Technical Analysis: STOCH');
            if (latest) {
              const kValue = parseFloat(latest['SlowK']);
              const dValue = parseFloat(latest['SlowD']);
              indicators.stochastic = {
                k: parseFloat(kValue.toFixed(2)),
                d: parseFloat(dValue.toFixed(2)),
                signal: kValue > 80 ? 'overbought' : kValue < 20 ? 'oversold' : 'neutral',
              };
            }
          }

          // ADX (Average Directional Index)
          const adxData = await fetchAVTechnical('ADX', symbol, avApiKey, {
            interval: 'daily',
            time_period: '14',
          });
          if (adxData) {
            const latest = getLatestTechnical(adxData, 'Technical Analysis: ADX');
            if (latest) {
              const adxValue = parseFloat(latest['ADX']);
              indicators.adx = {
                value: parseFloat(adxValue.toFixed(2)),
                trend: adxValue > 25 ? 'strong' : 'weak',
              };
            }
          }

          // ATR (Average True Range)
          const atrData = await fetchAVTechnical('ATR', symbol, avApiKey, {
            interval: 'daily',
            time_period: '14',
          });
          if (atrData) {
            const latest = getLatestTechnical(atrData, 'Technical Analysis: ATR');
            if (latest) {
              const atrValue = parseFloat(latest['ATR']);
              indicators.atr = {
                value: parseFloat(atrValue.toFixed(2)),
              };
            }
          }

          // Calculate overall technical score based on indicators
          let bullishSignals = 0;
          let bearishSignals = 0;
          let totalSignals = 0;

          // RSI analysis
          if (indicators.rsi) {
            totalSignals++;
            if (indicators.rsi.value < 30) bullishSignals++; // Oversold = potential buy
            else if (indicators.rsi.value > 70) bearishSignals++; // Overbought = potential sell
            else if (indicators.rsi.value < 50) bullishSignals += 0.5;
            else bearishSignals += 0.5;
          }

          // MACD analysis
          if (indicators.macd) {
            totalSignals++;
            if (indicators.macd.trend === 'bullish') bullishSignals++;
            else bearishSignals++;
          }

          // SMA analysis (price vs SMA)
          if (indicators.sma?.sma20 && indicators.sma?.sma50) {
            totalSignals++;
            // Golden cross (short > long) is bullish
            if (indicators.sma.sma20 > indicators.sma.sma50) bullishSignals++;
            else bearishSignals++;
          }

          // Stochastic analysis
          if (indicators.stochastic) {
            totalSignals++;
            if (indicators.stochastic.signal === 'oversold') bullishSignals++;
            else if (indicators.stochastic.signal === 'overbought') bearishSignals++;
            else if (indicators.stochastic.k > indicators.stochastic.d) bullishSignals += 0.5;
            else bearishSignals += 0.5;
          }

          // Calculate technical score (1-10)
          const technicalScore = totalSignals > 0
            ? Math.round(((bullishSignals / totalSignals) * 10))
            : 5;

          const overallSignal = bullishSignals > bearishSignals ? 'bullish' :
                               bearishSignals > bullishSignals ? 'bearish' : 'neutral';

          return NextResponse.json({
            success: true,
            data: {
              symbol,
              indicators,
              summary: {
                technicalScore,
                overallSignal,
                bullishSignals: Math.round(bullishSignals),
                bearishSignals: Math.round(bearishSignals),
                totalSignals,
              },
              timestamp: new Date().toISOString(),
            },
            source: 'Alpha Vantage',
          });
        } catch (error) {
          console.error('Failed to fetch technicals:', error);
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch technical indicators',
          }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Stocks API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
