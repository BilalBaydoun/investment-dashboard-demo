import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AV_BASE = 'https://www.alphavantage.co/query';

// Precious metals use CURRENCY_EXCHANGE_RATE with these codes
const COMMODITY_MAP: Record<string, { avSymbol: string; name: string }> = {
  'GOLD': { avSymbol: 'XAU', name: 'Gold' },
  'XAU': { avSymbol: 'XAU', name: 'Gold' },
  'SILVER': { avSymbol: 'XAG', name: 'Silver' },
  'XAG': { avSymbol: 'XAG', name: 'Silver' },
  'PLATINUM': { avSymbol: 'XPT', name: 'Platinum' },
  'XPT': { avSymbol: 'XPT', name: 'Platinum' },
  'PALLADIUM': { avSymbol: 'XPD', name: 'Palladium' },
  'XPD': { avSymbol: 'XPD', name: 'Palladium' },
  'COPPER': { avSymbol: 'COPPER', name: 'Copper' },
};

// Cache prices for 5 minutes
const priceCache: Record<string, { price: number; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000;

function getApiKey(request: NextRequest): string {
  return request.headers.get('x-alphavantage-key') || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_KEY || '';
}

async function fetchCommodityPrice(avSymbol: string, apiKey: string): Promise<number | null> {
  const now = Date.now();
  const cached = priceCache[avSymbol];

  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.price;
  }

  try {
    let price: number | null = null;

    if (avSymbol === 'COPPER') {
      // Alpha Vantage has a dedicated COPPER endpoint
      const response = await fetch(
        `${AV_BASE}?function=COPPER&interval=monthly&apikey=${apiKey}`
      );
      const data = await response.json();

      if (data['Error Message'] || data['Note'] || data['Information']) {
        return cached?.price || null;
      }

      const dataPoints = data['data'];
      if (Array.isArray(dataPoints) && dataPoints.length > 0) {
        // Get the most recent data point (price per pound in USD)
        price = parseFloat(dataPoints[0].value);
        // Convert from per pound to per troy oz (1 troy oz ≈ 14.58 lbs for copper pricing)
        if (!isNaN(price)) {
          price = price * 14.5833;
        }
      }
    } else {
      // Use CURRENCY_EXCHANGE_RATE for precious metals (XAU, XAG, XPT, XPD)
      const response = await fetch(
        `${AV_BASE}?function=CURRENCY_EXCHANGE_RATE&from_currency=${avSymbol}&to_currency=USD&apikey=${apiKey}`
      );
      const data = await response.json();

      if (data['Error Message'] || data['Note'] || data['Information']) {
        return cached?.price || null;
      }

      const rateData = data['Realtime Currency Exchange Rate'];
      if (rateData) {
        price = parseFloat(rateData['5. Exchange Rate']);
      }
    }

    if (price !== null && !isNaN(price)) {
      priceCache[avSymbol] = { price, timestamp: now };
      return price;
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch ${avSymbol}:`, error);
    return cached?.price || null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();
  const action = searchParams.get('action') || 'quote';

  const apiKey = getApiKey(request);

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Alpha Vantage API key not configured',
      requiresSetup: true,
    }, { status: 503 });
  }

  if (action === 'quote' && symbol) {
    const commodity = COMMODITY_MAP[symbol];

    if (!commodity) {
      return NextResponse.json({
        success: false,
        error: `Unknown commodity symbol: ${symbol}. Supported: GOLD, SILVER, PLATINUM, PALLADIUM, COPPER (or XAU, XAG, XPT, XPD)`,
      }, { status: 400 });
    }

    const pricePerTroyOz = await fetchCommodityPrice(commodity.avSymbol, apiKey);

    if (pricePerTroyOz === null) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch commodity price',
      }, { status: 503 });
    }

    const pricePerGram = pricePerTroyOz / 31.1035;
    const pricePerKg = pricePerGram * 1000;
    const pricePerOz = pricePerTroyOz / 1.09714;

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        name: commodity.name,
        price: pricePerTroyOz,
        pricePerTroyOz,
        pricePerGram,
        pricePerKg,
        pricePerOz,
        unit: 'troy_oz',
        currency: 'USD',
        timestamp: new Date().toISOString(),
        source: 'Alpha Vantage',
      },
    });
  }

  if (action === 'all') {
    const metals = ['XAU', 'XAG', 'XPT', 'XPD'];
    const results = [];

    for (const avSymbol of metals) {
      const commodity = COMMODITY_MAP[avSymbol];
      const pricePerTroyOz = await fetchCommodityPrice(avSymbol, apiKey) || 0;
      results.push({
        symbol: avSymbol,
        name: commodity.name,
        price: pricePerTroyOz,
        pricePerTroyOz,
        pricePerGram: pricePerTroyOz / 31.1035,
        pricePerKg: (pricePerTroyOz / 31.1035) * 1000,
        pricePerOz: pricePerTroyOz / 1.09714,
        unit: 'troy_oz',
        currency: 'USD',
        source: 'Alpha Vantage',
      });

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
      source: 'Alpha Vantage',
    });
  }

  return NextResponse.json({
    success: false,
    error: 'Invalid action. Use ?action=quote&symbol=GOLD or ?action=all',
  }, { status: 400 });
}
