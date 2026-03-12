import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// ISIN format: 2 letter country code + 9 alphanumeric + 1 check digit
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

interface SecurityInfo {
  code: string;
  exchange: string;
  name: string;
  type: string;
  country: string;
  currency: string;
  isin: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isin = searchParams.get('isin')?.toUpperCase();
  const action = searchParams.get('action') || 'lookup';

  const apiKey = request.headers.get('x-alphavantage-key') ||
    process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY ||
    process.env.ALPHA_VANTAGE_API_KEY ||
    process.env.ALPHA_VANTAGE_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Alpha Vantage API key not configured',
      requiresSetup: true,
    }, { status: 503 });
  }

  if (action === 'lookup') {
    if (!isin) {
      return NextResponse.json({
        success: false,
        error: 'ISIN required',
      }, { status: 400 });
    }

    // Validate ISIN format
    if (!ISIN_REGEX.test(isin)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ISIN format. Expected: 2 letters + 9 alphanumeric + 1 digit (e.g., US0378331005)',
      }, { status: 400 });
    }

    try {
      // Use Alpha Vantage SYMBOL_SEARCH with ISIN as keywords (best-effort)
      const searchUrl = `${ALPHA_VANTAGE_BASE}?function=SYMBOL_SEARCH&keywords=${isin}&apikey=${apiKey}`;
      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status}`);
      }

      const data = await response.json();

      if (data['Error Message'] || data['Note']) {
        throw new Error(data['Error Message'] || 'API rate limit reached');
      }

      const bestMatches = data['bestMatches'];

      if (!Array.isArray(bestMatches) || bestMatches.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No security found for ISIN: ${isin}`,
        }, { status: 404 });
      }

      // Find the best match (prefer US region, then by match score)
      let bestMatch = bestMatches[0];
      for (const match of bestMatches) {
        if (match['4. region'] === 'United States') {
          bestMatch = match;
          break;
        }
      }

      const symbolCode = bestMatch['1. symbol'] || '';
      const name = bestMatch['2. name'] || '';
      const typeStr = bestMatch['3. type'] || '';
      const region = bestMatch['4. region'] || isin.substring(0, 2);
      const currency = bestMatch['8. currency'] || 'USD';

      const security: SecurityInfo = {
        code: symbolCode,
        exchange: bestMatch['4. region'] || '',
        name,
        type: typeStr,
        country: region,
        currency,
        isin,
      };

      // Determine asset type
      let assetType = 'stock';
      const typeLower = typeStr.toLowerCase();
      const nameLower = name.toLowerCase();

      if (typeLower.includes('etf') || nameLower.includes('etf')) {
        assetType = 'etf';
      } else if (typeLower.includes('bond') || typeLower.includes('fixed income') || nameLower.includes('bond')) {
        assetType = 'bond';
      } else if (typeLower.includes('fund') || nameLower.includes('fund')) {
        assetType = 'etf';
      }

      // Fetch current price via GLOBAL_QUOTE
      let price = 0;
      let previousClose = 0;

      try {
        const quoteUrl = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbolCode}&apikey=${apiKey}`;
        const quoteResponse = await fetch(quoteUrl);

        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          const globalQuote = quoteData['Global Quote'];
          if (globalQuote) {
            price = parseFloat(globalQuote['05. price']) || 0;
            previousClose = parseFloat(globalQuote['08. previous close']) || 0;
          }
        }
      } catch (e) {
        console.error('Failed to fetch price for ISIN lookup:', e);
      }

      return NextResponse.json({
        success: true,
        data: {
          ...security,
          symbol: security.code,
          fullSymbol: security.code,
          assetType,
          price,
          previousClose,
          allMatches: bestMatches.map((item: any) => ({
            code: item['1. symbol'],
            exchange: item['4. region'],
            name: item['2. name'],
            type: item['3. type'],
          })),
        },
      });

    } catch (error) {
      console.error('ISIN lookup error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lookup ISIN',
      }, { status: 500 });
    }
  }

  // Search for securities (general search)
  if (action === 'search') {
    const query = searchParams.get('query');
    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Search query required',
      }, { status: 400 });
    }

    try {
      const searchUrl = `${ALPHA_VANTAGE_BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${apiKey}`;
      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();

      if (data['Error Message'] || data['Note']) {
        throw new Error(data['Error Message'] || 'API rate limit reached');
      }

      const bestMatches = data['bestMatches'] || [];

      const results = bestMatches.slice(0, 20).map((item: any) => ({
        code: item['1. symbol'],
        exchange: item['4. region'],
        name: item['2. name'],
        type: item['3. type'],
        isin: '',
        country: item['4. region'],
        currency: item['8. currency'],
      }));

      return NextResponse.json({
        success: true,
        data: results,
      });

    } catch (error) {
      console.error('Search error:', error);
      return NextResponse.json({
        success: false,
        error: 'Search failed',
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: false,
    error: 'Invalid action',
  }, { status: 400 });
}
