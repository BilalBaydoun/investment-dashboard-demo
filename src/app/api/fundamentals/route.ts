import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  pegRatio: number;
  bookValue: number;
  dividendPerShare: number;
  dividendYield: number;
  eps: number;
  revenuePerShareTTM: number;
  profitMargin: number;
  operatingMarginTTM: number;
  returnOnAssetsTTM: number;
  returnOnEquityTTM: number;
  revenueTTM: number;
  grossProfitTTM: number;
  quarterlyEarningsGrowthYOY: number;
  quarterlyRevenueGrowthYOY: number;
  analystTargetPrice: number;
  trailingPE: number;
  forwardPE: number;
  priceToSalesRatioTTM: number;
  priceToBookRatio: number;
  evToRevenue: number;
  evToEbitda: number;
  beta: number;
  week52High: number;
  week52Low: number;
  day50MovingAverage: number;
  day200MovingAverage: number;
  sharesOutstanding: number;
  dividendDate: string;
  exDividendDate: string;
}

// Cache for fundamentals (1 hour)
const fundamentalsCache: Record<string, { data: CompanyOverview; timestamp: number }> = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === 'None' || value === '-') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const symbols = searchParams.get('symbols')?.toUpperCase().split(',');
    const action = searchParams.get('action') || 'overview';

    // Get API key from header or env
    const apiKey = request.headers.get('x-alphavantage-key') || process.env.ALPHA_VANTAGE_API_KEY || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Alpha Vantage API key not configured. Add your key in Settings.',
        requiresSetup: true,
      }, { status: 503 });
    }

    // Single symbol overview
    if (action === 'overview' && symbol) {
      // Check cache
      const cached = fundamentalsCache[symbol];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return NextResponse.json({ success: true, data: cached.data, cached: true });
      }

      const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message'] || data['Note']) {
        return NextResponse.json({
          success: false,
          error: data['Error Message'] || 'API rate limit reached',
        }, { status: 429 });
      }

      if (!data.Symbol) {
        return NextResponse.json({
          success: false,
          error: `No data found for symbol: ${symbol}`,
        }, { status: 404 });
      }

      const overview: CompanyOverview = {
        symbol: data.Symbol,
        name: data.Name || symbol,
        description: data.Description || '',
        sector: data.Sector || 'Unknown',
        industry: data.Industry || 'Unknown',
        marketCap: parseNumber(data.MarketCapitalization),
        peRatio: parseNumber(data.PERatio),
        pegRatio: parseNumber(data.PEGRatio),
        bookValue: parseNumber(data.BookValue),
        dividendPerShare: parseNumber(data.DividendPerShare),
        dividendYield: parseNumber(data.DividendYield) * 100, // Convert to percentage
        eps: parseNumber(data.EPS),
        revenuePerShareTTM: parseNumber(data.RevenuePerShareTTM),
        profitMargin: parseNumber(data.ProfitMargin) * 100,
        operatingMarginTTM: parseNumber(data.OperatingMarginTTM) * 100,
        returnOnAssetsTTM: parseNumber(data.ReturnOnAssetsTTM) * 100,
        returnOnEquityTTM: parseNumber(data.ReturnOnEquityTTM) * 100,
        revenueTTM: parseNumber(data.RevenueTTM),
        grossProfitTTM: parseNumber(data.GrossProfitTTM),
        quarterlyEarningsGrowthYOY: parseNumber(data.QuarterlyEarningsGrowthYOY) * 100,
        quarterlyRevenueGrowthYOY: parseNumber(data.QuarterlyRevenueGrowthYOY) * 100,
        analystTargetPrice: parseNumber(data.AnalystTargetPrice),
        trailingPE: parseNumber(data.TrailingPE),
        forwardPE: parseNumber(data.ForwardPE),
        priceToSalesRatioTTM: parseNumber(data.PriceToSalesRatioTTM),
        priceToBookRatio: parseNumber(data.PriceToBookRatio),
        evToRevenue: parseNumber(data.EVToRevenue),
        evToEbitda: parseNumber(data.EVToEBITDA),
        beta: parseNumber(data.Beta),
        week52High: parseNumber(data['52WeekHigh']),
        week52Low: parseNumber(data['52WeekLow']),
        day50MovingAverage: parseNumber(data['50DayMovingAverage']),
        day200MovingAverage: parseNumber(data['200DayMovingAverage']),
        sharesOutstanding: parseNumber(data.SharesOutstanding),
        dividendDate: data.DividendDate || '',
        exDividendDate: data.ExDividendDate || '',
      };

      // Cache the result
      fundamentalsCache[symbol] = { data: overview, timestamp: Date.now() };

      return NextResponse.json({ success: true, data: overview });
    }

    // Batch fundamentals for multiple symbols
    if (action === 'batch' && symbols && symbols.length > 0) {
      const results: Record<string, CompanyOverview> = {};
      const errors: string[] = [];

      // Process in parallel with rate limiting (75 req/min = ~1.25 per second)
      // We'll do 5 at a time with small delays
      const batchSize = 5;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);

        const promises = batch.map(async (sym) => {
          // Check cache first
          const cached = fundamentalsCache[sym];
          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return { symbol: sym, data: cached.data, cached: true };
          }

          try {
            const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${sym}&apikey=${apiKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data['Error Message'] || data['Note'] || !data.Symbol) {
              return { symbol: sym, error: 'No data' };
            }

            const overview: CompanyOverview = {
              symbol: data.Symbol,
              name: data.Name || sym,
              description: data.Description || '',
              sector: data.Sector || 'Unknown',
              industry: data.Industry || 'Unknown',
              marketCap: parseNumber(data.MarketCapitalization),
              peRatio: parseNumber(data.PERatio),
              pegRatio: parseNumber(data.PEGRatio),
              bookValue: parseNumber(data.BookValue),
              dividendPerShare: parseNumber(data.DividendPerShare),
              dividendYield: parseNumber(data.DividendYield) * 100,
              eps: parseNumber(data.EPS),
              revenuePerShareTTM: parseNumber(data.RevenuePerShareTTM),
              profitMargin: parseNumber(data.ProfitMargin) * 100,
              operatingMarginTTM: parseNumber(data.OperatingMarginTTM) * 100,
              returnOnAssetsTTM: parseNumber(data.ReturnOnAssetsTTM) * 100,
              returnOnEquityTTM: parseNumber(data.ReturnOnEquityTTM) * 100,
              revenueTTM: parseNumber(data.RevenueTTM),
              grossProfitTTM: parseNumber(data.GrossProfitTTM),
              quarterlyEarningsGrowthYOY: parseNumber(data.QuarterlyEarningsGrowthYOY) * 100,
              quarterlyRevenueGrowthYOY: parseNumber(data.QuarterlyRevenueGrowthYOY) * 100,
              analystTargetPrice: parseNumber(data.AnalystTargetPrice),
              trailingPE: parseNumber(data.TrailingPE),
              forwardPE: parseNumber(data.ForwardPE),
              priceToSalesRatioTTM: parseNumber(data.PriceToSalesRatioTTM),
              priceToBookRatio: parseNumber(data.PriceToBookRatio),
              evToRevenue: parseNumber(data.EVToRevenue),
              evToEbitda: parseNumber(data.EVToEBITDA),
              beta: parseNumber(data.Beta),
              week52High: parseNumber(data['52WeekHigh']),
              week52Low: parseNumber(data['52WeekLow']),
              day50MovingAverage: parseNumber(data['50DayMovingAverage']),
              day200MovingAverage: parseNumber(data['200DayMovingAverage']),
              sharesOutstanding: parseNumber(data.SharesOutstanding),
              dividendDate: data.DividendDate || '',
              exDividendDate: data.ExDividendDate || '',
            };

            // Cache
            fundamentalsCache[sym] = { data: overview, timestamp: Date.now() };
            return { symbol: sym, data: overview };
          } catch (err) {
            return { symbol: sym, error: err instanceof Error ? err.message : 'Failed' };
          }
        });

        const batchResults = await Promise.all(promises);

        for (const result of batchResults) {
          if (result.data) {
            results[result.symbol] = result.data;
          } else if (result.error) {
            errors.push(`${result.symbol}: ${result.error}`);
          }
        }

        // Rate limit delay between batches
        if (i + batchSize < symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
        errors: errors.length > 0 ? errors : undefined,
        total: symbols.length,
        fetched: Object.keys(results).length,
      });
    }

    // Income statement
    if (action === 'income' && symbol) {
      const url = `${ALPHA_VANTAGE_BASE}?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message'] || data['Note']) {
        return NextResponse.json({
          success: false,
          error: data['Error Message'] || 'API rate limit',
        }, { status: 429 });
      }

      return NextResponse.json({
        success: true,
        data: {
          annualReports: data.annualReports?.slice(0, 5) || [],
          quarterlyReports: data.quarterlyReports?.slice(0, 8) || [],
        },
      });
    }

    // Balance sheet
    if (action === 'balance' && symbol) {
      const url = `${ALPHA_VANTAGE_BASE}?function=BALANCE_SHEET&symbol=${symbol}&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message'] || data['Note']) {
        return NextResponse.json({
          success: false,
          error: data['Error Message'] || 'API rate limit',
        }, { status: 429 });
      }

      return NextResponse.json({
        success: true,
        data: {
          annualReports: data.annualReports?.slice(0, 5) || [],
          quarterlyReports: data.quarterlyReports?.slice(0, 8) || [],
        },
      });
    }

    // Cash flow
    if (action === 'cashflow' && symbol) {
      const url = `${ALPHA_VANTAGE_BASE}?function=CASH_FLOW&symbol=${symbol}&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message'] || data['Note']) {
        return NextResponse.json({
          success: false,
          error: data['Error Message'] || 'API rate limit',
        }, { status: 429 });
      }

      return NextResponse.json({
        success: true,
        data: {
          annualReports: data.annualReports?.slice(0, 5) || [],
          quarterlyReports: data.quarterlyReports?.slice(0, 8) || [],
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action or missing symbol',
    }, { status: 400 });

  } catch (error) {
    console.error('Fundamentals API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch fundamentals',
    }, { status: 500 });
  }
}
