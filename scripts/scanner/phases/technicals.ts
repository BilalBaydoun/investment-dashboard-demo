import { fetchTechnical, fetchGlobalQuote, parseNumber } from '../lib/alphaVantage';
import type { ScoredStock, TechnicalIndicators } from '../lib/types';
import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINT_FILE = path.join(__dirname, '../../..', 'data', '.checkpoint-technicals.json');

function loadCheckpoint(): { completed: Set<string>; results: Record<string, TechnicalIndicators> } | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8'));
      const age = Date.now() - new Date(data.timestamp).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        console.log(`Resuming technicals from checkpoint: ${data.completedSymbols.length} done`);
        return {
          completed: new Set(data.completedSymbols),
          results: data.results,
        };
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveCheckpoint(completed: string[], results: Record<string, TechnicalIndicators>) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    phase: 'technicals',
    completedSymbols: completed,
    results,
    timestamp: new Date().toISOString(),
  }));
}

function clearCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  } catch { /* ignore */ }
}

function getLatestValue(data: any, key: string): number | null {
  if (!data) return null;
  const entries = data[key];
  if (!entries) return null;
  const dates = Object.keys(entries).sort().reverse();
  if (dates.length === 0) return null;
  const latestEntry = entries[dates[0]];
  // Technical indicators have varying key names
  const value = Object.values(latestEntry)[0];
  return typeof value === 'string' ? parseFloat(value) : null;
}

async function fetchTechnicalsForStock(symbol: string): Promise<TechnicalIndicators> {
  const indicators: TechnicalIndicators = {
    rsi: null,
    macdSignal: 'neutral',
    sma20: null,
    sma50: null,
    ema12: null,
    bbUpper: null,
    bbLower: null,
    bbMiddle: null,
  };

  // Fetch RSI
  const rsiData = await fetchTechnical('RSI', symbol, { time_period: '14' });
  if (rsiData) {
    const key = 'Technical Analysis: RSI';
    const dates = rsiData[key] ? Object.keys(rsiData[key]).sort().reverse() : [];
    if (dates.length > 0) {
      indicators.rsi = parseFloat(rsiData[key][dates[0]].RSI);
    }
  }

  // Fetch MACD
  const macdData = await fetchTechnical('MACD', symbol, {
    fastperiod: '12', slowperiod: '26', signalperiod: '9',
  });
  if (macdData) {
    const key = 'Technical Analysis: MACD';
    const dates = macdData[key] ? Object.keys(macdData[key]).sort().reverse() : [];
    if (dates.length > 0) {
      const macd = parseFloat(macdData[key][dates[0]].MACD);
      const signal = parseFloat(macdData[key][dates[0]].MACD_Signal);
      indicators.macdSignal = macd > signal ? 'bullish' : macd < signal ? 'bearish' : 'neutral';
    }
  }

  // Fetch SMA 20
  const sma20Data = await fetchTechnical('SMA', symbol, { time_period: '20' });
  if (sma20Data) {
    const key = 'Technical Analysis: SMA';
    const dates = sma20Data[key] ? Object.keys(sma20Data[key]).sort().reverse() : [];
    if (dates.length > 0) {
      indicators.sma20 = parseFloat(sma20Data[key][dates[0]].SMA);
    }
  }

  // Fetch SMA 50
  const sma50Data = await fetchTechnical('SMA', symbol, { time_period: '50' });
  if (sma50Data) {
    const key = 'Technical Analysis: SMA';
    const dates = sma50Data[key] ? Object.keys(sma50Data[key]).sort().reverse() : [];
    if (dates.length > 0) {
      indicators.sma50 = parseFloat(sma50Data[key][dates[0]].SMA);
    }
  }

  // Fetch Bollinger Bands
  const bbData = await fetchTechnical('BBANDS', symbol, { time_period: '20' });
  if (bbData) {
    const key = 'Technical Analysis: BBANDS';
    const dates = bbData[key] ? Object.keys(bbData[key]).sort().reverse() : [];
    if (dates.length > 0) {
      indicators.bbUpper = parseFloat(bbData[key][dates[0]]['Real Upper Band']);
      indicators.bbLower = parseFloat(bbData[key][dates[0]]['Real Lower Band']);
      indicators.bbMiddle = parseFloat(bbData[key][dates[0]]['Real Middle Band']);
    }
  }

  return indicators;
}

function calculateTechnicalScore(indicators: TechnicalIndicators, currentPrice: number): number {
  let score = 0;
  let signals = 0;

  // RSI (0-100, below 30 = oversold/buy, above 70 = overbought/sell)
  if (indicators.rsi !== null) {
    signals++;
    if (indicators.rsi < 30) score += 2;
    else if (indicators.rsi < 40) score += 1;
    else if (indicators.rsi > 70) score -= 2;
    else if (indicators.rsi > 60) score -= 1;
  }

  // MACD
  if (indicators.macdSignal !== 'neutral') {
    signals++;
    if (indicators.macdSignal === 'bullish') score += 2;
    else score -= 2;
  }

  // SMA crossover (price above SMA20 and SMA20 above SMA50 = bullish)
  if (indicators.sma20 !== null && indicators.sma50 !== null) {
    signals++;
    if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) score += 2;
    else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) score -= 2;
    else if (currentPrice > indicators.sma20) score += 1;
    else score -= 1;
  }

  // Bollinger Bands position
  if (indicators.bbUpper !== null && indicators.bbLower !== null) {
    signals++;
    if (currentPrice <= indicators.bbLower) score += 2; // Near lower band = potential buy
    else if (currentPrice >= indicators.bbUpper) score -= 2; // Near upper band = potential sell
    else if (indicators.bbMiddle !== null && currentPrice < indicators.bbMiddle) score += 1;
  }

  if (signals === 0) return 0;

  // Normalize to -10 to +10 range
  const maxPossible = signals * 2;
  return Math.round((score / maxPossible) * 10);
}

export async function deepTechnicals(candidates: ScoredStock[]): Promise<ScoredStock[]> {
  console.log(`Phase 3: Deep technical analysis on ${candidates.length} candidates...`);
  console.log(`  This requires ~${candidates.length * 5} API calls (~${Math.ceil(candidates.length * 5 / 75)} min)`);

  const checkpoint = loadCheckpoint();
  const completedSet = checkpoint?.completed || new Set<string>();
  const cachedResults: Record<string, TechnicalIndicators> = checkpoint?.results || {};
  const startTime = Date.now();

  for (let i = 0; i < candidates.length; i++) {
    const stock = candidates[i];

    if (completedSet.has(stock.symbol)) {
      // Apply cached technical score
      const cached = cachedResults[stock.symbol];
      if (cached) {
        const techScore = calculateTechnicalScore(cached, stock.currentPrice);
        stock.technicalScore = techScore;
        stock.buyScore = Math.max(0, Math.min(100, stock.buyScore + techScore));
        stock.confidence = Math.min(95, stock.confidence + 10);
      }
      continue;
    }

    try {
      // Fetch current price first
      const quote = await fetchGlobalQuote(stock.symbol);
      if (quote) {
        stock.currentPrice = parseFloat(quote['05. price']) || stock.currentPrice;
        const prevClose = parseFloat(quote['08. previous close']) || stock.currentPrice;
        const change = stock.currentPrice - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        // Recalculate upside with real price
        if (stock.targetPrice > 0) {
          stock.upside = ((stock.targetPrice - stock.currentPrice) / stock.currentPrice) * 100;
        }
      }

      const indicators = await fetchTechnicalsForStock(stock.symbol);
      const techScore = calculateTechnicalScore(indicators, stock.currentPrice);

      stock.technicalScore = techScore;
      stock.buyScore = Math.max(0, Math.min(100, stock.buyScore + techScore));
      stock.rating = stock.buyScore >= 75 ? 'strong_buy' :
                     stock.buyScore >= 60 ? 'buy' :
                     stock.buyScore >= 45 ? 'hold' : 'sell';
      stock.confidence = Math.min(95, stock.confidence + 10);

      completedSet.add(stock.symbol);
      cachedResults[stock.symbol] = indicators;

      // Progress logging
      if ((i + 1) % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const rate = (i + 1) / Math.max(elapsed, 0.1);
        const remaining = (candidates.length - i - 1) / rate;
        console.log(
          `  Progress: ${i + 1}/${candidates.length} | ~${remaining.toFixed(0)} min remaining`
        );
        saveCheckpoint(Array.from(completedSet), cachedResults);
      }
    } catch (err) {
      console.warn(`  Error analyzing ${stock.symbol}: ${err instanceof Error ? err.message : 'Unknown'}`);
      completedSet.add(stock.symbol);
    }
  }

  // Re-sort after technical adjustments
  candidates.sort((a, b) => b.buyScore - a.buyScore);

  console.log(`Phase 3 complete: Technical analysis done for ${completedSet.size} stocks`);
  clearCheckpoint();

  return candidates;
}
