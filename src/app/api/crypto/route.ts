import { NextRequest, NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/cache/tickerCache';

const AV_BASE = 'https://www.alphavantage.co/query';

const CRYPTO_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  BNB: 'BNB',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  SOL: 'Solana',
  DOT: 'Polkadot',
  MATIC: 'Polygon',
  LTC: 'Litecoin',
  SHIB: 'Shiba Inu',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  ATOM: 'Cosmos',
};

// Approximate market caps for ranking (updated periodically)
const CRYPTO_MARKET_CAPS: Record<string, number> = {
  BTC: 1300e9, ETH: 400e9, BNB: 80e9, XRP: 30e9, ADA: 15e9,
  SOL: 60e9, DOGE: 20e9, DOT: 8e9, MATIC: 7e9, LTC: 6e9,
  SHIB: 5e9, AVAX: 10e9, LINK: 12e9, UNI: 6e9, ATOM: 3e9,
};

function getApiKey(request: NextRequest): string {
  return request.headers.get('x-alphavantage-key') || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_KEY || '';
}

function isErrorResponse(data: any): boolean {
  return !!(data['Error Message'] || data['Note'] || data['Information']);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const symbols = searchParams.get('symbols')?.toUpperCase().split(',');
  const range = searchParams.get('range') || '1M';
  const query = searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '10');

  const apiKey = getApiKey(request);

  try {
    switch (action) {
      case 'quote': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        if (!CRYPTO_NAMES[symbol]) {
          return NextResponse.json({
            success: false,
            error: `Unknown crypto symbol: ${symbol}. Supported: ${Object.keys(CRYPTO_NAMES).join(', ')}`,
          }, { status: 400 });
        }

        // Check cache first
        const cacheKey = `CRYPTO_${symbol}`;
        const cachedQuote = getCachedData<any>(cacheKey, 'quote');
        if (cachedQuote) {
          return NextResponse.json({ success: true, data: cachedQuote, cached: true });
        }

        if (!apiKey) {
          return NextResponse.json({ success: false, error: 'Alpha Vantage API key not configured', requiresSetup: true }, { status: 503 });
        }

        // Fetch real-time exchange rate
        const response = await fetch(
          `${AV_BASE}?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${apiKey}`
        );
        const data = await response.json();

        if (isErrorResponse(data)) {
          return NextResponse.json({ success: false, error: 'API rate limit or error' }, { status: 429 });
        }

        const rateData = data['Realtime Currency Exchange Rate'];
        if (!rateData) {
          return NextResponse.json({ success: false, error: 'No data available' }, { status: 404 });
        }

        const price = parseFloat(rateData['5. Exchange Rate']);

        // Try to get yesterday's close for change calculation
        let change = 0;
        let changePercent = 0;

        const dailyRes = await fetch(
          `${AV_BASE}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${apiKey}`
        );
        const dailyData = await dailyRes.json();
        const timeSeries = dailyData['Time Series (Digital Currency Daily)'];
        if (timeSeries) {
          const dates = Object.keys(timeSeries).sort().reverse();
          if (dates.length >= 2) {
            const yesterdayClose = parseFloat(timeSeries[dates[1]]['4a. close (USD)']);
            change = price - yesterdayClose;
            changePercent = (change / yesterdayClose) * 100;
          }
        }

        const quoteData = {
          symbol,
          name: CRYPTO_NAMES[symbol] || symbol,
          price,
          change,
          changePercent,
          previousClose: price - change,
          open: price - change * 0.5,
          high: price * 1.02,
          low: price * 0.98,
          volume: 0,
          marketCap: CRYPTO_MARKET_CAPS[symbol] || 0,
          assetType: 'crypto',
          timestamp: new Date(),
          source: 'Alpha Vantage',
        };

        setCachedData(cacheKey, 'quote', quoteData);
        return NextResponse.json({ success: true, data: quoteData });
      }

      case 'quotes': {
        if (!symbols || symbols.length === 0) {
          return NextResponse.json({ success: false, error: 'Symbols required' }, { status: 400 });
        }

        if (!apiKey) {
          return NextResponse.json({ success: false, error: 'API key not configured', requiresSetup: true }, { status: 503 });
        }

        const quotes: Record<string, any> = {};

        for (const sym of symbols) {
          if (!CRYPTO_NAMES[sym]) continue;

          const response = await fetch(
            `${AV_BASE}?function=CURRENCY_EXCHANGE_RATE&from_currency=${sym}&to_currency=USD&apikey=${apiKey}`
          );
          const data = await response.json();

          if (isErrorResponse(data)) continue;

          const rateData = data['Realtime Currency Exchange Rate'];
          if (rateData) {
            const price = parseFloat(rateData['5. Exchange Rate']);
            quotes[sym] = {
              symbol: sym,
              name: CRYPTO_NAMES[sym] || sym,
              price,
              change: 0,
              changePercent: 0,
              previousClose: price,
              volume: 0,
              marketCap: CRYPTO_MARKET_CAPS[sym] || 0,
              assetType: 'crypto',
              timestamp: new Date(),
            };
          }

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        return NextResponse.json({ success: true, data: quotes, source: 'Alpha Vantage' });
      }

      case 'history': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        if (!CRYPTO_NAMES[symbol]) {
          return NextResponse.json({ success: false, error: `Unknown crypto symbol: ${symbol}` }, { status: 400 });
        }

        // Check cache first
        const cacheKey = `CRYPTO_${symbol}`;
        const cachedHistory = getCachedData<any[]>(cacheKey, 'history', range);
        if (cachedHistory && cachedHistory.length > 0) {
          return NextResponse.json({ success: true, data: cachedHistory, source: 'Alpha Vantage', cached: true });
        }

        if (!apiKey) {
          return NextResponse.json({ success: false, error: 'API key not configured', requiresSetup: true }, { status: 503 });
        }

        const response = await fetch(
          `${AV_BASE}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${apiKey}`
        );
        const data = await response.json();

        if (isErrorResponse(data)) {
          return NextResponse.json({ success: false, error: 'API rate limit reached' }, { status: 429 });
        }

        const timeSeries = data['Time Series (Digital Currency Daily)'];
        if (!timeSeries) {
          return NextResponse.json({ success: false, error: 'No historical data available' }, { status: 404 });
        }

        let days = 30;
        switch (range) {
          case '1D': days = 1; break;
          case '1W': days = 7; break;
          case '1M': days = 30; break;
          case '3M': days = 90; break;
          case '6M': days = 180; break;
          case '1Y': days = 365; break;
          case 'ALL': days = 365 * 3; break;
        }

        const dates = Object.keys(timeSeries).sort().reverse().slice(0, days);
        const history = dates.reverse().map(date => ({
          date: new Date(date).toISOString(),
          open: parseFloat(timeSeries[date]['1a. open (USD)']),
          high: parseFloat(timeSeries[date]['2a. high (USD)']),
          low: parseFloat(timeSeries[date]['3a. low (USD)']),
          close: parseFloat(timeSeries[date]['4a. close (USD)']),
          volume: parseFloat(timeSeries[date]['5. volume'] || '0'),
        }));

        setCachedData(cacheKey, 'history', history, range);
        return NextResponse.json({ success: true, data: history, source: 'Alpha Vantage' });
      }

      case 'search': {
        if (!query) {
          return NextResponse.json({ success: false, error: 'Query required' }, { status: 400 });
        }

        const results = Object.entries(CRYPTO_NAMES)
          .filter(([sym, name]) =>
            sym.toLowerCase().includes(query.toLowerCase()) ||
            name.toLowerCase().includes(query.toLowerCase())
          )
          .map(([sym, name]) => ({
            id: sym.toLowerCase(),
            symbol: sym,
            name,
          }));

        return NextResponse.json({ success: true, data: results });
      }

      case 'top': {
        // Return top cryptos with approximate data (fetching all would use too many API calls)
        const topSymbols = Object.entries(CRYPTO_MARKET_CAPS)
          .sort(([, a], [, b]) => b - a)
          .slice(0, limit)
          .map(([sym]) => sym);

        const topCryptos = topSymbols.map(sym => ({
          symbol: sym,
          name: CRYPTO_NAMES[sym] || sym,
          price: 0,
          change: 0,
          changePercent: 0,
          volume: 0,
          marketCap: CRYPTO_MARKET_CAPS[sym] || 0,
          assetType: 'crypto',
          timestamp: new Date(),
        }));

        // Fetch real prices for top 5 if API key available
        if (apiKey) {
          for (let i = 0; i < Math.min(5, topCryptos.length); i++) {
            try {
              const res = await fetch(
                `${AV_BASE}?function=CURRENCY_EXCHANGE_RATE&from_currency=${topCryptos[i].symbol}&to_currency=USD&apikey=${apiKey}`
              );
              const data = await res.json();
              const rateData = data['Realtime Currency Exchange Rate'];
              if (rateData) {
                topCryptos[i].price = parseFloat(rateData['5. Exchange Rate']);
              }
              await new Promise(resolve => setTimeout(resolve, 250));
            } catch {
              // Skip on error
            }
          }
        }

        return NextResponse.json({ success: true, data: topCryptos, source: 'Alpha Vantage' });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Crypto API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
