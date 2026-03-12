import { fetchOverview, fetchGlobalQuote, parseNumber } from '../lib/alphaVantage';
import { calculateBuyScore, getRating, getMarketCapCategory, generateReasons, generateRisks } from '../lib/scoring';
import type { Ticker, AlphaVantageFundamentals, ScoredStock, Checkpoint } from '../lib/types';
import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINT_FILE = path.join(__dirname, '../../..', 'data', '.checkpoint-fundamentals.json');

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      // Only resume if checkpoint is less than 24 hours old
      const age = Date.now() - new Date(data.timestamp).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        console.log(`Resuming from checkpoint: ${data.completedSymbols.length} already processed`);
        return data;
      }
    }
  } catch {
    // Ignore checkpoint errors
  }
  return null;
}

function saveCheckpoint(completed: string[], results: Record<string, any>) {
  const checkpoint: Checkpoint = {
    phase: 'fundamentals',
    completedSymbols: completed,
    results,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint));
}

function clearCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch {
    // Ignore
  }
}

// Mega caps to exclude from hidden gems
const MEGA_CAP_SYMBOLS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'JNJ',
  'V', 'UNH', 'XOM', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'MRK', 'PEP', 'KO',
  'COST', 'WMT', 'BAC', 'PFE', 'NFLX', 'DIS', 'VZ', 'T', 'CMCSA', 'BRK',
]);

export async function screenFundamentals(
  tickers: Ticker[],
  topN = 300
): Promise<{ candidates: ScoredStock[]; allFundamentals: Record<string, AlphaVantageFundamentals> }> {
  console.log(`Phase 2: Screening ${tickers.length} tickers for fundamentals...`);
  console.log(`Target: top ${topN} candidates for deep analysis`);

  const checkpoint = loadCheckpoint();
  const completedSet = new Set(checkpoint?.completedSymbols || []);
  const fundamentalsMap: Record<string, AlphaVantageFundamentals> = checkpoint?.results || {};
  const errors: string[] = [];
  let processed = completedSet.size;
  const startTime = Date.now();

  for (const ticker of tickers) {
    if (completedSet.has(ticker.symbol)) continue;

    try {
      const data = await fetchOverview(ticker.symbol);

      if (data) {
        const marketCap = parseNumber(data.MarketCapitalization);

        // Skip only if market cap is completely missing or zero
        if (marketCap <= 0) {
          completedSet.add(ticker.symbol);
          processed++;
          continue;
        }

        const fundamentals: AlphaVantageFundamentals = {
          symbol: data.Symbol,
          name: data.Name || ticker.name,
          sector: data.Sector || 'Unknown',
          industry: data.Industry || 'Unknown',
          marketCap,
          peRatio: parseNumber(data.PERatio),
          pegRatio: parseNumber(data.PEGRatio),
          pbRatio: parseNumber(data.PriceToBookRatio),
          roe: parseNumber(data.ReturnOnEquityTTM) * 100,
          profitMargin: parseNumber(data.ProfitMargin) * 100,
          operatingMargin: parseNumber(data.OperatingMarginTTM) * 100,
          dividendYield: parseNumber(data.DividendYield) * 100,
          eps: parseNumber(data.EPS),
          analystTargetPrice: parseNumber(data.AnalystTargetPrice),
          week52High: parseNumber(data['52WeekHigh']),
          week52Low: parseNumber(data['52WeekLow']),
          beta: parseNumber(data.Beta),
          revenueGrowth: parseNumber(data.QuarterlyRevenueGrowthYOY) * 100,
          earningsGrowth: parseNumber(data.QuarterlyEarningsGrowthYOY) * 100,
          priceToSales: parseNumber(data.PriceToSalesRatioTTM),
          evToEbitda: parseNumber(data.EVToEBITDA),
        };

        fundamentalsMap[ticker.symbol] = fundamentals;
      }

      completedSet.add(ticker.symbol);
      processed++;

      // Progress logging every 100 stocks
      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const rate = processed / Math.max(elapsed, 0.1);
        const remaining = (tickers.length - processed) / rate;
        console.log(
          `  Progress: ${processed}/${tickers.length} (${((processed / tickers.length) * 100).toFixed(1)}%) | ` +
          `${Object.keys(fundamentalsMap).length} valid | ` +
          `~${remaining.toFixed(0)} min remaining`
        );

        // Save checkpoint every 100 stocks
        saveCheckpoint(Array.from(completedSet), fundamentalsMap);
      }
    } catch (err) {
      errors.push(`${ticker.symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      completedSet.add(ticker.symbol);
      processed++;
    }
  }

  console.log(`Phase 2 screening complete: ${Object.keys(fundamentalsMap).length} stocks with valid data`);
  if (errors.length > 0) {
    console.log(`  ${errors.length} errors (sample: ${errors.slice(0, 3).join(', ')})`);
  }

  // Now score all stocks with fundamentals
  const scored: ScoredStock[] = [];

  for (const [symbol, fund] of Object.entries(fundamentalsMap)) {
    const buyScore = calculateBuyScore(
      0, // No day change data yet
      fund.peRatio,
      fund.dividendYield,
      fund.marketCap,
      fund,
      fund.analystTargetPrice > 0 ? fund.week52Low + (fund.week52High - fund.week52Low) * 0.5 : undefined
    );

    const currentPriceEstimate = fund.week52Low + (fund.week52High - fund.week52Low) * 0.5;
    const targetPrice = fund.analystTargetPrice || currentPriceEstimate * 1.15;
    const upside = currentPriceEstimate > 0
      ? ((targetPrice - currentPriceEstimate) / currentPriceEstimate) * 100
      : 0;

    const below52WeekHigh = fund.week52High > 0
      ? ((fund.week52High - currentPriceEstimate) / fund.week52High) * 100
      : 0;
    const above52WeekLow = fund.week52Low > 0
      ? ((currentPriceEstimate - fund.week52Low) / fund.week52Low) * 100
      : 0;

    const effectivePE = fund.peRatio;
    const valuationStatus: 'undervalued' | 'fair' | 'overvalued' =
      effectivePE > 0 && effectivePE < 15 ? 'undervalued' :
      effectivePE > 30 ? 'overvalued' : 'fair';

    const stock: ScoredStock = {
      symbol,
      name: fund.name,
      sector: fund.sector,
      industry: fund.industry,
      currentPrice: currentPriceEstimate,
      targetPrice,
      upside,
      buyScore,
      rating: getRating(buyScore),
      confidence: Math.min(80, 50 + buyScore / 3),
      marketCap: fund.marketCap,
      marketCapCategory: getMarketCapCategory(fund.marketCap),
      pe: fund.peRatio,
      pegRatio: fund.pegRatio,
      pbRatio: fund.pbRatio,
      roe: fund.roe,
      profitMargin: fund.profitMargin,
      dividendYield: fund.dividendYield,
      priceToSales: fund.priceToSales,
      beta: fund.beta,
      below52WeekHigh,
      above52WeekLow,
      reasonsToConsider: generateReasons({ pe: fund.peRatio, dividendYield: fund.dividendYield, upside, below52WeekHigh, marketCapCategory: getMarketCapCategory(fund.marketCap) }, fund),
      risks: generateRisks({ pe: fund.peRatio, marketCapCategory: getMarketCapCategory(fund.marketCap) }, fund),
      valuationStatus,
      technicalScore: null,
    };

    scored.push(stock);
  }

  // Sort by buy score and take top N
  scored.sort((a, b) => b.buyScore - a.buyScore);
  const candidates = scored.slice(0, topN);

  console.log(`Selected top ${candidates.length} candidates for technical analysis`);
  console.log(`  Score range: ${candidates[0]?.buyScore || 0} - ${candidates[candidates.length - 1]?.buyScore || 0}`);

  // Clear checkpoint on success
  clearCheckpoint();

  return { candidates, allFundamentals: fundamentalsMap };
}

export { MEGA_CAP_SYMBOLS };
