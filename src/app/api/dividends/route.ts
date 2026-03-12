import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Fallback dividend data for common stocks (used when no API key)
// Curated dividend data - amount is PER PAYMENT (not annual)
// For quarterly: annual = amount × 4
// For monthly: annual = amount × 12
const DIVIDEND_DATA: Record<string, { yield: number; frequency: 'quarterly' | 'monthly' | 'annual'; exDate: string; payDate: string; amount: number }> = {
  // Individual stocks (amount = per quarter dividend)
  AAPL: { yield: 0.44, frequency: 'quarterly', exDate: '2026-02-07', payDate: '2026-02-15', amount: 0.25 },    // $1.00/year
  MSFT: { yield: 0.7, frequency: 'quarterly', exDate: '2026-02-20', payDate: '2026-03-14', amount: 0.83 },     // $3.32/year
  GOOGL: { yield: 0.5, frequency: 'quarterly', exDate: '2026-03-10', payDate: '2026-03-25', amount: 0.20 },    // $0.80/year
  JNJ: { yield: 3.0, frequency: 'quarterly', exDate: '2026-02-24', payDate: '2026-03-10', amount: 1.24 },
  PG: { yield: 2.4, frequency: 'quarterly', exDate: '2026-01-24', payDate: '2026-02-15', amount: 1.01 },
  KO: { yield: 3.1, frequency: 'quarterly', exDate: '2026-03-14', payDate: '2026-04-01', amount: 0.49 },
  PEP: { yield: 2.7, frequency: 'quarterly', exDate: '2026-03-07', payDate: '2026-03-31', amount: 1.35 },
  VZ: { yield: 6.5, frequency: 'quarterly', exDate: '2026-01-10', payDate: '2026-02-01', amount: 0.67 },
  T: { yield: 5.0, frequency: 'quarterly', exDate: '2026-01-10', payDate: '2026-02-01', amount: 0.28 },
  XOM: { yield: 3.3, frequency: 'quarterly', exDate: '2026-02-12', payDate: '2026-03-10', amount: 0.99 },
  CVX: { yield: 4.0, frequency: 'quarterly', exDate: '2026-02-14', payDate: '2026-03-10', amount: 1.63 },
  JPM: { yield: 2.1, frequency: 'quarterly', exDate: '2026-01-06', payDate: '2026-01-31', amount: 1.25 },
  BAC: { yield: 2.4, frequency: 'quarterly', exDate: '2026-03-07', payDate: '2026-03-28', amount: 0.26 },
  HD: { yield: 2.2, frequency: 'quarterly', exDate: '2026-03-06', payDate: '2026-03-20', amount: 2.25 },
  MCD: { yield: 2.1, frequency: 'quarterly', exDate: '2026-03-01', payDate: '2026-03-17', amount: 1.77 },
  ABBV: { yield: 3.4, frequency: 'quarterly', exDate: '2026-01-14', payDate: '2026-02-14', amount: 1.64 },
  MRK: { yield: 2.8, frequency: 'quarterly', exDate: '2026-03-14', payDate: '2026-04-08', amount: 0.81 },
  COST: { yield: 0.5, frequency: 'quarterly', exDate: '2026-02-07', payDate: '2026-02-21', amount: 1.16 },
  NVDA: { yield: 0.03, frequency: 'quarterly', exDate: '2026-03-05', payDate: '2026-03-28', amount: 0.01 },

  // REITs (monthly dividends - amount = per month)
  O: { yield: 5.7, frequency: 'monthly', exDate: '2026-01-31', payDate: '2026-02-15', amount: 0.264 },         // $3.168/year

  // Dividend ETFs (quarterly - amount = per quarter)
  SCHD: { yield: 3.4, frequency: 'quarterly', exDate: '2026-03-20', payDate: '2026-03-27', amount: 0.73 },     // $2.92/year
  VYM: { yield: 2.8, frequency: 'quarterly', exDate: '2026-03-20', payDate: '2026-03-27', amount: 0.89 },
  VIG: { yield: 1.8, frequency: 'quarterly', exDate: '2026-03-20', payDate: '2026-03-27', amount: 0.80 },
  SPY: { yield: 1.2, frequency: 'quarterly', exDate: '2026-03-21', payDate: '2026-04-30', amount: 1.78 },
  QQQ: { yield: 0.5, frequency: 'quarterly', exDate: '2026-03-21', payDate: '2026-04-30', amount: 0.58 },
  VOO: { yield: 1.3, frequency: 'quarterly', exDate: '2026-03-21', payDate: '2026-04-30', amount: 1.70 },

  // Bond ETFs (monthly distributions - amount = per month)
  AGGU: { yield: 4.0, frequency: 'monthly', exDate: '2026-02-01', payDate: '2026-02-07', amount: 0.019 },      // ~$0.23/year per share
  BND: { yield: 3.5, frequency: 'monthly', exDate: '2026-02-01', payDate: '2026-02-07', amount: 0.21 },
  AGG: { yield: 3.4, frequency: 'monthly', exDate: '2026-02-01', payDate: '2026-02-07', amount: 0.28 },

  // High Yield Bond ETFs (monthly - amount = per month)
  JHYU: { yield: 6.2, frequency: 'monthly', exDate: '2026-02-01', payDate: '2026-02-07', amount: 2.16 },       // ~$25.92/year per share
  HYG: { yield: 5.5, frequency: 'monthly', exDate: '2026-02-01', payDate: '2026-02-07', amount: 0.36 },
  JNK: { yield: 5.8, frequency: 'monthly', exDate: '2026-02-01', payDate: '2026-02-07', amount: 0.43 },

  // REIT ETFs (quarterly - amount = per quarter)
  JMRE: { yield: 3.6, frequency: 'quarterly', exDate: '2026-03-15', payDate: '2026-03-25', amount: 0.40 },     // ~$1.60/year per share
  JGRE: { yield: 3.2, frequency: 'quarterly', exDate: '2026-03-15', payDate: '2026-03-25', amount: 0.38 },     // ~$1.52/year per share
  VNQ: { yield: 4.0, frequency: 'quarterly', exDate: '2026-03-15', payDate: '2026-03-25', amount: 0.92 },

  // No dividend stocks (included for completeness with 0 values)
  UBER: { yield: 0, frequency: 'annual', exDate: '', payDate: '', amount: 0 },
  AMD: { yield: 0, frequency: 'annual', exDate: '', payDate: '', amount: 0 },
  TSLA: { yield: 0, frequency: 'annual', exDate: '', payDate: '', amount: 0 },
  BLBD: { yield: 0, frequency: 'annual', exDate: '', payDate: '', amount: 0 },
  QS: { yield: 0, frequency: 'annual', exDate: '', payDate: '', amount: 0 },
};

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
  const apiKey = request.headers.get('x-alphavantage-key') ||
    process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY ||
    process.env.ALPHA_VANTAGE_API_KEY ||
    process.env.ALPHA_VANTAGE_KEY;

  try {
    switch (action) {
      case 'calendar': {
        // Check cache first
        const cacheKey = `dividend-calendar-${symbols?.sort().join(',') || 'all'}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        // Use DIVIDEND_DATA directly (most reliable source)
        const mockDividends = generateMockDividendCalendar(symbols);
        setCachedData(cacheKey, mockDividends);
        return NextResponse.json({
          success: true,
          data: mockDividends,
        });
      }

      case 'info': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        // Check cache
        const cacheKey = `dividend-info-${symbol}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        // Try Alpha Vantage OVERVIEW for dividend info
        if (apiKey) {
          try {
            const response = await fetch(
              `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
            );
            const data = await response.json();

            if (data.Symbol && !data['Error Message'] && !data['Note']) {
              const dividendPerShare = parseFloat(data.DividendPerShare) || 0;
              const dividendYield = parseFloat(data.DividendYield) * 100 || 0;
              const exDividendDate = data.ExDividendDate || null;
              const dividendDate = data.DividendDate || null;

              // Determine frequency from DIVIDEND_DATA if available, otherwise assume quarterly
              const knownData = DIVIDEND_DATA[symbol];
              const frequency = knownData?.frequency || 'quarterly';
              const perPayment = frequency === 'quarterly' ? dividendPerShare / 4 :
                                 frequency === 'monthly' ? dividendPerShare / 12 : dividendPerShare;

              const infoData = {
                symbol,
                name: data.Name,
                dividendYield,
                lastDividend: perPayment,
                annualDividend: dividendPerShare,
                frequency,
                nextExDate: exDividendDate,
                nextPayDate: dividendDate,
                payoutRatio: 0,
                currency: data.Currency || 'USD',
              };
              setCachedData(cacheKey, infoData);
              return NextResponse.json({ success: true, data: infoData });
            }
          } catch (e) {
            console.error(`Failed to fetch dividend info for ${symbol}:`, e);
          }
        }

        // Fallback to DIVIDEND_DATA
        const mockInfo = DIVIDEND_DATA[symbol];
        if (mockInfo) {
          return NextResponse.json({
            success: true,
            data: {
              symbol,
              dividendYield: mockInfo.yield,
              lastDividend: mockInfo.amount,
              annualDividend: mockInfo.frequency === 'quarterly' ? mockInfo.amount * 4 :
                              mockInfo.frequency === 'monthly' ? mockInfo.amount * 12 : mockInfo.amount,
              frequency: mockInfo.frequency,
              nextExDate: mockInfo.exDate,
              nextPayDate: mockInfo.payDate,
            },
            mock: true
          });
        }

        return NextResponse.json({
          success: true,
          data: { symbol, dividendYield: 0, lastDividend: 0, annualDividend: 0 },
          mock: true
        });
      }

      case 'history': {
        if (!symbol) {
          return NextResponse.json({ success: false, error: 'Symbol required' }, { status: 400 });
        }

        // Check cache
        const cacheKey = `dividend-history-${symbol}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        // Try Alpha Vantage CASH_FLOW for dividend payout history
        if (apiKey) {
          try {
            const response = await fetch(
              `${ALPHA_VANTAGE_BASE}?function=CASH_FLOW&symbol=${symbol}&apikey=${apiKey}`
            );
            const data = await response.json();

            if (data.quarterlyReports && Array.isArray(data.quarterlyReports) && data.quarterlyReports.length > 0) {
              const history = data.quarterlyReports
                .slice(0, 24)
                .filter((r: any) => r.dividendPayout && r.dividendPayout !== 'None' && parseFloat(r.dividendPayout) > 0)
                .map((r: any) => ({
                  date: r.fiscalDateEnding,
                  amount: parseFloat(r.dividendPayout) || 0,
                }));

              if (history.length > 0) {
                setCachedData(cacheKey, history);
                return NextResponse.json({ success: true, data: history });
              }
            }
          } catch (e) {
            console.error(`Failed to fetch dividend history for ${symbol}:`, e);
          }
        }

        // Mock history fallback
        return NextResponse.json({
          success: true,
          data: generateMockDividendHistory(symbol),
          mock: true
        });
      }

      case 'portfolio-income': {
        // Calculate total dividend income for portfolio
        if (!symbols || symbols.length === 0) {
          return NextResponse.json({ success: false, error: 'Symbols required' }, { status: 400 });
        }

        const quantities = searchParams.get('quantities')?.split(',').map(Number) || [];

        // Check cache - use sorted copy for consistent cache key (don't mutate original!)
        const sortedSymbols = [...symbols].sort();
        const cacheKey = `dividend-portfolio-${sortedSymbols.join(',')}-${quantities.join(',')}`;
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return NextResponse.json({ success: true, data: cachedData, cached: true });
        }

        let totalAnnualIncome = 0;
        const breakdown: any[] = [];

        // Use curated DIVIDEND_DATA (most reliable source)
        for (let i = 0; i < symbols.length; i++) {
          const sym = symbols[i];
          const qty = quantities[i] || 0;
          const divData = DIVIDEND_DATA[sym];

          if (divData && qty > 0) {
            let annualDiv = divData.amount;
            if (divData.frequency === 'quarterly') annualDiv *= 4;
            if (divData.frequency === 'monthly') annualDiv *= 12;

            const annualIncome = annualDiv * qty;
            totalAnnualIncome += annualIncome;

            breakdown.push({
              symbol: sym,
              quantity: qty,
              dividendPerShare: divData.amount,
              frequency: divData.frequency,
              yield: divData.yield,
              annualIncome,
              monthlyIncome: annualIncome / 12,
              nextExDate: divData.exDate,
            });
          }
        }

        const totalMonthlyIncome = totalAnnualIncome / 12;

        const portfolioData = {
          totalAnnualIncome,
          totalMonthlyIncome,
          breakdown: breakdown.sort((a, b) => b.annualIncome - a.annualIncome),
        };

        setCachedData(cacheKey, portfolioData);

        return NextResponse.json({
          success: true,
          data: portfolioData,
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Dividends API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dividend data' },
      { status: 500 }
    );
  }
}

function generateMockDividendCalendar(symbols?: string[]) {
  const targetSymbols = symbols?.filter(s => DIVIDEND_DATA[s]) ||
    Object.keys(DIVIDEND_DATA).slice(0, 10);

  return targetSymbols
    .filter(s => DIVIDEND_DATA[s])
    .map(symbol => {
      const data = DIVIDEND_DATA[symbol];
      return {
        symbol,
        exDate: data.exDate,
        paymentDate: data.payDate,
        amount: data.amount,
        yield: data.yield,
        frequency: data.frequency,
      };
    })
    .sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());
}

function generateMockDividendHistory(symbol: string) {
  const baseData = DIVIDEND_DATA[symbol];
  if (!baseData) return [];

  const history = [];
  const today = new Date();

  for (let i = 0; i < 12; i++) {
    const quarterDate = new Date(today);
    if (baseData.frequency === 'quarterly') {
      quarterDate.setMonth(today.getMonth() - (i * 3));
    } else if (baseData.frequency === 'monthly') {
      quarterDate.setMonth(today.getMonth() - i);
    } else {
      quarterDate.setFullYear(today.getFullYear() - i);
    }

    // Slight variation in dividend amount (dividend growth simulation)
    const growthFactor = 1 - (i * 0.01); // 1% growth per period going back
    const amount = (baseData.amount * growthFactor).toFixed(4);

    history.push({
      date: quarterDate.toISOString().split('T')[0],
      amount: parseFloat(amount),
    });
  }

  return history;
}
