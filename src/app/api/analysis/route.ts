import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Helper to parse Alpha Vantage numbers
function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === 'None' || value === '-') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

// Cache for analysis data (15 min)
const analysisCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 15 * 60 * 1000;

interface EarningsData {
  fiscalDateEnding: string;
  reportedDate: string;
  reportedEPS: number;
  estimatedEPS: number;
  surprise: number;
  surprisePercentage: number;
  beat: boolean;
}

interface FairValueEstimate {
  method: string;
  value: number;
  description: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase();

    const apiKey = request.headers.get('x-alphavantage-key') || process.env.ALPHA_VANTAGE_API_KEY || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || process.env.ALPHA_VANTAGE_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Alpha Vantage API key not configured',
        requiresSetup: true,
      }, { status: 503 });
    }

    if (!symbol) {
      return NextResponse.json({
        success: false,
        error: 'Symbol is required',
      }, { status: 400 });
    }

    // Check cache
    const cacheKey = `analysis_${symbol}`;
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ success: true, data: cached.data, cached: true });
    }

    // Fetch data sequentially to avoid rate limiting
    // Even with 75 req/min, parallel requests can cause issues
    const overviewRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`);
    const overview = await overviewRes.json();

    // Check overview first before making more requests
    if (overview['Error Message'] || overview['Note'] || overview['Information'] || !overview.Symbol) {
      // Return early with better error info
      if (overview['Note']) {
        return NextResponse.json({
          success: false,
          error: 'Alpha Vantage API rate limit reached. Please wait a moment and try again.',
        }, { status: 429 });
      }
      if (overview['Information']) {
        return NextResponse.json({
          success: false,
          error: overview['Information'],
        }, { status: 400 });
      }
      if (overview['Error Message']) {
        return NextResponse.json({
          success: false,
          error: overview['Error Message'],
        }, { status: 400 });
      }
      console.log('Alpha Vantage empty response for', symbol, ':', JSON.stringify(overview).slice(0, 500));
      return NextResponse.json({
        success: false,
        error: `No data found for ${symbol}. Verify your Alpha Vantage API key is valid.`,
        debug: { hasKey: !!apiKey, keyLen: apiKey?.length, response: overview },
      }, { status: 404 });
    }

    // Fetch real-time quote for current price
    await new Promise(r => setTimeout(r, 100));
    const quoteRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
    const quoteData = await quoteRes.json();
    const realTimePrice = parseNumber(quoteData?.['Global Quote']?.['05. price']);

    // Fetch remaining data with small delays to respect rate limits
    await new Promise(r => setTimeout(r, 100));
    const earningsRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=EARNINGS&symbol=${symbol}&apikey=${apiKey}`);
    const earnings = await earningsRes.json();

    await new Promise(r => setTimeout(r, 100));
    const incomeRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${apiKey}`);
    const income = await incomeRes.json();

    await new Promise(r => setTimeout(r, 100));
    const balanceRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=BALANCE_SHEET&symbol=${symbol}&apikey=${apiKey}`);
    const balance = await balanceRes.json();

    await new Promise(r => setTimeout(r, 100));
    const cashFlowRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=CASH_FLOW&symbol=${symbol}&apikey=${apiKey}`);
    const cashFlow = await cashFlowRes.json();

    // Fetch earnings calendar for next earnings date
    await new Promise(r => setTimeout(r, 100));
    const earningsCalendarRes = await fetch(`${ALPHA_VANTAGE_BASE}?function=EARNINGS_CALENDAR&symbol=${symbol}&horizon=3month&apikey=${apiKey}`);
    const earningsCalendarText = await earningsCalendarRes.text();
    let earningsCalendar: any[] = [];

    // Parse CSV response from earnings calendar
    if (earningsCalendarText && !earningsCalendarText.includes('Error') && !earningsCalendarText.includes('Note')) {
      const lines = earningsCalendarText.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',');
        earningsCalendar = lines.slice(1).map(line => {
          const values = line.split(',');
          const entry: any = {};
          headers.forEach((h, i) => {
            entry[h.trim()] = values[i]?.trim() || '';
          });
          return entry;
        }).filter(e => e.symbol === symbol);
      }
    }

    // Overview validation already done above

    // Parse fundamentals
    const fundamentals = {
      symbol: overview.Symbol,
      name: overview.Name,
      description: overview.Description,
      sector: overview.Sector,
      industry: overview.Industry,
      marketCap: parseNumber(overview.MarketCapitalization),
      peRatio: parseNumber(overview.PERatio),
      pegRatio: parseNumber(overview.PEGRatio),
      bookValue: parseNumber(overview.BookValue),
      dividendPerShare: parseNumber(overview.DividendPerShare),
      dividendYield: parseNumber(overview.DividendYield) * 100,
      eps: parseNumber(overview.EPS),
      revenuePerShare: parseNumber(overview.RevenuePerShareTTM),
      profitMargin: parseNumber(overview.ProfitMargin) * 100,
      operatingMargin: parseNumber(overview.OperatingMarginTTM) * 100,
      returnOnAssets: parseNumber(overview.ReturnOnAssetsTTM) * 100,
      returnOnEquity: parseNumber(overview.ReturnOnEquityTTM) * 100,
      revenueTTM: parseNumber(overview.RevenueTTM),
      grossProfitTTM: parseNumber(overview.GrossProfitTTM),
      quarterlyEarningsGrowth: parseNumber(overview.QuarterlyEarningsGrowthYOY) * 100,
      quarterlyRevenueGrowth: parseNumber(overview.QuarterlyRevenueGrowthYOY) * 100,
      analystTargetPrice: parseNumber(overview.AnalystTargetPrice),
      analystRatingStrongBuy: parseNumber(overview.AnalystRatingStrongBuy),
      analystRatingBuy: parseNumber(overview.AnalystRatingBuy),
      analystRatingHold: parseNumber(overview.AnalystRatingHold),
      analystRatingSell: parseNumber(overview.AnalystRatingSell),
      analystRatingStrongSell: parseNumber(overview.AnalystRatingStrongSell),
      trailingPE: parseNumber(overview.TrailingPE),
      forwardPE: parseNumber(overview.ForwardPE),
      priceToSales: parseNumber(overview.PriceToSalesRatioTTM),
      priceToBook: parseNumber(overview.PriceToBookRatio),
      evToRevenue: parseNumber(overview.EVToRevenue),
      evToEbitda: parseNumber(overview.EVToEBITDA),
      beta: parseNumber(overview.Beta),
      week52High: parseNumber(overview['52WeekHigh']),
      week52Low: parseNumber(overview['52WeekLow']),
      day50MA: parseNumber(overview['50DayMovingAverage']),
      day200MA: parseNumber(overview['200DayMovingAverage']),
      sharesOutstanding: parseNumber(overview.SharesOutstanding),
      sharesFloat: parseNumber(overview.SharesFloat),
      sharesShort: parseNumber(overview.SharesShort),
      shortRatio: parseNumber(overview.ShortRatio),
      shortPercentFloat: parseNumber(overview.ShortPercentFloat),
      percentInsiders: parseNumber(overview.PercentInsiders),
      percentInstitutions: parseNumber(overview.PercentInstitutions),
      forwardAnnualDividendRate: parseNumber(overview.ForwardAnnualDividendRate),
      forwardAnnualDividendYield: parseNumber(overview.ForwardAnnualDividendYield) * 100,
      payoutRatio: parseNumber(overview.PayoutRatio) * 100,
      dividendDate: overview.DividendDate || '',
      exDividendDate: overview.ExDividendDate || '',
    };

    // Parse earnings history
    const earningsHistory: EarningsData[] = [];
    if (earnings.quarterlyEarnings && Array.isArray(earnings.quarterlyEarnings)) {
      for (const q of earnings.quarterlyEarnings.slice(0, 12)) {
        const reported = parseNumber(q.reportedEPS);
        const estimated = parseNumber(q.estimatedEPS);
        const surprise = reported - estimated;
        const surprisePercent = estimated !== 0 ? (surprise / Math.abs(estimated)) * 100 : 0;

        earningsHistory.push({
          fiscalDateEnding: q.fiscalDateEnding,
          reportedDate: q.reportedDate,
          reportedEPS: reported,
          estimatedEPS: estimated,
          surprise,
          surprisePercentage: surprisePercent,
          beat: reported > estimated,
        });
      }
    }

    // Get next earnings date from earnings calendar (real data)
    let nextEarningsDate = '';
    let nextEarningsEstimate = 0;
    let nextEarningsIsEstimated = false;

    // Use earnings calendar if available (most accurate)
    if (earningsCalendar.length > 0) {
      const nextEarning = earningsCalendar.find((e: any) => {
        const reportDate = new Date(e.reportDate);
        return reportDate >= new Date();
      });
      if (nextEarning) {
        nextEarningsDate = nextEarning.reportDate;
        nextEarningsEstimate = parseNumber(nextEarning.estimate);
        nextEarningsIsEstimated = false; // Confirmed from calendar
      }
    }

    // Fallback: estimate from last reported date if calendar not available
    if (!nextEarningsDate && earningsHistory.length > 0) {
      const lastQuarter = earningsHistory[0];
      if (lastQuarter) {
        const lastDate = new Date(lastQuarter.reportedDate);
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + 3);
        if (nextDate > new Date()) {
          nextEarningsDate = nextDate.toISOString().split('T')[0];
          nextEarningsEstimate = fundamentals.forwardPE > 0 && fundamentals.analystTargetPrice > 0
            ? (fundamentals.analystTargetPrice / fundamentals.forwardPE) / 4
            : lastQuarter.estimatedEPS;
          nextEarningsIsEstimated = true; // Estimated (not from calendar)
        }
      }
    }

    // Calculate Fair Value estimates
    const fairValueEstimates: FairValueEstimate[] = [];
    const currentPrice = realTimePrice || fundamentals.day50MA || 0;

    // 1. Analyst Target Price
    if (fundamentals.analystTargetPrice > 0) {
      fairValueEstimates.push({
        method: 'Analyst Target',
        value: fundamentals.analystTargetPrice,
        description: `Consensus target from ${fundamentals.analystRatingStrongBuy + fundamentals.analystRatingBuy + fundamentals.analystRatingHold + fundamentals.analystRatingSell + fundamentals.analystRatingStrongSell} analysts`,
      });
    }

    // 2. Graham Number: sqrt(22.5 × EPS × Book Value)
    if (fundamentals.eps > 0 && fundamentals.bookValue > 0) {
      const grahamNumber = Math.sqrt(22.5 * fundamentals.eps * fundamentals.bookValue);
      fairValueEstimates.push({
        method: 'Graham Number',
        value: grahamNumber,
        description: 'Benjamin Graham formula: √(22.5 × EPS × Book Value)',
      });
    }

    // 3. P/E Based Fair Value (using sector average or 15)
    if (fundamentals.eps > 0) {
      const sectorPE = getSectorAveragePE(fundamentals.sector);
      const peBasedValue = fundamentals.eps * sectorPE;
      fairValueEstimates.push({
        method: 'P/E Based',
        value: peBasedValue,
        description: `EPS × ${sectorPE} (${fundamentals.sector} average P/E)`,
      });
    }

    // 4. PEG Based Fair Value
    if (fundamentals.eps > 0 && fundamentals.quarterlyEarningsGrowth > 0) {
      const pegBasedPE = fundamentals.quarterlyEarningsGrowth; // PEG of 1
      const pegBasedValue = fundamentals.eps * pegBasedPE;
      fairValueEstimates.push({
        method: 'PEG Based',
        value: pegBasedValue,
        description: `EPS × Growth Rate (${fundamentals.quarterlyEarningsGrowth.toFixed(0)}%) - PEG ratio of 1`,
      });
    }

    // 5. DCF Simplified (10-year projection)
    const dcfValue = calculateSimpleDCF(
      fundamentals.eps,
      fundamentals.quarterlyEarningsGrowth / 100,
      0.10, // Discount rate
      0.03  // Terminal growth
    );
    if (dcfValue > 0) {
      fairValueEstimates.push({
        method: 'DCF Model',
        value: dcfValue,
        description: '10-year DCF with 10% discount rate, 3% terminal growth',
      });
    }

    // Calculate average fair value
    const validEstimates = fairValueEstimates.filter(e => e.value > 0);
    const averageFairValue = validEstimates.length > 0
      ? validEstimates.reduce((sum, e) => sum + e.value, 0) / validEstimates.length
      : 0;

    // Parse financial statements for trends
    const incomeStatements = income.annualReports?.slice(0, 5) || [];
    const balanceSheets = balance.annualReports?.slice(0, 5) || [];
    const cashFlowStatements = cashFlow.annualReports?.slice(0, 5) || [];

    // Calculate revenue and earnings trends from financial statements
    // Alpha Vantage field names can vary - try multiple
    let revenueTrend = calculateTrend(
      incomeStatements.map((i: any) => parseNumber(i.totalRevenue || i.revenue || i.TotalRevenue))
    );
    let earningsTrend = calculateTrend(
      incomeStatements.map((i: any) => parseNumber(i.netIncome || i.netProfit || i.NetIncome))
    );
    let fcfTrend = calculateTrend(
      cashFlowStatements.map((c: any) => {
        const opCash = parseNumber(c.operatingCashflow || c.operatingCashFlow || c.OperatingCashflow);
        const capEx = parseNumber(c.capitalExpenditures || c.capitalExpenditure || c.CapitalExpenditures);
        return opCash - Math.abs(capEx);
      })
    );

    // Fallback: use fundamentals if financial statements don't have data
    if (revenueTrend.cagr === 0 && fundamentals.quarterlyRevenueGrowth !== 0) {
      revenueTrend = {
        direction: fundamentals.quarterlyRevenueGrowth > 5 ? 'up' : fundamentals.quarterlyRevenueGrowth < -5 ? 'down' : 'flat',
        cagr: fundamentals.quarterlyRevenueGrowth,
        consistent: true,
      };
    }
    if (earningsTrend.cagr === 0 && fundamentals.quarterlyEarningsGrowth !== 0) {
      earningsTrend = {
        direction: fundamentals.quarterlyEarningsGrowth > 5 ? 'up' : fundamentals.quarterlyEarningsGrowth < -5 ? 'down' : 'flat',
        cagr: fundamentals.quarterlyEarningsGrowth,
        consistent: true,
      };
    }

    // Calculate Buffett Score
    const buffettScore = calculateBuffettScore(fundamentals, currentPrice);

    // Build analysis result
    const analysisData = {
      symbol,
      fundamentals,
      currentQuotePrice: currentPrice,
      fairValue: {
        estimates: fairValueEstimates,
        average: averageFairValue,
        currentPrice,
        upside: currentPrice > 0 ? ((averageFairValue - currentPrice) / currentPrice) * 100 : 0,
      },
      earnings: {
        history: earningsHistory,
        nextDate: nextEarningsDate,
        nextEstimate: nextEarningsEstimate,
        nextIsEstimated: nextEarningsIsEstimated,
        beatRate: earningsHistory.filter(e => e.beat).length / Math.max(earningsHistory.length, 1) * 100,
        avgSurprise: earningsHistory.reduce((sum, e) => sum + e.surprisePercentage, 0) / Math.max(earningsHistory.length, 1),
      },
      trends: {
        revenue: revenueTrend,
        earnings: earningsTrend,
        freeCashFlow: fcfTrend,
      },
      analystRatings: {
        strongBuy: fundamentals.analystRatingStrongBuy,
        buy: fundamentals.analystRatingBuy,
        hold: fundamentals.analystRatingHold,
        sell: fundamentals.analystRatingSell,
        strongSell: fundamentals.analystRatingStrongSell,
        total: fundamentals.analystRatingStrongBuy + fundamentals.analystRatingBuy +
               fundamentals.analystRatingHold + fundamentals.analystRatingSell +
               fundamentals.analystRatingStrongSell,
        consensus: getAnalystConsensus(fundamentals),
      },
      ownership: {
        insiderPercent: fundamentals.percentInsiders,
        institutionPercent: fundamentals.percentInstitutions,
        shortPercent: fundamentals.shortPercentFloat,
        shortRatio: fundamentals.shortRatio,
      },
      financialStatements: {
        income: incomeStatements.slice(0, 3),
        balance: balanceSheets.slice(0, 3),
        cashFlow: cashFlowStatements.slice(0, 3),
      },
      buffettScore,
      generatedAt: new Date().toISOString(),
    };

    // Cache result
    analysisCache.set(cacheKey, { data: analysisData, timestamp: Date.now() });

    return NextResponse.json({ success: true, data: analysisData });

  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analysis',
    }, { status: 500 });
  }
}

// Get sector average P/E ratio
function getSectorAveragePE(sector: string): number {
  const sectorPEs: Record<string, number> = {
    'Technology': 28,
    'Healthcare': 22,
    'Financial Services': 12,
    'Consumer Cyclical': 20,
    'Consumer Defensive': 22,
    'Industrials': 18,
    'Energy': 12,
    'Basic Materials': 14,
    'Real Estate': 35,
    'Utilities': 18,
    'Communication Services': 18,
  };
  return sectorPEs[sector] || 15;
}

// Calculate simple DCF
function calculateSimpleDCF(
  currentEPS: number,
  growthRate: number,
  discountRate: number,
  terminalGrowth: number
): number {
  if (currentEPS <= 0 || growthRate < -0.5) return 0;

  const years = 10;
  let totalPV = 0;
  let eps = currentEPS;

  // Decay growth rate over time
  let currentGrowth = Math.min(growthRate, 0.25); // Cap at 25%

  for (let i = 1; i <= years; i++) {
    eps *= (1 + currentGrowth);
    const pv = eps / Math.pow(1 + discountRate, i);
    totalPV += pv;
    // Decay growth toward terminal rate
    currentGrowth = currentGrowth * 0.9 + terminalGrowth * 0.1;
  }

  // Terminal value
  const terminalValue = (eps * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const terminalPV = terminalValue / Math.pow(1 + discountRate, years);

  return totalPV + terminalPV;
}

// Calculate trend from historical data
function calculateTrend(values: number[]): { direction: string; cagr: number; consistent: boolean } {
  if (values.length < 2) return { direction: 'unknown', cagr: 0, consistent: false };

  // Filter out zeros and reverse (oldest first)
  const validValues = values.filter(v => v !== 0).reverse();
  if (validValues.length < 2) return { direction: 'unknown', cagr: 0, consistent: false };

  const oldest = validValues[0];
  const newest = validValues[validValues.length - 1];
  const years = validValues.length - 1;

  // CAGR
  const cagr = oldest > 0 ? (Math.pow(newest / oldest, 1 / years) - 1) * 100 : 0;

  // Check consistency (all positive or all negative changes)
  let increases = 0;
  let decreases = 0;
  for (let i = 1; i < validValues.length; i++) {
    if (validValues[i] > validValues[i - 1]) increases++;
    else if (validValues[i] < validValues[i - 1]) decreases++;
  }

  return {
    direction: cagr > 5 ? 'up' : cagr < -5 ? 'down' : 'flat',
    cagr,
    consistent: increases >= validValues.length - 2 || decreases >= validValues.length - 2,
  };
}

// Buffett-style scoring (mirrors scanner scoring.ts)
function calculateBuffettScore(f: any, currentPrice: number) {
  const breakdown: Array<{ category: string; metric: string; value: string; points: number; maxPoints: number }> = [];
  let total = 50; // Base score

  // 1. PROFITABILITY & MOAT (30 pts)
  const roe = f.returnOnEquity;
  const roePoints = roe > 30 ? 12 : roe > 20 ? 9 : roe > 15 ? 6 : roe > 10 ? 3 : roe < 0 ? -8 : 0;
  breakdown.push({ category: 'Profitability', metric: 'ROE', value: `${roe.toFixed(1)}%`, points: roePoints, maxPoints: 12 });
  total += roePoints;

  const pm = f.profitMargin;
  const pmPoints = pm > 25 ? 10 : pm > 15 ? 7 : pm > 10 ? 4 : pm > 5 ? 2 : pm < 0 ? -8 : 0;
  breakdown.push({ category: 'Profitability', metric: 'Profit Margin', value: `${pm.toFixed(1)}%`, points: pmPoints, maxPoints: 10 });
  total += pmPoints;

  const om = f.operatingMargin;
  const omPoints = om > 25 ? 8 : om > 15 ? 5 : om > 10 ? 3 : om < 0 ? -5 : 0;
  breakdown.push({ category: 'Profitability', metric: 'Operating Margin', value: `${om.toFixed(1)}%`, points: omPoints, maxPoints: 8 });
  total += omPoints;

  // 2. VALUATION (25 pts)
  const pe = f.peRatio;
  const pePoints = pe > 0 ? (pe < 12 ? 10 : pe < 18 ? 7 : pe < 25 ? 3 : pe > 60 ? -12 : pe > 40 ? -8 : 0) : 0;
  breakdown.push({ category: 'Valuation', metric: 'P/E Ratio', value: pe > 0 ? pe.toFixed(1) : 'N/A', points: pePoints, maxPoints: 10 });
  total += pePoints;

  const peg = f.pegRatio;
  const pegPoints = peg > 0 ? (peg < 1 ? 8 : peg < 1.5 ? 5 : peg < 2 ? 2 : peg > 3 ? -5 : 0) : 0;
  breakdown.push({ category: 'Valuation', metric: 'PEG Ratio', value: peg > 0 ? peg.toFixed(2) : 'N/A', points: pegPoints, maxPoints: 8 });
  total += pegPoints;

  const pb = f.priceToBook;
  const pbPoints = pb > 0 ? (pb < 1.5 ? 4 : pb < 3 ? 2 : pb > 10 ? -3 : 0) : 0;
  breakdown.push({ category: 'Valuation', metric: 'P/B Ratio', value: pb > 0 ? pb.toFixed(2) : 'N/A', points: pbPoints, maxPoints: 4 });
  total += pbPoints;

  const ps = f.priceToSales;
  const psPoints = ps > 0 ? (ps < 2 ? 3 : ps < 5 ? 1 : ps > 15 ? -3 : 0) : 0;
  breakdown.push({ category: 'Valuation', metric: 'P/S Ratio', value: ps > 0 ? ps.toFixed(2) : 'N/A', points: psPoints, maxPoints: 3 });
  total += psPoints;

  // 3. FINANCIAL HEALTH (15 pts)
  const evEbitda = f.evToEbitda;
  const evPoints = evEbitda > 0 ? (evEbitda < 8 ? 8 : evEbitda < 12 ? 5 : evEbitda < 18 ? 2 : evEbitda > 25 ? -5 : 0) : 0;
  breakdown.push({ category: 'Financial Health', metric: 'EV/EBITDA', value: evEbitda > 0 ? evEbitda.toFixed(1) : 'N/A', points: evPoints, maxPoints: 8 });
  total += evPoints;

  const beta = f.beta;
  const betaPoints = beta > 0 ? (beta < 0.8 ? 4 : beta < 1.2 ? 2 : beta > 1.8 ? -4 : 0) : 0;
  breakdown.push({ category: 'Financial Health', metric: 'Beta', value: beta > 0 ? beta.toFixed(2) : 'N/A', points: betaPoints, maxPoints: 4 });
  total += betaPoints;

  // Margin stress penalty
  const stressPoints = (pm > 0 && pm < 3 && om > 0 && om < 5) ? -3 : 0;
  if (stressPoints !== 0) {
    breakdown.push({ category: 'Financial Health', metric: 'Margin Stress', value: 'Low margins', points: stressPoints, maxPoints: 3 });
    total += stressPoints;
  }

  // 4. GROWTH (15 pts)
  const eg = f.quarterlyEarningsGrowth;
  const egPoints = eg > 25 ? 7 : eg > 15 ? 5 : eg > 5 ? 3 : eg < -15 ? -5 : eg < -5 ? -2 : 0;
  breakdown.push({ category: 'Growth', metric: 'Earnings Growth', value: `${eg.toFixed(1)}%`, points: egPoints, maxPoints: 7 });
  total += egPoints;

  const rg = f.quarterlyRevenueGrowth;
  const rgPoints = rg > 20 ? 5 : rg > 10 ? 4 : rg > 5 ? 2 : rg < -10 ? -4 : rg < 0 ? -1 : 0;
  breakdown.push({ category: 'Growth', metric: 'Revenue Growth', value: `${rg.toFixed(1)}%`, points: rgPoints, maxPoints: 5 });
  total += rgPoints;

  // Growth combo bonus
  const growthBonus = (eg > 10 && rg > 10) ? 3 : 0;
  if (growthBonus > 0) {
    breakdown.push({ category: 'Growth', metric: 'Growth Combo', value: 'Both >10%', points: growthBonus, maxPoints: 3 });
    total += growthBonus;
  }

  // 5. ANALYST UPSIDE (5 pts)
  const targetPrice = f.analystTargetPrice;
  const upside = currentPrice > 0 && targetPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;
  const upsidePoints = upside > 30 ? 5 : upside > 15 ? 3 : upside > 5 ? 1 : upside < -15 ? -3 : 0;
  breakdown.push({ category: 'Analyst', metric: 'Upside to Target', value: `${upside.toFixed(1)}%`, points: upsidePoints, maxPoints: 5 });
  total += upsidePoints;

  // 6. DIVIDENDS (5 pts)
  const dy = f.dividendYield;
  const dyPoints = dy > 4 ? 5 : dy > 2.5 ? 3 : dy > 1 ? 1 : 0;
  breakdown.push({ category: 'Dividends', metric: 'Dividend Yield', value: dy > 0 ? `${dy.toFixed(2)}%` : 'None', points: dyPoints, maxPoints: 5 });
  total += dyPoints;

  // 7. 52-WEEK POSITION (5 pts)
  const w52High = f.week52High;
  const w52Low = f.week52Low;
  let w52Pct = 50;
  if (w52High > w52Low && currentPrice > 0) {
    w52Pct = ((currentPrice - w52Low) / (w52High - w52Low)) * 100;
  }
  const w52Points = w52Pct < 25 ? 5 : w52Pct < 40 ? 3 : w52Pct < 50 ? 1 : w52Pct > 95 ? -3 : 0;
  breakdown.push({ category: '52-Week', metric: 'Position in Range', value: `${w52Pct.toFixed(0)}%`, points: w52Points, maxPoints: 5 });
  total += w52Points;

  // Clamp
  total = Math.max(0, Math.min(100, total));

  const rating = total >= 75 ? 'Strong Buy' : total >= 60 ? 'Buy' : total >= 45 ? 'Hold' : 'Sell';

  return { total, rating, breakdown };
}

// Get analyst consensus
function getAnalystConsensus(fundamentals: any): string {
  const total = fundamentals.analystRatingStrongBuy + fundamentals.analystRatingBuy +
                fundamentals.analystRatingHold + fundamentals.analystRatingSell +
                fundamentals.analystRatingStrongSell;

  if (total === 0) return 'No Coverage';

  const buyPercent = (fundamentals.analystRatingStrongBuy + fundamentals.analystRatingBuy) / total;
  const sellPercent = (fundamentals.analystRatingSell + fundamentals.analystRatingStrongSell) / total;

  if (buyPercent >= 0.7) return 'Strong Buy';
  if (buyPercent >= 0.5) return 'Buy';
  if (sellPercent >= 0.5) return 'Sell';
  if (sellPercent >= 0.7) return 'Strong Sell';
  return 'Hold';
}
