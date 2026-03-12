import type { AlphaVantageFundamentals, ScoredStock } from './types';

export function calculateBuyScore(
  dayChangePercent: number,
  pe: number,
  dividendYield: number,
  marketCap: number,
  fundamentals?: AlphaVantageFundamentals,
  currentPrice?: number
): number {
  let score = 50;

  // === PROFITABILITY & MOAT (30 points max) ===
  // Buffett's #1 signal: consistently high returns = durable competitive advantage
  if (fundamentals?.roe) {
    if (fundamentals.roe > 30) score += 12;
    else if (fundamentals.roe > 20) score += 9;
    else if (fundamentals.roe > 15) score += 6;
    else if (fundamentals.roe > 10) score += 3;
    else if (fundamentals.roe < 0) score -= 8;
  }

  if (fundamentals?.profitMargin) {
    if (fundamentals.profitMargin > 25) score += 10;
    else if (fundamentals.profitMargin > 15) score += 7;
    else if (fundamentals.profitMargin > 10) score += 4;
    else if (fundamentals.profitMargin > 5) score += 2;
    else if (fundamentals.profitMargin < 0) score -= 8;
  }

  if (fundamentals?.operatingMargin) {
    if (fundamentals.operatingMargin > 25) score += 8;
    else if (fundamentals.operatingMargin > 15) score += 5;
    else if (fundamentals.operatingMargin > 10) score += 3;
    else if (fundamentals.operatingMargin < 0) score -= 5;
  }

  // === VALUATION / MARGIN OF SAFETY (25 points max) ===
  // Buy wonderful companies at fair prices, not fair companies at wonderful prices
  const effectivePE = fundamentals?.peRatio || pe;
  if (effectivePE > 0 && effectivePE < 12) score += 10;
  else if (effectivePE > 0 && effectivePE < 18) score += 7;
  else if (effectivePE > 0 && effectivePE < 25) score += 3;
  else if (effectivePE > 40) score -= 8;
  else if (effectivePE > 60) score -= 12;

  if (fundamentals?.pegRatio) {
    if (fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1) score += 8;
    else if (fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1.5) score += 5;
    else if (fundamentals.pegRatio > 0 && fundamentals.pegRatio < 2) score += 2;
    else if (fundamentals.pegRatio > 3) score -= 5;
  }

  if (fundamentals?.pbRatio) {
    if (fundamentals.pbRatio > 0 && fundamentals.pbRatio < 1.5) score += 4;
    else if (fundamentals.pbRatio > 0 && fundamentals.pbRatio < 3) score += 2;
    else if (fundamentals.pbRatio > 10) score -= 3;
  }

  if (fundamentals?.priceToSales) {
    if (fundamentals.priceToSales > 0 && fundamentals.priceToSales < 2) score += 3;
    else if (fundamentals.priceToSales > 0 && fundamentals.priceToSales < 5) score += 1;
    else if (fundamentals.priceToSales > 15) score -= 3;
  }

  // === FINANCIAL HEALTH (15 points max) ===
  // Buffett avoids leveraged companies — debt kills in downturns
  if (fundamentals?.evToEbitda) {
    if (fundamentals.evToEbitda > 0 && fundamentals.evToEbitda < 8) score += 8;
    else if (fundamentals.evToEbitda > 0 && fundamentals.evToEbitda < 12) score += 5;
    else if (fundamentals.evToEbitda > 0 && fundamentals.evToEbitda < 18) score += 2;
    else if (fundamentals.evToEbitda > 25) score -= 5;
  }

  // Beta as proxy for business stability — Buffett wants predictable businesses
  if (fundamentals?.beta) {
    if (fundamentals.beta > 0 && fundamentals.beta < 0.8) score += 4;
    else if (fundamentals.beta > 0 && fundamentals.beta < 1.2) score += 2;
    else if (fundamentals.beta > 1.8) score -= 4;
  }

  // Penalize if both margins are thin — fragile business
  if (fundamentals?.profitMargin && fundamentals?.operatingMargin) {
    if (fundamentals.profitMargin < 3 && fundamentals.operatingMargin < 5) {
      score -= 3;
    }
  }

  // === GROWTH (15 points max) ===
  // Steady growth > explosive growth. Buffett wants compounders.
  if (fundamentals?.earningsGrowth) {
    if (fundamentals.earningsGrowth > 25) score += 7;
    else if (fundamentals.earningsGrowth > 15) score += 5;
    else if (fundamentals.earningsGrowth > 5) score += 3;
    else if (fundamentals.earningsGrowth < -15) score -= 5;
    else if (fundamentals.earningsGrowth < -5) score -= 2;
  }

  if (fundamentals?.revenueGrowth) {
    if (fundamentals.revenueGrowth > 20) score += 5;
    else if (fundamentals.revenueGrowth > 10) score += 4;
    else if (fundamentals.revenueGrowth > 5) score += 2;
    else if (fundamentals.revenueGrowth < -10) score -= 4;
    else if (fundamentals.revenueGrowth < 0) score -= 1;
  }

  // Bonus: growing revenue AND earnings together = real growth, not accounting tricks
  if (fundamentals?.earningsGrowth && fundamentals?.revenueGrowth) {
    if (fundamentals.earningsGrowth > 10 && fundamentals.revenueGrowth > 10) {
      score += 3;
    }
  }

  // === ANALYST UPSIDE (5 points max) ===
  // Minor signal — Buffett doesn't follow analysts but targets indicate market sentiment
  if (fundamentals?.analystTargetPrice && currentPrice && currentPrice > 0) {
    const upside = ((fundamentals.analystTargetPrice - currentPrice) / currentPrice) * 100;
    if (upside > 30) score += 5;
    else if (upside > 15) score += 3;
    else if (upside > 5) score += 1;
    else if (upside < -15) score -= 3;
  }

  // === DIVIDENDS (5 points max) ===
  // Nice to have, not essential. Buffett prefers reinvestment over payout.
  const effectiveDividend = fundamentals?.dividendYield || dividendYield;
  if (effectiveDividend > 4) score += 5;
  else if (effectiveDividend > 2.5) score += 3;
  else if (effectiveDividend > 1) score += 1;

  // === 52-WEEK POSITION (5 points max) ===
  // Buying near lows = more margin of safety (be greedy when others are fearful)
  if (fundamentals?.week52High && fundamentals?.week52Low && currentPrice) {
    const range = fundamentals.week52High - fundamentals.week52Low;
    if (range > 0) {
      const position = (currentPrice - fundamentals.week52Low) / range;
      if (position < 0.25) score += 5;
      else if (position < 0.4) score += 3;
      else if (position < 0.5) score += 1;
      else if (position > 0.95) score -= 3;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getRating(score: number): 'strong_buy' | 'buy' | 'hold' | 'sell' {
  if (score >= 75) return 'strong_buy';
  if (score >= 60) return 'buy';
  if (score >= 45) return 'hold';
  return 'sell';
}

export function getMarketCapCategory(marketCap: number): string {
  if (marketCap >= 200e9) return 'Mega Cap';
  if (marketCap >= 10e9) return 'Large Cap';
  if (marketCap >= 2e9) return 'Mid Cap';
  if (marketCap >= 300e6) return 'Small Cap';
  return 'Micro Cap';
}

export function generateReasons(stock: Partial<ScoredStock>, fundamentals?: AlphaVantageFundamentals): string[] {
  const reasons: string[] = [];

  // Profitability signals (most important)
  if (fundamentals?.roe && fundamentals.roe > 20) {
    reasons.push(`Excellent ROE of ${fundamentals.roe.toFixed(1)}% — strong competitive moat`);
  }
  if (fundamentals?.profitMargin && fundamentals.profitMargin > 20) {
    reasons.push(`${fundamentals.profitMargin.toFixed(1)}% profit margin — pricing power`);
  }
  if (fundamentals?.operatingMargin && fundamentals.operatingMargin > 20) {
    reasons.push(`${fundamentals.operatingMargin.toFixed(1)}% operating margin — efficient operations`);
  }

  // Valuation signals
  if (stock.pe && stock.pe > 0 && stock.pe < 15) {
    reasons.push(`P/E of ${stock.pe.toFixed(1)} — attractive margin of safety`);
  }
  if (fundamentals?.pegRatio && fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1) {
    reasons.push(`PEG of ${fundamentals.pegRatio.toFixed(2)} — undervalued relative to growth`);
  }
  if (fundamentals?.pbRatio && fundamentals.pbRatio > 0 && fundamentals.pbRatio < 1.5) {
    reasons.push(`P/B of ${fundamentals.pbRatio.toFixed(1)} — trading near book value`);
  }

  // Financial health
  if (fundamentals?.evToEbitda && fundamentals.evToEbitda > 0 && fundamentals.evToEbitda < 10) {
    reasons.push(`EV/EBITDA of ${fundamentals.evToEbitda.toFixed(1)} — reasonable enterprise value`);
  }
  if (fundamentals?.beta && fundamentals.beta > 0 && fundamentals.beta < 0.8) {
    reasons.push(`Low beta of ${fundamentals.beta.toFixed(2)} — stable, predictable business`);
  }

  // Growth signals
  if (fundamentals?.earningsGrowth && fundamentals.earningsGrowth > 15 &&
      fundamentals?.revenueGrowth && fundamentals.revenueGrowth > 10) {
    reasons.push(`Earnings +${fundamentals.earningsGrowth.toFixed(0)}% and revenue +${fundamentals.revenueGrowth.toFixed(0)}% — real growth`);
  } else if (fundamentals?.earningsGrowth && fundamentals.earningsGrowth > 15) {
    reasons.push(`Earnings growing ${fundamentals.earningsGrowth.toFixed(0)}% YoY`);
  }

  // Dividend
  if (stock.dividendYield && stock.dividendYield > 3) {
    reasons.push(`${stock.dividendYield.toFixed(1)}% dividend yield`);
  }

  // Upside
  if (stock.upside && stock.upside > 20 && fundamentals?.analystTargetPrice) {
    reasons.push(`${stock.upside.toFixed(0)}% upside to $${fundamentals.analystTargetPrice.toFixed(0)} target`);
  }

  // 52-week position
  if (stock.below52WeekHigh && stock.below52WeekHigh > 25) {
    reasons.push(`${stock.below52WeekHigh.toFixed(0)}% below 52-week high — potential bargain`);
  }

  return reasons.slice(0, 5);
}

export function generateRisks(stock: Partial<ScoredStock>, fundamentals?: AlphaVantageFundamentals): string[] {
  const risks: string[] = [];

  // Profitability risks
  if (fundamentals?.profitMargin && fundamentals.profitMargin < 0) {
    risks.push('Currently unprofitable — no margin of safety');
  } else if (fundamentals?.profitMargin && fundamentals.profitMargin < 5 && fundamentals.profitMargin > 0) {
    risks.push(`Thin ${fundamentals.profitMargin.toFixed(1)}% margin — vulnerable to downturns`);
  }
  if (fundamentals?.roe && fundamentals.roe < 5 && fundamentals.roe > 0) {
    risks.push(`Low ROE of ${fundamentals.roe.toFixed(1)}% — weak competitive position`);
  }

  // Valuation risks
  if (stock.pe && stock.pe > 40) {
    risks.push(`P/E of ${stock.pe.toFixed(1)} — expensive, limited margin of safety`);
  }
  if (fundamentals?.pegRatio && fundamentals.pegRatio > 2.5) {
    risks.push(`PEG of ${fundamentals.pegRatio.toFixed(1)} — overvalued relative to growth`);
  }

  // Financial health risks
  if (fundamentals?.evToEbitda && fundamentals.evToEbitda > 20) {
    risks.push(`High EV/EBITDA of ${fundamentals.evToEbitda.toFixed(1)} — may carry significant debt`);
  }
  if (fundamentals?.beta && fundamentals.beta > 1.8) {
    risks.push(`High beta of ${fundamentals.beta.toFixed(2)} — volatile, unpredictable`);
  }

  // Growth risks
  if (fundamentals?.earningsGrowth && fundamentals.earningsGrowth < -15) {
    risks.push(`Earnings declining ${Math.abs(fundamentals.earningsGrowth).toFixed(0)}% — deteriorating business`);
  }
  if (fundamentals?.revenueGrowth && fundamentals.revenueGrowth < -10) {
    risks.push(`Revenue shrinking ${Math.abs(fundamentals.revenueGrowth).toFixed(0)}% — demand problem`);
  }

  // Size risk
  if (stock.marketCapCategory === 'Micro Cap') {
    risks.push('Micro cap — higher volatility, lower liquidity');
  }

  return risks.slice(0, 4);
}
