import { NextRequest, NextResponse } from 'next/server';

interface InsiderTransaction {
  name: string;
  relationship: string;
  transactionDate: string;
  transactionType: string;
  shares: number;
  price: number;
  value: number;
  sharesOwned: number;
}

// Cache for insider data (1 hour)
const insiderCache: Record<string, { data: InsiderTransaction[]; timestamp: number }> = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol')?.toUpperCase();

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol required' },
        { status: 400 }
      );
    }

    // Check cache
    const cached = insiderCache[symbol];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ success: true, data: cached.data, cached: true });
    }

    // Use Yahoo Finance unofficial API for insider data (free, no key needed)
    try {
      const response = await fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=insiderTransactions,institutionOwnership`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const insiderData = data?.quoteSummary?.result?.[0]?.insiderTransactions?.transactions;

        if (insiderData && Array.isArray(insiderData)) {
          const transactions: InsiderTransaction[] = insiderData
            .slice(0, 20)
            .map((t: any) => ({
              name: t.filerName || 'Unknown',
              relationship: t.filerRelation || 'Unknown',
              transactionDate: t.startDate?.fmt || 'Unknown',
              transactionType: t.transactionText || (t.shares?.raw > 0 ? 'Buy' : 'Sell'),
              shares: Math.abs(t.shares?.raw || 0),
              price: t.value?.raw && t.shares?.raw ? Math.abs(t.value.raw / t.shares.raw) : 0,
              value: Math.abs(t.value?.raw || 0),
              sharesOwned: t.ownership?.raw || 0,
            }));

          insiderCache[symbol] = { data: transactions, timestamp: Date.now() };
          return NextResponse.json({ success: true, data: transactions });
        }
      }
    } catch (error) {
      console.error('Yahoo Finance error:', error);
    }

    // Return mock data for demonstration if Yahoo Finance fails
    const mockTransactions: InsiderTransaction[] = [
      {
        name: 'Insider data from Yahoo Finance',
        relationship: 'Info',
        transactionDate: new Date().toISOString().split('T')[0],
        transactionType: 'Info',
        shares: 0,
        price: 0,
        value: 0,
        sharesOwned: 0,
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockTransactions,
      note: 'Insider data sourced from Yahoo Finance. Data may be temporarily unavailable.'
    });

  } catch (error) {
    console.error('Insider API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch insider data' },
      { status: 500 }
    );
  }
}
